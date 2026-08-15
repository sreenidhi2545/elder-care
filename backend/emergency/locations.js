// ============================================================================
// Locations — database access
//
// Phase 1, step 2: capture and storage only. Nothing here reads this table
// back yet — no map UI, no geofencing (Phase 3). Same split as alerts.js:
// routes.js decides what is allowed, this file only knows how to write rows.
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
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

/**
 * Records one location reading for the caller. `recordedAt` is when the
 * device actually took the GPS fix, which may be a moment before this
 * request arrives — defaults to now() if the client didn't send one.
 */
export async function createLocation(userId, { latitude, longitude, accuracyMeters, batteryLevel, recordedAt }) {
  const { rows } = await query(
    `INSERT INTO locations (user_id, latitude, longitude, accuracy_meters, battery_level, recorded_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()))
     RETURNING *`,
    [userId, latitude, longitude, accuracyMeters ?? null, batteryLevel ?? null, recordedAt ?? null]
  );
  return rows[0];
}
