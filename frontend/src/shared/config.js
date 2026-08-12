// ============================================================================
// Where the backend is
//
// The first thing that breaks when you run this on a real phone: the phone is
// not the computer. `http://localhost:5000` on a handset means the handset
// itself, so every request fails with a network error and nothing explains why.
//
// The address is worked out in this order:
//
//   1. `expo.extra.apiUrl` in app.json, if it is set. Use this for a deployed
//      backend, or when the automatic answer is wrong.
//   2. The IP address of the computer running Metro, which Expo already tells
//      the app so it knows where to fetch the JavaScript bundle from. That
//      computer is also running the backend during development, so reusing the
//      address means nobody has to look up their own IP or edit a file to get
//      started.
//   3. localhost, as a last resort. Correct in a web browser on the same
//      machine, wrong on a phone — but by then there is no better guess.
//
// The phone and the computer have to be on the same Wi-Fi network either way.
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

  // Checked for being a non-empty string, not merely truthy. Expo resolves a
  // `null` in app.json to `{}`, which passes a truthy test and would make the
  // base URL the string "[object Object]" — every request then fails with a
  // network error that points nowhere near the actual mistake.
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
