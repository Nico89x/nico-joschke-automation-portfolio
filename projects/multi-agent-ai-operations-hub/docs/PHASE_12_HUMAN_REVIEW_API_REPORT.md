# Phase 12 report: Human review API

Date: 2026-09-23

## Implemented and published locally

- n8n workflow `08 - Operations Hub Review and Local Demo` exposes `POST /webhook/operations-hub-review`.
- It validates a PostgreSQL request UUID, `approved` or `rejected`, and a named reviewer; unknown fields are rejected.
- A database update changes only a blueprint still marked `pending`. The same transaction records one `operations-hub.approved` or `operations-hub.rejected` audit event.
- Approval prepares a proposal containing synthetic, local-only CRM/task draft information. It does not perform the proposed actions.
- Rejection produces no draft. Both outcomes keep `executionGate: false` and report zero external actions.
- A repeated or already-resolved decision is blocked and returns HTTP 409. Invalid review input returns HTTP 422.

## Verification performed

- At the initial Phase 12 verification point, `node --test` reported 115 passed, 0 failed. The current total after startup-import regression coverage is 118; see the [current project status](PROJECT_STATUS.md).
- Live synthetic intake returned HTTP 202 with `awaiting-human-review`, six audit events, and `executionGate: false`.
- Live approval returned `approved-local-draft-prepared`, recorded one decision audit event, and reported zero CRM writes, tasks, or messages.
- Replaying that decision returned HTTP 409, wrote no audit event, and prepared no draft.
- A malformed decision with an unknown `password` field returned HTTP 422.
- A separate synthetic rejection returned `rejected-blocked`, recorded one audit event, prepared no draft, and kept external actions at zero.

## Safety and limitations

- All test records use synthetic data; no real contact was notified and no real SaaS account was changed.
- Each smoke-test run creates two synthetic request records and audit rows in the local database; it deliberately performs no cleanup.
- The review route has no user authentication layer in this local portfolio build. Do not expose it to the public internet or treat it as production-ready.
- Agents and embeddings remain deterministic local baselines; no LLM provider is configured.
- The n8n UI workflow was republished locally after correcting the repeated-decision response code; the sanitized workflow export and tests match that expression.

## Non-destructive setup checkpoint

- `docker compose config --quiet` parsed the Compose configuration successfully (exit code 0); Docker printed access warnings for the user config file.
- The running local n8n service returned HTTP 200 from `/healthz`, and the six-path smoke run passed.
- A full clean-volume start was not attempted. `docker compose ps` could not access the Docker Engine named pipe (`docker_engine`) from this execution environment. Existing containers and volumes were left untouched, so clean install is still unverified.
- The local n8n workflow list had a published `01 - Deterministic Intake API` and a separate unpublished copy with the same name. The unpublished copy was renamed `01 - Deterministic Intake API (draft copy)` for clarity; the published workflow remains unchanged. No workflow was deleted.

## Local latency measurement

- A new five-sample synthetic benchmark completed successfully; all five planning requests returned HTTP 202, wrote six stage audit events, and kept the execution gate closed.
- Measured client-observed round-trip median: 89.2 ms; minimum: 70.7 ms; maximum: 378.2 ms. See [the full local evaluation report](LOCAL_EVALUATION_REPORT.md) for interpretation and reproduction instructions.
- No model API is connected, so LLM token usage and provider costs remain unavailable/not applicable.

## Follow-up test and startup-safety hardening

- The local startup and RAG import scripts now list existing workflow names and import only missing definitions. If n8n cannot return a parseable workflow list, they stop rather than risk a duplicate import or overwrite.
- A manual PowerShell mock verified both branches (existing workflow skips; missing workflow imports), and all three PowerShell scripts pass the PowerShell parser.
- Three Node regression checks protect the guarded import entry points. The latest local Node test suite passes 118 tests; the 115-test result above is the count at the initial Phase 12 verification point.

## Historical next-work checkpoint

The demo runbook, local latency benchmark, and `scripts/smoke-test-operations-hub.ps1` are now in place. The smoke script was run successfully: six live synthetic checks passed (valid planning, duplicate intake, approval, approval replay, invalid intake, rejection). The architecture document shows the implemented request, idempotency, audit, review, and safety paths. Verified UI screenshots still need to be saved under `docs/screenshots/`; the exact safe capture list is documented there. A clean-start setup review is pending because this execution environment cannot access the Docker Engine named pipe. Do not remove existing Docker volumes; no existing container or volume was changed for that unverified check.
