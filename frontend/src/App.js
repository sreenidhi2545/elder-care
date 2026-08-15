// ============================================================================
// Application root
//
// Provider order matters:
//
//   SafeAreaProvider    measures the notch and home indicator; screens read it
//   AuthProvider        must sit above the navigator, because which navigator
//                       renders at all depends on the auth state
//   NavigationContainer holds the navigation state for everything below it
//
// Phase 0 step 4. No feature screens — see src/shared/navigation/AppNavigator.js
// for where each phase's screens attach.
//
// Phase 1 step 3 adds <NotificationsBridge>: once signed in, it registers
// this device for push and starts listening for the "Acknowledge" action on
// an SOS notification. configureNotificationHandler() is called once at
// module load, not inside a component — it's configuration, not a
// subscription, so it needs no cleanup.
// ============================================================================

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './shared/auth/AuthContext';
import { RootNavigator } from './shared/navigation/RootNavigator';
import { NotificationsBridge } from './emergency/notifications/NotificationsBridge';
import { configureNotificationHandler } from './shared/notifications/notificationSetup';

configureNotificationHandler();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <NotificationsBridge />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
