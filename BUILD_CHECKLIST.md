# Bark by Supertails — Product Build Checklist

Use this as the working checklist for taking the local prototype to a complete clinic operations product. Check items off only after they are implemented and verified against the acceptance notes.

## 1. Local foundation and access

- [x] Run the React and Express app locally with PostgreSQL.
- [x] Store application data in PostgreSQL with Drizzle migrations.
- [x] Use server-side sessions, password hashing, and role-based permissions.
- [x] Keep the current server bound to `localhost` for local-only use.
- [x] Create user accounts from the admin panel with a role, initial password, and clinic assignment.
- [x] Allow staff to edit their display name, contact details, bio, and profile picture.
- [x] Add a local password recovery flow with one-time, expiring reset tokens.
- [ ] Configure email delivery for password recovery and operational notifications before any shared or hosted deployment.
- [ ] Add an admin workflow to edit existing user details and reset their password.
- [ ] Add supported account lifecycle actions (activate, suspend, deactivate) and verify session revocation for each.

## 2. Escalations

- [x] Persist escalations, comments, assignments, status changes, tier changes, and audit history.
- [x] Apply role, department, and clinic access checks.
- [x] Calculate an SLA deadline from the configured policy and route new escalations using assignment rules.
- [ ] Finish end-to-end checks for agent, team lead, clinic manager, zonal head, and central management workflows.
- [ ] Add actual notification delivery; current escalation notifications are queued in the database only.
- [ ] Support real attachment upload and secure file storage; current escalation records keep attachment metadata only.
- [ ] Review escalation UI copy and remove any remaining mock/demo wording in API mode.

## 3. Pawcare customers, pets, and health records

- [x] Start the booking flow with customer phone search: open an existing customer profile or create one if no match exists.
- [x] From the customer profile, select an existing pet or register a new pet before selecting a service.
- [ ] Complete the customer profile workflow and link customer, pet, health record, and appointment data consistently. The Pawcare booking flow now links the selected customer and pet to a new appointment.
- [ ] Add complete edit and view screens for pets and health records. Pawcare Booking now captures pet name, species, breed, size, coat, birth date, sex, and spay/neuter status during registration.
- [x] Use the pet's registered breed and coat to determine eligible grooming services; block long-coat routines for pets registered as short coat.
- [ ] Expand the initial curated breed list and define how staff register mixed or unknown breeds and coat types before enabling grooming eligibility checks.
- [ ] Define required health-record fields, record ownership, and edit history.
- [ ] Verify that staff can only view or edit customer and pet records allowed by their role and clinic assignment.

## 4. Appointments and clinic scheduling

- [x] Offer consultation types: General Consult, Follow-up Consult, Surgery Consult, and IV Drip.
- [x] Enforce service durations: General, Follow-up, and Surgery Consult 30 minutes; IV Drip 60 minutes; vaccination 15 minutes; deworming 15 minutes; Fit-to-Travel Certificate 30 minutes.
- [x] Enforce grooming durations: long-coat routine 90 minutes, short-coat routine 60 minutes, and Bath and Dry 60 minutes.
- [ ] Add clinic-configurable grooming duration by breed and coat for future adjustments.
- [x] Show visible slots only for the selected service duration and the chosen clinic's availability.
- [x] Block overlapping active bookings at a clinic, rechecking inside a database transaction when confirming.
- [ ] Model clinic capacity, rooms, doctors, and groomers so multiple non-conflicting appointments can run concurrently without allowing resource overlap.
- [ ] Make conflict prevention safe when concurrent users try to book or reschedule the same slot.
- [ ] Support appointment assignment, rescheduling, cancellation, completion, and no-show transitions. Pawcare Booking now creates appointments through the backend.
- [ ] Record who created, changed, assigned, rescheduled, and cancelled every appointment, with timestamp and reason.
- [ ] Use each clinic’s timezone and operating hours when offering or validating slots.
- [ ] Verify appointments cannot be created outside clinic hours or for inactive services/staff.
- [ ] Complete the appointment list and daily clinic schedule views against live API data.

### Agreed booking path

`Search customer by phone → open or create customer profile → select or add pet → select service group and service → choose clinic and visible slot → review details → confirm booking`

Service groups are **Consultation**, **Grooming**, **Vaccination**, and **Other services**. Other services include **Deworming** and **Fit-to-Travel Certificate**; additional services should be configurable with an explicit duration.

## 5. Bookings and daily snapshot

- [ ] Verify booking update, cancel, search, and history flows through the live backend. Booking creation and service availability are connected to the backend.
- [ ] Replace the hardcoded “Today’s booking snapshot” with current booking data.
- [ ] Connect the CX Clinic Dashboard Google Sheet for automatic snapshot import or sync.
- [ ] Define sync ownership, refresh frequency, duplicate handling, and behavior when the sheet is unavailable.
- [ ] Show the source and last successful update time for imported snapshot data.

## 6. Clinic Chat

- [ ] Replace sample in-memory threads with persisted conversations and messages.
- [ ] Define who can create or join clinic, agent, leadership, and direct conversations.
- [ ] Add message history, unread counts, read markers, and search backed by the API.
- [ ] Add live message delivery and reconnect behavior.
- [ ] Add secure attachment upload, file limits, and access checks if attachments are needed.
- [ ] Record message author and timestamps; define retention and moderation expectations.

## 7. Other Pawcare modules

- [x] Add a quote generator with clinic service search, editable quote quantities and rates, discount calculation, and print/save as PDF. Central validation for discount codes remains pending until approved code rules are supplied.
- [ ] Replace the Pharmacy placeholder with the agreed pharmacy workflow, or remove it until requirements are ready.
- [ ] Review Diagnostics and Grooming pages against actual clinic workflows and connect any remaining sample data to APIs.
- [ ] Confirm which services and modules each clinic offers and make the booking options follow that configuration.

## 8. Admin, audit, and operations

- [ ] Complete admin editing for users, roles, clinic access, services, and workflow settings.
- [ ] Make role and clinic access changes auditable and revoke affected sessions when appropriate.
- [ ] Provide searchable audit history for user, booking, appointment, and escalation actions.
- [ ] Configure operational email or in-app notification delivery and failure visibility.
- [ ] Add database backup and restore procedures and document how to recover the local installation.

## 9. Verification and release

- [ ] Add automated tests for authentication, role access, clinic isolation, scheduling conflicts, and audit history.
- [ ] Add end-to-end checks for the main user journeys: sign-in, booking, rescheduling, escalation, chat, and profile recovery.
- [ ] Test migrations from a clean database and upgrades from an existing local database.
- [ ] Add production configuration for HTTPS, secrets, email delivery, backups, logging, and monitoring before hosted use.
- [ ] Decide how the app will be hosted and how teammates will access it; the current setup is localhost-only.
- [ ] Write setup, account administration, backup, and troubleshooting instructions for operators.

## Suggested build order

1. Finish appointment duration and no-overlap rules.
2. Complete customer, pet, and health-record workflows around appointments.
3. Replace the daily snapshot sample with the agreed Google Sheet sync.
4. Build the persisted Clinic Chat backend.
5. Complete admin, email delivery, tests, backup, and deployment readiness.

