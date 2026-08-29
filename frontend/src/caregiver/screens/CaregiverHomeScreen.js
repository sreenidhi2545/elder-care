// Placeholder. Phase 2 replaces this with the caregiver's real home screen.
// Owner: Teammate B (caregiver module).
//
// Profile, Bookings and Schedule entry points added here as each shipped —
// the rest of this placeholder is untouched.

import { PlaceholderScreen } from '../../shared/ui/PlaceholderScreen';

export function CaregiverHomeScreen({ navigation }) {
  return (
    <PlaceholderScreen
      title="My schedule"
      subtitle="You are signed in as a caregiver."
      actions={[
        { label: 'Edit My Profile', onPress: () => navigation.navigate('CaregiverProfile') },
        { label: 'My Bookings', onPress: () => navigation.navigate('CaregiverBookings') },
        { label: 'My Schedule', onPress: () => navigation.navigate('CaregiverSchedule') },
      ]}
      comingSoon={[
        'Assigned tasks and care plans (Phase 4)',
        'Daily activity reports (Phase 4)',
      ]}
    />
  );
}
