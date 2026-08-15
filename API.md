# ElderCare — API Contract

**Version:** 0.2 — Phase 0 (authentication) + Phase 1 step 1 (SOS button and alert record)
**Base URL (development):** `http://localhost:5000`

This document is the agreement between the backend and the mobile app. Every endpoint the app is allowed to call is listed here. If you add an endpoint, add it to this file in the same Pull Request. If you need an endpoint that does not exist yet, raise it in the group rather than working around it.

The authentication endpoints and the emergency alert endpoints exist today. GPS ingestion, emergency contact notification, geofencing, and the caregiver endpoints arrive with later steps and phases and will be added to this file as they are built.

---

## Conventions

### Content type

Every request that has a body sends `Content-Type: application/json`. Every response is JSON.

### Success shape

Successful responses always carry `"status": "ok"` plus the fields documented for that endpoint.

```json
{ "status": "ok", "user": { "...": "..." } }
```

### Error shape

Failures always carry `"status": "error"`, a stable machine-readable `code`, and a human-readable `error`. The app should branch on `code`, never on the text of `error` — the wording may change, the code will not.

```json
{
  "status": "error",
  "code": "invalid_credentials",
  "error": "Phone/email or password is incorrect."
}
```

Validation failures add a `details` array so a form can highlight every bad field at once instead of one at a time:

```json
{
  "status": "error",
  "code": "validation_failed",
  "error": "One or more fields are invalid.",
  "details": [
    { "field": "phone", "message": "Phone or email is required." },
    { "field": "password", "message": "Password must be at least 8 characters." }
  ]
}
```

### Authentication

Protected endpoints expect the access token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Two kinds of token are issued together, and they are not interchangeable:

| Token | Lifetime | Where it goes | Can it be revoked? |
|---|---|---|---|
| `accessToken` | 15 minutes | `Authorization` header on every request | No — that is why it is short |
| `refreshToken` | 30 days | Body of `POST /auth/refresh` and `/auth/logout` only | Yes — it is stored server-side |

**The app must store both securely** (Expo `SecureStore`, not `AsyncStorage`). The refresh token is a long-lived credential; treat it like a password.

**Token expiry handling.** When any endpoint returns `401` with code `token_expired`, call `POST /auth/refresh` once and retry the original request with the new access token. Only send the user back to the login screen if the refresh itself fails.

**Rotation.** Every call to `/auth/refresh` returns a *new* refresh token and invalidates the one you sent. Always overwrite the stored token with the one you just received. Presenting a refresh token that was already exchanged is treated as theft: every session for that account is ended and the response is `401 refresh_token_reused`.

### Identity

**Phone is the login identity.** Email is optional — an account can be registered without one, and many elderly users will not have one. Login accepts either a phone number or an email address; if both are sent, phone is used.

#### Phone number format

**Stored form: E.164** — a `+`, the country code, then the national number, digits only, no spaces or punctuation. For example `+919876543210`. This is what `user.phone` contains in every response, and what the screens should display.

**Sent form: whatever the user typed.** The backend normalises the number before it looks anything up, so the app does not have to. All of these reach the same account:

| Sent | Normalised to |
|---|---|
| `9876543210` | `+919876543210` |
| `09876543210` | `+919876543210` |
| `919876543210` | `+919876543210` |
| `+919876543210` | `+919876543210` |
| `+91 98765 43210` | `+919876543210` |
| `+91-98765-43210` | `+919876543210` |
| `0091 9876543210` | `+919876543210` |

The rules, in the order they are applied:

1. Spaces, hyphens, brackets and dots are stripped.
2. A leading `00` is treated as `+`.
3. A number starting with `+` is taken at its word, whatever country it belongs to — `+14155552671` and `+442071838750` are both accepted.
4. A number with no country code is assumed to be Indian: exactly 10 digits, or 11 with the leading `0` trunk prefix, gets `+91`.
5. Twelve digits beginning `91` get a `+`.
6. Anything else is rejected with `validation_failed`.

The default country is configuration (`DEFAULT_CALLING_CODE`, `DEFAULT_NATIONAL_DIGITS`), not a constant, so serving another country later does not need a code change.

**What the registration screen should do:** show the country code as a fixed `+91` prefix beside a 10-digit field rather than leaving the user to type it. The backend accepts the other formats as a safety net for numbers pasted from a contacts list or typed by someone used to writing them differently — not as an invitation to leave the field free-form.

**Do not normalise in the app as well.** One implementation, on the server, is what keeps the two ends from ever disagreeing about which account a number belongs to.

### Roles

`elderly`, `family`, `caregiver`, `admin`. The role decides which home screen the app opens after login and which endpoints are permitted.

`admin` **cannot** be chosen at registration — attempting it returns `403 role_not_self_assignable`. Admins are promoted directly in the database.

---

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | — | Server and database liveness |
| `POST` | `/auth/register` | — | Create an account |
| `POST` | `/auth/login` | — | Exchange credentials for tokens |
| `POST` | `/auth/refresh` | — | Exchange a refresh token for a new pair |
| `POST` | `/auth/logout` | — | Revoke one refresh token |
| `GET` | `/auth/me` | Bearer | The caller's own record |
| `GET` | `/auth/admin/users` | Bearer + `admin` | List users |
| `POST` | `/emergency/alerts` | Bearer | Press SOS |
| `GET` | `/emergency/alerts` | Bearer | The caller's own alerts |
| `POST` | `/emergency/alerts/:id/cancel` | Bearer | "That was a mistake" — alert owner only |
| `POST` | `/emergency/alerts/:id/resolve` | Bearer | "This is handled" — owner or a permitted family member |
| `GET` | `/emergency/family/alerts` | Bearer + `family` | Active alerts for elderly users the caller is linked to |

---

### `GET /health`

Liveness plus database reachability. Useful for confirming the backend is up before debugging the app.

**Response `200`**

```json
{
  "status": "ok",
  "uptimeSeconds": 42,
  "db": {
    "connected": true,
    "database": "eldercare",
    "serverVersion": "PostgreSQL 18.4",
    "latencyMs": 2
  }
}
```

**Response `503`** — the server is running but cannot reach PostgreSQL. Deliberately not `200`: a backend that cannot reach its database is not healthy.

```json
{ "status": "error", "db": { "connected": false, "error": "..." } }
```

---

### `POST /auth/register`

Creates an account and logs it in immediately — the response includes tokens, so the app does not need to call `/auth/login` afterwards.

**Request body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `phone` | string | **yes** | Any accepted format — see [Phone number format](#phone-number-format). Stored as E.164 |
| `password` | string | **yes** | At least 8 characters, at most 72 bytes |
| `fullName` | string | **yes** | 1–120 characters |
| `role` | string | **yes** | `elderly`, `family` or `caregiver` |
| `email` | string | no | Valid address, 255 characters or fewer. Omit it entirely rather than sending `""` |
| `preferredLanguage` | string | no | ISO code such as `en`, `hi`, `te`. Defaults to `en` |
| `deviceLabel` | string | no | Shown on the active-sessions screen, e.g. `"Sree's Pixel 7"` |

The 72-byte password ceiling is bcrypt's limit — beyond it the tail is silently ignored, which would let two different passwords open the same account.

```json
{
  "phone": "+919876543210",
  "password": "correct-horse-battery",
  "fullName": "Ramesh Kumar",
  "role": "elderly"
}
```

**Response `201`**

```json
{
  "status": "ok",
  "user": {
    "id": "cc7e3c0f-640b-4a56-ad9c-ea100d4ce851",
    "phone": "+919876543210",
    "email": null,
    "fullName": "Ramesh Kumar",
    "role": "elderly",
    "preferredLanguage": "en",
    "profilePhotoUrl": null,
    "isActive": true,
    "lastLoginAt": null,
    "createdAt": "2026-08-12T13:54:28.604Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "K3Dvzwd_YqGz6bNogvxQ7G9Vw7BL0yeGK0n9BnLxhmM"
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `validation_failed` | A field is missing or malformed — see `details` |
| `403` | `role_not_self_assignable` | `role` was `admin` |
| `409` | `account_exists` | That phone number, or that email, is already registered |

---

### `POST /auth/login`

**Request body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `phone` | string | one of the two | Any accepted format — normalised the same way registration does |
| `email` | string | one of the two | Case-insensitive |
| `password` | string | **yes** | |
| `deviceLabel` | string | no | Shown on the active-sessions screen |

Send `phone` **or** `email`. If both are sent, `phone` is used and `email` is ignored.

```json
{ "phone": "+919876543210", "password": "correct-horse-battery" }
```

**Response `200`** — the same shape as `/auth/register`, with `lastLoginAt` populated.

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `validation_failed` | Neither identity sent, or the phone is malformed |
| `401` | `invalid_credentials` | No such account, or wrong password |
| `403` | `account_disabled` | The account has been deactivated |

`invalid_credentials` covers both "no such account" and "wrong password" on purpose. Distinguishing them would turn this endpoint into a way to discover which phone numbers are registered.

---

### `POST /auth/refresh`

Exchanges a refresh token for a new access token **and a new refresh token**. Replace both in storage.

**Request body**

| Field | Type | Required |
|---|---|---|
| `refreshToken` | string | **yes** |
| `deviceLabel` | string | no |

**Response `200`**

```json
{
  "status": "ok",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "8S0PnWQNTvYyBA6JPXC..."
}
```

**Errors**

| Status | Code | When | What the app should do |
|---|---|---|---|
| `400` | `validation_failed` | `refreshToken` missing | Fix the request |
| `401` | `invalid_refresh_token` | Not a token this server issued | Log the user out |
| `401` | `refresh_token_reused` | Already exchanged — all sessions ended | Log the user out and clear both tokens |
| `401` | `refresh_token_revoked` | The session ended normally | Log the user out |
| `401` | `refresh_token_expired` | Older than 30 days | Log the user out |
| `401` | `user_not_found` | The account was deleted | Log the user out |
| `403` | `account_disabled` | The account was deactivated | Show the deactivated message |

Every one of these means the same thing to the app: this session is over, return to the login screen. They are distinguished for debugging and for support, not because the app should behave differently.

---

### `POST /auth/logout`

Revokes one refresh token — the current device only. Other devices stay logged in.

**Request body**

| Field | Type | Required |
|---|---|---|
| `refreshToken` | string | **yes** |

**Response `200`**

```json
{ "status": "ok", "revoked": true }
```

`revoked` is `false` when the token was already revoked or was never valid. This endpoint returns `200` either way: logging out is not a place to tell an attacker whether the token they hold is real, and a client retrying a logout should not see it fail.

The access token is **not** revoked — it cannot be. It stops working within 15 minutes. The app must delete both tokens from storage itself.

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `validation_failed` | `refreshToken` missing |

---

### `GET /auth/me`

The caller's own record. Use it on app start to confirm a stored token is still good and to decide which home screen to open.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**

```json
{
  "status": "ok",
  "user": {
    "id": "cc7e3c0f-640b-4a56-ad9c-ea100d4ce851",
    "phone": "+919876543210",
    "email": null,
    "fullName": "Ramesh Kumar",
    "role": "elderly",
    "preferredLanguage": "en",
    "profilePhotoUrl": null,
    "isActive": true,
    "lastLoginAt": "2026-08-12T13:54:39.731Z",
    "createdAt": "2026-08-12T13:54:28.604Z"
  }
}
```

The user is reloaded from the database on every authenticated request, not read from the token. A deactivated account or a changed role therefore takes effect immediately rather than whenever the token happens to expire.

**Errors**

| Status | Code | When |
|---|---|---|
| `401` | `missing_token` | No `Authorization: Bearer` header |
| `401` | `invalid_token` | Signature or issuer does not check out |
| `401` | `token_expired` | Access token older than 15 minutes — call `/auth/refresh` |
| `401` | `user_not_found` | The account no longer exists |
| `403` | `account_disabled` | The account has been deactivated |

These five apply to **every** endpoint that requires a Bearer token, and are not repeated below.

---

### `GET /auth/admin/users`

The 50 most recently created users. Admin only.

**Headers:** `Authorization: Bearer <accessToken>` for a user whose role is `admin`

**Response `200`**

```json
{
  "status": "ok",
  "count": 2,
  "users": [
    {
      "id": "cc7e3c0f-640b-4a56-ad9c-ea100d4ce851",
      "fullName": "Ramesh Kumar",
      "email": null,
      "role": "elderly",
      "isActive": true,
      "createdAt": "2026-08-12T13:54:28.604Z"
    }
  ]
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| `403` | `insufficient_role` | A valid token, but the user is not an admin |

---

## Emergency alerts

Phase 1, step 1: the SOS button and the alert record only. Nothing here captures GPS (`latitude`/`longitude` on every alert are `null` for now) or sends a notification to anyone — those are separate steps and will extend this section when built. Every one of these endpoints requires `Authorization: Bearer <accessToken>`; the five error codes listed under [`GET /auth/me`](#get-authme) apply here too and are not repeated below.

### `POST /emergency/alerts`

Presses SOS for the signed-in user. `alertType` is always `sos`, `severity` is always `critical` — this button does not ask the person pressing it to grade their own emergency. No request body.

**Response `201`**

```json
{
  "status": "ok",
  "alert": {
    "id": "9c0c0c9c-f8de-4f25-9c76-2662e8f9a139",
    "userId": "68e6ca9c-a980-4509-b01d-cdc4c633bf95",
    "alertType": "sos",
    "status": "active",
    "severity": "critical",
    "latitude": null,
    "longitude": null,
    "message": null,
    "triggeredAt": "2026-08-15T06:51:50.230Z",
    "acknowledgedAt": null,
    "acknowledgedBy": null,
    "resolvedAt": null,
    "resolvedBy": null,
    "resolutionNotes": null,
    "createdAt": "2026-08-15T06:51:50.230Z",
    "updatedAt": "2026-08-15T06:51:50.230Z"
  }
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| `409` | `sos_already_active` | The caller already has an active SOS alert. The response carries `alert`, the existing one, in the same shape as above |

**`sos_already_active` is not a failure to show the person pressing the button.** A second press while one alert is already open almost always means the same emergency pressed twice, not a second one — the app should read this as reassurance ("help is already on the way"), never as an error screen. See `ElderlyHomeScreen.js`.

---

### `GET /emergency/alerts`

The caller's own alerts, newest first.

**Query parameters**

| Field | Required | Rules |
|---|---|---|
| `status` | no | One of `active`, `acknowledged`, `resolved`, `cancelled`, `false_alarm` |
| `limit` | no | Positive whole number, capped at 50. Defaults to 20 |

**Response `200`**

```json
{ "status": "ok", "count": 1, "alerts": [ { "...": "same shape as POST /emergency/alerts" } ] }
```

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `validation_failed` | `status` is not a recognised value, or `limit` is not a positive whole number |

---

### `POST /emergency/alerts/:id/cancel`

"That was a mistake" — only the person who triggered the alert may cancel it. A family member who believes it is a false alarm uses `resolve`, not `cancel`; only the person who pressed SOS can say it was pressed by accident.

**Request body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `note` | string | no | Up to 2000 characters, stored as `resolutionNotes` |

**Response `200`** — the updated alert, `status: "cancelled"`, same shape as `POST /emergency/alerts`.

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `validation_failed` | `id` is not a UUID, or `note` fails validation |
| `403` | `not_alert_owner` | The caller did not trigger this alert |
| `404` | `alert_not_found` | No alert with that id |
| `409` | `alert_not_active` | The alert is already cancelled, resolved, acknowledged or a false alarm |

---

### `POST /emergency/alerts/:id/resolve`

"This is handled/over" — the alert's owner, or a family member with an `active` `family_links` row to that elderly user **and** `can_acknowledge_alerts: true`.

**Request body:** same as `cancel` — optional `note`.

**Response `200`** — the updated alert, `status: "resolved"`.

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `validation_failed` | `id` is not a UUID, or `note` fails validation |
| `403` | `not_permitted` | The caller neither owns the alert nor has a permitted family link to its owner |
| `404` | `alert_not_found` | No alert with that id |
| `409` | `alert_not_active` | The alert is already closed |

---

### `GET /emergency/family/alerts`

Active alerts for every elderly user the caller has an `active` `family_links` row with. Role-gated to `family`.

**Every alert for every actively-linked elderly user is included**, regardless of `can_acknowledge_alerts` — a view-only family member still needs to know an emergency is happening, they just cannot close it out. Each alert carries `canAcknowledge` so the app knows whether to offer a "mark resolved" button; the `resolve` endpoint enforces the same permission server-side regardless of what the app shows.

**Response `200`**

```json
{
  "status": "ok",
  "count": 1,
  "alerts": [
    {
      "id": "9c0c0c9c-f8de-4f25-9c76-2662e8f9a139",
      "userId": "68e6ca9c-a980-4509-b01d-cdc4c633bf95",
      "alertType": "sos",
      "status": "active",
      "severity": "critical",
      "triggeredAt": "2026-08-15T06:51:50.230Z",
      "...": "remaining fields as in POST /emergency/alerts",
      "elderlyUser": { "fullName": "Test Elderly", "phone": "+919000000001" },
      "canAcknowledge": true
    }
  ]
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| `403` | `insufficient_role` | The caller's role is not `family` |

---

---

## For the login and registration screens

Phase 0 step 5, Teammate C. The app shell already handles tokens, refresh and role-based routing — the screens only have to collect credentials and hand the response over.

**Where the code goes:** `frontend/src/shared/screens/LoginScreen.js`. The comment block at the top of that file repeats all of this next to the code, and the temporary sign-in panel in it is scaffolding to delete once the real screen works.

**The whole handover is two lines:**

```js
import { login, register } from '../api/auth';
import { useAuth } from '../auth/AuthContext';

const { signIn } = useAuth();

// logging in
const response = await login({ phone, password });
await signIn(response);

// registering — the response carries tokens, so no second login call
const response = await register({ phone, password, fullName, role });
await signIn(response);
```

`signIn` stores both tokens in SecureStore and switches the navigator to the home screen for that user's role. **Do not navigate by hand and do not read the role yourself** — routing off `user.role` is already built in `src/shared/navigation/AppNavigator.js`.

**Which endpoints to call:** `POST /auth/login` and `POST /auth/register`, both documented above. Nothing else. `/auth/refresh` is handled inside the API client; a screen never calls it.

**Do not reformat the phone number.** Send the field exactly as typed — the backend normalises to E.164 and is the only place that does. Show `+91` as a fixed prefix beside a 10-digit input so most people type ten plain digits, but do not strip, pad or rewrite what they enter.

**Errors** come back as `ApiError` with `.status`, `.code` and `.details`, or `NetworkError` when the request never arrived. Branch on `.code`: `invalid_credentials`, `account_exists`, `account_disabled`, `role_not_self_assignable`, `validation_failed`. On `validation_failed`, `.details` lists every bad field at once — show each message against its own input.

**Roles the form may offer:** `elderly`, `family`, `caregiver`. Not `admin` — the server rejects it with `403 role_not_self_assignable`.

---

## Not yet built

Everything below is planned but does not exist. Do not code against it — it will be specified here first.

| Area | Phase | Owner |
|---|---|---|
| GPS ingestion, emergency contacts, notification fanout (SMS/call/push) | 1 | Sree |
| Caregiver profiles, search, booking, scheduling, attendance | 2 | [Teammate B] |
| Geofences, breach detection, live location over WebSockets | 3 | Sree |
| Care plans, activity reports, tasks, reviews | 4 | [Teammate B] |
| Ambulance booking, disaster alerts, response centre, fall trigger | 5 | [Teammate C] |
| Device token registration for push notifications | 1 | Sree |
| Family links — invitations, approval, permissions | 1 | Sree |

**Done as of this version:** `POST /emergency/alerts`, `GET /emergency/alerts`, `POST /emergency/alerts/:id/cancel`, `POST /emergency/alerts/:id/resolve`, `GET /emergency/family/alerts` — see the "Emergency alerts" section above. `family_links` rows themselves must still be created directly (no invite/approve endpoint yet), so the family screen has nothing to show until one exists.
