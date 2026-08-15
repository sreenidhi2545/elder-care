// ============================================================================
// Input validation for the emergency alert routes
//
// Same shape as shared/auth/validate.js: collect every problem and report
// them together rather than one at a time.
// ============================================================================

import { badRequest } from '../shared/http/errors.js';

const ALERT_STATUSES = ['active', 'acknowledged', 'resolved', 'cancelled', 'false_alarm'];

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

function fieldErrors(checks) {
  return checks.filter((c) => c.when).map(({ field, message }) => ({ field, message }));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Shared by the SOS body and the locations endpoint — same column, same rules. */
function coordinateErrors(latitude, longitude, { required }) {
  if (!required && latitude === undefined && longitude === undefined) return [];

  return fieldErrors([
    { when: latitude === undefined || longitude === undefined,
      field: 'latitude', message: 'latitude and longitude must be sent together.' },
    { when: latitude !== undefined && (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90),
      field: 'latitude', message: 'Latitude must be a number between -90 and 90.' },
    { when: longitude !== undefined && (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180),
      field: 'longitude', message: 'Longitude must be a number between -180 and 180.' },
  ]);
}

/** GET /emergency/alerts and GET /emergency/family/alerts share this shape. */
export function validateListQuery(query = {}) {
  const { status, limit } = query;

  const errors = fieldErrors([
    { when: status !== undefined && !ALERT_STATUSES.includes(status),
      field: 'status', message: `Status must be one of: ${ALERT_STATUSES.join(', ')}.` },
    { when: limit !== undefined && (!/^\d+$/.test(String(limit)) || Number(limit) < 1),
      field: 'limit', message: 'Limit must be a positive whole number.' },
  ]);

  if (errors.length > 0) {
    throw badRequest('validation_failed', 'One or more fields are invalid.', { details: errors });
  }

  return {
    status: status ?? null,
    limit: limit === undefined ? DEFAULT_LIST_LIMIT : Math.min(Number(limit), MAX_LIST_LIMIT),
  };
}

/**
 * POST /emergency/alerts — `latitude`/`longitude` are optional and, if sent,
 * captured on the device at press time and written straight onto the alert.
 * Never required: an SOS must fire with or without a location fix.
 */
export function validateSosAlertBody(body = {}) {
  const { latitude, longitude } = body;
  const errors = coordinateErrors(latitude, longitude, { required: false });

  if (errors.length > 0) {
    throw badRequest('validation_failed', 'One or more fields are invalid.', { details: errors });
  }

  return latitude === undefined ? { latitude: null, longitude: null } : { latitude, longitude };
}

/** POST /emergency/locations */
export function validateCreateLocationBody(body = {}) {
  const { latitude, longitude, accuracyMeters, batteryLevel, recordedAt } = body;

  const errors = [
    ...coordinateErrors(latitude, longitude, { required: true }),
    ...fieldErrors([
      { when: accuracyMeters !== undefined && (!isFiniteNumber(accuracyMeters) || accuracyMeters < 0),
        field: 'accuracyMeters', message: 'Accuracy must be a non-negative number.' },
      { when: batteryLevel !== undefined &&
          (!Number.isInteger(batteryLevel) || batteryLevel < 0 || batteryLevel > 100),
        field: 'batteryLevel', message: 'Battery level must be a whole number between 0 and 100.' },
      { when: recordedAt !== undefined && Number.isNaN(new Date(recordedAt).getTime()),
        field: 'recordedAt', message: 'recordedAt must be a valid date.' },
    ]),
  ];

  if (errors.length > 0) {
    throw badRequest('validation_failed', 'One or more fields are invalid.', { details: errors });
  }

  return {
    latitude,
    longitude,
    accuracyMeters: accuracyMeters ?? null,
    batteryLevel: batteryLevel ?? null,
    recordedAt: recordedAt !== undefined ? new Date(recordedAt).toISOString() : null,
  };
}

/** GET /emergency/family/alerts/history — same limit rules, no status filter (fixed server-side). */
export function validateHistoryQuery(query = {}) {
  const { limit } = query;

  const errors = fieldErrors([
    { when: limit !== undefined && (!/^\d+$/.test(String(limit)) || Number(limit) < 1),
      field: 'limit', message: 'Limit must be a positive whole number.' },
  ]);

  if (errors.length > 0) {
    throw badRequest('validation_failed', 'One or more fields are invalid.', { details: errors });
  }

  return {
    limit: limit === undefined ? DEFAULT_LIST_LIMIT : Math.min(Number(limit), MAX_LIST_LIMIT),
  };
}

/** POST /emergency/alerts/:id/cancel and /resolve share this body shape. */
export function validateCloseAlertBody(body = {}) {
  const { note } = body;

  const errors = fieldErrors([
    { when: note !== undefined && note !== null && typeof note !== 'string',
      field: 'note', message: 'Note must be a string.' },
    { when: typeof note === 'string' && note.length > 2000,
      field: 'note', message: 'Note must be 2000 characters or fewer.' },
  ]);

  if (errors.length > 0) {
    throw badRequest('validation_failed', 'One or more fields are invalid.', { details: errors });
  }

  return { note: typeof note === 'string' && note.trim() !== '' ? note.trim() : null };
}
