// ============================================================================
// Input validation for the auth routes
//
// Every rule here exists to stop a bad row reaching the database, or to keep a
// column's constraint from surfacing as a 500. Collects all problems and
// reports them together, so a client fixing a form is not told about one
// mistake at a time.
// ============================================================================

import { badRequest } from '../http/errors.js';
import { BCRYPT_MAX_BYTES } from './password.js';

// Roles a person may give themselves. 'admin' is deliberately absent: a public
// endpoint that grants admin is a privilege-escalation hole. Admins are made by
// promoting an existing user directly in the database.
export const SELF_ASSIGNABLE_ROLES = ['elderly', 'family', 'caregiver'];
export const ALL_ROLES = [...SELF_ASSIGNABLE_ROLES, 'admin'];

export const PASSWORD_MIN_LENGTH = 8;

// Deliberately permissive. Strict email regexes reject valid addresses; the
// real check is whether mail to it is ever delivered.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Digits, optionally a leading +, 7-15 digits. Fits users.phone VARCHAR(20).
const PHONE_RE = /^\+?[0-9]{7,15}$/;

function fieldErrors(checks) {
  return checks.filter((c) => c.when).map(({ field, message }) => ({ field, message }));
}

export function validateRegister(body = {}) {
  const { email, password, fullName, phone, role, preferredLanguage } = body;

  const errors = fieldErrors([
    { when: !email, field: 'email', message: 'Email is required.' },
    { when: email && typeof email !== 'string', field: 'email', message: 'Email must be a string.' },
    { when: typeof email === 'string' && !EMAIL_RE.test(email.trim()),
      field: 'email', message: 'Email is not a valid address.' },
    { when: typeof email === 'string' && email.trim().length > 255,
      field: 'email', message: 'Email must be 255 characters or fewer.' },

    { when: !phone, field: 'phone', message: 'Phone is required.' },
    { when: typeof phone === 'string' && !PHONE_RE.test(phone.trim()),
      field: 'phone', message: 'Phone must be 7-15 digits, optionally starting with +.' },

    { when: !password, field: 'password', message: 'Password is required.' },
    { when: typeof password === 'string' && password.length < PASSWORD_MIN_LENGTH,
      field: 'password', message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` },
    // Longer than this and bcrypt silently ignores the tail, so two different
    // passwords could unlock the same account.
    { when: typeof password === 'string' && Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES,
      field: 'password', message: `Password must be ${BCRYPT_MAX_BYTES} bytes or fewer.` },

    { when: !fullName, field: 'fullName', message: 'Full name is required.' },
    { when: typeof fullName === 'string' && (fullName.trim().length < 1 || fullName.trim().length > 120),
      field: 'fullName', message: 'Full name must be 1-120 characters.' },

    { when: !role, field: 'role', message: 'Role is required.' },
    { when: role && !ALL_ROLES.includes(role),
      field: 'role', message: `Role must be one of: ${ALL_ROLES.join(', ')}.` },

    { when: preferredLanguage !== undefined &&
            (typeof preferredLanguage !== 'string' || preferredLanguage.length > 10),
      field: 'preferredLanguage', message: 'Preferred language must be 10 characters or fewer.' },
  ]);

  if (errors.length > 0) {
    throw badRequest('validation_failed', 'One or more fields are invalid.', { details: errors });
  }

  return {
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    password,
    fullName: fullName.trim(),
    role,
    preferredLanguage: preferredLanguage?.trim() || 'en',
  };
}

export function validateLogin(body = {}) {
  const { email, password } = body;

  const errors = fieldErrors([
    { when: !email || typeof email !== 'string', field: 'email', message: 'Email is required.' },
    { when: !password || typeof password !== 'string', field: 'password', message: 'Password is required.' },
  ]);

  if (errors.length > 0) {
    throw badRequest('validation_failed', 'One or more fields are invalid.', { details: errors });
  }

  return { email: email.trim().toLowerCase(), password };
}

export function validateRefreshTokenBody(body = {}) {
  const { refreshToken } = body;

  if (!refreshToken || typeof refreshToken !== 'string') {
    throw badRequest('validation_failed', 'One or more fields are invalid.', {
      details: [{ field: 'refreshToken', message: 'Refresh token is required.' }],
    });
  }

  return refreshToken;
}
