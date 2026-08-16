// ============================================================================
// Elderly home screen — the SOS button
//
// Phase 1, steps 1-2. One thing on this screen matters: getting help fast. Three
// states:
//
//   idle       — the big SOS button
//   confirming — a 5-second countdown overlay, cancellable, before anything
//                is sent. This is what stops a pocket press from ever
//                reaching the server.
//   active     — an alert exists on the server; shows that plainly and offers
//                a way to cancel it, itself behind one confirmation tap.
//
// Phase 1, step 2 adds GPS: a "Location sharing" card (permission handling,
// mount-time capture posted to POST /emergency/locations) and a best-effort
// capture at SOS press time, sent inline with the alert. Never a
// precondition — see startCountdown/fireSos below. No notifications yet —
// that's step 3. See BUILD_LOG.md.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { cancelAlert, createSosAlert, listAlerts } from '../api/alerts';
import { recordLocation } from '../api/locations';
import { ApiError, NetworkError } from '../../shared/api/client';
import {
  captureCurrentLocation,
  getLocationPermissionStatus,
  requestLocationPermission,
} from '../../shared/location/captureLocation';
import {
  enableBackgroundTracking,
  disableBackgroundTracking,
  reconcileTrackingState,
} from '../../shared/location/backgroundTracking';
import { useAuth } from '../../shared/auth/AuthContext';
import { colors, spacing, type } from '../../shared/ui/theme';

const COUNTDOWN_SECONDS = 5;
const POLL_ACTIVE_MS = 10_000;
const POLL_IDLE_MS = 20_000;

// Stays under the 5-second countdown so a location fix never delays sending
// the alert — by the time the countdown reaches zero, this has already
// settled (a reading or null), so awaiting it in fireSos adds no wait.
const SOS_LOCATION_TIMEOUT_MS = 4500;

export function ElderlyHomeScreen() {
  const { user, signOut } = useAuth();

  // 'checking' | 'idle' | 'confirming' | 'sending' | 'active' | 'confirmingCancel' | 'cancelling'
  const [phase, setPhase] = useState('checking');
  const [alert, setAlert] = useState(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [banner, setBanner] = useState(null); // transient, non-scary status line
  const countdownTimer = useRef(null);

  // 'checking' | 'undetermined' | 'granted' | 'denied'
  const [locationPermission, setLocationPermission] = useState('checking');
  const [locationShared, setLocationShared] = useState(false);
  const sosLocationRef = useRef(null); // in-flight capture promise during the countdown

  // 'checking' | 'off' | 'enabling' | 'on' | 'foreground_denied' | 'background_denied'
  const [trackingPhase, setTrackingPhase] = useState('checking');

  const stopCountdown = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------
  // Checking for an alert already active — on load, and periodically.
  // A failure here is never shown as an error: if we cannot tell whether an
  // alert is active, the safest default is to leave the SOS button available
  // rather than block someone who may be in a real emergency.
  // ---------------------------------------------------------------------
  const checkActive = useCallback(async () => {
    try {
      const { alerts } = await listAlerts({ status: 'active', limit: 1 });
      if (alerts.length > 0) {
        setAlert(alerts[0]);
        setPhase((p) => (p === 'checking' || p === 'idle' || p === 'active' ? 'active' : p));
      } else {
        setAlert(null);
        setPhase((p) => (p === 'checking' || p === 'active' ? 'idle' : p));
      }
    } catch {
      setPhase((p) => (p === 'checking' ? 'idle' : p));
    }
  }, []);

  useEffect(() => {
    checkActive();
  }, [checkActive]);

  // Poll faster while an alert is active than while idle — an open emergency
  // is worth checking on more often (e.g. a family member resolved it).
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'active') return;
    const intervalMs = phase === 'active' ? POLL_ACTIVE_MS : POLL_IDLE_MS;
    const id = setInterval(checkActive, intervalMs);
    return () => clearInterval(id);
  }, [phase, checkActive]);

  useEffect(() => stopCountdown, [stopCountdown]);

  // ---------------------------------------------------------------------
  // Location sharing — foreground, one-shot on mount if already granted.
  // No background/periodic tracking here; that's continuous live location,
  // which is Phase 3's job (and needs a dev build Expo Go can't provide —
  // see BUILD_LOG.md's open issues).
  // ---------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const status = await getLocationPermissionStatus();
      setLocationPermission(status);
      if (status === 'granted') {
        await captureAndShareLocation();
      }
    })();
  }, []);

  async function captureAndShareLocation() {
    const location = await captureCurrentLocation();
    if (!location) return;
    try {
      await recordLocation(location);
      setLocationShared(true);
    } catch {
      // Background enrichment — a failed share here is not something to
      // alarm an elderly user about. It will simply try again next visit.
    }
  }

  async function handleEnableLocationSharing() {
    const status = await requestLocationPermission();
    setLocationPermission(status);
    if (status === 'granted') {
      await captureAndShareLocation();
    }
  }

  // ---------------------------------------------------------------------
  // Continuous background tracking — separate from the one-shot sharing
  // above (Phase 3 step 2). Re-checked whenever this screen regains focus,
  // not just on mount: covers coming back from the system Settings screen
  // after granting "Allow all the time" on Android 11+, where the in-app
  // prompt can't grant it directly (see backgroundTracking.js) — if the
  // permission is now granted, this retries starting the task automatically
  // rather than making the person hunt for the button again.
  // ---------------------------------------------------------------------
  // A ref, not a dependency: useCallback below is memoized once so
  // useFocusEffect only fires on an actual focus transition, not on every
  // trackingPhase change — the effect still needs the *current* phase when
  // it runs, so it reads it from a ref kept in sync, same pattern as
  // sosLocationRef above.
  const trackingPhaseRef = useRef(trackingPhase);
  useEffect(() => {
    trackingPhaseRef.current = trackingPhase;
  }, [trackingPhase]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        if (trackingPhaseRef.current === 'background_denied') {
          setTrackingPhase('enabling');
          const result = await enableBackgroundTracking();
          if (!cancelled) setTrackingPhase(result.started ? 'on' : result.reason);
          return;
        }

        const active = await reconcileTrackingState();
        if (cancelled) return;
        setTrackingPhase((prev) => {
          if (active) return 'on';
          // A denied-permission explanation should stay on screen until the
          // user actually acts on it, not reset to a bare "off" on every
          // refocus.
          return prev === 'foreground_denied' || prev === 'background_denied' ? prev : 'off';
        });
      })();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function handleEnableTracking() {
    setTrackingPhase('enabling');
    const result = await enableBackgroundTracking();
    setTrackingPhase(result.started ? 'on' : result.reason);
  }

  async function handleDisableTracking() {
    await disableBackgroundTracking();
    setTrackingPhase('off');
  }

  // ---------------------------------------------------------------------
  // Pressing SOS
  // ---------------------------------------------------------------------

  function startCountdown() {
    setCountdown(COUNTDOWN_SECONDS);
    setPhase('confirming');

    // Started now, not awaited until fireSos — see SOS_LOCATION_TIMEOUT_MS.
    // If permission isn't granted this resolves to null immediately, which
    // is exactly the "fire without a location" path.
    sosLocationRef.current = captureCurrentLocation({ timeoutMs: SOS_LOCATION_TIMEOUT_MS });

    countdownTimer.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          stopCountdown();
          fireSos();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  }

  function cancelCountdown() {
    stopCountdown();
    setPhase('idle');
  }

  async function fireSos() {
    setPhase('sending');
    // Already settled by now — SOS_LOCATION_TIMEOUT_MS is shorter than the
    // countdown that just finished — so this await does not delay sending.
    const location = await (sosLocationRef.current ?? Promise.resolve(null));
    try {
      const { alert: created } = await createSosAlert(location);
      setAlert(created);
      setPhase('active');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sos_already_active') {
        // Not a failure — someone already pressed it (perhaps this same
        // person, moments ago on another screen). Reassurance, not an error.
        setBanner('Help is already on the way.');
        await checkActive();
        setPhase('active');
        return;
      }

      // A genuine network problem while trying to send an SOS is the one
      // moment this screen must not go quiet. Offer to try again immediately
      // rather than showing a generic error and leaving someone stranded.
      setBanner(
        err instanceof NetworkError
          ? 'Could not reach the server. Tap SOS to try again.'
          : 'Something went wrong sending your alert. Tap SOS to try again.'
      );
      setPhase('idle');
    }
  }

  // ---------------------------------------------------------------------
  // Cancelling an active alert — behind one confirmation, since dismissing a
  // real emergency should not be as easy as raising one.
  // ---------------------------------------------------------------------

  async function confirmCancelAlert() {
    if (!alert) return;
    setPhase('cancelling');
    try {
      await cancelAlert(alert.id);
      setAlert(null);
      setBanner(null);
      setPhase('idle');
    } catch (err) {
      // The alert may have just been resolved by a family member — either
      // way, find out what is actually true rather than guessing.
      await checkActive();
      if (err instanceof NetworkError) {
        setBanner('Could not reach the server. Your alert may still be active.');
      }
    }
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.greeting}>Hello, {user?.fullName?.split(' ')[0] ?? 'there'}</Text>

        {banner && (
          <Pressable onPress={() => setBanner(null)} style={styles.banner}>
            <Text style={styles.bannerText}>{banner}</Text>
          </Pressable>
        )}

        <View style={styles.center}>
          {phase === 'checking' && <ActivityIndicator size="large" color={colors.primary} />}

          {(phase === 'idle' || phase === 'sending') && (
            <>
              <Pressable
                onPress={startCountdown}
                disabled={phase === 'sending'}
                accessibilityRole="button"
                accessibilityLabel="Press for help. Sends an emergency alert after a 5 second countdown you can cancel."
                style={({ pressed }) => [styles.sosButton, pressed && styles.sosButtonPressed]}
              >
                {phase === 'sending' ? (
                  <ActivityIndicator size="large" color={colors.surface} />
                ) : (
                  <Text style={styles.sosButtonText}>SOS</Text>
                )}
              </Pressable>
              <Text style={styles.helpText}>Press for help</Text>
              <Text style={styles.subText}>You'll have 5 seconds to cancel before it sends.</Text>
              <LocationSharingCard
                permission={locationPermission}
                shared={locationShared}
                onEnable={handleEnableLocationSharing}
              />
              <BackgroundTrackingCard
                phase={trackingPhase}
                onEnable={handleEnableTracking}
                onDisable={handleDisableTracking}
              />
            </>
          )}

          {(phase === 'active' || phase === 'confirmingCancel' || phase === 'cancelling') && (
            <ActiveAlert
              alert={alert}
              phase={phase}
              onRequestCancel={() => setPhase('confirmingCancel')}
              onBackOut={() => setPhase('active')}
              onConfirmCancel={confirmCancelAlert}
            />
          )}
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut} accessibilityRole="button">
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      <Modal
        visible={phase === 'confirming'}
        transparent
        animationType="fade"
        onRequestClose={cancelCountdown}
      >
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Sending SOS in</Text>
            <Text style={styles.countdownNumber}>{countdown}</Text>
            <Pressable
              onPress={cancelCountdown}
              accessibilityRole="button"
              accessibilityLabel="Cancel. Do not send an alert."
              style={styles.bigCancelButton}
            >
              <Text style={styles.bigCancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActiveAlert({ alert, phase, onRequestCancel, onBackOut, onConfirmCancel }) {
  const minutesAgo = alert ? Math.max(0, Math.round((Date.now() - new Date(alert.triggeredAt)) / 60000)) : 0;

  return (
    <View style={styles.activeCard}>
      <Text style={styles.activeTitle}>SOS Active</Text>
      <Text style={styles.activeSubtitle}>
        {minutesAgo === 0 ? 'Triggered just now' : `Triggered ${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`}
      </Text>

      {phase === 'active' && (
        <Pressable
          onPress={onRequestCancel}
          accessibilityRole="button"
          style={styles.safeButton}
        >
          <Text style={styles.safeButtonText}>I'm safe — cancel alert</Text>
        </Pressable>
      )}

      {phase === 'confirmingCancel' && (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>Are you sure you're safe now?</Text>
          <View style={styles.confirmButtons}>
            <Pressable onPress={onBackOut} accessibilityRole="button" style={styles.confirmNoButton}>
              <Text style={styles.confirmNoButtonText}>No, keep it active</Text>
            </Pressable>
            <Pressable onPress={onConfirmCancel} accessibilityRole="button" style={styles.confirmYesButton}>
              <Text style={styles.confirmYesButtonText}>Yes, I'm safe</Text>
            </Pressable>
          </View>
        </View>
      )}

      {phase === 'cancelling' && <ActivityIndicator size="large" color={colors.text} />}
    </View>
  );
}

/**
 * The plain-language explanation the OS permission prompt itself doesn't
 * give — shown before asking, per Phase 1 step 2's requirement. Never blocks
 * the SOS button in any state; this is a small card underneath it, not a gate
 * in front of it.
 */
function LocationSharingCard({ permission, shared, onEnable }) {
  if (permission === 'checking') return null;

  if (permission === 'granted') {
    return (
      <View style={styles.locationCard}>
        <Text style={styles.locationText}>
          {shared
            ? 'Location sharing is on — your family can see where you are if you press SOS.'
            : 'Location sharing is on. Could not get a fix just now — will try again next time you open the app.'}
        </Text>
      </View>
    );
  }

  if (permission === 'denied') {
    return (
      <View style={styles.locationCard}>
        <Text style={styles.locationText}>
          Location sharing is off. SOS still works — your family just won't see where you are.
        </Text>
        <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button">
          <Text style={styles.locationLink}>Open settings to turn it on</Text>
        </Pressable>
      </View>
    );
  }

  // 'undetermined'
  return (
    <View style={styles.locationCard}>
      <Text style={styles.locationText}>
        ElderCare can share your location so your family can see where you are if you press SOS.
        This only happens on this device.
      </Text>
      <Pressable onPress={onEnable} accessibilityRole="button">
        <Text style={styles.locationLink}>Enable location sharing</Text>
      </Pressable>
    </View>
  );
}

/**
 * Continuous background tracking — deliberately a separate card from
 * LocationSharingCard above, not folded into it. That one is a single
 * foreground capture tied to this session; this is an ongoing background
 * service with its own permission step (foreground, then background) and
 * its own on/off state the elderly user controls. Conflating the copy for
 * both risks the elderly user not understanding what either one actually
 * does. See BUILD_LOG.md, Phase 3 step 2.
 */
function BackgroundTrackingCard({ phase, onEnable, onDisable }) {
  if (phase === 'checking') return null;

  if (phase === 'enabling') {
    return (
      <View style={styles.locationCard}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (phase === 'on') {
    return (
      <View style={styles.locationCard}>
        <Text style={styles.locationText}>
          Continuous location tracking is on. Your family can see where you are, even when
          ElderCare isn't open. A notification stays on screen the whole time this is on.
        </Text>
        <Pressable onPress={onDisable} accessibilityRole="button">
          <Text style={styles.locationLink}>Turn off</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'background_denied') {
    return (
      <View style={styles.locationCard}>
        <Text style={styles.locationText}>
          Continuous tracking needs "Allow all the time" turned on in your phone's Settings — it
          can't be turned on from inside the app on this version of Android.
        </Text>
        <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button">
          <Text style={styles.locationLink}>Open settings</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'foreground_denied') {
    return (
      <View style={styles.locationCard}>
        <Text style={styles.locationText}>Continuous tracking needs location permission, which is currently off.</Text>
        <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button">
          <Text style={styles.locationLink}>Open settings</Text>
        </Pressable>
      </View>
    );
  }

  // 'off' (also covers 'unsupported_platform' — nothing more to offer there)
  return (
    <View style={styles.locationCard}>
      <Text style={styles.locationText}>
        Turn on continuous tracking so your family can see where you are even when ElderCare
        isn't open. SOS works the same either way.
      </Text>
      <Pressable onPress={onEnable} accessibilityRole="button">
        <Text style={styles.locationLink}>Turn on continuous tracking</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg, gap: spacing.md },
  greeting: { fontSize: type.heading, fontWeight: '600', color: colors.text },
  banner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: spacing.md,
  },
  bannerText: { fontSize: type.body, color: colors.text, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },

  sosButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  sosButtonPressed: { backgroundColor: '#961515' },
  sosButtonText: { fontSize: 56, fontWeight: '800', color: colors.surface, letterSpacing: 2 },
  helpText: { fontSize: type.heading, fontWeight: '700', color: colors.text },
  subText: { fontSize: type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 280 },

  locationCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    maxWidth: 320,
  },
  locationText: { fontSize: type.small, color: colors.textMuted, textAlign: 'center' },
  locationLink: { fontSize: type.small, color: colors.primary, fontWeight: '700', textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.85)', alignItems: 'center', justifyContent: 'center' },
  overlayCard: { alignItems: 'center', gap: spacing.lg, padding: spacing.xl },
  overlayTitle: { fontSize: type.heading, color: colors.surface, fontWeight: '600' },
  countdownNumber: { fontSize: 96, fontWeight: '800', color: colors.surface },
  bigCancelButton: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 16,
    minWidth: 220,
    alignItems: 'center',
  },
  bigCancelButtonText: { fontSize: type.heading, fontWeight: '700', color: colors.text },

  activeCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  activeTitle: { fontSize: 32, fontWeight: '800', color: colors.danger },
  activeSubtitle: { fontSize: type.body, color: colors.text },
  safeButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 240,
    alignItems: 'center',
  },
  safeButtonText: { fontSize: type.body, fontWeight: '700', color: colors.text },
  confirmRow: { alignItems: 'center', gap: spacing.md, width: '100%' },
  confirmText: { fontSize: type.body, fontWeight: '600', color: colors.text },
  confirmButtons: { gap: spacing.sm, width: '100%' },
  confirmNoButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  confirmNoButtonText: { fontSize: type.body, fontWeight: '600', color: colors.text },
  confirmYesButton: {
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  confirmYesButtonText: { fontSize: type.body, fontWeight: '700', color: colors.surface },

  signOutButton: { alignItems: 'center', paddingVertical: spacing.sm },
  signOutText: { fontSize: type.small, color: colors.textMuted },
});
