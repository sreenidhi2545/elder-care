// ============================================================================
// Role-based routing
//
// Four roles, four different home screens. The role comes from the server on
// the user record, never from anything the app decides for itself.
//
// Each role gets its own navigator rather than one navigator with a swapped
// first screen, so that Phase 1 can push emergency screens onto the elderly and
// family stacks without those routes existing for a caregiver at all. A screen
// a role should not reach is better absent than merely unlinked.
//
// This is navigation only. It is not a security boundary — an elderly user
// cannot reach the admin screen here, but the reason they cannot read admin
// data is that the server checks the role on every request. The app's job is to
// show the right thing, not to enforce permission.
// ============================================================================

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CaregiverHomeScreen } from '../../caregiver/screens/CaregiverHomeScreen';
import { ElderlyHomeScreen } from '../../emergency/screens/ElderlyHomeScreen';
import { FamilyHomeScreen } from '../../emergency/screens/FamilyHomeScreen';
import { useAuth } from '../auth/AuthContext';
import { AdminHomeScreen } from '../screens/AdminHomeScreen';

const Stack = createNativeStackNavigator();

// Headers are off for now because every stack is one screen deep and a bare
// title bar above a placeholder is just clutter. Phase 1 turns them back on.
const screenOptions = { headerShown: false };

function ElderlyNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ElderlyHome" component={ElderlyHomeScreen} />
      {/* Phase 1: SOS confirmation. Phase 5: fall trigger. */}
    </Stack.Navigator>
  );
}

function FamilyNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="FamilyHome" component={FamilyHomeScreen} />
      {/* Phase 1: alert detail, emergency contacts. Phase 3: live map. */}
      {/* Phase 2: caregiver search and booking. */}
    </Stack.Navigator>
  );
}

function CaregiverNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="CaregiverHome" component={CaregiverHomeScreen} />
      {/* Phase 2: visit detail, attendance check-in. Phase 4: reports, tasks. */}
    </Stack.Navigator>
  );
}

function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'elderly':
      return <ElderlyNavigator />;
    case 'family':
      return <FamilyNavigator />;
    case 'caregiver':
      return <CaregiverNavigator />;
    case 'admin':
      return <AdminNavigator />;
    default:
      // An unknown role means the server added one the app has not been updated
      // for. Showing the family dashboard would be a guess about what someone
      // is allowed to see, so the safe answer is the least-privileged screen
      // there is.
      return <ElderlyNavigator />;
  }
}
