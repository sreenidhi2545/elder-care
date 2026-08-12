// Placeholder. Phase 1 replaces this with the family monitoring dashboard —
// incoming alerts, then live location and the map in Phase 3.
// Owner: Sree (emergency module).

import { PlaceholderScreen } from '../../shared/ui/PlaceholderScreen';

export function FamilyHomeScreen() {
  return (
    <PlaceholderScreen
      title="Family dashboard"
      subtitle="You are signed in as a family member."
      comingSoon={[
        'Alerts feed — SOS, falls, safe zone breaches (Phase 1)',
        'Emergency contacts, in priority order (Phase 1)',
        'Live location and history on a map (Phase 3)',
        'Book and manage caregivers (Phase 2)',
        'Care plans, activity reports and reviews (Phase 4)',
      ]}
    />
  );
}
