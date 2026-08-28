// ============================================================================
// Role-based routing
//
// Four roles, four different home screens. The role comes from the server on
// the user record, never from anything the app decides for itself.
// ============================================================================

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CaregiverHomeScreen } from '../../caregiver/screens/CaregiverHomeScreen';
import { ElderlyHomeScreen } from '../../emergency/screens/ElderlyHomeScreen';
import { FamilyHomeScreen } from '../../emergency/screens/FamilyHomeScreen';
import { AmbulanceBookingScreen } from '../../emergency/screens/AmbulanceBookingScreen';
import { AmbulanceStatusScreen } from '../../emergency/screens/AmbulanceStatusScreen';
import { DisasterAlertsScreen } from '../../emergency/screens/DisasterAlertsScreen';
import { DisasterDetailScreen } from '../../emergency/screens/DisasterDetailScreen';
import { ResponseCenterScreen } from '../../emergency/screens/ResponseCenterScreen';
import { FallDetectionScreen } from '../../emergency/screens/FallDetectionScreen';
import { EmergencyContactsScreen } from '../../emergency/screens/EmergencyContactsScreen';
import { ManageFamilyScreen } from '../../family/screens/ManageFamilyScreen';
import { FamilyLinksScreen } from '../../family/screens/FamilyLinksScreen';
import { useAuth } from '../auth/AuthContext';
import { AdminHomeScreen } from '../screens/AdminHomeScreen';

const Stack = createNativeStackNavigator();

const screenOptions = { headerShown: false };

function ElderlyNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ElderlyHome" component={ElderlyHomeScreen} />
      <Stack.Screen name="AmbulanceBooking" component={AmbulanceBookingScreen} />
      <Stack.Screen name="AmbulanceStatus" component={AmbulanceStatusScreen} />
      <Stack.Screen name="DisasterAlerts" component={DisasterAlertsScreen} />
      <Stack.Screen name="DisasterDetail" component={DisasterDetailScreen} />
      <Stack.Screen name="ResponseCenter" component={ResponseCenterScreen} />
      <Stack.Screen name="FallDetection" component={FallDetectionScreen} />
      <Stack.Screen name="ManageFamily" component={ManageFamilyScreen} />
      <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
    </Stack.Navigator>
  );
}

function FamilyNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="FamilyHome" component={FamilyHomeScreen} />
      <Stack.Screen name="AmbulanceBooking" component={AmbulanceBookingScreen} />
      <Stack.Screen name="AmbulanceStatus" component={AmbulanceStatusScreen} />
      <Stack.Screen name="DisasterAlerts" component={DisasterAlertsScreen} />
      <Stack.Screen name="DisasterDetail" component={DisasterDetailScreen} />
      <Stack.Screen name="ResponseCenter" component={ResponseCenterScreen} />
      <Stack.Screen name="FallDetection" component={FallDetectionScreen} />
      <Stack.Screen name="FamilyLinks" component={FamilyLinksScreen} />
    </Stack.Navigator>
  );
}

function CaregiverNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="CaregiverHome" component={CaregiverHomeScreen} />
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
      return <ElderlyNavigator />;
  }
}
