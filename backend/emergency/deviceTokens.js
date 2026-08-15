// ============================================================================
// Device tokens — database access
//
// Registers the Expo push token for the calling user's device. Was listed in
// API.md's "Not yet built" since Phase 0; nothing populated device_tokens
// until this step, which is why push had no destinations to send to before
// now.
// ============================================================================

import { query } from '../shared/db/pool.js';

function toPublicDeviceToken(row) {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    deviceName: row.device_name,
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

/**
 * Upserts on the token itself (UNIQUE in the schema), not on (user, device) —
 * the same physical token can only ever belong to one user at a time, so a
 * reinstall or an account switch on the same device correctly reassigns it
 * rather than creating a duplicate.
 */
export async function registerDeviceToken(userId, { expoPushToken, platform, deviceName, deviceModel, appVersion, osVersion }) {
  const { rows } = await query(
    `INSERT INTO device_tokens
       (user_id, expo_push_token, platform, device_name, device_model, app_version, os_version, is_active, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, now())
     ON CONFLICT (expo_push_token) DO UPDATE
        SET user_id      = EXCLUDED.user_id,
            platform     = EXCLUDED.platform,
            device_name  = EXCLUDED.device_name,
            device_model = EXCLUDED.device_model,
            app_version  = EXCLUDED.app_version,
            os_version   = EXCLUDED.os_version,
            is_active    = TRUE,
            last_seen_at = now()
     RETURNING *`,
    [userId, expoPushToken, platform, deviceName ?? null, deviceModel ?? null, appVersion ?? null, osVersion ?? null]
  );
  return toPublicDeviceToken(rows[0]);
}
