# ElderCare — Team Work Division

**Who owns what, and what to do next**

Team: Sree · [Teammate B] · [Teammate C]
Companion to `PROJECT_REPORT.md` — read that first for the full project picture.
Document version: 2.0

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
