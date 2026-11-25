# Bark by Supertails — Two-Page Business Requirements Document

**Version:** 1.0  
**Date:** 19 November 2026  
**Status:** MVP / hosted pilot  
**Owner:** Supertails Operations & Product

## Page 1 — Business context and product requirements

### 1. Purpose

Bark is an internal operations workspace for Supertails. It gives sales agents, clinic teams, managers, and central operations one role-aware place to coordinate bookings, calendars, escalations, customer context, dashboards, and administration.

The immediate business objective is to replace fragmented operational tracking with a shared, accessible workspace that improves visibility, ownership, and follow-through without exposing each team to data outside its role or clinic scope.

### 2. Problem statement

Operational information is currently distributed across Google Sheets, Pawcare workflows, manual follow-ups, and separate team practices. This creates four recurring problems:

- Agents and managers lack a reliable view of bookings completed today.
- Incentive and performance numbers are difficult to find and reconcile.
- Operational issues can lose ownership or breach service-level expectations.
- Access to operational data is difficult to govern consistently across teams and clinics.

Bark should provide a clear operational front door while allowing existing Sheets and Pawcare processes to remain sources of truth during the transition.

### 3. Goals

1. Provide secure, role-aware access for internal Supertails users.
2. Show current-day agent bookings from the published booking sheet, excluding Pawcare-created bookings for the initial release.
3. Show monthly “shows” and incentive progress from the `CX Clinic Dashboard` workbook, using the logged-in agent’s row.
4. Give teams a shared booking and calendar workflow backed by PostgreSQL.
5. Make escalations accountable through ownership, priority, SLA, status, comments, and history.
6. Provide administrators with user, clinic, permission, workflow, and audit visibility.
7. Support a hosted pilot accessible through a public HTTPS URL without requiring tokens for public read-only Sheets.

### 4. Users and roles

| User group | Primary needs |
|---|---|
| Sales agent | View personal performance, today’s bookings, shows, calendar context, and assigned work. |
| Clinic/front-desk team | Create and manage eligible bookings, coordinate schedules, and view clinic-scoped information. |
| Team lead/manager | Monitor team performance, booking activity, workload, escalations, and SLA risk. |
| Central operations | See cross-clinic operational summaries, queues, escalations, and governance information. |
| System administrator | Manage access, roles, clinics, settings, audit history, and operational configuration. |

### 5. In-scope MVP capabilities

**Authentication and access**

- Email/password sign-in with secure scrypt password hashing.
- HttpOnly session cookie and server-side session validation.
- Role, clearance, clinic, and ownership checks enforced by the API.
- Active/inactive account handling and logout.

**Dashboard and performance**

- Home dashboard with operational summary cards.
- “Bookings today” sourced from the `Today Snapshot` sheet.
- Manual refresh control plus automatic refresh every two minutes.
- “This month” shows sourced from `MTD V2`, filtered to the logged-in agent.
- Clear indication of source, refresh time, loading state, and stale-data fallback.

**Bookings and calendar**

- List, create, view, assign, reschedule, and cancel database-backed bookings where permitted.
- Calendar event visibility and editing based on role and clinic access.
- Conflict protection for overlapping active appointments.

**Escalations**

- Create and view operational issues.
- Track category, priority, SLA, tier, owner, status, comments, and activity history.
- Use assignment rules and audit important changes.
- The escalation workflow is working correctly and has been tested and validated by both a subject-matter expert (SME) and an operational agent.

**Administration**

- Inspect users, roles, clinics, account status, and audit events.
- Support platform configuration needed for the pilot.

## Page 2 — Requirements, integrations, and delivery criteria

### 6. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | A user must authenticate before accessing protected screens or APIs. | Must |
| FR-02 | The system must show only data allowed by the user’s role, clearance, clinic, and ownership scope. | Must |
| FR-03 | The dashboard must load today’s agent bookings from the configured public Google Sheet. | Must |
| FR-04 | The dashboard must exclude Pawcare-originated bookings until direct Bark/Pawcare booking is enabled. | Must |
| FR-05 | The dashboard must refresh the booking sheet automatically every two minutes and provide a manual refresh button. | Must |
| FR-06 | A failed refresh must preserve the last successful snapshot and show its timestamp. | Must |
| FR-07 | Monthly shows must be selected from the logged-in agent’s row in `MTD V2`. | Must |
| FR-08 | Authorized users must be able to create, update, assign, reschedule, and cancel bookings. | Must |
| FR-09 | The system must prevent unauthorized booking, calendar, escalation, or administrative mutations at the API boundary. | Must |
| FR-10 | Important mutations must create append-only audit records. | Must |
| FR-11 | Administrators must be able to manage or inspect users, roles, clinics, and audit history. | Should |
| FR-12 | Data-source URLs and sheet names must be centralized in a replaceable configuration registry. | Should |

### 7. Validation status

The escalation system is considered operational for the current MVP. The workflow has been tested by a subject-matter expert (SME) and by an agent representing the day-to-day user group. Validation covered creating an escalation, reviewing its details, assigning ownership, tracking priority/SLA/status, adding comments, and confirming the activity history. Any future changes to escalation rules or permissions should be regression-tested with both user groups.

### 8. Non-functional requirements

- **Security:** TLS in hosted environments; secrets stored in deployment configuration; no passwords or tokens in source control; secure cookies; validated input; trusted-origin checks.
- **Availability:** The pilot should be usable during operating hours. Free hosting may sleep after inactivity and may take approximately one minute to wake.
- **Performance:** Normal authenticated screens should render promptly after service wake-up; dashboard refresh should not block the rest of the application.
- **Data integrity:** PostgreSQL is the source of truth for identity and operational records. Booking conflict rules and audit immutability must be enforced server-side.
- **Usability:** The interface should use Supertails green, black, and white visual language, provide clear loading/error states, and work on common laptop and tablet viewports.
- **Observability:** Requests should include request IDs and structured logs; health checks should be available for the hosting platform.

### 9. Integrations and source-of-truth model

| Source | Current use | Transition direction |
|---|---|---|
| Google Sheets — `Today Snapshot` | Current-day agent booking count and staff breakdown. | Continue for pilot; later replace with direct Bark/Pawcare booking events. |
| Google Sheets — `MTD V2` | Monthly shows and incentive progress. | Continue until incentive data is available in a governed operational system. |
| Pawcare | Customer, pet, appointment, and future direct booking context. | Gradually integrate direct booking creation into Bark. |
| PostgreSQL | Users, permissions, bookings, calendar, escalations, configuration, and audit history. | Primary application system of record. |

### 10. Out of scope for this release

- Direct Pawcare booking creation inside Bark.
- Automated incentive payouts or payroll integration.
- Pharmacy workflow completion.
- Guaranteed email/SMS notification delivery; the current design may record notification outbox rows without a delivery worker.
- Full migration of every Google Sheet into PostgreSQL.
- Advanced analytics, forecasting, and multi-instance scaling.

### 11. Success measures and acceptance criteria

The pilot is successful when:

1. An authorized agent can sign in and see their permitted workspace.
2. The dashboard displays the current day’s agent bookings from the public sheet, with refresh time and staff breakdown.
3. A sheet change is reflected after the next two-minute refresh or after pressing the manual refresh button.
4. A temporary Sheet failure leaves the last valid snapshot visible and communicates that it is stale.
5. The logged-in agent’s monthly shows match the corresponding `MTD V2` row.
6. Unauthorized users cannot access or mutate data outside their permission and clinic scope.
7. Booking conflicts are rejected consistently by the backend.
8. Escalations have visible ownership, priority, SLA, status, and history.
9. Administrative changes and major operational mutations are auditable.
10. The hosted pilot passes health checks, builds successfully, and remains usable after a free-tier wake-up.

### 12. Risks and next decisions

- The free Render PostgreSQL database expires after 30 days; a paid database or migration plan is required for continued production use.
- Public Google Sheet reads are convenient for the pilot but provide weaker governance than authenticated server-side ingestion.
- Free web services sleep when idle, which is unsuitable for strict real-time availability.
- The business must confirm the final definition of a “show,” agent identity matching rules, cancellation handling, timezone policy, and the date on which Pawcare-originated bookings enter the dashboard.

