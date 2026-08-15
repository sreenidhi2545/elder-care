// ============================================================================
// Family home screen — active alerts
//
// Phase 1, steps 1-2. Shows active alerts for elderly users this family member
// is linked to. Every linked (status='active') elderly user's alerts are
// shown — a view-only family member still needs to know an emergency is
// happening. Only alerts where the link's can_acknowledge_alerts is true get
// a "mark resolved" button; the server enforces this regardless of what this
// screen shows. See BUILD_LOG.md for the open question on whether
// can_acknowledge_alerts should also allow cancelling, not just resolving.
//
// Below active alerts, a "Recent alerts" section shows the last 7 days of
// resolved/cancelled alerts for the same linked elderly users — so a
// cancelled SOS still leaves a trace instead of just disappearing. Fetched
// alongside the active list on the same poll cadence rather than its own
// interval; see BUILD_LOG.md for why that's an acceptable trade at this
// scale.
//
// Active alert cards show coordinates (plain text + an "Open in Maps" link)
// where the alert has them and family_links.can_view_location allows it —
// the server redacts latitude/longitude to null otherwise, this screen just
// renders what it's given. Not shown on "Recent alerts" cards, not asked for
// there. Still no in-app map, no live tracking — those are Phase 3. No
// caregiver or care-plan sections — those are Phase 2/4, owned by the
// caregiver module.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listFamilyAlerts, listFamilyAlertHistory, resolveAlert } from '../api/alerts';
import { NetworkError } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/AuthContext';
import { colors, spacing, type } from '../../shared/ui/theme';

const POLL_WITH_ACTIVE_MS = 10_000;
const POLL_IDLE_MS = 20_000;

export function FamilyHomeScreen() {
  const { user, signOut } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [{ alerts: active }, { alerts: recent }] = await Promise.all([
        listFamilyAlerts(),
        listFamilyAlertHistory(),
      ]);
      setAlerts(active);
      setHistory(recent);
      setBanner(null);
    } catch (err) {
      // A background poll failing should not overwrite a list that is still
      // showing correctly — only the initial load surfaces the problem.
      if (!silent) {
        setBanner(
          err instanceof NetworkError
            ? 'Could not reach the server.'
            : 'Could not load alerts.'
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll faster while there is an open alert to watch than while the list is
  // quiet — matches the elderly screen's rhythm.
  useEffect(() => {
    const intervalMs = alerts.length > 0 ? POLL_WITH_ACTIVE_MS : POLL_IDLE_MS;
    const id = setInterval(() => load({ silent: true }), intervalMs);
    return () => clearInterval(id);
  }, [alerts.length, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }

  async function handleResolve(alertId) {
    setResolvingId(alertId);
    try {
      await resolveAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      setConfirmingId(null);
    } catch (err) {
      setBanner(
        err instanceof NetworkError
          ? 'Could not reach the server. Please try again.'
          : 'Could not resolve that alert. Please try again.'
      );
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Family dashboard</Text>
        <Text style={styles.subtitle}>Signed in as {user?.fullName}</Text>

        {banner && (
          <Pressable onPress={() => setBanner(null)} style={styles.banner}>
            <Text style={styles.bannerText}>{banner}</Text>
          </Pressable>
        )}

        <Text style={styles.sectionHeading}>Active alerts</Text>

        {loading && <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />}

        {!loading && alerts.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No active alerts. Everyone you're linked to is safe.</Text>
          </View>
        )}

        {!loading &&
          alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              confirming={confirmingId === alert.id}
              resolving={resolvingId === alert.id}
              onRequestResolve={() => setConfirmingId(alert.id)}
              onBackOut={() => setConfirmingId(null)}
              onConfirmResolve={() => handleResolve(alert.id)}
            />
          ))}

        <Text style={styles.sectionHeading}>Recent alerts</Text>

        {!loading && history.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No alerts in the past 7 days.</Text>
          </View>
        )}

        {!loading && history.map((alert) => <HistoryCard key={alert.id} alert={alert} />)}

        <Pressable style={styles.signOutButton} onPress={signOut} accessibilityRole="button">
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function AlertCard({ alert, confirming, resolving, onRequestResolve, onBackOut, onConfirmResolve }) {
  const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(alert.triggeredAt)) / 60000));
  const elapsed = minutesAgo === 0 ? 'Just now' : `${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;
  const hasLocation = alert.latitude != null && alert.longitude != null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardName}>{alert.elderlyUser.fullName}</Text>
      <Text style={styles.cardType}>{alert.alertType.toUpperCase()} · {elapsed}</Text>

      {hasLocation && (
        <Pressable onPress={() => openInMaps(alert.latitude, alert.longitude)} accessibilityRole="button">
          <Text style={styles.locationLink}>
            {formatCoordinates(alert.latitude, alert.longitude)} · Open in Maps
          </Text>
        </Pressable>
      )}

      {resolving && <ActivityIndicator color={colors.text} style={styles.spinner} />}

      {!resolving && !confirming && alert.canAcknowledge && (
        <Pressable onPress={onRequestResolve} accessibilityRole="button" style={styles.resolveButton}>
          <Text style={styles.resolveButtonText}>Mark resolved</Text>
        </Pressable>
      )}

      {!resolving && !confirming && !alert.canAcknowledge && (
        <Text style={styles.viewOnlyText}>You have view-only access to this alert.</Text>
      )}

      {!resolving && confirming && (
        <View style={styles.confirmButtons}>
          <Pressable onPress={onBackOut} accessibilityRole="button" style={styles.confirmNoButton}>
            <Text style={styles.confirmNoButtonText}>Not yet</Text>
          </Pressable>
          <Pressable onPress={onConfirmResolve} accessibilityRole="button" style={styles.confirmYesButton}>
            <Text style={styles.confirmYesButtonText}>Yes, mark resolved</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function formatCoordinates(latitude, longitude) {
  return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
}

/** Universal Google Maps link — opens the native maps app if one is installed, else a browser. */
function openInMaps(latitude, longitude) {
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
}

/** "active for 4 minutes" / "active for 1 hour 12 minutes" / "active for 2 days" */
function formatActiveDuration(triggeredAt, resolvedAt) {
  const totalMinutes = Math.max(0, Math.round((new Date(resolvedAt) - new Date(triggeredAt)) / 60000));

  if (totalMinutes < 1) return 'Active for less than a minute';
  if (totalMinutes < 60) {
    return `Active for ${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    const hourPart = `${hours} hour${hours === 1 ? '' : 's'}`;
    return minutes === 0 ? `Active for ${hourPart}` : `Active for ${hourPart} ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  const days = Math.floor(hours / 24);
  return `Active for ${days} day${days === 1 ? '' : 's'}`;
}

/** Who closed it and how — cancel is always the alert owner; resolve can be either. */
function formatEndedBy(alert) {
  const name = alert.resolvedByName ?? alert.elderlyUser.fullName;

  if (alert.status === 'cancelled') {
    return `Cancelled by ${name} — they said it was a mistake`;
  }
  return alert.resolvedByIsSelf
    ? `Marked resolved by ${name}`
    : `Resolved by ${name} (family)`;
}

function HistoryCard({ alert }) {
  const cancelled = alert.status === 'cancelled';

  return (
    <View style={[styles.historyCard, cancelled ? styles.historyCardCancelled : styles.historyCardResolved]}>
      <Text style={styles.cardName}>{alert.elderlyUser.fullName}</Text>
      <Text style={styles.historyMeta}>Triggered {new Date(alert.triggeredAt).toLocaleString()}</Text>
      <Text style={styles.historyMeta}>{formatActiveDuration(alert.triggeredAt, alert.resolvedAt)}</Text>
      <Text style={styles.historyEndedBy}>{formatEndedBy(alert)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  title: { fontSize: type.title, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: type.body, color: colors.textMuted, marginTop: -spacing.sm },
  banner: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: spacing.md },
  bannerText: { fontSize: type.body, color: colors.text, fontWeight: '600' },
  sectionHeading: { fontSize: type.heading, fontWeight: '700', color: colors.text },
  spinner: { marginVertical: spacing.md },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  emptyText: { fontSize: type.body, color: colors.textMuted },
  card: {
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardName: { fontSize: type.heading, fontWeight: '700', color: colors.text },
  cardType: { fontSize: type.small, fontWeight: '700', color: colors.danger, letterSpacing: 0.5 },
  locationLink: { fontSize: type.small, color: colors.primary, fontWeight: '600' },
  resolveButton: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  resolveButtonText: { fontSize: type.body, fontWeight: '700', color: colors.text },
  viewOnlyText: { fontSize: type.small, color: colors.textMuted, fontStyle: 'italic' },
  confirmButtons: { gap: spacing.sm },
  confirmNoButton: { backgroundColor: colors.surface, borderRadius: 10, paddingVertical: spacing.sm, alignItems: 'center' },
  confirmNoButtonText: { fontSize: type.body, fontWeight: '600', color: colors.text },
  confirmYesButton: { backgroundColor: colors.success, borderRadius: 10, paddingVertical: spacing.sm, alignItems: 'center' },
  confirmYesButtonText: { fontSize: type.body, fontWeight: '700', color: colors.surface },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    gap: 4,
  },
  historyCardResolved: { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
  historyCardCancelled: { backgroundColor: colors.surface, borderColor: colors.border },
  historyMeta: { fontSize: type.small, color: colors.textMuted },
  historyEndedBy: { fontSize: type.small, color: colors.text, fontWeight: '600' },
  signOutButton: { alignItems: 'center', paddingVertical: spacing.sm },
  signOutText: { fontSize: type.small, color: colors.textMuted },
});
