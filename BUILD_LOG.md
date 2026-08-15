# ElderCare — Build Log

A running record of what was built, when, and why. Each entry says what changed, what the alternatives were where there was a real choice to make, and what was left open.

**How to use this file:** append an entry after every completed step, and commit the log update in the same commit as the work it describes. Newest entries go at the bottom. Write it so someone who was not watching the build can follow it — plain English, no shorthand.

**Rule, stated plainly because it has drifted before (see the 2026-08-15 audit entry below): every commit that changes code also updates this file, in that same commit.** A log-only commit (fixing a stale entry, backfilling a gap) is fine. A code commit with no log entry is not — not even for something that feels too small to write up. If it's small, the entry is one sentence.

Entries before 2026-08-12 were reconstructed from the git history and the files themselves, so they record the decisions but not always the discussion behind them.

---

## 2026-08-05 — Repository created

**Commits:** `d840005`, `17beca2`, `1d402d4`

The GitHub repository `sreenidhi2545/elder-care` was created with an initial folder structure and a README. `main` was set as the stable branch, with work happening on per-member feature branches and reaching `main` only through a Pull Request.

**Why branches per member rather than everyone on `main`:** three people building three modules at once will collide constantly on a shared branch, and a broken `main` blocks everyone. The cost is the overhead of opening a Pull Request for each phase, which is small and buys a reviewable history.

---

## 2026-08-06 — Project report and database design

**Commit:** `0f8c280`

Two documents were added: `PROJECT_REPORT.md`, converted from the client-facing PDF so the plan lives next to the code, and `SCHEMA_DESIGN.md`, a full design for all 19 tables — every column with its type, its constraints, and the reason it exists.

**Why design the whole database at Phase 0 rather than table by table per phase:** the alternative is adding tables as each phase needs them, which means schema migrations landing in the middle of three people's parallel work and a real chance of two modules defining conflicting versions of the same concept. Designing it once up front costs a slower start and means some tables sit empty until Phase 5, which is the cheaper trade.

The decisions recorded in that document, each with the option that was rejected:

| Decision | Alternative rejected | Reason |
|---|---|---|
| UUID primary keys | Auto-incrementing integers | The phone can generate an ID offline — an SOS press cannot wait for the server. Sequential IDs also leak how many users exist and let an attacker walk the list. Costs 16 bytes per key instead of 4, irrelevant at this scale |
| `TIMESTAMPTZ` everywhere | Plain `TIMESTAMP` | A wall-clock reading with no timezone makes "the alert fired at 14:32" ambiguous the moment a family member travels. For an emergency product, when something happened must never be ambiguous |
| PostgreSQL `ENUM` types for fixed value sets | `VARCHAR` with values checked in code | The database rejects a typo like `acknowleged`; in a text column that typo becomes a row no query matches, which here means an alert nobody sees. Costs a one-line `ALTER TYPE` migration to add a value later |
| `NUMERIC(9,6)` coordinates | `FLOAT` | Six decimal places is about 11 cm, more than consumer GPS delivers. `NUMERIC` is exact; `FLOAT` produces values like `12.971598999999999` that break equality and look wrong in reports |
| `NUMERIC(10,2)` money with an explicit currency column | `FLOAT` | Floating-point rounding errors in billing are not acceptable, and an amount without a currency is ambiguous |
| No PostGIS — circular zones only | PostGIS with polygon geofences | A circle is a centre and a radius, checkable on the phone as well as the server, with no extension to install on every machine. Gives up polygon zones and efficient "everyone within 5 km" queries — neither is needed by any phase |
| Delete behaviour chosen per foreign key | Leaving it at the default | Unspecified means PostgreSQL blocks the delete, which surfaces as a confusing 500 months later. Each key is now `CASCADE`, `SET NULL` or `RESTRICT` on purpose |
| Soft delete via `is_active` | Deleting rows | If an elderly user is removed, their alert history must survive for the family's records and any dispute |
| `family_links` separate from `emergency_contacts` | One combined contacts table | They answer different questions: who to phone in an emergency, versus who may watch this person's live location. A helpful neighbour should be callable without being granted permanent access to someone's movements |
| Refresh tokens stored, hashed with SHA-256 | Stateless tokens only | A stored token can be revoked, which is what makes "log out my other devices" and "this phone was stolen" possible. Hashed so a leaked database yields no usable sessions |
| `device_tokens` as its own table, unique on the token | One push-token column on `users` | A user may have a phone and a tablet. One column means the second device silently overwrites the first and that person stops receiving alerts with nothing logged and nothing failing |
| Identity document numbers not stored at all | Storing Aadhaar/PAN numbers | Regulated personal data creates obligations a small team cannot meet, and nothing in any phase reads the number back. Kept: which document type was checked, whether it passed, when, and by whom |
| Alerts carry their own copy of the coordinates | Relying on the `location_id` link alone | An SOS can fire before any GPS reading is stored, and the 30-day location purge would otherwise erase where someone was during an old emergency |
| Caregiver rating cached on `caregivers` | Computing the average live from `reviews` | A list of twenty caregivers would otherwise mean twenty aggregate queries on every scroll |

**Deferred at this point:**
- Location retention was fixed at 30 days as a policy, but the deletion job itself was pushed to Phase 6. Until it runs the `locations` table simply grows, which is harmless at Phase 0 and 1 volumes.
- `caregivers.average_rating` and `total_reviews` are not maintained by the database. The application must recalculate them in the same transaction that writes a review.
- The database prevents two visits starting at the exact same time for one caregiver, but not overlapping visits (9–11 against 10–12). The application has to check for overlap.
- Whether the client requires identity document numbers to be stored after all was left as an open question to raise with them.

---

## 2026-08-08 — Secrets protection, schema applied, backend and auth

### `.gitignore` (`8842ba7`)

Rules added so `.env`, `node_modules/`, build output and editor files are never committed. `.env.example` is the template everyone copies.

**Why a template file rather than sharing a working `.env`:** a real `.env` in the repository is a leaked database password and a leaked JWT signing key, and once pushed it is in the history permanently.

### Database schema applied (`c91eba4`)

`backend/shared/db/schema.sql` was written and run: 19 tables, 17 enum types, and a shared `set_updated_at()` trigger function wired to all 17 tables that have an `updated_at` column.

**Why a trigger for `updated_at` rather than setting it in each query:** every write path would otherwise have to remember, and the one that forgets produces a row that quietly lies about when it last changed.

One index was added beyond the obvious ones: `idx_alerts_location` on `alerts(location_id)`. The Phase 6 location purge depends on that foreign key's `ON DELETE SET NULL`, which without an index scans the entire `alerts` table once per deleted location row.

Verified by creating the `eldercare` database and running the file end to end against PostgreSQL 18.4 with `ON_ERROR_STOP=1`, so any error would have aborted rather than leaving a half-built schema.

### Backend server and connection pool (`460374e`)

Express 5 on Node, started with `npm start` from `backend/`. Structure: `server.js` starts the listener, `app.js` builds the application without binding a port, `shared/config/env.js` is the only file that reads `.env`, `shared/db/pool.js` is the only file that imports the `pg` driver.

Decisions in this layer:

- **The server verifies the database connection before binding the port.** The alternative — start listening and discover the problem on the first request — turns a wrong `DATABASE_URL` into a confusing runtime error instead of a clear startup failure.
- **`GET /health` returns 503, not 200, when PostgreSQL is unreachable.** A backend that is running but cannot reach its database is not healthy, and reporting 200 would hide the outage.
- **A connection pool of 10, not one connection per request.** Opening and authenticating a TCP connection costs several round trips and would dominate every endpoint's response time.
- **Configuration read in one place and frozen.** A missing `DATABASE_URL` or `JWT_SECRET` exits at startup with a message naming the file, rather than failing deep inside a request. A `JWT_SECRET` shorter than 32 characters warns but does not exit, so development is not blocked — this must be fixed before deploying.
- **Graceful shutdown on SIGINT/SIGTERM.** Without it, Ctrl+C leaves sessions open on the database server.

### Authentication module (`460374e`, `bca974a`)

Six endpoints: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `GET /auth/admin/users`. Plus `requireAuth` and `requireRole` middleware in `shared/auth/`, written to be used by the emergency and caregiver modules later, not only by these routes.

The decisions, each against its alternative:

- **Two token types.** A 15-minute JWT access token that needs no database lookup to verify, and a 30-day random refresh token stored as a row. The access token is short precisely because it cannot be revoked; the refresh token can be long because it can.
- **Refresh tokens hashed with SHA-256, not bcrypt.** The column is UNIQUE and has to be looked up by value, and bcrypt salts every hash differently so an equality lookup could never match. This is only safe because the token is 256 bits of randomness rather than a guessable password. Passwords themselves use bcrypt at 12 rounds.
- **Passwords capped at 72 bytes.** bcrypt reads only the first 72 bytes and silently ignores the rest, so without the cap two different long passwords could open the same account.
- **Refresh tokens rotate on every use, and reuse is treated as theft.** Presenting a token that was already exchanged means two parties hold the same secret, and there is no way to tell which one is the real user — so every session for that account is ended. The rotation is a single data-modifying statement so there is never a moment where the old token is dead and no replacement exists.
- **`requireAuth` reloads the user from the database on every request** instead of trusting the claims in the token. A JWT cannot be recalled, so without this a deactivated account would keep working until its token expired. One primary-key lookup is a cheap price for revocation taking effect immediately.
- **Login returns one message for "no such account" and for "wrong password".** Distinguishing them would turn the endpoint into a way to discover which accounts exist. For the same reason the unknown-account path still runs a password hash, so the response timing does not give the answer away either.
- **Logout returns 200 whether or not the token was real.** Telling an attacker their token was recognised is information they should not get, and a client retrying a logout should not see a failure.
- **`admin` cannot be self-assigned at registration.** A public endpoint that grants admin is a privilege-escalation hole. Admins are promoted directly in the database.
- **Registration relies on the database's unique constraint rather than a pre-check.** Two simultaneous registrations would both pass a pre-check; only the database can actually decide.
- **Validation collects every problem and returns them together** in a `details` array, so a form can highlight all the bad fields at once.

**Left open at this point:** no `API.md`, so all six endpoints were undocumented. No tests. No mobile app of any kind.

---

## 2026-08-12 — Audit, login identity fix, documentation

A full status check was run against the repository and the live database, because the documented state and the real state had drifted.

**What the audit found:** the database was correct — all 19 tables, 17 enums and 17 triggers present and matching the design, including the revision-2 removal of `id_proof_number`. The backend and auth module both worked; the full flow was exercised end to end, including refresh rotation, reuse detection and the role gate. But `WORK_DIVISION.md` still described Phase 0 as one step of six when three were done, `SCHEMA_DESIGN.md` still said nothing had been run against a database, `PROJECT_REPORT.md` had been deleted from the working tree, `API.md` did not exist, the `backend/emergency/` and `backend/caregiver/` folders described in the project report did not exist, and `WORK_DIVISION.md` itself was sitting outside the repository where teammates could not read it.

### Phone made the login identity (`18fe144`)

**The problem:** `SCHEMA_DESIGN.md` states that phone is the primary login identity, chosen because many elderly users in India have a phone but no email address they check, and `WORK_DIVISION.md` specifies a "phone/email + password" login form. The code did the opposite — it required an email at registration and looked users up by email alone at login. No account could be created without an email, and the login screen as specified could not have been built.

**The decision:** change the code to match the design rather than change the design to match the code. The design reason is a real constraint about the people using this product, and the code was simply written before anyone checked.

- Registration no longer requires an email. An absent or empty one is stored as `NULL`, not an empty string — `users.email` is a nullable UNIQUE column, and PostgreSQL permits many NULLs but only one empty string, so empty strings would let exactly one account exist without an email.
- Login accepts phone or email and requires one of them. **Phone wins when both are sent.** The alternative was an `OR` across two unique columns, which can match two different accounts and leaves the result depending on which row the query read first.
- The invalid-credentials message no longer names email specifically.

Verified against the running server: registration without an email, two phone-only accounts coexisting, login by phone, login by email still working, neither identity rejected as 400, wrong password as 401, duplicate phone as 409, and a malformed email still rejected when one is supplied.

### Module folders (`1578b7f`)

`backend/emergency/` and `backend/caregiver/` created, each holding a `.gitkeep` until its first real file arrives in Phase 1 and Phase 2. Git does not track empty directories, so without the placeholder the folders exist on one machine and nowhere else.

### `API.md`, `WORK_DIVISION.md`, and stale status corrected (`68af6fb`)

`API.md` written, covering `/health` and all six auth endpoints: request fields with their rules, response bodies, and every error code per endpoint. It also records the conventions the mobile app depends on — the success and error shapes, the `details` array, the `Authorization: Bearer` header, both token lifetimes, and the rule that every `/auth/refresh` call returns a new refresh token that must replace the stored one.

`WORK_DIVISION.md` copied into the repository root, its Phase 0 table corrected to three of six, and the completed work for the backend server and auth module written up. `SCHEMA_DESIGN.md`'s header no longer claims that nothing has been run against a database.

### Test data cleaned up

The `promoted@test.eldercare.local` admin account was deleted from the development database, along with the probe accounts created during the audit. Three test users remain: one elderly, one family, one caregiver.

**Consequence:** there is now no admin account, so `GET /auth/admin/users` cannot be exercised until someone is promoted with `UPDATE users SET role = 'admin' WHERE phone = '+91...'`.

### Frontend folder structure

`.gitkeep` added to `frontend/src/emergency/`, `frontend/src/caregiver/` and `frontend/src/shared/`. The folders existed on one machine but, being empty, were in nobody's clone — so the structure `PROJECT_REPORT.md` section 5 describes now actually exists in the repository.

### Housekeeping

The stale copies of `WORK_DIVISION.md` and `ElderCare_Work_Division.docx` outside the repository were deleted, so there is one copy of that document and it is the one under version control.

### Phone numbers normalised to E.164 — closes the open issue above

Done before the Expo shell, deliberately: the rule has to exist before the registration screen is written against it, and migrating accounts is trivial now and awkward once real people have signed up.

**The problem:** `users.phone` is UNIQUE on the exact string it was given. Registration accepted `9876543210`, `+919876543210` and `919876543210` as three different values, so one person could create three accounts and then fail to log in with whichever format they did not use that day.

**The decision:** normalise on the server, in one place, and apply it to registration and login identically. `backend/shared/phone.js` reduces every accepted way of writing a number to `+<country code><national number>` — digits only.

The alternatives considered:

- **Validate strictly and reject anything that is not already E.164.** Rejected: it pushes the problem onto every screen and onto the user, and a number pasted from a phone's contacts list very often carries spaces or brackets. Being strict about storage and forgiving about input is the better split.
- **Normalise in the mobile app instead.** Rejected: two implementations of the same rule drift, and the moment they disagree the two ends disagree about which account a number belongs to. The server is the only place that can be authoritative. `API.md` tells the screens not to normalise.
- **Use libphonenumber.** Rejected for now: it carries the numbering plans of every country in the world at a cost of several megabytes, to solve a problem that today is one country. The module's header says to swap it in rather than grow a country table by hand if the product ever ships outside India.

**Where the default country lives:** `DEFAULT_CALLING_CODE` and `DEFAULT_NATIONAL_DIGITS` in configuration, defaulting to `91` and `10`, not constants in the code. More importantly, any number already written in international form — starting `+` or `00` — is accepted as it stands for any country. `+14155552671` and `+442071838750` both pass today. The default country only decides what a *bare* national number means, so nothing here has to be unpicked to serve a second country later.

**What it accepts.** Verified against the running server: `9876543210`, `09876543210` (trunk prefix), `919876543210`, `+919876543210`, `+91 98765 43210`, `+91-98765-43210`, `(98765) 43210` and `0091 9876543210` all reduce to `+919876543210`. Registering the first created one account; the other formats then returned `409 account_exists` rather than making a second. Logging in with any of the seven returned the same user id. `12345`, `98765432101` and `abcdefghij` are rejected with `validation_failed`.

**Migration.** `backend/scripts/normalize-phones.js` rewrites existing rows, importing the same `normalizePhone` so the migration cannot drift from the running rule. It is a dry run by default and needs `--apply` to write, because it rewrites the column every account is identified by. It refuses to write anything if two rows would reduce to the same number — that means one person registered twice and a human has to decide which row survives; the UNIQUE constraint would have caught it, but only one clash at a time.

Run against the development database, it reported **3 rows examined, 3 already canonical, 0 rewritten, 0 collisions**. The three test accounts were already stored with a `+` prefix, so the migration was a no-op for them. Teammates should still run it once against their own databases, where locally created test rows may not be.

**Left open:** those three test accounts are `+91990000001` and similar — nine national digits, so not real Indian numbers. They pass because a number already in international form is accepted at face value for any country, and enforcing a national-number length for every country is exactly the job that needs libphonenumber. Harmless for test data; worth knowing if someone wonders why an obviously wrong number was allowed.

---

## 2026-08-12 — Expo app shell (Phase 0, step 4)

The mobile app, shell only: it runs, it knows who is signed in, it talks to the backend, and it sends each role to a different home screen. No features — those are Phases 1, 2 and 5.

### The project

Expo SDK 57 (React Native 0.86, React 19.2) created with the blank template. It was scaffolded into a temporary folder and merged into `frontend/` rather than generated in place, because `create-expo-app` refuses a non-empty directory and `frontend/src/` already held the module folders.

`index.js` at the root hands `src/App.js` to Expo, so all application code stays under `src/` in the layout `PROJECT_REPORT.md` section 5 documents.

Dependencies, all pinned by `npx expo install` so they match the SDK: `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-safe-area-context`, `expo-secure-store`, `expo-constants`. No HTTP client library — the built-in `fetch` is enough, and an extra dependency here would only wrap it.

### React Navigation rather than Expo Router

Expo Router is the current Expo default and is file-based: routes are files under an `app/` directory, and role routing is done with route groups and redirects.

React Navigation was chosen because role routing becomes an ordinary `switch` on `user.role` in one readable file, and because everything stays inside `src/{emergency,caregiver,shared}` — the structure both project documents already describe. Expo Router would have pulled the screens out into a parallel `app/` tree and split the layout across two conventions. The cost is writing navigators by hand instead of getting them from the filesystem, which for a shell this size is a few dozen lines.

### How the backend address is found

A phone is not the computer, so `http://localhost:5000` on a handset means the handset and every request fails with an unexplained network error. `src/shared/config.js` resolves the address in three steps: `expo.extra.apiUrl` from `app.json` if set, otherwise the IP of the computer running Metro — which Expo already tells the app so it can fetch the JavaScript bundle, and which is the same machine running the backend in development — and finally `localhost`.

The alternative was making every developer look up their own IP and edit a file before anything worked. Reusing the address Expo already provides means the app finds the backend with no configuration at all.

### Tokens

`expo-secure-store`, not `AsyncStorage`. AsyncStorage is an unencrypted file in the app sandbox; SecureStore uses the iOS Keychain and Android EncryptedSharedPreferences. The refresh token is a 30-day credential for someone's emergency account and belongs behind the same door as a password. Storing it is also what keeps a user signed in across restarts.

SecureStore has no web implementation, so the browser falls back to an in-memory map — tokens do not survive a page reload there. Accepted: the web target is only for a quick look at a screen, and the product ships to phones.

### The API client

`src/shared/api/client.js` is the only file that knows how to reach the backend. For an authenticated request it attaches the Bearer token; on `401 token_expired` it calls `/auth/refresh`, stores the new pair and retries the original request exactly once; if the refresh itself fails it clears the tokens and drops the app to the login screen. A screen therefore never sees a token and never handles an expiry.

**Concurrent refreshes share one promise.** Several screens can be loading at once, and if the access token has just expired they all get a 401 together. Without the shared promise each would start its own refresh, the first would rotate the token, and the rest would present one that had already been exchanged — which the backend correctly reads as theft and answers by ending every session for the account. The bug would have looked like random logouts under load.

Requests carry a 15-second timeout via `AbortController`. Without one, a request to an unreachable backend hangs until the platform gives up, which on a phone is a minute of spinner and no explanation.

The client holds no React state; `AuthContext` injects what it needs through `configureApiClient`, which keeps it importable from anywhere without a circular dependency back into the component tree.

### Auth state and routing

`AuthContext` has three states: `restoring`, `signedOut`, `signedIn`. `restoring` exists as its own state so a returning user does not see the login screen flash before their home screen replaces it — reading SecureStore and confirming the token with `/auth/me` takes a moment.

Tokens live in a ref rather than in state, because the client reads them from callbacks that can run mid-request and a value captured in a closure can be one render stale — here that would mean sending a token that had just been rotated away.

`RootNavigator` swaps the whole tree on that state rather than navigating between an auth stack and an app stack, so signing out cannot leave a screen behind for someone to swipe back into. `AppNavigator` then gives each role its own navigator, so Phase 1 can add emergency routes to the elderly and family stacks without those routes existing for a caregiver at all — a screen a role should not reach is better absent than merely unlinked.

**This is navigation, not security.** An elderly user cannot reach the admin screen, but the reason they cannot read admin data is that the server checks the role on every request.

### Screens

Four placeholders, one per role, each in its owning module's folder: elderly and family under `emergency/`, caregiver under `caregiver/`, admin under `shared/` since it belongs to no module. Each shows the signed-in user, the backend address and its health, and what arrives in later phases — between them enough to prove storage, token, request and routing all work. All four are replaced in Phases 1, 2 and 5.

### The login screen is left for Teammate C

`src/shared/screens/LoginScreen.js` is a placeholder carrying the instructions: what to build, which endpoints to call, the two-line handover to `signIn()`, the error codes to branch on, and the rule not to reformat phone numbers. The same instructions are in `API.md` under "For the login and registration screens".

It also carries a temporary sign-in panel — two inputs and a button, marked on screen and in the code as Teammate C's to delete. Without it there is no way to reach any home screen, so the routing built in this step could not be tested at all. It calls the same `login()` and `signIn()` the real screen will, so it exercises that path too. It has no validation, no registration and no accessibility work, all of which are the real screen's job.

### Test accounts

`backend/scripts/seed-test-users.js` creates one account per role, all sharing a password passed on the command line so no working credential is committed. Re-running with a different password updates the accounts instead of colliding.

It writes to the database directly rather than calling the API, because `admin` cannot be self-assigned through `/auth/register` — seeding through the API would mean three accounts and then a manual SQL step for the fourth. It uses the same `hashPassword` and `normalizePhone` the API uses, so the rows are identical to registered ones, and it refuses to run with `NODE_ENV=production`.

The accounts carry no email address, which exercises the phone-only path.

### Verified

A real Metro production bundle of the current tree: `Android Bundled 839 modules`, no errors or unresolved imports — that exercises the entire import graph from the entry point through to SecureStore. `npx expo install --check` reports every dependency matching SDK 57.

Against the running backend, all four seeded accounts log in and return the right role, each typed in a different phone format (`9000000001`, `+919000000002`, `919000000003`, `09000000004`), and the admin account reaches `/auth/admin/users` with a 200.

Not verified, because it needs the device: that the phone reaches the backend over Wi-Fi, that SecureStore survives a restart, and that each role visibly lands on its own screen.

---

## 2026-08-12 — Downgraded to Expo SDK 54, and a configuration bug it exposed

### Why

Expo Go on the phone refused the project: it was built on SDK 57, and the Expo Go in the app stores does not support that.

Expo's own changelog explains it. **Expo Go in both the App Store and Google Play is on SDK 54**, and SDK 56 and 57 are not available in either store with no timeline for when they will be — Apple has not approved the newer submissions for months. Newer SDKs can only be run through a development build, through `eas go` with an Apple Developer membership, or in a simulator.

So the SDK the project targets is not really a choice: **anything above 54 cannot be opened in Expo Go on a real phone**, and running on a real phone through Expo Go is exactly what the setup checklist in `WORK_DIVISION.md` asks every team member to do.

### The decision

Target SDK 54. The alternatives were both worse for this team:

- **A development build.** More capable — it is where the project has to go eventually, since Twilio and background location in later phases will need native modules Expo Go cannot provide. But it means every teammate installing Android Studio or holding an Apple Developer membership, and a build step before anyone can see a screen. Not the right cost at Phase 0, when the point is that three people can run the app today.
- **`eas go` with TestFlight.** Needs a paid Apple Developer membership and puts the iOS build behind an invite. Same objection, plus money.

SDK 54 is a year of tooling behind the newest, and nothing the project uses needs anything newer. When a development build becomes necessary for Phase 1's native modules, the SDK can move at the same time.

### What changed

`expo` pinned to `~54.0.0`, then `npx expo install --fix` realigned everything else to what that SDK expects:

| Package | Was (SDK 57) | Now (SDK 54) |
|---|---|---|
| `expo` | 57.0.12 | 54.0.36 |
| `react-native` | 0.86.2 | 0.81.5 |
| `react` | 19.2.3 | 19.1.0 |
| `expo-secure-store` | 57.0.1 | 15.0.8 |
| `expo-constants` | 57.0.10 | 18.0.13 |
| `expo-status-bar` | 57.0.1 | 3.0.9 |
| `react-native-screens` | 4.26.2 | 4.16.0 |
| `react-native-safe-area-context` | 5.7.0 | 5.6.2 |

The React Navigation packages are not Expo-managed and did not move; version 7 supports React Native 0.81. No application code needed changing for the downgrade — every API the shell uses is present in both SDKs.

`npx expo install --fix` also added `@expo/ngrok` as a dependency, which was removed again. It is a tool for `expo start --tunnel`, not something the app uses at runtime.

### A real bug this uncovered

Checking the resolved configuration afterwards showed `extra.apiUrl` coming out as `{}` — an empty object — where `app.json` said `null`.

Expo normalises a `null` in `app.json` to `{}`, and `{}` is truthy in JavaScript. The check in `src/shared/config.js` was `if (configured)`, so it would have accepted that object and produced a base URL of the string `"[object Object]"`. **Every request from the app would have failed**, with a network error pointing at the Wi-Fi or the firewall rather than at a configuration value nobody would have thought to look at.

Fixed at both ends, because either alone would leave the trap in place:

- `app.json` no longer carries an `apiUrl` key at all. The comment beside it now says what to add when you want to override the address, and warns not to write `null` there.
- `config.js` accepts the value only if it is a non-empty string, rather than merely truthy.

It had not been caught earlier because the bundle check proves the code compiles, not that it computes the right address, and the app had never been run on a device.

### Verified

`npx expo config` reports `sdkVersion 54.0.0` and `extra.apiUrl` as `undefined`. `npx expo install --check` reports every dependency matching SDK 54. A Metro production bundle succeeds: 838 modules, Hermes bytecode generated, no errors or unresolved imports.

Still not verified on a device — that is the next thing to do, and now it is possible.

---

## Open issues

Things known to be wrong or undecided. Each should be closed before the work that depends on it starts.

### Closed

- **Phone numbers not normalised** — closed 2026-08-12. Normalised to E.164 in `backend/shared/phone.js`, applied by both `validateRegister` and `validateLogin`, documented in `API.md`, existing rows migrated. See the entry above.

### Open

- **`emergency_contacts.phone` is not normalised yet.** The table is empty, so there is nothing to migrate, but Phase 1 must run contact numbers through `normalizePhone` when it starts writing them — otherwise the same duplicate problem reappears on a table where a duplicate means someone gets called twice and someone else not at all.
- **No tests.** Every verification so far has been manual `curl` against a running server, plus a Metro bundle for the app. Nothing catches a regression automatically. `shared/phone.js` is the first piece of pure logic in the codebase with enough branches to be worth unit tests, and it is the natural place to start.
- **The temporary sign-in panel** in `frontend/src/shared/screens/LoginScreen.js` must go when the real login screen lands. It is marked on screen and in the code, but nothing enforces its removal.
- **The app shell is unverified on a real device.** It bundles and the backend calls are proven, but nothing has confirmed the phone reaches the backend over Wi-Fi, that SecureStore persists across a restart, or that each role visibly lands on its own screen.
- **`npm audit` reports 19 vulnerabilities** (8 moderate, 11 high) in the frontend tree, effectively all in transitive build tooling rather than anything shipped to the phone. `npm audit fix` is deliberately not run — on an Expo project it breaks the SDK version alignment that `npx expo install` maintains.
- **Expo Go caps the SDK at 54.** Phase 1 needs native modules Expo Go cannot provide — Twilio, background location, push notifications beyond the basics — so a development build is coming whether or not the SDK moves. Worth planning before Phase 1 rather than discovering it mid-phase.
- **No mobile app.** Phase 0 steps 4 and 5 — the Expo shell and the login and registration screens — are the remaining work, and there is no frontend code at all yet.
- **No admin account** in the development database, so the admin-only endpoint cannot be tested until one is promoted.
- **`JWT_SECRET` length is only a warning, not a startup failure.** Acceptable in development; it must not reach a deployment that way.
- **Location retention purge** is deferred to Phase 6. The `locations` table grows without bound until it is written.
- **`caregivers.average_rating` and `total_reviews`** are not maintained by the database. Whoever builds reviews in Phase 4 must recalculate them in the same transaction that writes the review.
- **Overlapping caregiver visits** are not prevented by the database, only identical start times. The application has to check.
- **Identity document numbers** are deliberately not stored. If the client requires them, the answer is a hash plus the document in a separate access-controlled store — not a plain column.
- **Whether `can_acknowledge_alerts` should also permit cancelling an alert, not just resolving it.** Left open deliberately at your request — see the 2026-08-15 entry below for the case on each side. A one-line change in `backend/emergency/routes.js` either way.
- **The SOS button flow is unverified on a real device.** Bundling proves it compiles; it does not prove the 5-second countdown, the confirm-to-cancel step, or the polling behaviour hold up under an actual press on an actual phone. See the 2026-08-15 entry below.

---

## 2026-08-14 — `SETUP.md`

**Why now:** every setup step so far has been reconstructed from git history and from whoever did it originally. A new teammate cloning the repo on a fresh Windows machine had nothing that walked them through it end to end, and the project documents that do exist (`API.md`, `SCHEMA_DESIGN.md`, `WORK_DIVISION.md`) assume the reader already has the environment running.

`SETUP.md` was written for someone who has never set up a development environment before: every command spelled out, no assumed knowledge. It covers, in order: installing Git, Node.js, VS Code, PostgreSQL 18 and Expo Go; cloning the repo and creating a feature branch; adding `psql` to PATH and why a new terminal is required afterwards; creating the `eldercare` database, running `backend/shared/db/schema.sql`, and confirming all 19 tables exist with `\dt`; creating `.env` from `.env.example` with a table explaining what each value means and a warning that the file is gitignored and must never be committed; `npm install` in both `backend/` and `frontend/`; seeding the four test accounts with `backend/scripts/seed-test-users.js` and what each is for; running the backend and Expo and scanning the QR code from Expo Go; and verifying the result with the `/health` endpoint, a login, and confirming the right role screen loads.

It states plainly near the top that this is an Expo/React Native mobile app, not a website — no `index.html`, no Vite, the UI runs on a phone through Expo Go, not in a browser. This was worth saying explicitly because nothing else in the repository says it, and someone's first instinct on seeing a `frontend/` folder is reasonably to look for a page to open.

**Troubleshooting section:** written from the problems the team actually hit, all traceable to entries already in this log — `psql` not recognised until PATH is edited and a new terminal opened (section 3 above), a forgotten `postgres` password with no real recovery short of reinstalling on a machine with nothing at stake yet, Expo Go capping the SDK at 54 (the 2026-08-12 SDK downgrade entry above), the phone unable to reach the laptop over Wi-Fi (network isolation, Windows Firewall's first-run prompt, or the `apiUrl`/`null`/`{}` trap from the same entry), and the wrong-folder confusion between the repo root and `backend/`/`frontend/`, which have their own separate `package.json` files.

---

## 2026-08-14 — Lockfiles updated (`9b495c5`)

**Backfilled 2026-08-15** — this commit had no log entry at the time; see the audit entry below.

`backend/package-lock.json` and `frontend/package-lock.json` updated to match `package.json` after routine dependency work earlier the same day. No dependency was added or removed and no version was deliberately bumped; this is `npm install` recording an already-current lockfile, not a decision. Twelve lines changed, nothing to verify beyond `npm install` completing clean.

---

## 2026-08-14 — Merge conflict: a Vite scaffold under `frontend/`

**What happened.** Before the Expo shell (2026-08-12, above) was merged, a teammate had separately scaffolded a Vite web app directly into `frontend/` on `main` (`2c5a24e`, merged via PR #2 from `feature/caregiver`) — `frontend/index.html`, `frontend/src/main.jsx` (a plain `react-dom` app), and a stray root-level `package-lock.json` with no matching root `package.json`, evidently left over from running `npm install` at the repository root by mistake. Landing that on `main` before the Expo work merged meant the pull request from `feature/emergency` into `main` conflicted on `frontend/package.json` and `frontend/package-lock.json` — one side had Expo and React Native, the other had Vite and `react-dom` for the same file.

**Why Expo won outright, not a merge of both.** This project is a mobile app that runs on a phone through Expo Go — see `SETUP.md`'s opening section. A web frontend under the same folder is not a second flavour of the same app; Expo and Vite cannot coexist in one `package.json`, and nothing in any project document describes a web client. The Vite scaffold was scope creep from before the module folders existed, not a parallel feature.

**How it was actually resolved.** By the time this was picked up, GitHub's Copilot coding agent had already been run against the open pull request and had pushed its own merge commit (`85fe877`, authored `copilot-swe-agent[bot]`) straight to `origin/feature/emergency`. It got the real conflict right — `frontend/package.json` and `frontend/package-lock.json` came out matching the Expo side exactly, no `vite` or `react-dom` anywhere — but it did not clean up: because `frontend/index.html`, `frontend/src/main.jsx` and the root `package-lock.json` were *new* files on the `main` side rather than edits to a file both branches touched, they merged in without triggering a conflict at all, and the bot had no reason to look at them.

Rather than discard an already-pushed merge commit and force-push a from-scratch redo, the fix was applied on top of it: pull the existing merge, delete the three leftover files, and push normally as a fast-forward. Confirmed afterwards — `git grep` for `vite` and `react-dom` across the tracked tree turns up nothing but coincidental substring matches (`invited_by`, a base64 hash), `frontend/package.json` lists only `expo` and `react-native`, and `npx expo config` still resolves `sdkVersion: '54.0.0'`. `backend/shared/db/schema.sql` was left untouched — the teammate's encoding fix for the mangled em dash (`9d169cd`, already covered by 2026-08-08 above) came through the merge cleanly and stays.

**Worth knowing for next time, with three people on one repository:** an automated conflict-resolution pass (Copilot's or otherwise) can fix the conflict markers correctly and still leave scope creep behind, because non-conflicting new files never get its attention. Reviewing "does this pull request still contain files it shouldn't" is a separate question from "does this pull request have conflicts," and answering the first one is still a human's job even after the second is automated away.

---

## 2026-08-15 — Build log audit: the append-and-commit-together rule had drifted

Run because the rule at the top of this file — append an entry after every completed step, commit it with the work — was suspected of not having been followed consistently since the very first (2026-08-05) session. It hadn't been, though not in the way expected.

**Method:** `git log --oneline -- BUILD_LOG.md` (commits that actually touched this file) compared against the full commit history on this branch (`git log --oneline --all`).

**What the comparison found:**

- **Every commit before 2026-08-12 is a non-issue.** None of them individually touch `BUILD_LOG.md`, but the file's own header already discloses this — those entries were written in one pass, reconstructed from the git history and the code, not committed alongside the work in real time. Disclosed drift isn't silent drift.
- **One real, undisclosed gap: `9b495c5` ("Update lockfiles", 2026-08-14).** A routine lockfile-sync commit with no log entry at all, not mentioned anywhere in the file. Small — 12 lines, no decisions — but the rule doesn't carve out an exception for small. Backfilled above.
- **One traceability gap, not a content gap: `2c5a24e`** (the Vite-scaffold commit, merged from `feature/caregiver` via PR #2). The event it caused was already fully narrated in the "Merge conflict: a Vite scaffold" entry above, just without the commit hash tying the narrative to the actual commit. Added the hash for precision; no content was missing.
- **The largest gap: the SOS button feature (Phase 1, step 1) and the credential rotation, both dated 2026-08-15 above, existed only in the uncommitted working tree at the time of this audit.** The code (`backend/emergency/alerts.js`, `routes.js`, `validate.js`, the frontend `emergency/api/` client, both home screens, the `API.md` update) and the matching log entries had both already been written — checked against `git reflog` and against `origin/main`'s merge history (`dafc85d`), neither of which contains any of it — but nothing had been committed. This is a stricter violation than a missing log entry: the rule assumes work gets committed *promptly*, with the log riding along: here the log was actually ahead of git, correct and complete, but sitting in a working tree with no commit at all backing it. Resolved by committing the SOS feature (code + its log entry) as one commit and the credential-rotation note (log-only, since that action left no code diff) as a separate one, both immediately after this audit entry.

**Going forward:** the header above now states the rule explicitly rather than leaving it to be remembered. It's also saved to this session's persistent memory, so it doesn't depend on either the header being read or the memory alone — either should be enough on its own to catch the next drift before it reaches six commits.
