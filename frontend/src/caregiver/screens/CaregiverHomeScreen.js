// Placeholder. Phase 2 replaces this with the caregiver's real home screen:
// today's schedule and attendance check-in.
// Owner: Teammate B (caregiver module).

import { PlaceholderScreen } from '../../shared/ui/PlaceholderScreen';

export function CaregiverHomeScreen() {
  return (
    <PlaceholderScreen
      title="My schedule"
      subtitle="You are signed in as a caregiver."
      comingSoon={[
        'Visit schedule for the week (Phase 2)',
        'Check in and check out of a visit (Phase 2)',
        'Assigned tasks and care plans (Phase 4)',
        'Daily activity reports (Phase 4)',
      ]}
    />
  );
}
