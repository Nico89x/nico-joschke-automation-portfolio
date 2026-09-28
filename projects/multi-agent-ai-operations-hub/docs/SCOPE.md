# Project scope

## Goal

Turn one unstructured, synthetic automation request into a reviewed automation blueprint and, after explicit approval, create records in demo systems.

## Target users

- Automation agencies qualifying new projects
- Internal automation and operations teams
- Technical consultants preparing discovery and implementation work

## In scope

- One request per intake call
- Deterministic validation and routing
- Company research from explicitly approved sources
- Internal RAG knowledge base with source references
- Structured workflow blueprint
- Independent risk review
- Rule-based effort and cost estimate
- Human approval before external actions
- Demo CRM and project backlog integration
- Audit events, metrics, controlled failures, and resumability
- Synthetic data and local execution

## Out of scope for the portfolio version

- Contacting real people or companies
- Automatic email sending
- Production customer data
- Autonomous purchasing, contracts, or financial transactions
- Unrestricted browsing or unrestricted tool use by agents
- A general-purpose chatbot
- High availability or enterprise-scale infrastructure

## Success criteria

1. Invalid requests are rejected with actionable errors and no downstream side effects.
2. Repeated idempotency keys do not create duplicate project or CRM records.
3. Every agent handoff validates against a documented JSON contract.
4. Missing evidence produces an explicit unknown or human-review outcome.
5. No demo CRM or project record is written without an approval event.
6. At least 30 evaluation cases run reproducibly and results are reported honestly.
7. Cost and latency are recorded per request and the test budget is capped at 10 EUR per month.

## Assumptions

- Local development uses Windows, Docker Desktop, and n8n Community Edition.
- English field names are used in APIs and database columns; portfolio explanations are provided in German and English.
- A model provider is connected only after the deterministic foundation is verified.
- The initial demo targets will be selected later; until then, the execution boundary remains mocked.
