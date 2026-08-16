// ============================================================================
// Background location task definition — Phase 3 step 2.
//
// TaskManager.defineTask must run at module scope, unconditionally, in a
// file that's part of the app's static import graph from the very top
// (imported at the top of App.js — see the comment there). Module-level code
// runs on every bundle load, headless or not, simply as a consequence of how
// JS module evaluation works; that's what makes it safe to rely on here even
// though nothing else about a headless run is safe to assume (no React tree,
// no AuthProvider — see backgroundLocationApi.js). If this were only
// imported from a screen component, a headless run would never import it at
// all, and Android would have a location task with nowhere to deliver to.
//
// Enabling/disabling what actually invokes this is backgroundTracking.js's
// job, driven from the UI. This file only has to be ready to receive.
// ============================================================================

import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';

import { BACKGROUND_LOCATION_TASK } from './backgroundLocationTaskName';
import { enqueueLocation } from './locationQueue';
import { flushLocationQueue } from './backgroundLocationApi';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('Background location task error:', error.message);
    return;
  }

  // expo-location can deliver more than one location per invocation if the
  // OS held several before it got a chance to wake the app.
  const locations = data?.locations ?? [];
  if (locations.length === 0) return;

  // Best-effort, same as the SOS-time capture in captureLocation.js — a
  // missing battery reading is never a reason to discard an otherwise-good
  // position fix, and some devices/emulators don't support it at all.
  const batteryLevel = await Battery.getBatteryLevelAsync().catch(() => null);
  const batteryPercent =
    typeof batteryLevel === 'number' && batteryLevel >= 0 ? Math.round(batteryLevel * 100) : null;

  for (const location of locations) {
    await enqueueLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracyMeters: location.coords.accuracy ?? null,
      batteryLevel: batteryPercent,
      recordedAt: new Date(location.timestamp).toISOString(),
    });
  }

  // Every delivery is also a chance to drain whatever's backed up, rather
  // than waiting for a separate retry timer — the common case (online)
  // clears the queue back down to nothing on almost every tick.
  await flushLocationQueue();
});
