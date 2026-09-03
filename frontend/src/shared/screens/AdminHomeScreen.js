// ============================================================================
// Admin home screen — real dashboard
//
// Reachable only by an account whose role was set to 'admin' directly in the
// database — registration refuses to hand out that role.
//
// One real action today: the caregiver verification queue. User management
// and a platform-wide alert overview are genuine future work — kept visible
// below, clearly marked as not built, rather than presented as if they were
// live features or dropped silently.
// ============================================================================

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { colors, spacing, type } from '../ui/theme';

const NOT_BUILT_YET = ['User management', 'Platform-wide alert overview'];

export function AdminHomeScreen({ navigation }) {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greetingTitle}>Hello, {user?.fullName ?? 'Admin'}</Text>
          <Text style={styles.greetingSubtitle}>You are signed in as an administrator.</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
          onPress={() => navigation.navigate('CaregiverVerification')}
          accessibilityRole="button"
          accessibilityLabel="Caregiver Verification Queue"
        >
          <Text style={styles.cardTitle}>Caregiver Verification Queue</Text>
          <Text style={styles.cardSubtitle}>Review and approve caregiver applications</Text>
        </Pressable>

        <View style={styles.notBuiltCard}>
          <Text style={styles.notBuiltHeading}>Not built yet</Text>
          {NOT_BUILT_YET.map((item) => (
            <Text key={item} style={styles.notBuiltItem}>
              • {item}
            </Text>
          ))}
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
  notBuiltCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.md,
    gap: 4,
  },
  notBuiltHeading: {
    fontSize: type.small,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  notBuiltItem: { fontSize: type.body - 1, color: colors.textMuted },
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
