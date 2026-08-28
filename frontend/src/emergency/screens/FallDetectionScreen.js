// ============================================================================
// Fall Detection Screen — ElderCare
//
// Dedicated manual "I FELL" emergency trigger screen.
// Captures GPS location, confirms user intent to prevent accidental alerts,
// creates a PostgreSQL alert record ('fall'), and triggers emergency contact notifications.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cancelAlert, createFallAlert, listAlerts } from '../api/alerts';
import { captureCurrentLocation } from '../../shared/location/captureLocation';
import { colors, spacing, type } from '../../shared/ui/theme';

export function FallDetectionScreen({ navigation }) {
  const [activeAlert, setActiveAlert] = useState(null);
  const [checkingActive, setCheckingActive] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Check for pre-existing active fall alert on mount
  const checkActiveAlert = useCallback(async () => {
    try {
      const { alerts } = await listAlerts({ status: 'active', limit: 5 });
      const fallAlert = alerts.find((a) => a.alertType === 'fall');
      if (fallAlert) {
        setActiveAlert(fallAlert);
      }
    } catch {
      // Best effort check
    } finally {
      setCheckingActive(false);
    }
  }, []);

  useEffect(() => {
    checkActiveAlert();
  }, [checkActiveAlert]);

  async function handleSendFallAlert() {
    setShowConfirmModal(false);
    setSubmitting(true);
    setError(null);

    try {
      // Capture GPS location best-effort with quick timeout
      let location = null;
      try {
        const locResult = await captureCurrentLocation();
        if (locResult?.latitude && locResult?.longitude) {
          location = { latitude: locResult.latitude, longitude: locResult.longitude };
        }
      } catch {
        // Location failure does not stop alert creation
      }

      const { alert } = await createFallAlert(location);
      setActiveAlert(alert);
    } catch (err) {
      if (err.code === 'fall_already_active' && err.alert) {
        setActiveAlert(err.alert);
      } else {
        setError(err.message || 'Unable to send emergency fall alert. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelAlert() {
    if (!activeAlert?.id) return;
    setCancelling(true);
    try {
      await cancelAlert(activeAlert.id, 'User cancelled fall alert');
      setActiveAlert(null);
    } catch (err) {
      setError(err.message || 'Could not cancel alert.');
    } finally {
      setCancelling(false);
    }
  }

  if (checkingActive) {
    return (
      <SafeAreaView style={styles.centerSafe}>
        <ActivityIndicator size="large" color={colors.danger} />
        <Text style={styles.loadingText}>Checking emergency status...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Fall Detection</Text>
          <Text style={styles.subtitle}>Manual Emergency Fall Alert Trigger</Text>
        </View>

        {/* Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Active Alert State */}
        {activeAlert ? (
          <View style={styles.activeCard}>
            <Text style={styles.activeCardIcon}>🚨</Text>
            <Text style={styles.activeCardTitle}>Emergency Fall Alert Active</Text>
            <Text style={styles.activeCardSub}>
              Your emergency contacts are being notified. Assistance is on the way.
            </Text>

            <View style={styles.activeDetailsBox}>
              <Text style={styles.activeDetailText}>
                📍 Location: {activeAlert.latitude ? 'Shared (GPS Available)' : 'Location Unavailable'}
              </Text>
              <Text style={styles.activeDetailText}>
                🕒 Triggered: {new Date(activeAlert.triggeredAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
                cancelling && styles.buttonDisabled,
              ]}
              onPress={handleCancelAlert}
              disabled={cancelling}
              accessibilityRole="button"
              accessibilityLabel="Cancel fall alert"
            >
              {cancelling ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel Alert (False Alarm)</Text>
              )}
            </Pressable>
          </View>
        ) : (
          /* Normal Trigger View */
          <View style={styles.triggerContainer}>
            <Text style={styles.instructionText}>
              If you have fallen and need help, press the button below. An emergency alert will be sent immediately to your emergency contacts.
            </Text>

            {/* Primary "I FELL" Action Button */}
            <Pressable
              style={({ pressed }) => [
                styles.fellButton,
                pressed && styles.fellButtonPressed,
                submitting && styles.buttonDisabled,
              ]}
              onPress={() => setShowConfirmModal(true)}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="I fell. Tap to request emergency assistance."
            >
              {submitting ? (
                <View style={styles.submittingContainer}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.submittingText}>Sending Alert...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.fellButtonIcon}>🍂</Text>
                  <Text style={styles.fellButtonText}>I FELL</Text>
                  <Text style={styles.fellButtonSub}>Tap for Emergency Help</Text>
                </>
              )}
            </Pressable>

            <Text style={styles.disclaimerText}>
              Note: This is a manual fall alert button. Tap to notify your emergency contacts and care team.
            </Text>
          </View>
        )}

        {/* Shortcuts Section */}
        <View style={styles.shortcutsSection}>
          <Text style={styles.shortcutsTitle}>Other Emergency Options</Text>

          <Pressable
            style={styles.shortcutButton}
            onPress={() => navigation.navigate('AmbulanceBooking')}
            accessibilityRole="button"
          >
            <Text style={styles.shortcutText}>🚑 Request Emergency Ambulance</Text>
          </Pressable>

          <Pressable
            style={styles.shortcutButton}
            onPress={() => navigation.navigate('ResponseCenter')}
            accessibilityRole="button"
          >
            <Text style={styles.shortcutText}>📞 24/7 Emergency Response Center</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIcon}>⚠️</Text>
            <Text style={styles.modalTitle}>Send Emergency Fall Alert?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to send a fall emergency alert to your emergency contacts?
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setShowConfirmModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel fall alert"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.modalConfirmButton}
                onPress={handleSendFallAlert}
                accessibilityRole="button"
                accessibilityLabel="Confirm send emergency fall alert"
              >
                <Text style={styles.modalConfirmText}>YES, SEND ALERT</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerSafe: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: type.body,
    color: colors.textMuted,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: type.title + 2,
    fontWeight: '800',
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: type.body - 1,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: type.body - 1,
    fontWeight: '600',
    textAlign: 'center',
  },
  triggerContainer: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  instructionText: {
    fontSize: type.body,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  fellButton: {
    backgroundColor: colors.danger,
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    padding: spacing.md,
  },
  fellButtonPressed: {
    backgroundColor: '#991B1B',
  },
  fellButtonIcon: {
    fontSize: 42,
    marginBottom: 2,
  },
  fellButtonText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  fellButtonSub: {
    color: '#FEE2E2',
    fontSize: type.small,
    fontWeight: '700',
    marginTop: 2,
  },
  submittingContainer: {
    alignItems: 'center',
    gap: 8,
  },
  submittingText: {
    color: '#FFFFFF',
    fontSize: type.body,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  disclaimerText: {
    fontSize: type.small,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    maxWidth: 300,
  },
  activeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.danger,
    alignItems: 'center',
    gap: spacing.md,
  },
  activeCardIcon: {
    fontSize: 48,
  },
  activeCardTitle: {
    fontSize: type.heading,
    fontWeight: '800',
    color: colors.danger,
    textAlign: 'center',
  },
  activeCardSub: {
    fontSize: type.body - 1,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  activeDetailsBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: spacing.md,
    width: '100%',
    gap: spacing.xs,
  },
  activeDetailText: {
    fontSize: type.body - 1,
    color: colors.text,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  cancelButtonPressed: {
    backgroundColor: '#D1D5DB',
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: type.body - 1,
    fontWeight: '700',
  },
  shortcutsSection: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  shortcutsTitle: {
    fontSize: type.heading - 2,
    fontWeight: '800',
    color: colors.text,
  },
  shortcutButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  shortcutText: {
    fontSize: type.body - 1,
    fontWeight: '700',
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalIcon: {
    fontSize: 40,
  },
  modalTitle: {
    fontSize: type.heading,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: type.body - 1,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: colors.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: type.body - 1,
    fontWeight: '700',
    color: colors.text,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: colors.danger,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: type.small + 1,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
