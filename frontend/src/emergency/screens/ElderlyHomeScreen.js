// Placeholder. Phase 1 replaces this with the real elderly home screen: one
// large SOS button and very little else, per PROJECT_REPORT section 3.
// Owner: Sree (emergency module).

import { PlaceholderScreen } from '../../shared/ui/PlaceholderScreen';

export function ElderlyHomeScreen() {
  return (
    <PlaceholderScreen
      title="Home"
      subtitle="You are signed in as an elderly user."
      comingSoon={[
        'One-touch SOS button (Phase 1)',
        'Location sharing with your family (Phase 1)',
        'Safe zone alerts (Phase 3)',
        'I fell — manual fall trigger (Phase 5)',
      ]}
    />
  );
}
