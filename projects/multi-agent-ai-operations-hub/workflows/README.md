# n8n workflows

Workflow exports live in this folder. Before committing an export:

- remove credential identifiers and test secrets;
- use synthetic test data;
- confirm no personal data is present;
- document required credentials in the main README;
- keep agent prompts versioned;
- include an error path and an audit event.

The workflows are imported in this order:

1. `00-apply-knowledge-migration.json` applies the idempotent knowledge-base schema migration to an existing local database.
2. `01-intake-api.json` validates, stores, and audits project requests. Valid requests return HTTP 202; invalid requests return HTTP 422.
3. `02-knowledge-ingestion-api.json` validates and chunks **synthetic** internal knowledge documents for pgvector storage. It remains inactive after import and requires the local PostgreSQL credential to be selected on its database node.
4. `03-rag-retrieval-api.json` performs read-only, source-grounded retrieval from the local knowledge base. It remains inactive after import and requires the local PostgreSQL credential to be selected on its database node.
5. `04-reset-synthetic-knowledge-base.json` is a manual maintenance workflow that deletes only rows explicitly marked as synthetic; it must never be used with real customer data.
6. `05-research-brief-api.json` creates a bounded local research brief from validated intake and a synthetic tool catalog.
7. `06-audit-event-api.json` accepts minimised audit summaries and rejects contact details.
8. `07-central-operations-hub.json` connects deterministic intake, local pgvector retrieval, research, solution design, risk review, estimation, blueprint persistence, and per-stage audit records. It stops at `awaiting-human-review`.
9. `08-operations-hub-review-api.json` records a one-time named approval or rejection for a pending blueprint. Approval prepares only a synthetic local draft; it does not execute CRM, task, messaging, or publishing actions.

Workflows `02`, `03`, `06`, `07`, and `08` use the local PostgreSQL credential selected in the n8n UI. No workflow export includes a credential, API key, or real customer data. The central endpoint is `POST /webhook/operations-hub`; the one-time decision endpoint is `POST /webhook/operations-hub-review` after publication.
