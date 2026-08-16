# ElderCare — Team Work Division

**Who owns what, and what to do next**

Team: Sree · [Teammate B] · [Teammate C]
Companion to `PROJECT_REPORT.md` — read that first for the full project picture.
Document version: 2.1

---

## 1. At a glance

| Member | Owns | Branch | Phases |
|---|---|---|---|
| **Sree** | Emergency & Safety Services | `feature/emergency` | 1, 3 |
| **[Teammate B]** | Caregiver Management | `feature/caregiver` | 2, 4 |
| **[Teammate C]** | App Access & Emergency Response Services | `feature/screens` | 0, 5 |

Everyone contributes to Phase 0 (foundation) and Phase 6 (polish & delivery).

The project is split by module so all three of us can build at the same time without waiting on each other. Each module has its own folder, its own branch, and its own tables.

---

## 2. Sree — Emergency & Safety Services

**Branch:** `feature/emergency`

### Owns
- Shared database schema (`backend/shared/db/schema.sql`)
- The API contract (`API.md`)
- Authentication and user roles (Phase 0)
- The alert engine — SOS trigger, notification fanout, escalation
- GPS location ingestion and storage
- Geofencing logic and safe-zone breach detection
- Real-time layer (WebSockets) for live location and alerts

### Features from the client requirements
| Feature | Phase |
|---|---|
| One-touch SOS button | 1 |
| Emergency contacts notification | 1 |
| GPS location tracking | 1 |
| Geofencing alerts | 3 |
| Personal safety monitoring | 3 |

### Tables
`alerts`, `locations`, `geofences`, `emergency_contacts`, `notifications`, plus the shared `users`, `family_links`, `refresh_tokens`, `device_tokens`

---

## 3. [Teammate B] — Caregiver Management

**Branch:** `feature/caregiver`

### Owns
- The Caregiver module end to end — backend endpoints and mobile screens
- Caregiver profiles, booking, and search
- Scheduling and attendance
- Care plans, activity reports, tasks, and reviews

### Features from the client requirements
| Feature | Phase |
|---|---|
| Professional caregiver booking | 2 |
| Caregiver scheduling | 2 |
| Caregiver attendance tracking | 2 |
| Care plan management | 4 |
| Daily activity reports | 4 |
| Task assignment | 4 |
| Caregiver ratings and reviews | 4 |

### Tables
`caregivers`, `caregiver_bookings`, `schedules`, `attendance`, `care_plans`, `activity_reports`, `tasks`, `reviews`

### Two things the database does not handle for you
- `caregivers.average_rating` and `total_reviews` are summary columns of the `reviews` table. Nothing updates them automatically — the application recalculates them whenever a review is added or changed.
- The database prevents two visits starting at the exact same time for one caregiver, but not overlapping visits (9–11 and 10–12). The application checks for overlaps.

---

## 4. [Teammate C] — App Access & Emergency Response Services

**Branch:** `feature/screens`

### Owns
- The app's login and registration screens — the entry point every user passes through
- The full Emergency Response Services feature set (Phase 5)
- Accessibility across the app in Phase 6

### Features from the client requirements
| Feature | Phase | What to build |
|---|---|---|
| Login & registration | 0 | Phone/email + password form, register link, role-based routing after login |
| Emergency ambulance booking | 5 | Request form — pickup location, destination hospital, submit; plus a status view |
| Disaster alerts | 5 | List screen showing area warnings, with severity and time |
| 24/7 emergency response center | 5 | Contact screen — call button, help information |
| Fall detection | 5 | Manual "I fell" trigger that raises an alert |

### Tables
`ambulance_bookings`, `disaster_alerts`, and the shared `users` table for login

### Note on Phase 5
Ambulance booking, disaster alerts, and the response center connect to outside providers that the client is still arranging. Build the screens and the full in-app flow now, with the external connection mocked. Once the client confirms a provider, the mock is swapped for the real one — the screens do not change.

### Setup checklist
1. Install Git, Node.js, and VS Code
2. Get added as a collaborator on the GitHub repo
3. Clone the repo and create the branch `feature/screens`
4. Install Expo Go on your phone
5. Read `PROJECT_REPORT.md` end to end
6. Get the app running on your phone before writing any code

---

## 5. Shared rules (everyone)

### Branches
- `main` stays stable — never push to it directly
- Work only on your own branch
- Pull `main` into your branch regularly so you do not drift
- Merge into `main` through a Pull Request

### Files that need coordination
These are shared, so post in the group before changing them:
- `backend/shared/` — the database schema, auth, and config
- `API.md` — the API contract
- `PROJECT_REPORT.md` and this document

Everything inside your own module folder is yours to change freely.

### The API contract
`API.md` is the agreement between the backend and the screens. If you add an endpoint, add it to `API.md` in the same Pull Request. If you need an endpoint that does not exist yet, raise it in the group so it gets added rather than worked around.

### Secrets
Never commit `.env` or any real keys. Use `.env.example` for templates. Run `git status` after creating any file that holds a password and confirm it does not appear.

### Working rhythm per phase
1. Confirm the tables your phase needs already exist
2. Build the backend endpoints and add them to `API.md`
3. Build the screens that call those endpoints
4. Test the full flow on Expo Go on a real phone
5. Open a Pull Request and merge into `main`
6. Demo the phase before moving on

---

## 6. Progress so far

### Completed

**Project setup**
- GitHub repository created at `github.com/sreenidhi2545/elder-care`
- Folder structure in place — `backend/` (emergency, caregiver, shared) and `frontend/src/` (emergency, caregiver, shared)
- `main` branch protected — all changes go through a Pull Request
- `.gitignore` configured so `.env` and secrets are never committed
- `.env.example` template committed for everyone to copy

**Documentation**
- `PROJECT_REPORT.md` — the full project plan, committed to the repo
- `SCHEMA_DESIGN.md` — every table and column explained, with the reasoning behind each design decision
- `WORK_DIVISION.md` — this document
- `API.md` — the API contract, covering the six auth endpoints that exist today

**Database (Phase 0, step 1)**
- Schema designed and reviewed — 19 tables across three groups: 4 shared, 7 emergency, 8 caregiver
- PostgreSQL 18.4 installed and running locally
- `eldercare` database created, schema applied with no errors
- All 19 tables confirmed present:
  `users`, `family_links`, `refresh_tokens`, `device_tokens`, `emergency_contacts`, `alerts`, `locations`, `geofences`, `notifications`, `ambulance_bookings`, `disaster_alerts`, `caregivers`, `caregiver_bookings`, `schedules`, `attendance`, `care_plans`, `activity_reports`, `tasks`, `reviews`

**Backend server (Phase 0, step 2)**
- Express server in `backend/`, started with `npm start` from that folder
- Connection pool in `backend/shared/db/pool.js`, configuration in `backend/shared/config/env.js`
- `GET /health` reports database reachability — it returns 503, not 200, when PostgreSQL cannot be reached
- The server verifies the database connection before it binds the port, so a bad `DATABASE_URL` fails immediately with a clear message

**Authentication and user roles (Phase 0, step 3)**
- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `GET /auth/admin/users`
- Phone is the login identity; email is optional, and an account can be created without one
- Short-lived JWT access tokens plus stored refresh tokens, rotated on every use, with reuse detection that ends every session for the account
- `requireAuth` and `requireRole` middleware in `backend/shared/auth/middleware.js`, ready for both modules to use
- `admin` cannot be self-assigned at registration — admins are promoted directly in the database

### Phase 0 — remaining steps

| Step | Status | Owner |
|---|---|---|
| 1. Database schema created and applied (19 tables) | **Done** | Sree |
| 2. Backend server + database connection | **Done** | Sree |
| 3. Authentication and user roles | **Done** | Sree |
| 4. Expo app shell and navigation | Next | Sree |
| 5. Login & registration screens | Not started | [Teammate C] |
| 6. API contract (`API.md`) | **Done** for auth; extended per phase | Sree |

Three of the six steps are complete. The remaining work is the mobile side: the Expo
app shell, then the login and registration screens that call the auth endpoints above.

**Emergency core (Phase 1) — complete, verified on real devices**
- SOS button with a cancellable five-second countdown, the `alerts` row it creates, owner-only cancel and family-eligible resolve, and a family dashboard showing both active alerts and alert history
- GPS location capture — permission handling with a plain-language explanation before the OS prompt, a location-storage endpoint, and location captured on the alert itself at the moment SOS fires; never a precondition for sending the alert
- Emergency contact notification fanout in `emergency_contacts.priority` order across push, SMS and voice call, with escalation to the next contact on no acknowledgement, and acknowledgement via a push action button
- Push delivered end to end on a real device, through a real EAS project (`@sree25/eldercare`); SMS and voice attempts are recorded with a clear failure reason (Twilio not yet configured, and DLT registration still pending for production — see the milestone note under Phase 1 in section 8) rather than silently skipped
- Alerts never auto-expire — only `cancel` or `resolve` closes one; escalation only adds further notification attempts

### Phase 1 — steps

| Step | Status | Owner |
|---|---|---|
| 1. SOS button and alert record | **Done** | Sree |
| 2. GPS location capture | **Done** | Sree |
| 3. Emergency contact notification and escalation | **Done** | Sree |

All three steps are built and verified on real devices. See `BUILD_LOG.md` for the per-step decisions and verification detail.

### What happens after Phase 0

Once Phase 0 is merged into `main`, all three modules run in parallel — Sree starts Phase 1, [Teammate B] starts Phase 2, and [Teammate C] starts Phase 5.

**[Teammate B] and [Teammate C]:** the database is already built, so all the tables your modules need already exist. You do not need to create anything in the database — just read from and write to the tables listed in your section. Start with the setup checklist so your environment is ready when Phase 0 lands.

---

## 7. Phase ownership summary

| Phase | Focus | Owner |
|---|---|---|
| 0 | Foundation — database, auth, app shell, login | Sree + [Teammate C] |
| 1 | Emergency core — SOS, GPS, notifications | Sree |
| 2 | Caregiver core — booking, scheduling, attendance | [Teammate B] |
| 3 | Safety layer — geofencing, monitoring, live map | Sree |
| 4 | Caregiver depth — plans, reports, tasks, reviews | [Teammate B] |
| 5 | Emergency response services — ambulance, disaster, response center, fall | [Teammate C] |
| 6 | Polish & delivery | All three |

---

## 8. Step-by-step breakdown — every phase

The table above is the summary. This is what each phase actually involves, step by step, so anyone reading this document knows what the project involves end to end without having to ask. This is the plan, not a progress report — for what's actually been built so far, see `BUILD_LOG.md`.

### Phase 0 — Foundation

| Step | What it covers | Owner |
|---|---|---|
| 1 | Database schema — design and apply every shared and module table | Sree |
| 2 | Backend server and database connection | Sree |
| 3 | Authentication and user roles — register, log in, refresh, roles | Sree |
| 4 | Expo app shell and role-based navigation | Sree |
| 5 | Login and registration screens | [Teammate C] |
| 6 | API contract (`API.md`) — established here, extended every phase after | Sree |

### Phase 1 — Emergency Core

| Step | What it covers | Owner |
|---|---|---|
| 1 | SOS button and alert record — the one-touch trigger, the alert row it creates, cancelling and resolving an alert, and a family dashboard showing active alerts and alert history | Sree |
| 2 | GPS location capture — device permission handling with a plain-language explanation, a location-storage endpoint, location captured on the alert itself at the moment SOS fires, and the family dashboard showing it where the elderly user has permitted it | Sree |
| 3 | Emergency contact notification — fanout to `emergency_contacts` in priority order by SMS, call and push; escalation to the next contact if nobody acknowledges; alerts do not auto-expire, only a person closes one | Sree |

> **Milestone:** SMS to Indian phone numbers requires DLT (telecom regulator) registration before it will reach real numbers in production. The client is arranging this registration, and it takes weeks — it needs to start well ahead of step 3 going live. Development and testing of step 3 does not depend on it; only sending real SMS to real Indian numbers in production does.

### Phase 2 — Caregiver Core

| Step | What it covers | Owner |
|---|---|---|
| 1 | Caregiver profiles and search | [Teammate B] |
| 2 | Caregiver booking — a family requests and confirms a caregiver | [Teammate B] |
| 3 | Scheduling — set and view visit times | [Teammate B] |
| 4 | Attendance tracking — caregiver check-in and check-out | [Teammate B] |

### Phase 3 — Safety Layer

> **Milestone:** this phase begins with a development build, not Expo Go. Background location — reading the user's position while the app is not in the foreground — needs native modules Expo Go cannot run. Moving to a custom dev client (step 1 below) has to happen before any of the background-location work that depends on it.

| Step | What it covers | Owner |
|---|---|---|
| 1 | Development build — move off Expo Go to a custom dev client | Sree |
| 2 | Background location tracking | Sree |
| 3 | Geofencing — define safe zones per elderly user, detect when one is left | Sree |
| 4 | Real-time layer — a WebSocket connection for live location and alert delivery | Sree |
| 5 | Family live map and safety dashboard — live location, recent alerts, and status | Sree |

### Phase 4 — Caregiver Depth

| Step | What it covers | Owner |
|---|---|---|
| 1 | Care plan management — create and manage a care plan per elderly user | [Teammate B] |
| 2 | Daily activity reports — caregivers log daily activities | [Teammate B] |
| 3 | Task assignment — assign tasks to caregivers | [Teammate B] |
| 4 | Ratings and reviews — families rate caregivers | [Teammate B] |

### Phase 5 — Emergency Response Services

Ambulance booking and disaster alerts connect to outside providers the client is still arranging — see the "Note on Phase 5" in section 4. Each step below is built as a full working screen against a mock or placeholder connection now, and is wired to the real provider later without the screen itself changing.

| Step | What it covers | Owner |
|---|---|---|
| 1 | Ambulance booking — pickup location, destination hospital, submit, and a status view, against a mock provider | [Teammate C] |
| 2 | Disaster alerts — a list screen for area warnings with severity and time, against a placeholder feed | [Teammate C] |
| 3 | 24/7 emergency response center — a contact screen with a call button and information | [Teammate C] |
| 4 | Fall detection — a manual "I fell" trigger that raises an alert; automatic sensor-based detection is a later version, not this phase | [Teammate C] |

### Phase 6 — Polish & Delivery

| Step | What it covers | Owner |
|---|---|---|
| 1 | Accessible design — large text, high contrast, simple flow, applied across every screen | All three, each on their own module |
| 2 | Location retention purge — the scheduled deletion job for `locations` rows older than 30 days, deferred here since the day-to-day product doesn't need it yet | Sree |
| 3 | Testing across the main flows | All three |
| 4 | Final demo build via Expo | All three |
| 5 | Handover documentation for the client | All three |
