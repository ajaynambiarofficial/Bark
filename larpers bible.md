# Bark by Supertails — Larping Bible

This is a speaking guide for explaining Bark to people who understand software, even if you are not deeply technical yourself. It gives you the vocabulary, the system story, the honest status of each feature, and the answers to the questions people are most likely to ask.

## The one-sentence explanation

Bark is an internal operations workspace for Supertails that brings bookings, team scheduling, escalations, customer and Pawcare context, dashboards, and administration into one role-aware web application.

## The 30-second version

“Bark is a React and TypeScript web app used by operational teams. The browser talks to an Express REST API, and PostgreSQL is the source of truth for users, permissions, clinics, bookings, escalations, calendar events, configuration, and audit history. The important design choice is that permissions are enforced on the server, not just hidden in the UI. It is an MVP: the backend foundation and several workflows are real, while some older screens and prototype integrations are still being migrated.”

## The mental model

Think of Bark as three connected layers:

```text
Person using Bark
        |
        v
React single-page app in the browser
        |
        | HTTP requests under /api
        v
Express + TypeScript REST API
        |
        | Drizzle ORM and transactions
        v
PostgreSQL database
```

- The **frontend** is the dashboard and the screens people click.
- The **API** is the rule-enforcing middle layer. It authenticates the user, checks permissions, validates input, applies business rules, and writes audit records.
- **PostgreSQL** stores the operational truth. It protects important invariants such as booking conflicts and immutable audit history.

This is called a **modular monolith**: one repository and one deployable API, organized into modules. It is deliberately simpler than a collection of microservices for the current team and product stage.

## What problem Bark solves

Bark is designed for work that crosses teams and clinics:

- A sales or front-desk employee books a service for a customer or pet.
- A team member sees the shared calendar.
- A problem becomes an escalation with an owner, priority, SLA, tier, comments, and history.
- Managers see the operational picture appropriate to their scope.
- Administrators manage access, clinics, workflows, settings, and audit history.

The product is not primarily a consumer pet-care storefront. It is an internal operations system with a Supertails-inspired visual identity.

## Technology stack, in plain English

| Area | Technology | What it does |
|---|---|---|
| Language | TypeScript | Adds types to frontend and backend code. |
| Browser UI | React 19 | Renders the single-page application. |
| Frontend tooling | Vite 6 | Runs the development server and builds the browser bundle. |
| Navigation | React Router | Maps URLs such as `/bookings` to screens. |
| API server | Express 5 | Receives REST requests under `/api`. |
| Database | PostgreSQL | Persists identity, operations, configuration, and audit data. |
| Database access | Drizzle ORM | Defines tables in TypeScript and executes database queries. |
| Validation | Zod | Validates environment variables, request bodies, parameters, and queries. |
| Authentication | Node scrypt + opaque sessions | Hashes passwords and stores only session-token hashes. |
| Testing | Vitest | Runs focused unit and guardrail tests. |
| Local database | Docker Compose | Provides PostgreSQL for local development when Docker is available. |

## Where the important code lives

- `src/main.tsx` — browser entry point; mounts React.
- `src/app/router.tsx` — URL-to-page map and protected-route boundary.
- `src/components/` — reusable UI and application shell pieces.
- `src/pages/` — major application screens.
- `src/features/` — feature-specific pages, types, services, and adapters.
- `src/auth/` — frontend authentication context and API/mock adapters.
- `server/index.ts` — starts the API process.
- `server/app.ts` — builds Express middleware and mounts API routes.
- `server/routes/` — REST endpoints for auth, bookings, escalations, calendar, dashboard, customers, catalog, and admin.
- `server/middleware/` — request context, origin checks, and authentication.
- `server/auth/` — password, session, permission, role, and principal logic.
- `server/db/schema.ts` — database table definitions.
- `drizzle/` — committed forward-only SQL migrations.
- `server/services/audit.service.ts` — writes audit events during important mutations.
- `tests/` — password, escalation-policy, and database-guardrail tests.
- `README.md` — setup and command reference.
- `BACKEND_PLAN.md` — architecture, endpoint inventory, schema rationale, and rollout phases.
- `PROJECT_AUDIT.md` — current health, known gaps, and verification evidence.

## The main user-facing areas

### Welcome dashboard

The home area combines the application shell, profile context, operational summaries, and some legacy snapshot cards. The operational summary is backed by the API; some older goal and snapshot content is still hardcoded or snapshot-based and should not be presented as live reporting.

### Bookings

Bookings are one of the strongest end-to-end areas. The API supports listing, creating, viewing, rescheduling, assigning, and cancelling bookings. PostgreSQL protects against overlapping active appointments for the same staff member.

### Calendar

The team calendar reads and writes API-backed events. Editing is restricted by role and also checked by the backend. The frontend service translates between the UI’s date/time shape and the API’s timestamps.

### Escalations

An escalation represents an operational issue that needs accountable ownership and follow-through. It can have a reference, category, issue type, priority, SLA due time, owner, tier, status, comments, activity history, and clinic context.

The backend supports authorization, assignment rules, SLA policies, tier changes, status transitions, comments, notifications-as-outbox rows, and audits. Important caveat: the current escalation pages still use the legacy local prototype service in places. That means the escalation UI is not yet fully connected to the PostgreSQL backend.

### Pawcare

Pawcare screens provide customer and pet context around appointments and records. Booking and appointments have meaningful backend-backed flows. Pharmacy is explicitly a placeholder. Diagnostics reads a published Google Sheet CSV in the browser and is not yet a PostgreSQL import workflow.

### Guide

The Guide is a read-only local reference area for packages, services, and clinic information.

### Admin Control Center

The admin area currently supports important user and audit inspection flows. The API surface is broader than the current UI and also includes roles, clinics, workflows, settings, feature flags, and session revocation. A complete admin UI is still future work.

## Authentication and authorization: how to explain it

Authentication answers: “Who are you?” Authorization answers: “What are you allowed to do?” Bark treats those as separate checks.

1. A user submits an email and password.
2. The server verifies the password using a memory-hard scrypt hash.
3. The server creates a random opaque session token.
4. The browser receives the token in an HttpOnly, SameSite cookie.
5. Only a SHA-256 digest of the token is stored in PostgreSQL.
6. On protected requests, the server loads the session and builds an authenticated principal.
7. Routes check permissions, clearance, account status, clinic access, and sometimes ownership.

The frontend may hide a button for convenience, but that is not the security boundary. A user who calls the API directly still has to pass the server-side checks.

### Roles and clearance

Built-in roles include Sales Agent, Clinic Front Desk, Doctor, Groomer, Sales Team Lead, Clinic Manager, Sales Manager, Zonal Head, Central Management, System Administrator, and GOD / Super Admin.

Roles provide permissions and a clearance level. Clinic assignments further restrict which clinic data a person can access. GOD is a clearance level 100 role, but even GOD does not make audit history mutable: audit rows are append-only and PostgreSQL rejects updates and deletes.

## A request lifecycle you can narrate

For a request such as `POST /api/bookings`:

1. The React page sends JSON with the session cookie.
2. Express adds request context and logging, applies security headers, parses JSON, and checks the trusted origin for state-changing requests.
3. Authentication middleware loads the session from the cookie.
4. The route checks the required booking permission and clinic scope.
5. Zod validates the body and route/query inputs.
6. The handler applies booking rules and performs a transactional database write.
7. PostgreSQL constraints provide a final integrity check, including overlap protection.
8. The API returns a consistent response such as `{ "data": ... }`, or a structured error with a code, message, and request ID.

For an important mutation, the operational write and audit write happen in the same transaction. If the transaction fails, the audit record does not falsely claim that the operation succeeded.

## API conventions

The API is REST-shaped and lives under `/api`.

- Success responses use `{ "data": value }`.
- List responses may include `meta` for pagination information.
- Errors use `{ "error": { "code", "message", "requestId", "details?" } }`.
- Authentication endpoints are under `/api/auth`.
- Protected operational endpoints are mounted after the authentication middleware.
- IDs are UUIDs.
- State-changing production requests require the configured trusted `Origin`.

Useful endpoint families include:

| Area | Examples |
|---|---|
| Authentication | `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout` |
| Bookings | `GET/POST /api/bookings`, `POST /api/bookings/:id/reschedule` |
| Escalations | `GET/POST /api/escalations`, status, assignment, tier, and comments routes |
| Calendar | `GET/POST /api/calendar/events`, `PATCH/DELETE /api/calendar/events/:id` |
| Customers | `GET /api/customers/search`, `GET /api/customers/:id/profile` |
| Dashboard | `GET /api/dashboard/summary` |
| Administration | `/api/admin/users`, roles, clinics, workflows, settings, and audit events |

## Database story

The schema is grouped around:

- **Identity and access:** users, roles, permissions, role permissions, user overrides, clinics, and sessions.
- **Customer operations:** customers, pets, health records, orders, services, and clinic service availability.
- **Bookings:** bookings and booking history.
- **Escalations:** escalations, comments, activity, ownership history, SLA policies, assignment rules, and notifications.
- **Planning:** calendar events and dashboard aggregates.
- **Governance:** application settings, feature flags, notification templates, and audit events.

The project uses forward-only migrations. The TypeScript schema is the design source; generated SQL in `drizzle/` is what applies changes to PostgreSQL.

## What is real, what is partial, and what is not yet production-ready

| Area | Honest current description |
|---|---|
| Authentication | Backend-backed with an explicit opt-in mock adapter for the old fixture login. |
| Bookings | Database-backed MVP with validation and conflict protection. |
| Calendar | Database-backed with server-side edit permissions. |
| Escalations | Backend APIs are substantial, but the SPA still has legacy local/prototype integration. |
| Dashboard | Live operational summary exists; some older cards are hardcoded snapshots. |
| Pawcare Booking/Appointments | Meaningful customer/profile and calendar flows exist. |
| Pawcare Pharmacy | Placeholder screen. |
| Diagnostics | Browser-side read-only Google Sheet CSV reader. |
| Notifications | Rows are written to an outbox; no email worker or delivery guarantee exists yet. |
| Admin | Important user/audit UI exists; the API and UI are not feature-complete. |
| Production deployment | Not complete until PostgreSQL, HTTPS, trusted origins, strong secrets, least-privilege credentials, backups, and monitoring are supplied. |

The safest phrase when presenting this is: **“The repository contains a working backend MVP and an incremental frontend migration; not every visible screen is yet an end-to-end production workflow.”**

## Local setup and demo flow

Requirements: Node.js 20+, npm, and Docker Desktop or PostgreSQL 16.

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run db:seed
```

Run the API and frontend in separate terminals:

```powershell
npm run dev:api
npm run dev
```

Open `http://localhost:5173` and sign in using the configured `GOD_EMAIL` and `GOD_PASSWORD`.

Useful checks:

```powershell
npm run typecheck
npm test
npm run build
```

The Vite development server proxies `/api` to port 3000. The mock authentication path is only selected when `VITE_USE_MOCK_AUTH=true` is explicitly set.

## How to give the demo

Use this sequence:

1. Start at the login page and explain that the session is issued by the API.
2. Show the application shell and explain that the visible navigation is role-aware convenience, not the real security boundary.
3. Open Bookings and describe the request path: page → API → permission check → validation → PostgreSQL.
4. Open Calendar and explain shared operational scheduling.
5. Open Escalations and describe owner, SLA, tier, comments, and activity history. Say clearly that the current UI migration is incomplete if asked whether every action is PostgreSQL-backed.
6. Show Admin only if the audience wants governance and access control; explain that the admin UI is partial even though the API surface is broader.
7. End with the audit story: important mutations are recorded transactionally, and audit history cannot be updated or deleted through the application.

## Questions technically minded people may ask

### “Why not microservices?”

The current product is a modular monolith. It keeps deployment, transactions, authorization, and local development manageable while still separating domains in code. Microservices would add operational complexity before the current workflows and contracts are fully stable.

### “Is the frontend secure if it hides buttons?”

No security claim depends on hidden buttons. The Express API checks the authenticated principal, permissions, clearance, clinic grants, account status, and resource access on the server.

### “Can an administrator edit the audit log?”

The intended answer is no. Audit events are append-only, the API exposes inspection rather than mutation, and the PostgreSQL migration adds a trigger that rejects updates and deletes.

### “Are notifications actually sent?”

Not yet. A successful escalation mutation creates a notification/outbox row. A worker, provider integration, retry policy, and delivered state are still future work.

### “Is every page using the database?”

No. Bookings and Calendar are database-backed. Escalations have a real backend but the legacy SPA adapter is still being replaced. Pharmacy is a placeholder, Diagnostics reads a Google Sheet CSV, and some dashboard cards are snapshots.

### “Has the database been tested live?”

The code has static checks and focused tests, but live migration and PostgreSQL integration verification require a running PostgreSQL instance. If the local environment lacks Docker/PostgreSQL, say that plainly.

### “What is the next highest-value engineering task?”

Finish replacing the escalation mock adapter with a typed REST adapter, then add PostgreSQL integration tests for authorization, transitions, comments, SLA behavior, booking conflicts, transaction rollback, and audit immutability.

## Words to use correctly

- **Authentication:** proving identity.
- **Authorization:** deciding what an authenticated identity may do.
- **Permission:** a named capability such as `bookings:create`.
- **Clearance:** a numeric hierarchy used for higher-level authority checks.
- **Clinic scope:** the clinics whose records a user may access.
- **SLA:** service-level agreement; here, a target response or resolution window for an escalation.
- **Outbox:** a durable database row saying that a notification should be delivered later; it is not proof of delivery.
- **Audit event:** an append-only record of an important mutation.
- **Adapter:** a boundary that lets the UI talk to a particular data source, such as the API or the explicit mock service.
- **MVP:** minimum viable product; a usable first increment, not a claim of full production completeness.

## The final honest summary

Bark has a credible foundation for an internal operations platform: typed React and Express code, PostgreSQL persistence, structured REST endpoints, server-side authorization, transactional audit writes, and focused tests. It should be presented as an evolving backend MVP with a partially migrated frontend. The strongest story is not that every screen is finished; it is that the architecture makes the unfinished boundaries visible and gives the team a clear path to complete them safely.
