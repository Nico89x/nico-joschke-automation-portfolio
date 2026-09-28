# Local Ollama ↔ n8n pilot

This opt-in bridge keeps Windows Ollama bound to `127.0.0.1:11434`. It does **not** change `OLLAMA_HOST`, expose port 11434 to the LAN, install a second model, or modify published workflows `07` and `08`.

## Data flow

1. `scripts/run-local-ollama-n8n-pilot.mjs --live` sends one synthetic intake to the existing n8n `operations-hub` webhook. The returned request is pending human review and contains approved local RAG excerpts.
2. The host-side adapter calls local Qwen 3.5 4B using only the process description, goals, tool names, sensitivity label, and at most five approved excerpts. Company and contact fields are omitted. An explicit-event rule resolves high-confidence start events; the local evaluator records both the raw model trigger and selected trigger.
3. The adapter validates strict JSON output and refuses execution authority or external action counts. If citations are empty, it makes at most one local retry, then stops if they are still empty. It exposes the cited source excerpts for human review, without claiming semantic verification. Only a cited advisory is sent to the separate n8n workflow `09`.
4. Workflow `09` independently rejects an empty citation list, checks that its request is synthetic and still pending review, and checks every cited source ID against the saved blueprint evidence. It inserts one `agent_runs` row and one minimal audit event. The caller-supplied run UUID prevents duplicate inserts on replay. It does not alter the blueprint or approval and performs no CRM, task, email, or publication actions.

Only the synthetic local n8n and Ollama services are contacted. The n8n webhook remains unauthenticated and bound to host loopback by the Docker Compose port mapping; do **not** publish this instance to a network or send real customer data. The checked-in receipt export is inactive by default. On the current development stack, workflow `09` has been imported, assigned the existing `Postgres account` credential, and published.

## Local setup and verified run

Import `workflows/09-local-ollama-interpretation-receipt.json` into the existing Personal project only if it is not already present. The guarded local import helper below checks by exact workflow name and refuses to import if the existing list cannot be read:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import-local-ollama-workflow.ps1
```

The above guarded import is already complete on the current local stack. The existing **Postgres account** credential is selected on `Persist local agent run and audit`; workflow `09` is published. Do not create or paste new database credentials into the workflow JSON. The exported file intentionally contains no credentials. The import helper itself does not publish the workflow.

Check the production webhook with an invalid, synthetic probe. A registered route should return HTTP 422, not HTTP 404:

```powershell
try {
  Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5680/webhook/local-ollama-interpretation-receipt' -Method Post -ContentType 'application/json' -Body '{}'
} catch { [int]$_.Exception.Response.StatusCode }
```

The live runs performed this preflight and received HTTP 422, confirming that an invalid receipt was rejected before database persistence. The original synthetic end-to-end pilot ran on 24 September 2026; two further adapter runs followed on 25 September 2026:

```powershell
node scripts/run-local-ollama-n8n-pilot.mjs --live
```

The command without `--live` makes no requests. The first successful live run reported model `qwen3.5:4b` and duration 17,640 ms; the second `interpretation-v4-trigger-v1` run lasted 7,042 ms. The latest `interpretation-v4-trigger-v1-citation-v3` run lasted 7,256 ms and returned `local-advisory-persisted`, `auditEventsWritten: 1`, `executionGate: false`, and zero CRM writes, tasks, and messages. Its review output included the approved excerpts for two cited source IDs. Each run created **one synthetic request**, one agent-run row, and one audit event. No cleanup is performed. These three timings are individual local observations, not a speed comparison. If the receipt workflow is missing or inactive on a future setup, the runner stops on HTTP 404 before creating a planning request or calling the model.

## Verification boundary

The export, validator, source-citation SQL guard, explicit-trigger rule, and host orchestration have automated tests; the full 178-test suite passes. On 25 September 2026, the published local receipt validator was updated and an otherwise well-formed synthetic receipt with an empty citation list returned HTTP 422 with the expected error. The Docker/n8n receipt workflow and PostgreSQL persistence have completed three live synthetic runs, including one after the citation gate was published. The workflow was additionally imported into a clean isolated n8n/PostgreSQL stack before this change; the expected workflow name and ID were verified and the workflow remained inactive. No credentials were copied and no webhook was activated in that clean-stack check. This is a **host-initiated local AI step feeding n8n**; the central n8n workflow does not itself invoke Ollama.
