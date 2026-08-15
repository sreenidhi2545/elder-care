// ============================================================================
// Device location capture
//
// Phase 1, step 2. A thin wrapper around expo-location (+ expo-battery for
// the battery_level column) that never throws and never hangs — permission
// denied, GPS off, no fix in time, or a genuinely broken device all come back
// as `null`. Callers branch on "did we get a reading", nothing else; nobody
// calling this needs a try/catch for the ordinary "location unavailable"
// case, since that isn't treated as an error here.
//
// Used from two places: ElderlyHomeScreen's "Location sharing" card (mount-
// time capture, posted to POST /emergency/locations) and the SOS countdown
// (capture at press time, sent inline on POST /emergency/alerts). Kept here,
// under shared/, because it's a device capability, not emergency-module
// business logic — the same way shared/api/client.js isn't owned by one
// screen either.
// ============================================================================

import * as Location from 'expo-location';
import * as Battery from 'expo-battery';

/** Checks the current permission without prompting. */
export async function getLocationPermissionStatus() {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status; // 'granted' | 'denied' | 'undetermined'
}

/** Triggers the OS permission prompt. Call only after showing the rationale. */
export async function requestLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status;
}

/**
 * Best-effort single reading. Returns null rather than throwing for every
 * case that isn't "something is actually broken": permission not granted, no
 * fix within `timeoutMs`, or the platform refusing (GPS off, airplane mode).
 *
 * Battery level is fetched alongside but is genuinely optional — some
 * platforms/emulators don't support it, and a missing battery reading is not
 * a reason to discard an otherwise-good position fix.
 */
export async function captureCurrentLocation({ timeoutMs = 8000 } = {}) {
  try {
    const status = await getLocationPermissionStatus();
    if (status !== 'granted') return null;

    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));

    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeout,
    ]);
    if (!position) return null;

    const batteryLevel = await Battery.getBatteryLevelAsync().catch(() => null);

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy ?? null,
      batteryLevel:
        typeof batteryLevel === 'number' && batteryLevel >= 0
          ? Math.round(batteryLevel * 100)
          : null,
      recordedAt: new Date(position.timestamp).toISOString(),
    };
  } catch {
    // GPS hardware error, permission revoked mid-flight, etc. — location is
    // enrichment, never a reason to fail whatever the caller is doing.
    return null;
  }
}
