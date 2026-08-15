// ============================================================================
// Emergency routes — mounted at /emergency
//
//   POST /emergency/alerts               press SOS
//   GET  /emergency/alerts               the caller's own alerts
//   POST /emergency/alerts/:id/cancel    "that was a mistake" — owner only
//   POST /emergency/alerts/:id/resolve   "this is handled" — owner or family
//   GET  /emergency/family/alerts        active alerts for linked elderly users
//   GET  /emergency/family/alerts/history recent resolved/cancelled alerts, last 7 days
//
// Phase 1, step 1 only: the SOS button and the alert record. No GPS capture,
// no notification fanout — those are separate steps. See BUILD_LOG.md.
// ============================================================================

import { Router } from 'express';
import { badRequest, notFound, forbidden, conflict } from '../shared/http/errors.js';
import { requireAuth, requireRole } from '../shared/auth/middleware.js';
import {
  toPublicAlert,
  findActiveSosAlert,
  createSosAlert,
  listAlertsForUser,
  findAlertById,
  cancelAlert,
  resolveAlert,
  findFamilyLink,
  listActiveFamilyAlerts,
  listFamilyAlertHistory,
} from './alerts.js';
import { validateListQuery, validateCloseAlertBody, validateHistoryQuery } from './validate.js';

export const emergencyRouter = Router();

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

  const alert = await createSosAlert(req.user.id);
  res.status(201).json({ status: 'ok', alert: toPublicAlert(alert) });
});

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
