// ============================================================================
// Input validation for the emergency alert routes
//
// Same shape as shared/auth/validate.js: collect every problem and report
// them together rather than one at a time.
// ============================================================================

import { badRequest } from '../shared/http/errors.js';

const ALERT_STATUSES = ['active', 'acknowledged', 'resolved', 'cancelled', 'false_alarm'];

// 'sos_capture' is reserved: nothing writes it yet, since the SOS-press
// capture goes straight onto alerts.latitude/longitude, not this table. Kept
// here so validation is ready the moment that changes.
const LOCATION_SOURCES = ['foreground_mount', 'background_task', 'sos_capture'];

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
 *
 * `accuracyMeters`/`isApproximate`/`capturedAt` are optional alongside the
 * coordinates — Phase 1 step 4, carrying a getLastKnownPositionAsync floor
 * value onto the initial send when no fresh fix landed within
 * SOS_LOCATION_TIMEOUT_MS. `isApproximate` defaults false, matching a fresh
 * fix; the client only ever sends true for a last-known reading.
 */
export function validateSosAlertBody(body = {}) {
  const { latitude, longitude, accuracyMeters, isApproximate, capturedAt } = body;
  const errors = [
    ...coordinateErrors(latitude, longitude, { required: false }),
    ...fieldErrors([
      { when: accuracyMeters !== undefined && (!isFiniteNumber(accuracyMeters) || accuracyMeters < 0),
        field: 'accuracyMeters', message: 'Accuracy must be a non-negative number.' },
      { when: isApproximate !== undefined && typeof isApproximate !== 'boolean',
        field: 'isApproximate', message: 'isApproximate must be a boolean.' },
      { when: capturedAt !== undefined && Number.isNaN(new Date(capturedAt).getTime()),
        field: 'capturedAt', message: 'capturedAt must be a valid date.' },
    ]),
  ];

  if (errors.length > 0) {
    throw badRequest('validation_failed', 'One or more fields are invalid.', { details: errors });
  }

  return {
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    accuracyMeters: accuracyMeters ?? null,
    isApproximate: isApproximate ?? false,
    capturedAt: capturedAt !== undefined ? new Date(capturedAt).toISOString() : null,
  };
}

/**
 * PATCH /emergency/alerts/:id/location — a fresh fix that landed after the
 * alert already sent (Phase 1 step 4's async-attach path). Always a real
 * reading, never a last-known one — isApproximate is not a caller option
 * here, alerts.js hardcodes it false on write.
 */
export function validateAttachLocationBody(body = {}) {
  const { latitude, longitude, accuracyMeters, capturedAt } = body;

  const errors = [
    ...coordinateErrors(latitude, longitude, { required: true }),
    ...fieldErrors([
      { when: accuracyMeters !== undefined && (!isFiniteNumber(accuracyMeters) || accuracyMeters < 0),
        field: 'accuracyMeters', message: 'Accuracy must be a non-negative number.' },
      { when: capturedAt !== undefined && Number.isNaN(new Date(capturedAt).getTime()),
        field: 'capturedAt', message: 'capturedAt must be a valid date.' },
    ]),
  ];

  if (errors.length > 0) {
    throw badRequest('validation_failed', 'One or more fields are invalid.', { details: errors });
  }

  return {
    latitude,
    longitude,
    accuracyMeters: accuracyMeters ?? null,
    capturedAt: capturedAt !== undefined ? new Date(capturedAt).toISOString() : null,
  };
}

/** POST /emergency/locations */
export function validateCreateLocationBody(body = {}) {
  const { latitude, longitude, accuracyMeters, batteryLevel, recordedAt, source } = body;

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
      { when: source !== undefined && !LOCATION_SOURCES.includes(source),
        field: 'source', message: `source must be one of: ${LOCATION_SOURCES.join(', ')}.` },
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
    source: source ?? null,
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

const DEVICE_PLATFORMS = ['ios', 'android', 'web'];

/** POST /emergency/device-tokens */
export function validateRegisterDeviceTokenBody(body = {}) {
  const { expoPushToken, platform, deviceName, deviceModel, appVersion, osVersion } = body;

  const shortString = (value, max) => typeof value === 'string' && value.length <= max;

  const errors = fieldErrors([
    { when: typeof expoPushToken !== 'string' || expoPushToken.trim() === '',
      field: 'expoPushToken', message: 'expoPushToken is required.' },
    { when: typeof expoPushToken === 'string' && expoPushToken.length > 255,
      field: 'expoPushToken', message: 'expoPushToken must be 255 characters or fewer.' },
    { when: !DEVICE_PLATFORMS.includes(platform),
      field: 'platform', message: `platform must be one of: ${DEVICE_PLATFORMS.join(', ')}.` },
    { when: deviceName !== undefined && !shortString(deviceName, 120),
      field: 'deviceName', message: 'deviceName must be a string of 120 characters or fewer.' },
    { when: deviceModel !== undefined && !shortString(deviceModel, 120),
      field: 'deviceModel', message: 'deviceModel must be a string of 120 characters or fewer.' },
    { when: appVersion !== undefined && !shortString(appVersion, 20),
      field: 'appVersion', message: 'appVersion must be a string of 20 characters or fewer.' },
    { when: osVersion !== undefined && !shortString(osVersion, 40),
      field: 'osVersion', message: 'osVersion must be a string of 40 characters or fewer.' },
  ]);

  if (errors.length > 0) {
    throw badRequest('validation_failed', 'One or more fields are invalid.', { details: errors });
  }

  return {
    expoPushToken: expoPushToken.trim(),
    platform,
    deviceName: deviceName ?? null,
    deviceModel: deviceModel ?? null,
    appVersion: appVersion ?? null,
    osVersion: osVersion ?? null,
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
