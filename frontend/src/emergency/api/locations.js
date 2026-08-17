// ============================================================================
// Location endpoint
//
// One function, same pattern as emergency/api/alerts.js.
// ============================================================================

import { apiRequest } from '../../shared/api/client';

/**
 * POST /emergency/locations — records one GPS reading for the caller.
 * @param {{ latitude: number, longitude: number, accuracyMeters?: number, batteryLevel?: number, recordedAt?: string, source?: string }} location
 */
export function recordLocation(location) {
  return apiRequest('/emergency/locations', { method: 'POST', body: location });
}
