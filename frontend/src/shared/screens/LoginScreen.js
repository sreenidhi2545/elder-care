// ============================================================================
// Login screen — TEAMMATE C BUILDS THIS (WORK_DIVISION section 4, Phase 0 step 5)
//
// This file is a placeholder. Replace everything below it with the real login
// and registration screens. The shell around it is finished: routing, token
// storage, refresh and role-based navigation all work already, and none of it
// needs changing.
//
// ---------------------------------------------------------------------------
// WHAT TO BUILD
// ---------------------------------------------------------------------------
//
//   - A phone + password form. Phone is the login identity; email also works
//     for anyone who registered with one.
//   - A link across to a registration form: phone, password, full name, role.
//   - Nothing about role-based routing. Once signIn() is called the app routes
//     by role on its own — that part is already done.
//
// ---------------------------------------------------------------------------
// WHAT TO CALL
// ---------------------------------------------------------------------------
//
//   import { login, register } from '../api/auth';
//   import { useAuth } from '../auth/AuthContext';
//
//   const { signIn } = useAuth();
//
//   // logging in
//   const response = await login({ phone, password });
//   await signIn(response);        // <- the entire handover. Nothing else.
//
//   // registering — the response has tokens too, so no second login call
//   const response = await register({ phone, password, fullName, role });
//   await signIn(response);
//
// `signIn` stores both tokens securely and switches the navigator to the home
// screen for that user's role. There is nothing to navigate to by hand.
//
// ---------------------------------------------------------------------------
// PHONE NUMBERS — DO NOT REFORMAT THEM
// ---------------------------------------------------------------------------
//
// Send the field exactly as the user typed it. The backend normalises to E.164
// and is the only place that does. `9876543210`, `+91 98765 43210` and
// `919876543210` all reach the same account already.
//
// Show `+91` as a fixed prefix beside a 10-digit field so most people type the
// plain 10 digits — but do not strip, pad or rewrite what they enter. Two
// implementations of that rule drift, and then the app and the server disagree
// about which account a number belongs to.
//
// ---------------------------------------------------------------------------
// HANDLING FAILURES
// ---------------------------------------------------------------------------
//
// Both calls throw on failure. `ApiError` has `.status`, `.code` and
// `.details`; `NetworkError` means the request never arrived. Branch on
// `.code`, never on the message text — API.md lists the codes per endpoint.
//
//   invalid_credentials  wrong phone/email or password
//   account_exists       that phone or email is already registered
//   account_disabled     the account has been deactivated
//   validation_failed    check `.details` for the per-field messages
//
// `validation_failed` returns every bad field at once, which is exactly what a
// form wants — show each message against its own input rather than one at a
// time.
// ============================================================================

import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { login } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';
import { colors, spacing, type } from '../ui/theme';

export function LoginScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>ElderCare</Text>
          <Text style={styles.subtitle}>
            Placeholder. The real login and registration screens are Teammate C's,
            Phase 0 step 5 — build them here, replacing this whole file. Instructions
            and the exact calls to make are in the comment block at the top of
            {' '}
            <Text style={styles.code}>src/shared/screens/LoginScreen.js</Text>.
          </Text>

          <TemporarySignIn />

          <Text style={styles.footnote}>Backend: {API_URL}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ===========================================================================
// TEMPORARY — DELETE THIS COMPONENT ALONG WITH THE PLACEHOLDER ABOVE
//
// Scaffolding, not a design. It exists so the role-based routing built in this
// step can actually be exercised on a phone before the real screen lands: sign
// in as an elderly user and you should arrive at the elderly home screen, as a
// caregiver at the caregiver one. It calls the same login() and signIn() the
// real screen will, so it also proves that path works end to end.
//
// No validation, no error styling, no registration, no accessibility work. All
// of that is the real screen's job.
// ===========================================================================

function TemporarySignIn() {
  const { signIn } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function attempt() {
    setBusy(true);
    setError(null);

    try {
      const response = await login({ phone, password });
      await signIn(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.devCard}>
      <Text style={styles.devHeading}>Temporary — Teammate C deletes this</Text>
      <Text style={styles.devNote}>
        Scaffolding so role-based routing can be tested before the real screen exists.
        Not a design, and not the login screen — no validation, no registration, no
        accessibility work.
      </Text>

      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone, e.g. 9876543210"
        keyboardType="phone-pad"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
      />

      <Pressable style={styles.button} onPress={attempt} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: type.title, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: type.body, color: colors.textMuted, textAlign: 'center' },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: type.small },
  devCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  devHeading: { fontSize: type.small, fontWeight: '700', color: colors.danger, textTransform: 'uppercase' },
  devNote: { fontSize: type.small, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: type.body,
    color: colors.text,
    backgroundColor: colors.background,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: type.body, fontWeight: '600' },
  error: { color: colors.danger, fontSize: type.small },
  footnote: { fontSize: type.small, color: colors.textMuted, textAlign: 'center' },
});
