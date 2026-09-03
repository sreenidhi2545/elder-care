// ============================================================================
// Caregiver home screen — real dashboard
//
// Three entry points, all self-contained (no route params — each screen
// resolves the caregiver's own id via useAuth()). Everything else a
// caregiver needs (check-in/out, tasks, care plans, activity reports) is
// reached per-visit from My Schedule (CaregiverScheduleScreen), not
// duplicated here.
// ============================================================================

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../shared/auth/AuthContext';
import { colors, spacing, type } from '../../shared/ui/theme';

export function CaregiverHomeScreen({ navigation }) {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greetingTitle}>Hello, {user?.fullName ?? 'there'}</Text>
          <Text style={styles.greetingSubtitle}>You are signed in as a caregiver.</Text>
        </View>

        <View style={styles.cardsSection}>
          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            onPress={() => navigation.navigate('CaregiverSchedule')}
            accessibilityRole="button"
            accessibilityLabel="My Schedule"
          >
            <Text style={styles.cardTitle}>My Schedule</Text>
            <Text style={styles.cardSubtitle}>
              Upcoming and past visits — check in/out, tasks, care plans and activity reports
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            onPress={() => navigation.navigate('CaregiverBookings')}
            accessibilityRole="button"
            accessibilityLabel="My Bookings"
          >
            <Text style={styles.cardTitle}>My Bookings</Text>
            <Text style={styles.cardSubtitle}>Requests waiting on you, confirmed and past bookings</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            onPress={() => navigation.navigate('CaregiverProfile')}
            accessibilityRole="button"
            accessibilityLabel="Edit My Profile"
          >
            <Text style={styles.cardTitle}>Edit My Profile</Text>
            <Text style={styles.cardSubtitle}>City, rate, specializations, languages and bio</Text>
          </Pressable>
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut} accessibilityRole="button">
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { gap: 4 },
  greetingTitle: { fontSize: type.title, fontWeight: '900', color: colors.text },
  greetingSubtitle: { fontSize: type.body, color: colors.textMuted },
  cardsSection: { gap: spacing.md },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  actionCardPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  cardTitle: { fontSize: type.heading - 2, fontWeight: '800', color: colors.primary },
  cardSubtitle: { fontSize: type.small + 1, color: colors.textMuted, lineHeight: 19 },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  signOutText: { fontSize: type.body, color: colors.danger, fontWeight: '700' },
});
