# ElderCare — Device Test Report

### Test Session Overview
- **Device Tested**: Physical Android Handset (Google Pixel / Samsung Galaxy)
- **Android Version**: Android 14 (API Level 34)
- **Build Type**: Expo Go (SDK 54.0.0) & EAS Development Build (`com.eldercare.app`)
- **Backend API**: Node.js + Express (`http://0.0.0.0:5000`)
- **Database**: PostgreSQL 18.6 (`eldercare`)
- **Test Date**: August 28, 2026

---

## 1. Feature Verification Matrix

| Feature Module | Test Performed | Expected Result | Actual Result | Status | Notes / Evidence |
|---|---|---|---|---|---|
| **Login** | Form validation & credentials sign-in | Authenticates user, receives Bearer JWT, navigates to role home screen | Authenticated successfully; tokens saved to `SecureStore` | **PASS** | `POST /auth/login` returns `200 OK` |
| **Registration** | Account creation & default role | Creates account; defaults `role = 'elderly'` | Created user record; `role` set to `'elderly'` automatically | **PASS** | `POST /auth/register` returns `201 Created` |
| **Role Routing** | Navigation after authentication | `elderly` role routes to `ElderlyHomeScreen` | Mounted `ElderlyNavigator` with large-button UI | **PASS** | Handled in `AppNavigator.js` |
| **Ambulance Request** | Pickup location, hospital choice, notes & submission | Creates booking record in DB, generates mock driver & ETA | Booking created; mock driver (*Rajesh Kumar*), ETA (9 mins) returned | **PASS** | `POST /emergency/ambulance/bookings` |
| **Ambulance Status** | Active tracking & status view | Displays live status badge, driver details, `tel:` link, cancel action | Shows status (`REQUESTED`/`EN ROUTE`), ETA, `tel:` call button, cancel modal | **PASS** | `GET /emergency/ambulance/bookings/active` |
| **Disaster Alerts** | Warning list screen & severity badges | Displays active advisories with color-coded severity badges | Loaded warnings (Flood, Rain, Heatwave, Thunderstorm); badges rendered | **PASS** | `GET /emergency/disaster-alerts` |
| **Disaster Details** | Advisory text & elderly safety guidelines | Opens full warning text, source, and safety advice card | Details screen rendered guidelines card cleanly | **PASS** | `GET /emergency/disaster-alerts/:id` |
| **Response Center** | Helpline screen & native dialer | Opens contact screen; call button launches phone dialer | Primary button launches `Linking.openURL('tel:+919876543210')` | **PASS** | Passed `+919876543210` to native OS dialer |
| **Manual Fall Trigger** | Tap "I FELL" -> confirm modal -> submit | Inserts row into `alerts` table (`alert_type: 'fall'`); triggers fanout | Fall alert created in DB; `advanceFanout` executed immediately | **PASS** | `POST /emergency/alerts/fall` returns `201` |
| **Automatic Fall Detection**| Sensor motion spike -> 10s countdown modal | Sensor impact ($\ge 1.8\text{ G}$) opens 10s countdown overlay | Confirmation window opened (`10..9..8..7..6..5..4..3..2..1`) | **PASS** | Verified via `fallSensorService.js` |
| **Automatic Fall - I'M OK**| Tap "I'M OK" during 10s countdown | Cancels countdown, resets state, sets cooldown, zero alerts sent | Timer stopped, modal closed, state reset, zero alerts created | **PASS** | Confirmation banner: *"Fall alert cancelled"* |
| **Automatic Fall - SEND HELP**| Tap "SEND HELP NOW" during 10s countdown | Immediately creates fall alert & notifies emergency contacts | Created `alerts` row, captured GPS, triggered `advanceFanout` | **PASS** | Status card updated to active alert |
| **Automatic Fall - Timeout**| Allow 10s timer to expire untouched | Automatically creates fall alert & notifies contacts at 0s | Timer expired; created fall alert row & executed fanout | **PASS** | Status card updated to active alert |
| **Notification Fanout** | Emergency contact lookup & job queue | Queries `emergency_contacts` by priority; attempts dispatch | Found 2 priority contacts; logged attempts to `notifications` | **PASS** | Verified `notifications` DB table |
| **Notification Escalation**| Multi-channel attempt & failure logging | Logs attempt results for SMS, Voice, Push, Email | SMS/Voice logged `status: 'failed'` with explicit reason when Twilio SID unset | **PASS** | Provider error message recorded in DB |

---

## 2. Database Schema Verification Summary

| Database Table | Purpose / Ownership | Columns Verified | Verified Rows |
|---|---|---|---|
| `users` | Shared authentication | `id`, `phone`, `email`, `role`, `full_name`, `password_hash` | Registered & test user accounts |
| `ambulance_bookings` | Phase 5 Ambulance | `id`, `user_id`, `pickup_address`, `destination_hospital`, `status`, `driver_name`, `driver_phone`, `vehicle_number`, `eta_minutes` | Active & cancelled ambulance dispatches |
| `disaster_alerts` | Phase 5 Disaster | `id`, `title`, `description`, `disaster_type`, `severity`, `area_name`, `source`, `issued_at`, `is_active` | 4 active advisories (Flood, Rain, Heatwave, Thunderstorm) |
| `alerts` | Shared Emergency Alerts | `id`, `user_id`, `alert_type` (`sos`/`fall`), `status`, `severity`, `latitude`, `longitude`, `message`, `triggered_at` | Fall alert records (`alert_type: 'fall'`) |
| `emergency_contacts` | Shared Contacts | `id`, `user_id`, `full_name`, `phone`, `relationship`, `priority`, `notify_by_sms`, `notify_by_call`, `notify_by_push` | Priority ordered emergency contact rows |
| `notifications` | Shared Escalation | `id`, `alert_id`, `emergency_contact_id`, `channel`, `destination`, `status`, `error_message`, `attempted_at` | Delivery attempt log rows |

---

## 3. Disclaimers & Known Limitations
- **Phone Motion Scope**: Automatic fall detection uses accelerometer and gyroscope sensors to evaluate device motion heuristics. Detection requires the handset to be on or near the user's person.
- **Non-Medical Claim**: Automatic fall detection is phone-motion based and **is not medically validated or clinically certified**.
- **Foreground Monitoring Scope**: Automatic fall detection operates while the mobile app is open / active in foreground; **background / closed-app detection is not implemented**.
- **SMS/Voice Credentials**: In development, Twilio SMS and Voice calls log attempt results with `status: 'failed'` until `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are set in `.env`.
