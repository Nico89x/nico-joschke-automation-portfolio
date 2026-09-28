# Agent handoffs and data contracts

Every handoff is a JSON object with `requestId`, `schemaVersion`, `status`, `data`, `warnings`, and `errors`. Outputs that do not validate are rejected and stored as failed runs.

| Producer | Consumer | Required output |
|---|---|---|
| Intake | Persistence / Research | Normalized company, process, tools, goals, constraints, missing information, idempotency key |
| Research | RAG / Architect | Verified facts with source URL, retrieval time, confidence, and explicit unknowns |
| RAG | Architect | Ranked knowledge chunks with source ID, relevance score, and excerpts |
| Architect | Risk / Estimator | Trigger, systems, data flow, steps, dependencies, failure paths, and open questions |
| Risk Reviewer | Human review | Risks, severity, affected data, mitigation, and required approval gates |
| Estimator | Human review | Assumptions, effort range, recurring cost range, source date, and uncertainty |
| Human review | Execution | Decision, reviewer, time, approved version, and optional revision notes |
| Execution | Audit / Result | Created demo records, skipped actions, errors, and rollback information |

## Intake result v1

```json
{
  "requestId": "req-example",
  "schemaVersion": "1.0",
  "status": "accepted",
  "data": {
    "companyName": "Example GmbH",
    "processDescription": "Synthetic example description",
    "currentTools": ["HubSpot"],
    "goals": ["Reduce manual data entry"],
    "constraints": {
      "dataSensitivity": "personal",
      "requiresHumanApproval": true
    },
    "idempotencyKey": "example-request-001"
  },
  "warnings": [],
  "errors": []
}
```

## Research brief v1

The first Research Agent is deliberately bounded: it accepts only an `accepted` intake envelope, uses the local synthetic tool catalog, labels every finding with its source, and returns explicit unknowns. It cannot contact companies, call the web, modify data, or use contact details.

Later phases add separate JSON Schemas for RAG retrieval, architecture blueprints, risk reviews, estimates, approvals, and execution results.

## Automation blueprint v1

The Solution Architect accepts an accepted intake, a bounded research brief, and one or more RAG sources. It returns a non-executable blueprint containing the proposed trigger, data flow, integrations, error paths, source references, and explicit human-approval gate. It cannot create CRM records, tasks, or messages.
