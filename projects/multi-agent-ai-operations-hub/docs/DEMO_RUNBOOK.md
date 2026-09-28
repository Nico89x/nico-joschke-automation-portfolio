# Demo runbook

This walkthrough uses only synthetic data against the local Docker stack. It does not require an LLM key and must not be exposed as a public service.

## 90-second live interview demo (no video required)

1. Open the [architecture diagram](architecture-overview.svg) and explain the path in one sentence: request → validation and deduplication → source-grounded local plan → audit trail → human decision.
2. Show the published `07 - Multi-Agent AI Operations Hub` workflow in n8n. Point to validation before retrieval and planning, then to the pending human-review response.
3. Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test-operations-hub.ps1` from this project folder. The six checks should pass: HTTP 202 planning, duplicate key, approval with zero external actions, HTTP 409 replay, HTTP 422 invalid input, and rejection.
4. Show `08 - Operations Hub Review and Local Demo`. State clearly that approval only prepares a synthetic local draft, and that the central agent logic and embeddings are deterministic baselines.
5. Optionally show `09 - Local Ollama Interpretation Receipt` and its one successful synthetic execution. Explain that a host-side adapter calls local Ollama and `09` validates/persists its advisory result; the central `07` workflow does not itself call the model.

Short spoken version (German):

> „Eine unstrukturierte Anfrage wird zuerst geprüft und gegen Dubletten abgesichert. Danach erstellt das System mit lokalem Wissen einen nachvollziehbaren Automatisierungsentwurf und protokolliert jeden Schritt. Eine Person muss den Entwurf ausdrücklich freigeben. Auch danach bereitet diese Demo nur einen lokalen synthetischen Entwurf vor. Die sechs Live-Prüfungen zeigen neben dem Normalfall auch Dubletten, ungültige Eingaben und abgelehnte oder wiederholte Freigaben.“

The script adds two synthetic requests and related audit rows per run. This live demonstration replaces a recorded video for the portfolio; recording remains optional.

## Before the demo

1. Start the local n8n and PostgreSQL stack and confirm n8n is available at `http://localhost:5680`.
2. Confirm workflows `07 - Multi-Agent AI Operations Hub` and `08 - Operations Hub Review and Local Demo` are published.
3. Run the full suite with `node --test`; the latest local verification passed 178 tests. Adapter and receipt contract tests use mocks, while three full Ollama-to-n8n synthetic runs were completed, including the current citation-gated adapter. The new 15-case independent validation snapshot is documented in [LOCAL_LLM_EVALUATION_REPORT.md](LOCAL_LLM_EVALUATION_REPORT.md); it includes one controlled stop despite an available source and does not prove production model quality.
4. Keep the n8n execution view and this runbook ready. Use only the synthetic request below.

For a repeatable live check before recording, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test-operations-hub.ps1`. It exercises all six paths below without needing to paste requests manually. Each run leaves two synthetic requests and their audit events in the local database; the script deliberately does not delete test data.

To measure local planning round-trip latency, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\benchmark-local-hub.ps1`. It sends five unique synthetic requests by default, checks that each stops for human review with six audit events and a closed execution gate, and prints the median/minimum/maximum HTTP round-trip time as JSON. It stores one synthetic request and six audit events per sample; no cleanup or external actions are performed. This measures the local end-to-end route, not isolated node time, and no LLM cost is reported because no model API is configured.

## Happy path

Send this JSON to `POST http://localhost:5680/webhook/operations-hub`:

```json
{
  "companyName": "Synthetic Demo GmbH",
  "contactName": "Synthetic Contact",
  "contactEmail": "synthetic@example.test",
  "processDescription": "Synthetic website leads are manually copied into a CRM. Validate the fields, prevent duplicates, and create a reviewable automation proposal.",
  "currentTools": ["HubSpot", "n8n"],
  "goals": ["Reduce manual entry", "Prevent duplicate leads"],
  "constraints": {
    "dataSensitivity": "personal",
    "requiresHumanApproval": true
  },
  "idempotencyKey": "demo-run-unique-001"
}
```

Use a fresh idempotency key if you repeat this demo. The expected planning response is HTTP 202 and `status: "awaiting-human-review"`, with a `requestDbId`, retrieved source chunks, six stage-audit events, `executionGate: false`, and zero external actions.

Review the plan in n8n/PostgreSQL, then make the human decision explicitly by sending this JSON to `POST http://localhost:5680/webhook/operations-hub-review` (replace the UUID with the `requestDbId` from the planning response):

```json
{
  "requestDbId": "<requestDbId-from-planning-response>",
  "decision": "approved",
  "reviewer": "Synthetic Reviewer",
  "revisionNotes": "Approved for local synthetic demo only"
}
```

Expected result: `approved-local-draft-prepared`, one decision audit event, `executionGate: false`, and zero CRM writes, tasks, or messages. Approval prepares a proposal; it does not run external actions.

## Show safety paths

- Send the same decision a second time: expect HTTP 409 and no new audit event or draft.
- Send an invalid intake (for example, omit `companyName`): expect HTTP 422 before planning.
- Create another fresh request and reject it through the review route: expect `rejected-blocked`, no proposal, and zero external actions.

## Optional 2–3 minute demo-video outline

| Time | Show | Explain |
|---|---|---|
| 0:00–0:20 | Project overview | The problem is unstructured automation requests and risky, premature execution. |
| 0:20–0:50 | Central n8n workflow | Deterministic validation and idempotency happen before research and planning. |
| 0:50–1:20 | RAG and audit trail | Source chunks are retrieved locally; each planning stage leaves a minimised audit event. |
| 1:20–1:50 | Review endpoint | A named person makes a one-time decision; approval only prepares a local synthetic draft. |
| 1:50–2:15 | Failure/replay | Show a rejected input or repeated decision returning 422/409 without external actions. |
| 2:15–2:45 | Tests and limitations | 178 tests pass; the agents and embeddings in central workflow `07` remain deterministic baselines. A host-side local Ollama step feeds the published receipt workflow `09`; show the citation review output, one controlled missing-citation stop, and clarify there are no external actions. |

## German narration script (about 2:30)

Use the script as a guide, not a claim that the central n8n workflow has LLM-powered agents or that real SaaS execution is enabled. Show only the local n8n UI and synthetic data.

### 0:00–0:20 — Problem and goal

> „Der Multi-Agent AI Operations Hub nimmt unstrukturierte Anforderungen zur Prozessautomatisierung entgegen und macht daraus einen nachvollziehbaren, überprüfbaren Lösungsvorschlag. Der Schwerpunkt liegt auf kontrollierter Orchestrierung, Datenqualität und einer klaren menschlichen Freigabe – nicht auf unkontrollierter automatischer Ausführung.“

### 0:20–0:45 — Intake and idempotency

Show the central workflow and one successful synthetic execution.

> „Am Eingang prüft der Workflow die Anfrage deterministisch und speichert sie mit einem Idempotency-Key. Eine Wiederholung derselben Anfrage erzeugt keinen zweiten Plan. Hier siehst du, dass der Ablauf mit sechs Stage-Audit-Ereignissen bei `awaiting-human-review` endet.“

### 0:45–1:10 — Retrieval and planning stages

Show the RAG retrieval and the central planning stages.

> „Danach werden passende Einträge aus einer lokalen synthetischen Wissensbasis abgerufen. Recherche, Lösungsvorschlag, Risikoprüfung und Aufwandsschätzung sind in klar abgegrenzte Schritte getrennt. Die Agentenschritte in diesem zentralen Workflow und die Test-Embeddings sind deterministische Baselines. Ergänzend gibt es einen separaten, hostseitigen lokalen Qwen-Interpretationsschritt, der sein Ergebnis an Workflow 09 zur Validierung und Speicherung übergibt.“

### 1:10–1:35 — Audit and reliability

Show the stored run/audit result, keeping the visible records synthetic.

> „Die Verarbeitung hinterlässt nachvollziehbare Audit-Ereignisse, statt nur ein Endergebnis auszugeben. In einem Fünf-Stichproben-Test auf dieser lokalen Entwicklungsmaschine lag die HTTP-Rundlaufzeit im Median bei 89,2 Millisekunden. Das ist ein lokaler Richtwert und keine Produktions- oder SLA-Aussage.“

### 1:35–2:00 — Human review and safety gate

Show the review workflow and one approved synthetic local draft.

> „Vor jeder folgenreichen Aktion ist eine benannte menschliche Entscheidung erforderlich. Selbst nach einer Freigabe erzeugt die Demo nur einen synthetischen lokalen Entwurf. Sie schreibt nicht in ein echtes CRM, erstellt keine echten Aufgaben und verschickt keine Nachrichten.“

### 2:00–2:20 — Failure paths

Show an invalid intake or a replayed review decision.

> „Auch Fehlerfälle sind Teil des Designs: Ungültige Eingaben werden abgelehnt, und eine bereits getroffene Freigabe kann nicht erneut angewendet werden. Die entsprechenden Live-Prüfungen liefern HTTP 422 beziehungsweise HTTP 409.“

### 2:20–2:35 — Close

> „Die aktuelle Version hat 178 automatisierte Tests. Den separaten KI-Schritt habe ich mit einem lokalen Qwen-Modell geprüft. Fehlt eine Quelle, gibt es höchstens einen lokalen Nachprüfungsversuch; danach wird der Entwurf gestoppt. In einem neuen 15-Fall-Testsatz wurden 14 belegte Entwürfe akzeptiert, einer wurde trotz passender Quelle kontrolliert gestoppt. Die Quellen muss ein Mensch inhaltlich prüfen. Drei synthetische Live-Läufe wurden sicher protokolliert. Der zentrale Planungsworkflow bleibt deterministisch; echte CRM- oder Nachrichtenaktionen sind nicht aktiv.“

## Recording checklist

- Use a fresh synthetic request and keep the visible payload free of real contact data.
- Hide the `.env` file, credentials, browser profile details, and unrelated tabs before recording.
- Show the workflow names `07 - Multi-Agent AI Operations Hub` and `08 - Operations Hub Review and Local Demo`.
- Keep the human-review boundary and the no-external-actions result visible when discussing approval.
- If recording a fresh approval/rejection, remember the live smoke and benchmark scripts persist synthetic request/audit rows and do not clean them up.
- Do not describe the local latency number as a production benchmark, or the deterministic stages as live LLM agents.

Do not show `.env`, credentials, browser profiles, or any real customer or contact data in screenshots or video.
