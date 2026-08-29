// Placeholder. The admin dashboard is a later phase (PROJECT_REPORT section 3
// lists it as such). Lives in shared/ because it belongs to no single module.
//
// Reachable only by an account whose role was set to 'admin' directly in the
// database — registration refuses to hand out that role.
//
// Verification queue entry point added here (first admin-facing screen to
// actually ship) — the rest of this placeholder is untouched.

import { PlaceholderScreen } from '../ui/PlaceholderScreen';

export function AdminHomeScreen({ navigation }) {
  return (
    <PlaceholderScreen
      title="Admin"
      subtitle="You are signed in as an administrator."
      actions={[
        { label: 'Caregiver Verification Queue', onPress: () => navigation.navigate('CaregiverVerification') },
      ]}
      comingSoon={[
        'User management',
        'Platform-wide alert overview',
      ]}
    />
  );
}
