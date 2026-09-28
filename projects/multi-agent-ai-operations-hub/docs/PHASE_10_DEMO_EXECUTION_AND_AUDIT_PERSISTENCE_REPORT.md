# Phase 10 report: Local Demo Execution and Audit Persistence

Date: 2026-09-23

## Created

- A non-destructive Demo Execution Adapter.
- Without approval it returns `blocked`; with approval it creates only a reversible, synthetic local draft.
- Parameterized PostgreSQL queries for audit events and agent-run summaries.
- Sanitised persistence mapping: audit entries contain stage summaries, not contact details.

## Important design rule

The human-facing request key is not a PostgreSQL UUID. Audit persistence therefore uses an optional database request ID only after the intake persistence layer has supplied one. This prevents failed casts and accidental linking to the wrong request.

## Actually tested

Commands:

```text
node --test test/audit-workflow-export.test.mjs test/audit-persistence.test.mjs test/demo-execution-adapter.test.mjs test/orchestrator.test.mjs
POST http://localhost:5680/webhook/audit-event
```

- Focused test run: 10 passed, 0 failed.
- Full test suite after the live import: 107 passed, 0 failed.
- The demo adapter creates zero CRM writes, zero tasks, and zero messages in all tested paths.
- Rejected approval keeps the adapter blocked; approved demo mode creates only a reversible local draft.
- Audit SQL is parameterized and contains no destructive statement.
- The local n8n workflow `06 - Sanitised Audit Event API` was imported, linked to the existing local PostgreSQL credential, and published as `Phase 10 - Sanitised local audit persistence`.
- A synthetic, minimised `agent-stage-completed` event returned HTTP 201 and persisted an audit row. The response exposed only the event ID, timestamp, event type, and actor.
- A payload containing `details.contactEmail` returned HTTP 422; it was rejected before database persistence.

## Still open

The audit API is live locally, but is not yet invoked by a single central n8n orchestration workflow. That workflow must first obtain the real database request ID from the intake persistence stage.

## Next concrete step

Build the central local n8n orchestration workflow and connect its stage summaries to the prepared audit-persistence queries.
