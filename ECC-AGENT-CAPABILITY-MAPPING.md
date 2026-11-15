# ECC-to-agent capability mapping

This workspace uses Codex-native ECC capabilities installed from ECC 2.2.3. The mapping is a
selection guide, not a copy of ECC skill instructions. Load metadata first and read a full
`SKILL.md` only when the assignment activates it.

| Role | Relevant ECC capabilities | ECC commands / quality gates | Sandbox and effort | Deliverable |
| --- | --- | --- | --- | --- |
| Architect | `api-design`, `backend-patterns`, `hexagonal-architecture`, `architecture-decision-records`, `context-budget` | `plan`, `multi-plan`; contract, dependency, and risk review | Read-only; medium | Decision record or bounded implementation plan with assumptions and file references |
| Designer | `frontend-design-direction`, `design-system`, `accessibility`, `frontend-a11y` | `plan`; responsive, keyboard, state, and accessibility acceptance checks | Read-only; medium | Implementation-ready design specification and acceptance criteria |
| Frontend | `frontend-patterns`, `react-patterns` or framework-specific skill, `react-performance`, `frontend-a11y` | `feature-dev`, `react-build`, `react-test`, `quality-gate` | Workspace-write; medium | Changed UI files, focused tests, validation output, and risks |
| Backend | `backend-patterns`, `api-design`, `error-handling`, framework-specific testing/security skill | `feature-dev`, framework test command, `quality-gate`, `verification-loop` | Workspace-write; medium | Changed server files, focused tests, contract notes, and risks |
| Security | `security-review`, `security-scan`, `agent-security-hardening`, `mcp-dependency-review` when relevant | `security-scan`, `quality-gate`; severity, evidence, impact, remediation | Read-only; medium | Prioritized findings with evidence and explicit residual risk |
| QA | `tdd-workflow`, `ai-regression-testing`, `e2e-testing`, `verification-loop`, `plankton-code-quality` | `test-coverage`, framework test commands, `quality-gate` | Read-only; medium | Reproducible test plan/results and prioritized defects |

## Verified Codex-compatible surface

- ECC exposes a `skills/` directory, `.mcp.json`, Codex hooks, Codex agent references, and migrated
  command skills through its installed plugin manifest.
- The installed Codex CLI reports `multi_agent` as stable and enabled. Workspace registration is
  retained in `.codex/config.toml` with `max_threads = 2` and `max_depth = 1`.
- ECC skills are guidance files selected by relevance; their presence does not prove execution.
  Execution requires a Codex tool call and observable result.

## Compatibility limits

- Claude-only commands, `${CLAUDE_*}` variables, Claude team controls, and undocumented repair or
  memory loops are not assumed to work in Codex.
- ECC workflows that depend on a specific framework, repository, branch, worktree, or external MCP
  server require a separate compatibility check before use.
- Codex hooks and MCP servers are available only when enabled, trusted, and supported by the local
  Codex runtime; failures must be reported with evidence rather than silently substituted.
