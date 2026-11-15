# Bark Backend Plan

## 1. Current application inventory

Bark is a Vite 6 + React 19 + TypeScript single-page application. It currently has no server
process, production identity provider, or persistent application database.

| Module | Current state | Existing actions / data |
| --- | --- | --- |
| Authentication | Backend-backed with explicit demo fallback | Production adapter uses REST sessions; fixture auth is opt-in with `VITE_USE_MOCK_AUTH=true`. |
| Home dashboard | Partially implemented | Static greeting/profile, hard-coded goal tracker, and a copied Google Sheet snapshot. |
| Bookings | Backend-backed MVP | PostgreSQL API, overlap protection, catalog lookups, search, and create flow are wired into the page. |
| Team calendar | Backend-backed | PostgreSQL API with server-side edit permissions; the page loads and mutates API events. |
| Escalations | Backend API plus legacy frontend adapter | Backend supports authorization, SLA, assignment, tiers, comments, and audit; the current SPA pages still use the local prototype adapter. |
| Guide | Read-only | Local package/service/clinic reference snapshot. |
| Pawcare | Partially implemented | Booking and Appointments now have customer/profile and calendar views; Pharmacy remains a placeholder. Diagnostics reads published Google Sheet CSV directly from the browser. |
| Admin Control Center | Partial | GOD/system-admin UI covers users and audit inspection; APIs cover users, roles, clinics, workflows, settings, flags, and session revocation. |
| Theme/settings | Client preference | Theme mode and palette stored in `localStorage`. |

Existing application roles are Sales Agent, Sales Team Lead, Sales Manager, Clinic Front Desk,
Clinic Manager, Doctor, Groomer, Central Management, and System Administrator. The backend adds
GOD / Super Admin as clearance level 100 while retaining all existing role identifiers.

## 2. Architecture

Use a modular monolith suited to the current team size and traffic:

```text
React SPA  ->  /api REST service (Express + TypeScript)
                         |
                         +-- service layer / authorization policies
                         +-- Drizzle repositories and transactions
                         +-- PostgreSQL
```

- One repository and one deployable API service; no microservices or paid dependencies.
- PostgreSQL is the authority for operational data, sessions, permissions, configuration, and audit events.
- Drizzle ORM owns schema definitions and forward-only SQL migrations.
- Zod validates environment variables, request bodies, route parameters, and query strings.
- Authentication uses Node's memory-hard scrypt password hashes and opaque random session tokens. Only a SHA-256
  token digest is stored. The browser receives a Secure, HttpOnly, SameSite cookie.
- State-changing requests require an allowed Origin and use same-site cookies. Production must run
  the SPA and API under the same site.
- Authorization is server enforced using permissions, clearance level, account status, clinic
  grants, and resource ownership. UI checks are convenience only.
- Important writes and their audit event run in the same database transaction.
- Audit rows are append-only. PostgreSQL rejects application attempts to update or delete them,
  and no mutation endpoint is exposed.

## 3. Data model

Core identity and access:

- `roles`, `permissions`, `role_permissions`
- `users`, `user_permissions`, `user_clinics`
- `sessions`, `authentication_attempts`
- `clinics`

Operations:

- `customers`, `services`, `clinic_services`
- `customer_pets`, `customer_health_records`, `customer_orders`
- `bookings`, `booking_history`
- `escalations`, `escalation_comments`, `escalation_activity`, `escalation_ownership_history`
- `sla_policies`, `assignment_rules`, `notifications`
- `calendar_events`

Configuration and governance:

- `application_settings`, `feature_flags`, `notification_templates`
- `audit_events`

All operational records use UUID primary keys, foreign keys, timestamps, and soft-deactivation or
soft-deletion where appropriate. Customer phone/email values are excluded from audit snapshots.
Booking overlap is checked transactionally and protected by a PostgreSQL exclusion constraint for
active appointments assigned to the same staff member.

## 4. REST contract

Responses use `{ "data": ... }`; list endpoints may add `meta`. Errors use
`{ "error": { "code", "message", "requestId", "details?" } }`.

### Authentication

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `POST /api/auth/logout-all`

### Bookings

- `GET /api/bookings`, `POST /api/bookings`
- `GET /api/bookings/:id`
- `POST /api/bookings/:id/reschedule`
- `POST /api/bookings/:id/assign`
- `POST /api/bookings/:id/cancel`

### Pawcare customer search

- `GET /api/customers/search?phone=...` (permission and clinic scoped)
- `GET /api/customers/:id/profile` (customer, pets, appointments, orders, and health/vaccination records)

### Escalations

- `GET /api/escalations`, `POST /api/escalations`
- `GET /api/escalations/:id`
- `POST /api/escalations/:id/status`
- `POST /api/escalations/:id/assign`
- `POST /api/escalations/:id/tier`
- `POST /api/escalations/:id/comments`

### Calendar and reporting

- `GET /api/calendar/events`, `POST /api/calendar/events`
- `PATCH /api/calendar/events/:id`, `DELETE /api/calendar/events/:id`
- `GET /api/dashboard/summary`

### GOD / administration

- Users: `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id`, suspend/reactivate and revoke-session actions
- Roles: `GET/POST /api/admin/roles` with permission assignment during creation
- Clinics: `GET/POST /api/admin/clinics`, `PATCH /api/admin/clinics/:id`
- Workflow: read configuration and create SLA policies or assignment rules
- Configuration: application settings, feature flags, notification templates
- Governance: read-only `GET /api/admin/audit-events`

Search, filters, date ranges, sorting, and cursor pagination are validated query parameters. No API
hard-deletes audit records or historical booking/escalation events.

## 5. Implementation phases

1. **Foundation:** server entry point, environment validation, structured logging, database pool,
   Drizzle schema/migrations, health checks, consistent errors, and request IDs.
2. **Identity and governance:** password login, opaque sessions, RBAC/clinic scope, GOD role, login
   throttling, append-only audits, and development seed data.
3. **Operational MVP:** bookings with conflict prevention/history; escalations with SLA, assignment,
   tier/status policies, comments, notifications; calendar persistence.
4. **Frontend integration:** API auth adapter and service adapters; preserve current pages and visual
   design; remove local operational persistence after each API path is working.
5. **Administration/reporting:** Admin Control Center, users/roles/clinics/workflows/configuration,
   dashboard aggregates, audit explorer, and emergency controls.
6. **Hardening/deployment:** integration tests against PostgreSQL, backup/restore runbook, production
   cookies/origin policy, TLS, least-privilege database role, monitoring, and deployment guide.

## 6. Dependencies

Runtime: Express, Drizzle ORM, `pg`, Zod, Node scrypt, Helmet, cookie-parser, Pino, and dotenv.

Development: Drizzle Kit, `tsx`, Vitest, and TypeScript type packages. PostgreSQL 15+
is required. A local Docker Compose file is provided for development; production may use any
standard managed or self-hosted PostgreSQL service.

## 7. Explicit limitations during incremental delivery

- Google Sheet-backed diagnostics and dashboard snapshots remain external read-only sources until
  an approved import/synchronization policy is defined.
- Pawcare Booking, Pharmacy, and Appointment pages remain explicitly marked placeholders; the main
  Bookings module is now database-backed. Product requirements are needed before those separate
  Pawcare screens can be implemented without inventing workflows.
- The escalation SPA still uses its existing local prototype service. The backend escalation APIs,
  validation, authorization, audit, SLA, assignment, and notification-outbox writes are implemented,
  but an API response mapper must replace the prototype's denormalized person snapshots before the
  existing detail UI can switch over safely.
- Email delivery requires approved SMTP credentials and a background outbox worker. Notification
  rows are created transactionally, but no message is represented as delivered.
- Admin APIs cover users, role creation, clinics, workflows, settings, feature flags, session
  revocation, and audit inspection. Service/staff editors, operational record correction/restore,
  role editing, templates, and a complete UI for every endpoint remain future increments.
- PostgreSQL migrations were generated and statically validated, but could not be applied in this
  environment because neither Docker nor a PostgreSQL server is installed.
- Production authentication cannot be declared complete until deployment supplies a database,
  HTTPS, allowed origins, strong bootstrap credentials, and the development seed password is removed.
