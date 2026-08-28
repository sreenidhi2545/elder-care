// ============================================================================
// Locations — database access
//
// Phase 1, step 2: capture and storage only. Same split as alerts.js:
// routes.js decides what is allowed, this file only knows how to write rows.
// Phase 3 step 3's geofence check reads this table back (the previous
// reading, to detect a boundary crossing) — see geofenceCheck.js, not here.
// ============================================================================

import { query } from '../shared/db/pool.js';

/** Shapes a raw `locations` row into the camelCase form the API returns. */
export function toPublicLocation(row) {
  return {
    id: row.id,
    userId: row.user_id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyMeters: row.accuracy_meters,
    batteryLevel: row.battery_level,
    source: row.source,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

/**
 * Records one location reading for the caller. `recordedAt` is when the
 * device actually took the GPS fix, which may be a moment before this
 * request arrives — defaults to now() if the client didn't send one.
 *
 * ON CONFLICT DO NOTHING relies on the locations_user_recorded_at_key unique
 * constraint (same user, same recorded_at = the same reading resent by a
 * queued retry) and returns undefined rather than throwing — callers must
 * treat that as a successful no-op, not an error.
 */
export async function createLocation(
  userId,
  { latitude, longitude, accuracyMeters, batteryLevel, recordedAt, source }
) {
  const { rows } = await query(
    `INSERT INTO locations (user_id, latitude, longitude, accuracy_meters, battery_level, recorded_at, source)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), COALESCE($7, 'gps'))
     ON CONFLICT (user_id, recorded_at) DO NOTHING
     RETURNING *`,
    [userId, latitude, longitude, accuracyMeters ?? null, batteryLevel ?? null, recordedAt ?? null, source ?? null]
  );
  return rows[0];
}
