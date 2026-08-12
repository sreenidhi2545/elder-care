// ============================================================================
// Development seed: one test account per role
//
//   node scripts/seed-test-users.js <password>
//
// Run from backend/. Creates four accounts — elderly, family, caregiver and
// admin — all sharing the password you pass in. They exist so the mobile app's
// role-based routing can be exercised: sign in as each and confirm you land on
// a different home screen.
//
// The password is an argument rather than a constant in this file, so no
// working credential is ever committed. Re-running with a different password
// updates the existing accounts instead of failing.
//
// The accounts carry no email address, which also exercises the phone-only
// registration path.
//
// Why this writes to the database directly instead of calling POST
// /auth/register: 'admin' cannot be self-assigned through the API, deliberately
// — a public endpoint that grants admin is a privilege-escalation hole. Seeding
// through the API would mean creating three accounts and then reaching into
// SQL for the fourth anyway. It uses the same hashPassword and normalizePhone
// the API uses, so the rows are identical to registered ones.
// ============================================================================

import { config } from '../shared/config/env.js';
import { query, closePool } from '../shared/db/pool.js';
import { hashPassword } from '../shared/auth/password.js';
import { normalizePhone } from '../shared/phone.js';
import { PASSWORD_MIN_LENGTH } from '../shared/auth/validate.js';

// Test numbers are valid 10-digit Indian mobile numbers so they survive
// normalisation unchanged, and are obviously sequential so nobody mistakes one
// for a real person's.
const TEST_USERS = [
  { phone: '9000000001', fullName: 'Test Elderly', role: 'elderly' },
  { phone: '9000000002', fullName: 'Test Family', role: 'family' },
  { phone: '9000000003', fullName: 'Test Caregiver', role: 'caregiver' },
  { phone: '9000000004', fullName: 'Test Admin', role: 'admin' },
];

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/seed-test-users.js <password>');
  console.error(`The password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  process.exit(1);
}

if (password.length < PASSWORD_MIN_LENGTH) {
  console.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  process.exit(1);
}

// These are known-password accounts. Creating them anywhere real would be
// handing out four working logins, one of them an administrator.
if (config.nodeEnv === 'production') {
  console.error('Refusing to run with NODE_ENV=production. This script is for development databases only.');
  process.exit(1);
}

const passwordHash = await hashPassword(password);

console.log(`Seeding ${TEST_USERS.length} test accounts into ${config.databaseUrl.replace(/:[^:@]*@/, ':****@')}\n`);

for (const user of TEST_USERS) {
  const normalized = normalizePhone(user.phone);

  if (!normalized.ok) {
    console.error(`  ${user.phone}  SKIPPED — ${normalized.reason}`);
    process.exitCode = 1;
    continue;
  }

  // Upsert on phone: re-running the script resets the password and the role
  // rather than colliding with the UNIQUE constraint.
  const { rows } = await query(
    `INSERT INTO users (phone, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (phone) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            full_name     = EXCLUDED.full_name,
            role          = EXCLUDED.role,
            is_active     = TRUE
     RETURNING id, phone, role, (xmax = 0) AS inserted`,
    [normalized.value, passwordHash, user.fullName, user.role]
  );

  const row = rows[0];
  console.log(`  ${row.phone.padEnd(15)} ${row.role.padEnd(10)} ${row.inserted ? 'created' : 'updated'}`);
}

console.log('\nSign in with any of the numbers above and the password you passed.');
console.log('The app normalises nothing — type the number in any format you like.');

await closePool();
