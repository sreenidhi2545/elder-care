// ============================================================================
// Push token registration — generic device capability, no ElderCare-specific
// knowledge of what a notification means once it arrives.
//
// Unlike location (captureLocation.js), this doesn't show a custom
// plain-language rationale before the OS prompt — a notification permission
// is a much more familiar, lower-stakes ask than background location, and the
// product requirement didn't call for one here the way it did for GPS.
// ============================================================================

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apiRequest } from '../api/client';

/**
 * Requests permission if not already granted, gets this device's Expo push
 * token, and registers it with the backend. Returns the token, or null if
 * any step couldn't complete — permission denied, no EAS projectId configured
 * yet, or running on a simulator/emulator (push tokens don't exist there).
 * Never throws: registering for push is enrichment, not something that
 * should interrupt sign-in.
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    // Expected until `eas init` has been run once — see app.config.js's
    // "extra" comment. Not an error: the rest of the app works without it.
    console.warn('No EAS projectId configured — skipping push registration. See app.config.js.');
    return null;
  }

  let expoPushToken;
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    expoPushToken = result.data;
  } catch (err) {
    console.warn('Could not get an Expo push token:', err.message);
    return null;
  }

  try {
    await apiRequest('/emergency/device-tokens', {
      method: 'POST',
      body: {
        expoPushToken,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? undefined,
        deviceModel: Device.modelName ?? undefined,
        osVersion: Device.osVersion != null ? String(Device.osVersion) : undefined,
      },
    });
  } catch (err) {
    // Backend unreachable, or the token was rejected — either way, the app
    // itself is unaffected. Whatever called this can retry another time.
    console.warn('Could not register push token with the backend:', err.message);
  }

  return expoPushToken;
}
