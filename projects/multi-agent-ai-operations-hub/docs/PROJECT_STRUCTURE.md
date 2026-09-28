# Local project structure

```text
automation-project-planner/
|-- .github/workflows/         Automated Node.js test workflow for GitHub Actions
|-- database/
|   `-- init/                 PostgreSQL and pgvector schema
|-- docs/                     Scope, architecture, runbook, reports, portfolio summary
|   `-- screenshots/          Capture instructions; verified UI captures are pending
|-- evals/                    Synthetic intake and RAG cases
|-- knowledge/base/           Synthetic RAG source documents
|-- schemas/                  JSON Schema contracts
|-- scripts/                  Setup, import, seeding, smoke and workflow-generation scripts
|-- src/                      Deterministic agents, orchestration and adapters
|-- test/                     Executable Node.js unit, contract, E2E and export tests
|-- workflows/                Sanitized, versioned n8n workflow exports
|-- database/                 Schema and parameterized SQL queries
|-- .env.example              Placeholders only
|-- docker-compose.yml        Local n8n and PostgreSQL stack
|-- package.json              Test command and runtime metadata
`-- README.md                 Portfolio entry point and verified status
```

All checked-in evaluation inputs and demo records are synthetic. UI screenshots and a recorded video are not yet checked in; see the [capture checklist](screenshots/README.md) and [demo runbook](DEMO_RUNBOOK.md).
