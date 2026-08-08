// ============================================================================
// Environment configuration
//
// Single place where the process reads .env. Everything else imports the
// frozen `config` object below, so no other file calls process.env directly
// and a missing variable is caught here at startup instead of surfacing as a
// confusing error deep inside a request.
// ============================================================================

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));

// .env lives at the repository root, not inside backend/, so that the same
// file can serve any tooling added later. Resolved from this file's own
// location rather than process.cwd(), so `npm start` works from any directory.
const envPath = path.resolve(here, '../../../.env');

dotenv.config({ path: envPath, quiet: true });

// Fail loudly and immediately if the server was started without its settings.
const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}\n` +
      `Expected them in ${envPath}\n` +
      `Copy .env.example to .env and fill in the values.`
  );
  process.exit(1);
}

// A short signing key is the weak link in an otherwise sound token scheme:
// it can be brute-forced offline from a single captured JWT. Warn rather than
// exit so development is not blocked, but this must be fixed before deploying.
const MIN_SECRET_LENGTH = 32;
if (process.env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
  console.warn(
    `WARNING: JWT_SECRET is ${process.env.JWT_SECRET.length} characters; ` +
      `${MIN_SECRET_LENGTH}+ recommended. Generate one with:\n` +
      `  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
  );
}

export const config = Object.freeze({
  databaseUrl: process.env.DATABASE_URL,
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  jwtSecret: process.env.JWT_SECRET,
  // Short, because an access token cannot be revoked once issued — the window
  // in which a stolen one is useful is exactly this long.
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  // Long, because this one lives in the refresh_tokens table and CAN be revoked.
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30,
  jwtIssuer: 'eldercare',
  bcryptRounds: 12,
});
