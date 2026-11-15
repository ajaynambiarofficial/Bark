# General Codex collaboration rules

The primary Codex session is the orchestrator. It owns task decomposition, agent selection,
integration, and the final response. It should execute small, local tasks directly when delegation
will not materially improve quality or reduce total work.

## Delegation

- Shape each assignment as one question or work item with acceptance criteria, relevant paths,
  expected deliverable, and explicit file ownership.
- Select the narrowest specialist; do not invoke every role by default.
- Use at most two concurrent specialists. Parallelize only independent, non-overlapping work.
- Never give simultaneous write ownership of the same file. Sequence dependent edits and reviews.
- Specialists must not spawn agents, broaden scope, change global configuration, or invent project
  requirements.
- Every specialist returns evidence, changed files, tests/checks, risks, and unresolved questions.
- The orchestrator reviews every result and integrates it before continuing.

## Skill and ECC usage

- Start with the ECC capability mapping in [ECC-AGENT-CAPABILITY-MAPPING.md](./ECC-AGENT-CAPABILITY-MAPPING.md).
- Discover skill metadata or the relevant index first; read full skill instructions only when the
  assigned work activates that skill.
- Use one primary workflow and only the quality gates it requires. Do not run overlapping skills.
- Treat Claude-only commands, team UIs, hidden repair loops, and undocumented integrations as
  unsupported until verified in Codex. Never claim a skill or hook ran without tool evidence.

## Execution and ownership

- Read targeted files and existing documentation before acting; avoid repeated full-repository scans.
- Preserve existing conventions and make the smallest coherent change inside the assigned boundary.
- Validate inputs at boundaries, protect secrets, and consider authorization and data exposure.
- Read-only roles (architect, designer, security, QA) produce plans/reviews unless the orchestrator
  explicitly assigns a narrower write task.
- Implementation roles change only their assigned files and add focused tests for changed behavior.

## Quality and handoff

- Run the narrowest useful validation first, then broader checks when risk warrants it.
- Review diffs for correctness, security, ownership, accidental scope, and test coverage.
- Escalate blockers with the failed gate, evidence, attempted safe alternatives, and next decision;
  do not silently retry or work around incompatible tooling.
- Record decisions, assumptions, validation results, and known limitations when future maintainers
  need them.

## Context efficiency

- Pass concise handoffs with file paths, symbols, constraints, and only the context needed for the
  assignment.
- Prefer targeted search and reusable documentation over broad rescans or copied skill text.
- Use moderate reasoning for routine work; increase depth only for ambiguous, high-risk, or
  cross-cutting decisions.
