# Bark Project Audit

Audit date: 2026-11-11

Scope: the complete tracked Bark repository, including React/Vite frontend, Express API,
PostgreSQL/Drizzle schema and migration, authentication/RBAC, configuration, tests, dependency
metadata, repository instructions, and ECC mapping.

## Overall health

**Overall assessment: medium risk / backend MVP, not production-ready.**

The repository is type-safe and builds successfully. The backend has a coherent modular-monolith
shape, server-side authorization, transactional audit writes, session handling, booking overlap
constraints, and a working migration contract. The largest functional gap is that the escalation
frontend still uses its local prototype service, so the most important operational workflow is not
yet end-to-end database-backed. PostgreSQL could not be started in this environment, so migration,
seed, and live API integration remain unverified.

## Severity-ranked findings

### High — Escalation UI is still disconnected from the backend

`src/features/escalations/EscalationOverviewPage.tsx`, `CreateEscalationPage.tsx`, and
`EscalationDetailPage.tsx` import `escalation.mock-service`. That service persists cases and
notifications in `localStorage` and explicitly records `mock-activity-only` delivery. The backend
routes in `server/routes/escalation.routes.ts` are not called by the production pages.

Impact: users can see and mutate data that is not in PostgreSQL; authorization and audit guarantees
do not cover the UI workflow.

Action: replace the adapter with a typed API mapper for list/detail/person snapshots, then remove
the prototype persistence only after parity tests pass.

### High — Full dependency audit has development-tool vulnerabilities

`npm audit` reports 9 vulnerabilities, including critical advisories through Vitest 2.x/Tinypool
and a high advisory through nested Vite/esbuild packages. Production-only dependencies report no
vulnerabilities, but the development toolchain must be upgraded before CI or any exposed test/UI
server is used. The safe upgrade is constrained by the current Node 20 runtime and should be done
as a deliberate toolchain change, not with `npm audit fix --force`.

### High — Live database integration is unverified

The code requires PostgreSQL through `DATABASE_URL`; no PostgreSQL server or Docker runtime was
available. Therefore migrations, seed idempotency, exclusion constraints, audit triggers, and live
route authorization have only static/type-level coverage. This is an environment blocker, not a
reason to replace PostgreSQL with an unrequested local mock.

### Medium — Remaining Pawcare workflow screens remain placeholders

`src/app/router.tsx` still routes only Pawcare Pharmacy to `PawcarePlaceholderPage`. Pawcare Booking
has a database-backed customer profile flow and Pawcare Appointments now has a clinic-filtered
calendar/history view. Diagnostics remains a browser-side Google Sheets CSV reader. These remaining
gaps are explicitly identified rather than silently presented as persisted workflows.

### Medium — Admin Control Center is partial

The current UI covers user search, suspend/reactivate, and audit inspection. Backend APIs exist for
additional users, roles, clinics, workflows, settings, feature flags, and session revocation, but
the UI does not yet expose all of them. Service/staff management, record correction/restore,
template editing, and a full emergency-control surface remain incomplete.

### Medium — Notification delivery stops at an outbox row

Escalation writes create notification records, but there is no worker, retry policy, or SMTP/provider
adapter. The UI and types correctly label delivery as mock/outbox-only. No user should interpret
the current notification write as an email delivery guarantee.

### Medium — Home snapshot and agent goals are hardcoded snapshots

`src/components/dashboard/TodaySnapshot.tsx`, `BookingGoalTracker.tsx`, and the call-quality card
in `src/pages/WelcomePage.tsx` contain fixed dates, counts, targets, incentive thresholds, and a
static score. The new operational summary is live, but these older cards can display stale or
misleading numbers after the workbook changes.

Action: move snapshot, goals, incentives, and call-quality data behind versioned API contracts or
an explicit read-only import job, with a visible last-updated timestamp and empty/error states.

### Medium — API integration test coverage is too narrow

The current tests cover password hashing, pure escalation transitions, and migration guardrail text.
There are no PostgreSQL-backed tests for login throttling, clinic scoping, booking conflicts,
transaction rollback, escalation authorization, admin privilege boundaries, or immutable audit
triggers.

### Low — Static/client-only state remains by design in limited areas

Theme preference, sidebar collapse, and opt-in demo authentication use `localStorage`. Escalation
draft text is also local for recovery. These are acceptable client preferences/drafts, but the
operational escalation store is not acceptable for production and is tracked above.

## Security review

Implemented and verified in source:

- Passwords use Node scrypt with random salts and constant-time comparison.
- Sessions use random opaque tokens; only SHA-256 token digests are stored.
- Cookies are HttpOnly, SameSite, and Secure in production.
- Backend routes enforce permissions, clearance, account status, and clinic scope.
- GOD is clearance 100; non-GOD actors cannot assign or elevate to their own clearance.
- Session revocation and account suspension revoke active sessions.
- Audit writes are transactional and the PostgreSQL migration adds an UPDATE/DELETE trigger.
- Audit snapshots remove sensitive customer/contact keys.
- State-changing production requests require the configured trusted Origin.
- Clinic-specific service catalog reads are now access-checked.
- Dashboard agent/clinic totals are now scoped for non-global users.
- Application settings now reject plaintext secret storage and direct deployments to a secret manager.

Residual security risks:

- The escalation frontend bypasses the backend until the adapter migration is completed.
- No live PostgreSQL security/integration test has run in this environment.
- No general API rate limiter exists beyond database-backed login throttling.
- Production deployment still needs TLS, secret-manager configuration, least-privilege database
  credentials, backups, and monitoring.

## Database and architecture review

The schema is normalized around users/roles/permissions, clinics, services, customers, customer
pets/orders/health records, bookings, escalations, calendar events, configuration, notifications,
and audit events. Foreign keys,
timestamps, indexes, soft-deactivation/deletion, booking time validation, a staff overlap exclusion
constraint, and the immutable audit trigger are present.

The users email index is intentionally case-insensitive in both the schema and migration. Drizzle
metadata was corrected so future migration generation reports no schema change. The migrations are
forward-only: the initial schema/guardrails migration is followed by the Pawcare customer-record
tables migration.

The primary architectural inconsistency is not server-side layering; it is the split persistence
model between the backend MVP and the legacy escalation frontend adapter. That boundary should be
the next integration target.

## Redundant or unnecessary code removed

- Removed unused `src/components/brand/GoogleMark.tsx` after the login flow moved to email/password.
- Removed unused `supertest` and `@types/supertest` packages because no test imported them.
- Corrected stale README Docker service name from `db` to the actual `postgres` service.
- Aligned Drizzle schema and snapshot metadata with the lowercased email unique index.

No operational record, audit table, security control, or working UI module was deleted.

## Fixes implemented during this audit

- Scoped dashboard agent and clinic aggregates for non-global users.
- Enforced clinic access on `GET /api/catalog/services?clinicId=...`.
- Rejected `secret: true` application settings instead of persisting plaintext integration secrets.
- Required a trusted Origin for state-changing requests in production while retaining development
  tooling compatibility.
- Updated the backend plan inventory to distinguish backend-backed modules from remaining prototypes.
- Added the Pawcare customer search/profile API and normalized pet, order, and health-record tables.
- Confirmed migration generation is clean after schema metadata alignment.

## Verification

Passed:

- `npm run typecheck`
- `npm test` — 3 files, 6 tests passed
- `npm run build`
- `npx drizzle-kit check`
- `npx drizzle-kit generate` — no schema changes after metadata alignment
- `npm audit --omit=dev` — no production dependency vulnerabilities
- No lint command is configured; lint/static-style verification could not be run.

Blocked or unresolved:

- Full `npm audit` reports 9 development dependency vulnerabilities.
- PostgreSQL/Docker was unavailable, so `npm run db:migrate`, `npm run db:seed`, and live API tests
  could not run.
- No browser automation or end-to-end test harness is configured.

## Recommended next priorities

1. Replace the escalation mock adapter with a typed REST adapter and add PostgreSQL integration
   tests for authorization, transitions, comments, SLA, and audit behavior.
2. Upgrade the Node/Vite/Vitest development toolchain to a supported patched set and commit the
   lockfile after verifying Node-version compatibility.
3. Run migrations and seed against a real PostgreSQL instance; test rollback, overlap conflicts,
   audit immutability, and privilege boundaries.
4. Finish the Admin Control Center for all existing admin endpoints.
5. Add an outbox worker with explicit retry/dead-letter behavior and approved email credentials.
6. Define product contracts for Pawcare Pharmacy and diagnostics import
   synchronization before implementing those screens.
7. Add CI for typecheck, build, tests, migration drift, dependency audit, and secret scanning.

## ECC/Codex review

`AGENTS.md` and `ECC-AGENT-CAPABILITY-MAPPING.md` are consistent with the repository workflow and
do not introduce application runtime behavior. The agent-architecture-audit skill was reviewed but
not activated because Bark is an operations application, not an LLM-agent runtime; the relevant
security and backend findings were handled directly from the code and existing repository guidance.
