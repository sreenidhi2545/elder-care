# ElderCare — Project Report & Build Plan

A mobile platform for elderly safety and caregiver management

**Prepared for:** [MSME Client Name]
**Team:** Sree (Lead — Emergency & Safety module) · [Teammate] (Caregiver Management module)
**Document version:** 1.0

> Converted to Markdown from the original PDF (`PROJECT_REPORT.md.pdf`) so the report lives in the repository alongside the code. Content is unchanged.

---

## 1. Overview

ElderCare is a mobile application that helps elderly people stay safe and helps their families and caregivers stay connected to them. The app has two sides working together:

- **Emergency & Safety Services** — a fast way for an elderly person to call for help, share their location, and stay within safe areas, with their family notified instantly.
- **Caregiver Management** — a way to book caregivers, schedule visits, track attendance, manage care plans, and review the quality of care.

The app serves two kinds of users with two different experiences:

- **Elderly users** get a simple, large-button interface focused on one thing: getting help fast.
- **Family members** get a monitoring dashboard where they can see their loved one's location, receive alerts, manage contacts and caregivers, and review care activity.

The product is built as a single mobile app using Expo (React Native), with a shared backend and a shared database that both modules read from and write to.

---

## 2. Goals

1. Give elderly users a one-touch way to signal an emergency.
2. Notify the right people immediately when something happens.
3. Let families see where their loved one is and be alerted if they leave a safe area.
4. Let families book and manage caregivers, and track the care being delivered.
5. Keep a reliable record of every alert and every care activity.

---

## 3. Users & Roles

| Role | What they do | Main screens |
|---|---|---|
| Elderly user | Presses SOS, is tracked for safety | Large SOS button, simple status screen |
| Family member | Monitors, manages contacts & caregivers | Live map, alerts feed, caregiver management |
| Caregiver | Delivers care, logs visits & activity | Schedule, attendance check-in, activity reports |
| Admin | Oversees the platform | Management dashboard (later phase) |

---

## 4. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Mobile app | React Native + Expo | One codebase for Android & iOS; Expo Go for fast testing |
| Backend | Node.js + Express | Simple, widely supported REST API |
| Database | PostgreSQL | Reliable, strong support for relationships and location data |
| Real-time updates | Socket.io (WebSockets) | Live location + instant alerts |
| Notifications | Twilio (SMS/voice) + Expo Push | Reach contacts by text/call and app notification |
| Maps & location | Expo Location + a map library | GPS tracking and displaying location |

---

## 5. System Structure

The project lives in one GitHub repository, split into clear folders so both team members work in parallel without collisions:

```
elder-care/
  backend/
    emergency/     -> SOS, GPS, geofencing, alerts        (Sree)
    caregiver/     -> profiles, scheduling, reports       (Teammate)
    shared/        -> database schema, auth, config       (shared)
  frontend/
    src/
      emergency/   -> SOS screen, family safety dashboard
      caregiver/   -> caregiver booking & schedule screens
      shared/      -> login, navigation, common components
  API.md           -> the agreed API contract
  SCHEMA_DESIGN.md -> the database design and its reasoning
  PROJECT_REPORT.md
```

> **Folder naming:** the original PDF called the mobile folder `mobile/`. The repository uses `frontend/`, with the same three subfolders. `frontend/` is the agreed name — this section has been updated to match the repository.

**Workflow:** the `main` branch stays stable. Each member works on their own branch (`feature/emergency`, `feature/caregiver`) and merges into `main` through a reviewed Pull Request.

---

## 6. Database Design (what the app remembers)

The database is a set of tables. Each table stores one kind of thing. The tables are shared so both modules stay consistent.

| Table | Stores | Used by |
|---|---|---|
| `users` | Every user — elderly, family, caregiver, admin | Both modules |
| `emergency_contacts` | Who to notify for each elderly user, in priority order | Emergency |
| `alerts` | Every emergency event (SOS, fall, geofence breach) | Emergency |
| `locations` | GPS readings over time | Emergency |
| `geofences` | Safe zones defined for each user | Emergency |
| `notifications` | Record of who was alerted and whether it succeeded | Emergency |
| `ambulance_bookings` | Ambulance requests (stub for now) | Emergency |
| `disaster_alerts` | Area-wide warnings (stub for now) | Emergency |
| `caregivers` | Caregiver profiles and details | Caregiver |
| `caregiver_bookings` | Which caregiver is booked for which user | Caregiver |
| `schedules` | Caregiver visit schedule | Caregiver |
| `attendance` | Caregiver check-in / check-out records | Caregiver |
| `care_plans` | Care plan per elderly user | Caregiver |
| `activity_reports` | Daily activity logs by caregivers | Caregiver |
| `tasks` | Tasks assigned to caregivers | Caregiver |
| `reviews` | Ratings and reviews of caregivers | Caregiver |

The tables connect to each other through references (for example, each emergency contact points back to the user it belongs to). This is what lets the app answer questions like "who are this person's contacts?" or "what visits are scheduled for this caregiver?"

> **Note:** during Phase 0 design, three further shared tables were added by decision — `family_links`, `refresh_tokens`, and `device_tokens`. See `SCHEMA_DESIGN.md` for the reasoning.

---

## 7. Build Phases

The project is delivered in phases. Each phase produces something that works and can be shown to the client. Phases 1 and 2 run in parallel (one person each). Later phases build on the earlier ones.

### Phase 0 — Foundation (both members, first)

Sets up the ground everything else stands on.

- Create the database and all shared tables
- Build login and user roles (elderly / family / caregiver / admin)
- Set up the backend server and database connection
- Set up the Expo app shell, navigation, and login screen
- Agree and write the API contract (API.md)

**Done when:** a user can register, log in, and land on the correct home screen for their role.

### Phase 1 — Emergency Core (Sree)

The heart of the safety product.

- One-touch SOS button — elderly user presses it to raise an alert
- GPS location tracking — the app records and sends the user's location
- Emergency contacts notification — when SOS fires, contacts are alerted by SMS/call and app notification, in priority order
- Family dashboard shows incoming alerts

**Done when:** pressing SOS creates an alert, captures location, and notifies the family in real time.

### Phase 2 — Caregiver Core (Teammate, in parallel with Phase 1)

- Caregiver profiles & booking — families can view and book caregivers
- Caregiver scheduling — set and view visit times
- Attendance tracking — caregivers check in and out

**Done when:** a family can book a caregiver, see a schedule, and the caregiver can mark attendance.

### Phase 3 — Safety Layer (Sree)

Builds on the GPS from Phase 1.

- Geofencing alerts — define safe zones; alert the family if the user leaves one
- Personal safety monitoring — a family dashboard showing live location, recent alerts, and status
- Live map of the elderly user's location

**Done when:** leaving a safe zone triggers an alert, and the family can see live location and history on a map.

### Phase 4 — Caregiver Depth (Teammate)

Builds on the caregiver core from Phase 2.

- Care plan management — create and manage a care plan per user
- Daily activity reports — caregivers log daily activities
- Task assignment — assign tasks to caregivers
- Ratings & reviews — families rate caregivers

**Done when:** a full care cycle is captured — plan, daily reports, tasks, and reviews.

### Phase 5 — External Integrations (both, last)

Features that depend on outside services or operations. Built as working screens with placeholder/mock connections, ready to wire to real providers once available.

- Emergency ambulance booking — request screen + booking record (mock provider for now)
- Disaster alerts — screen to receive area warnings (placeholder feed for now)
- Fall detection — a manual "I fell" trigger in the app for now; automatic detection is planned for a later version with device sensors
- 24/7 emergency response center — a contact/placeholder screen; the staffed operations side is handled by the client

**Done when:** each screen works end to end within the app, with the external connection clearly marked for later wiring.

### Phase 6 — Polish & Delivery (both)

- Accessible design for elderly users (large text, high contrast, simple flow)
- Testing across the main flows
- Final demo build via Expo
- Handover documentation for the client

---

## 8. How Each Phase Is Executed (step by step)

Every phase follows the same rhythm so the team always knows what to do next:

1. Confirm the tables the phase needs already exist (from Phase 0).
2. Build the backend endpoints for the phase and add them to `API.md`.
3. Build the mobile screens that call those endpoints.
4. Test the full flow on Expo Go on a real phone.
5. Open a Pull Request and merge into `main` after review.
6. Demo the phase to the client before moving on.

---

## 9. Deliverables

- A working mobile app (Expo/React Native) with both modules
- A backend API and PostgreSQL database
- Source code in the shared GitHub repository
- This project report and the API contract
- A final demo build and handover notes

---

## 10. Roadmap Summary

| Phase | Focus | Owner |
|---|---|---|
| 0 | Foundation (DB, auth, app shell) | Both |
| 1 | Emergency core (SOS, GPS, notify) | Sree |
| 2 | Caregiver core (book, schedule, attendance) | Teammate |
| 3 | Safety layer (geofencing, monitoring, map) | Sree |
| 4 | Caregiver depth (plans, reports, tasks, reviews) | Teammate |
| 5 | External integrations (ambulance, disaster, fall, response) | Both |
| 6 | Polish & delivery | Both |
