// ============================================================================
// Emergency routes — mounted at /emergency
//
//   POST /emergency/alerts               press SOS
//   GET  /emergency/alerts               the caller's own alerts
//   POST /emergency/alerts/:id/cancel    "that was a mistake" — owner only
//   POST /emergency/alerts/:id/resolve   "this is handled" — owner or family
//   POST /emergency/alerts/:id/acknowledge  "I've seen this" — family only, stops escalation
//   PATCH /emergency/alerts/:id/location attach a fresh fix that landed after send — owner only, any status
//   GET  /emergency/family/alerts        active alerts for linked elderly users
//   GET  /emergency/family/alerts/history recent resolved/cancelled alerts, last 7 days
//   POST /emergency/locations            record one GPS reading
//   POST /emergency/device-tokens        register this device for push
//
// Phase 1, step 3: emergency contact notification and escalation. No
// geofencing, no map UI (Phase 3). See BUILD_LOG.md.
// ============================================================================

import { Router } from 'express';
import { badRequest, notFound, forbidden, conflict } from '../shared/http/errors.js';
import { requireAuth, requireRole } from '../shared/auth/middleware.js';
import {
  toPublicAlert,
  findActiveSosAlert,
  createSosAlert,
  findActiveFallAlert,
  createFallAlert,
  listAlertsForUser,
  findAlertById,
  cancelAlert,
  resolveAlert,
  acknowledgeAlert,
  attachAlertLocation,
  findFamilyLink,
  listActiveFamilyAlerts,
  listFamilyAlertHistory,
} from './alerts.js';
import { createLocation, toPublicLocation } from './locations.js';
import { registerDeviceToken } from './deviceTokens.js';
import { advanceFanout } from './notifications/fanout.js';
import { ambulanceRouter } from './ambulance/routes.js';
import { disasterRouter } from './disaster/routes.js';
import {
  validateListQuery,
  validateCloseAlertBody,
  validateHistoryQuery,
  validateSosAlertBody,
  validateAttachLocationBody,
  validateCreateLocationBody,
  validateRegisterDeviceTokenBody,
} from './validate.js';

export const emergencyRouter = Router();

emergencyRouter.use('/ambulance', ambulanceRouter);
emergencyRouter.use('/disaster-alerts', disasterRouter);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireAlertId(req) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) {
    throw badRequest('validation_failed', 'Alert id is not a valid identifier.', {
      details: [{ field: 'id', message: 'Must be a UUID.' }],
    });
  }
  return id;
}

// ---------------------------------------------------------------------------
// POST /emergency/alerts
// ---------------------------------------------------------------------------

emergencyRouter.post('/alerts', requireAuth, async (req, res) => {
  const location = validateSosAlertBody(req.body);

  // One active SOS per person at a time. A second press while one is already
  // open is not a second emergency — it is almost always the same emergency
  // pressed twice, or a retry after a slow response. Returning the existing
  // alert instead of creating another means the app can treat this as
  // reassurance ("help is already on the way") rather than an error.
  const existing = await findActiveSosAlert(req.user.id);
  if (existing) {
    throw conflict('sos_already_active', 'An SOS alert is already active for this account.', {
      alert: toPublicAlert(existing),
    });
  }

  const alert = await createSosAlert(req.user.id, location);

  // Fire-and-forget: notifying contact 1 must never delay the response to the
  // person who just pressed SOS, same "never a precondition" principle as the
  // GPS capture above. Errors are logged, not thrown — a notification problem
  // is not a reason to fail the alert that already exists.
  advanceFanout(alert.id).catch((err) =>
    console.error(`Initial fanout failed for alert ${alert.id}:`, err)
  );

  res.status(201).json({ status: 'ok', alert: toPublicAlert(alert) });
});

// ---------------------------------------------------------------------------
// POST /emergency/alerts/fall (and POST /emergency/fall)
// ---------------------------------------------------------------------------
const handleFallAlert = async (req, res) => {
  let location = null;
  let message = null;

  if (req.body && typeof req.body === 'object') {
    location = validateSosAlertBody(req.body);
    if (typeof req.body.message === 'string' && req.body.message.trim()) {
      message = req.body.message.trim();
    }
  }

  const existing = await findActiveFallAlert(req.user.id);
  if (existing) {
    throw conflict('fall_already_active', 'A fall alert is already active for this account.', {
      alert: toPublicAlert(existing),
    });
  }

  const alert = await createFallAlert(req.user.id, location, message);

  advanceFanout(alert.id).catch((err) =>
    console.error(`Initial fanout failed for fall alert ${alert.id}:`, err)
  );

  res.status(201).json({ status: 'ok', alert: toPublicAlert(alert) });
};

emergencyRouter.post('/alerts/fall', requireAuth, handleFallAlert);
emergencyRouter.post('/fall', requireAuth, handleFallAlert);

// ---------------------------------------------------------------------------
// GET /emergency/alerts
// ---------------------------------------------------------------------------

emergencyRouter.get('/alerts', requireAuth, async (req, res) => {
  const { status, limit } = validateListQuery(req.query);
  const alerts = await listAlertsForUser(req.user.id, { status, limit });

  res.json({ status: 'ok', count: alerts.length, alerts: alerts.map(toPublicAlert) });
});

// ---------------------------------------------------------------------------
// POST /emergency/alerts/:id/cancel — owner only
// ---------------------------------------------------------------------------

emergencyRouter.post('/alerts/:id/cancel', requireAuth, async (req, res) => {
  const id = requireAlertId(req);
  const { note } = validateCloseAlertBody(req.body);

  const alert = await findAlertById(id);
  if (!alert) throw notFound('alert_not_found', 'No alert with that id.');

  // Only the person who pressed SOS can say it was a mistake. A family
  // member who thinks it's a false alarm uses resolve, not cancel — that
  // distinction is deliberate, see BUILD_LOG.md.
  if (alert.user_id !== req.user.id) {
    throw forbidden('not_alert_owner', 'Only the person who triggered this alert can cancel it.');
  }

  const updated = await cancelAlert(id, req.user.id, note);
  if (!updated) {
    throw conflict('alert_not_active', 'This alert is no longer active.');
  }

  res.json({ status: 'ok', alert: toPublicAlert(updated) });
});

// ---------------------------------------------------------------------------
// POST /emergency/alerts/:id/resolve — owner or a permitted family member
// ---------------------------------------------------------------------------

emergencyRouter.post('/alerts/:id/resolve', requireAuth, async (req, res) => {
  const id = requireAlertId(req);
  const { note } = validateCloseAlertBody(req.body);

  const alert = await findAlertById(id);
  if (!alert) throw notFound('alert_not_found', 'No alert with that id.');

  if (alert.user_id !== req.user.id) {
    const link = await findFamilyLink(req.user.id, alert.user_id);
    const permitted = link && link.status === 'active' && link.can_acknowledge_alerts;

    if (!permitted) {
      throw forbidden(
        'not_permitted',
        'You are not permitted to resolve alerts for this person.'
      );
    }
  }

  const updated = await resolveAlert(id, req.user.id, note);
  if (!updated) {
    throw conflict('alert_not_active', 'This alert is no longer active.');
  }

  res.json({ status: 'ok', alert: toPublicAlert(updated) });
});

// ---------------------------------------------------------------------------
// POST /emergency/alerts/:id/acknowledge — a permitted family member only.
// Does not close the alert; stops it from escalating further.
// ---------------------------------------------------------------------------

emergencyRouter.post('/alerts/:id/acknowledge', requireAuth, async (req, res) => {
  const id = requireAlertId(req);

  const alert = await findAlertById(id);
  if (!alert) throw notFound('alert_not_found', 'No alert with that id.');

  // No owner branch here on purpose: chk_not_self in the schema means a
  // family_links row from someone to themselves can never exist, so the
  // owner is automatically excluded by this same check, not a special case.
  const link = await findFamilyLink(req.user.id, alert.user_id);
  const permitted = link && link.status === 'active' && link.can_acknowledge_alerts;
  if (!permitted) {
    throw forbidden('not_permitted', 'You are not permitted to acknowledge alerts for this person.');
  }

  const updated = await acknowledgeAlert(id, req.user.id);
  if (!updated) {
    // Re-read rather than trust the copy fetched above, which may now be
    // stale — distinguishes "already closed" from "someone else got there
    // first" for the error the app shows.
    const current = await findAlertById(id);
    if (current.status !== 'active') {
      throw conflict('alert_not_active', 'This alert is no longer active.');
    }
    throw conflict('alert_already_acknowledged', 'This alert has already been acknowledged.', {
      alert: toPublicAlert(current),
    });
  }

  res.json({ status: 'ok', alert: toPublicAlert(updated) });
});

// ---------------------------------------------------------------------------
// PATCH /emergency/alerts/:id/location — owner only, any status.
//
// Phase 1 step 4: the SOS-time capture keeps trying for a fresh fix past the
// 4.5s send deadline (see ElderlyHomeScreen's SOS_LOCATION_ASYNC_CEILING_MS).
// When one lands, this is how it reaches the alert already sent. Deliberately
// not restricted to status = 'active' — a fix landing after the alert was
// cancelled or resolved is still attached, so the record isn't stuck on "no
// location" or an approximate reading just because the timing lost a race.
// ---------------------------------------------------------------------------

emergencyRouter.patch('/alerts/:id/location', requireAuth, async (req, res) => {
  const id = requireAlertId(req);
  const location = validateAttachLocationBody(req.body);

  const alert = await findAlertById(id);
  if (!alert) throw notFound('alert_not_found', 'No alert with that id.');

  if (alert.user_id !== req.user.id) {
    throw forbidden('not_alert_owner', 'Only the person who triggered this alert can attach a location to it.');
  }

  const updated = await attachAlertLocation(id, location);
  res.json({ status: 'ok', alert: toPublicAlert(updated) });
});

// ---------------------------------------------------------------------------
// GET /emergency/family/alerts — family role only
// ---------------------------------------------------------------------------

emergencyRouter.get('/family/alerts', requireAuth, requireRole('family'), async (req, res) => {
  const alerts = await listActiveFamilyAlerts(req.user.id);
  res.json({ status: 'ok', count: alerts.length, alerts });
});

// ---------------------------------------------------------------------------
// GET /emergency/family/alerts/history — family role only
// ---------------------------------------------------------------------------

emergencyRouter.get(
  '/family/alerts/history',
  requireAuth,
  requireRole('family'),
  async (req, res) => {
    const { limit } = validateHistoryQuery(req.query);
    const alerts = await listFamilyAlertHistory(req.user.id, { limit });
    res.json({ status: 'ok', count: alerts.length, alerts });
  }
);

// ---------------------------------------------------------------------------
// POST /emergency/locations — no role check, same reasoning as POST /alerts:
// scoped to the caller's own user_id, restricted by UI, not by role here.
// ---------------------------------------------------------------------------

emergencyRouter.post('/locations', requireAuth, async (req, res) => {
  const location = validateCreateLocationBody(req.body);
  const row = await createLocation(req.user.id, location);

  // row is undefined when ON CONFLICT DO NOTHING silently dropped a duplicate
  // reading (same user_id + recorded_at, most often a queued retry resending
  // something already written) — that is a successful no-op, not an error,
  // so the client's queue must still see a 2xx and drop the item.
  if (!row) {
    res.status(200).json({ status: 'ok', location: null, deduplicated: true });
    return;
  }

  res.status(201).json({ status: 'ok', location: toPublicLocation(row) });
});

// ---------------------------------------------------------------------------
// POST /emergency/device-tokens — no role check, same reasoning as the two
// endpoints above: scoped to the caller's own account.
// ---------------------------------------------------------------------------

emergencyRouter.post('/device-tokens', requireAuth, async (req, res) => {
  const deviceToken = validateRegisterDeviceTokenBody(req.body);
  const row = await registerDeviceToken(req.user.id, deviceToken);
  res.status(201).json({ status: 'ok', deviceToken: row });
});
