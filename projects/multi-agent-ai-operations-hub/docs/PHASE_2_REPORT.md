# Phase 2 report: PostgreSQL persistence and audit logging

Date: 2026-09-21

## Created or extended

- Parameterized PostgreSQL insert for accepted intake requests
- Idempotency handling with a unique `idempotency_key`
- Audit events for accepted, duplicate, and rejected requests
- PostgreSQL nodes on both the valid and invalid n8n branches
- Local encrypted n8n credential for the project database
- Repeatable smoke test for accepted, duplicate, and rejected requests
- Workflow export checks for the persistence and audit nodes

## Actually tested

Automated test suite:

- Total tests: 30
- Passed: 30
- Failed: 0
- Skipped: 0

Live local n8n tests against the test webhook:

1. A valid synthetic request returned HTTP 202 with status `accepted`.
2. The same request and idempotency key returned HTTP 202 with status `duplicate` and `idempotentReplay: true`.
3. The accepted and duplicate responses contained the same database request ID, confirming that no second request record was created.
4. An invalid synthetic request returned HTTP 422 with status `rejected` and five explicit validation errors.
5. n8n reported all three workflow executions as successful, including the PostgreSQL branches.
6. Accepted and duplicate responses each reported one written audit event. The rejected branch completed successfully after its audit node; the rejection response intentionally exposes only validation details.

Live production-webhook smoke test after publication:

- `valid-request`: HTTP 202, status `accepted`, passed
- `duplicate-request`: HTTP 202, status `duplicate`, `idempotentReplay: true`, passed
- `invalid-request`: HTTP 422, status `rejected`, passed
- The accepted and duplicate production responses contained the same database request ID.

All live tests used synthetic data and the local PostgreSQL instance. No real customer data or external API was used.

## Errors found and fixed

- The imported PostgreSQL node version `2.7` was not recognized by the installed n8n version. It was corrected to `2.6`.
- The first persistence test failed because the saved PostgreSQL credential had not been assigned to the accepted branch. The credential was assigned explicitly and the test then passed.
- An earlier import had merged duplicate nodes into the existing workflow. A clean workflow was imported and the redundant nodes were removed after approval.

## Open points

- Persistence across a full Docker stack restart has not yet been tested.
- Direct database inspection from the isolated automation shell is blocked by access to the Windows Docker named pipe; behavior was verified through the workflow responses and n8n execution results.

## Next concrete step

1. Restart the stack and verify that the workflow and stored request remain available.
2. Add a read-only internal status workflow for verifiable database health and audit checks.
3. Begin the RAG knowledge-base ingestion phase.
