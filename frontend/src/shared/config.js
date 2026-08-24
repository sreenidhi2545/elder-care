// ============================================================================
// Application Configuration & Environment Settings
// ============================================================================

import Constants from 'expo-constants';

/** Port the backend listens on. Matches PORT in the repository's .env. */
const BACKEND_PORT = 5000;

/**
 * The address Metro is served from, e.g. "192.168.1.7:8081".
 * `hostUri` is the current field; `debuggerHost` is where older Expo Go builds
 * put the same value, so both are checked.
 */
function metroHost() {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? null;
  if (!hostUri) return null;

  const [host] = hostUri.split(':');
  return host || null;
}

function resolveApiUrl() {
  const configured = Constants.expoConfig?.extra?.apiUrl;

  if (typeof configured === 'string' && configured.trim() !== '') {
    return configured.trim().replace(/\/+$/, '');
  }

  const host = metroHost();
  if (host) return `http://${host}:${BACKEND_PORT}`;

  return `http://localhost:${BACKEND_PORT}`;
}

export const API_URL = resolveApiUrl();

/** How long a request may take before it is given up on, in milliseconds. */
export const REQUEST_TIMEOUT_MS = 15000;

/** Configurable 24/7 Emergency Response Center contact number. */
export const EMERGENCY_RESPONSE_CENTER_PHONE =
  Constants.expoConfig?.extra?.responseCenterPhone || '+919876543210';

/** Configurable Emergency Response Center desk name. */
export const EMERGENCY_RESPONSE_CENTER_NAME =
  Constants.expoConfig?.extra?.responseCenterName || 'ElderCare 24/7 Emergency Response Desk';
