# ElderCare — Build Log

A running record of what was built, when, and why. Each entry says what changed, what the alternatives were where there was a real choice to make, and what was left open.

**How to use this file:** append an entry after every completed step, and commit the log update in the same commit as the work it describes. Newest entries go at the bottom. Write it so someone who was not watching the build can follow it — plain English, no shorthand.

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

## Open issues

Things known to be wrong or undecided. Each should be closed before the work that depends on it starts.

### Closed

- **Phone numbers not normalised** — closed 2026-08-12. Normalised to E.164 in `backend/shared/phone.js`, applied by both `validateRegister` and `validateLogin`, documented in `API.md`, existing rows migrated. See the entry above.

### Open

- **`emergency_contacts.phone` is not normalised yet.** The table is empty, so there is nothing to migrate, but Phase 1 must run contact numbers through `normalizePhone` when it starts writing them — otherwise the same duplicate problem reappears on a table where a duplicate means someone gets called twice and someone else not at all.
- **No tests.** Every verification so far has been manual `curl` against a running server. Nothing catches a regression automatically. `shared/phone.js` is the first piece of pure logic in the codebase with enough branches to be worth unit tests, and it is the natural place to start.
- **No mobile app.** Phase 0 steps 4 and 5 — the Expo shell and the login and registration screens — are the remaining work, and there is no frontend code at all yet.
- **No admin account** in the development database, so the admin-only endpoint cannot be tested until one is promoted.
- **`JWT_SECRET` length is only a warning, not a startup failure.** Acceptable in development; it must not reach a deployment that way.
- **Location retention purge** is deferred to Phase 6. The `locations` table grows without bound until it is written.
- **`caregivers.average_rating` and `total_reviews`** are not maintained by the database. Whoever builds reviews in Phase 4 must recalculate them in the same transaction that writes the review.
- **Overlapping caregiver visits** are not prevented by the database, only identical start times. The application has to check.
- **Identity document numbers** are deliberately not stored. If the client requires them, the answer is a hash plus the document in a separate access-controlled store — not a plain column.
