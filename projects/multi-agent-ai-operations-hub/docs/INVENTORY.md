# Existing-work inventory

Inventory performed on 2026-09-21 before extending the project.

## Reused project assets

- `README.md`: early project description and quality goals
- `docker-compose.yml`: n8n and pgvector/PostgreSQL services
- `database/init/001_schema.sql`: initial persistence model
- `schemas/intake.schema.json`: incoming request contract
- `src/intake-validator.mjs`: deterministic validator
- `test/intake-validator.test.mjs`: initial unit tests
- `evals/intake-cases.json`: early evaluation examples
- `docs/ARCHITECTURE.md`: component and agent boundaries
- `docs/TEN_DAY_PLAN.md`: implementation sequence

## Other workspace material

The surrounding workspace also contains application documents, PDF builders, and role-specific deliverables. They are unrelated to this build and were not modified as part of the project.

## Gaps found during inventory

- The public project name differed from the new specification.
- The README referred to an intake workflow export that did not exist.
- The database lacked several required run-level metric fields.
- Agent handoff contracts were not documented precisely.
- Only five validator tests existed.
- No test executed the code embedded in an n8n workflow export.
- Docker Desktop was installed but its engine was not running.

## Preservation decision

The existing folder is reused instead of replaced. Earlier files are extended in place, and unrelated workspace files remain untouched.
