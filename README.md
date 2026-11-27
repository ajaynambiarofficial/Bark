# Bark by Supertails

Bark is a React operations workspace backed by an Express/TypeScript REST API and PostgreSQL. The backend provides secure sessions, server-enforced permissions, bookings, escalations, team calendar data, dashboards, administrative controls, and append-only audit history.

## Local setup

Requirements: Node.js 20+, npm, Docker Desktop (or PostgreSQL 16).

1. Copy `.env.example` to `.env` and replace the example GOD password.
2. Start PostgreSQL: `docker compose up -d postgres`.
3. Apply the schema: `npm run db:migrate`.
4. Create roles, permissions, defaults, and the initial GOD account: `npm run db:seed`.
5. In one terminal run `npm run dev:api`; in another run `npm run dev`.
6. Open `http://localhost:5173` and sign in with `GOD_EMAIL` / `GOD_PASSWORD`.

Vite proxies `/api` to port 3000 in development. For the old fixture-only login, explicitly set `VITE_USE_MOCK_AUTH=true`; it is never selected implicitly.

## Commands

- `npm run deploy:render` — trigger a Render deploy using `RENDER_DEPLOY_HOOK_URL` from `.env`

- `npm run typecheck` — frontend and backend TypeScript validation
- `npm test` — focused security and domain tests
- `npm run build` — production frontend build
- `npm run db:generate` — generate a migration after schema changes
- `npm run db:migrate` — apply committed migrations
- `npm run db:seed` — idempotently seed access-control data and bootstrap the GOD account

### Render deploy hook

1. In Render, open the Bark service and create a deploy hook under **Settings → Deploy → Deploy Hook**.
2. Put the URL in your local `.env` as `RENDER_DEPLOY_HOOK_URL=...`. Do not commit or paste the URL into source files.
3. Run `npm run deploy:render` to trigger a deploy of the latest commit on the service's linked branch.

The hook can trigger deployments for this service; it does not provide access to Render settings or logs. Regenerate the hook in Render if its URL is exposed.

## Security model

Authentication uses scrypt password hashes and opaque session cookies. Only session-token hashes are stored. State-changing requests enforce the configured trusted origin. Every protected route is authorized by backend permissions, clearance, resource ownership, and clinic access. Important mutations write an audit event in the same transaction. PostgreSQL rejects all updates and deletes against `audit_events`, including attempts made by GOD users.

Production should terminate TLS, set `NODE_ENV=production`, serve the SPA and API under the same site, keep secrets outside source control, use a restricted PostgreSQL application role, run migrations through a separate deploy identity, and back up PostgreSQL with tested point-in-time restoration.

See [BACKEND_PLAN.md](./BACKEND_PLAN.md) for the architecture, endpoint inventory, schema rationale, rollout phases, and known follow-ups.
