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
// ============================================================================

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './shared/auth/AuthContext';
import { RootNavigator } from './shared/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
