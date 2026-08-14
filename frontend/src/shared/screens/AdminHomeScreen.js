// Placeholder. The admin dashboard is a later phase (PROJECT_REPORT section 3
// lists it as such). Lives in shared/ because it belongs to no single module.
//
// Reachable only by an account whose role was set to 'admin' directly in the
// database — registration refuses to hand out that role.

import { PlaceholderScreen } from '../ui/PlaceholderScreen';

export function AdminHomeScreen() {
  return (
    <PlaceholderScreen
      title="Admin"
      subtitle="You are signed in as an administrator."
      comingSoon={[
        'Caregiver verification queue',
        'User management',
        'Platform-wide alert overview',
      ]}
    />
  );
}
