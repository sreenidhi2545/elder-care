// Placeholder. Phase 2 replaces this with the caregiver's real home screen:
// today's schedule and attendance check-in.
// Owner: Teammate B (caregiver module).
//
// Profile and Bookings entry points added here (first caregiver-module
// screens to actually ship) — the rest of this placeholder is untouched.

import { PlaceholderScreen } from '../../shared/ui/PlaceholderScreen';

export function CaregiverHomeScreen({ navigation }) {
  return (
    <PlaceholderScreen
      title="My schedule"
      subtitle="You are signed in as a caregiver."
      actions={[
        { label: 'Edit My Profile', onPress: () => navigation.navigate('CaregiverProfile') },
        { label: 'My Bookings', onPress: () => navigation.navigate('CaregiverBookings') },
      ]}
      comingSoon={[
        'Visit schedule for the week (Phase 2)',
        'Check in and check out of a visit (Phase 2)',
        'Assigned tasks and care plans (Phase 4)',
        'Daily activity reports (Phase 4)',
      ]}
    />
  );
}
