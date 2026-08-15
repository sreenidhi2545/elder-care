// ============================================================================
// Emergency alert endpoints
//
// One function per endpoint in API.md, same pattern as shared/api/auth.js —
// a screen never writes a URL, so if the contract changes it changes here and
// nowhere else.
// ============================================================================

import { apiRequest } from '../../shared/api/client';

/**
 * POST /emergency/alerts — presses SOS for the signed-in user.
 *
 * If one is already active, the server answers 409 `sos_already_active` and
 * includes the existing alert on the error. That is not a failure to show the
 * user — see ElderlyHomeScreen, which treats it as reassurance ("help is
 * already on the way") rather than an error.
 */
export function createSosAlert() {
  return apiRequest('/emergency/alerts', { method: 'POST' });
}

/**
 * GET /emergency/alerts — the caller's own alerts, newest first.
 * @param {object} [options]
 * @param {string} [options.status] filter, e.g. 'active'
 * @param {number} [options.limit]
 */
export function listAlerts({ status, limit } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  return apiRequest(`/emergency/alerts${query ? `?${query}` : ''}`);
}

/** POST /emergency/alerts/:id/cancel — "that was a mistake", owner only. */
export function cancelAlert(id, note) {
  return apiRequest(`/emergency/alerts/${id}/cancel`, { method: 'POST', body: note ? { note } : undefined });
}

/** POST /emergency/alerts/:id/resolve — "this is handled", owner or a permitted family member. */
export function resolveAlert(id, note) {
  return apiRequest(`/emergency/alerts/${id}/resolve`, { method: 'POST', body: note ? { note } : undefined });
}

/** GET /emergency/family/alerts — active alerts for elderly users the caller is linked to. */
export function listFamilyAlerts() {
  return apiRequest('/emergency/family/alerts');
}

/**
 * GET /emergency/family/alerts/history — resolved/cancelled alerts from the
 * last 7 days for elderly users the caller is linked to. The window is fixed
 * server-side; only `limit` is a caller option.
 */
export function listFamilyAlertHistory({ limit } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  return apiRequest(`/emergency/family/alerts/history${query ? `?${query}` : ''}`);
}
