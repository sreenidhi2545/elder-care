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
