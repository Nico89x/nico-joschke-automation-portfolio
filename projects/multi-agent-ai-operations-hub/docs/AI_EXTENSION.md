# Optional real-model interpretation pilot

This is an **opt-in extension**, not a claim that the published n8n workflows already use an LLM. The existing central workflow and approval gate remain deterministic. The module interprets a synthetic process request and approved knowledge excerpts into a small, reviewable advisory JSON object. It cannot create CRM records, tasks, messages, or approvals. Two separate adapters exist: a paid OpenAI Responses adapter (mock-tested only) and a local Ollama adapter (tested against a real local model).

## Boundary and contract

- `src/ai-interpretation-agent.mjs` accepts only a process description, goals, tool names, data-sensitivity label, and at most five approved knowledge excerpts. Explicit company and contact fields are omitted; direct email/phone patterns in free text are rejected before a call.
- The OpenAI adapter calls only the official OpenAI Responses endpoint, with `store: false`, a 400-token output cap, a timeout, no automatic retry, and a strict JSON Schema. A local validator also rejects extra fields, unknown citations, malformed JSON, refusals, incomplete output, and absent token usage. The server cannot grant execution authority.
- `src/local-ai-interpretation-agent.mjs` uses only Ollama's loopback API, rejects cloud model tags, requests the same JSON Schema and applies the same local output validator. It does not need an API key or a paid provider.
- The structured-output request shape follows the [official OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs). `store: false` follows the [OpenAI data-controls guidance](https://developers.openai.com/api/docs/guides/your-data). Provider support, model availability and prices must be rechecked before a live call.
- `evals/ai-interpretation-cases.json` contains six synthetic cases. `src/ai-interpretation-eval.mjs` measures schema validity, trigger match, missing-information detection, allowed-source citations, latency and token usage. These checks do **not** prove the answer is useful to a real client; that still needs human review.

## What was actually verified

The full Node suite passes 178 tests, including mocked success/failure paths for both adapters, the local trigger rule, citation gate, n8n receipt, isolated-import guard, and evaluation datasets. The offline evaluator returns `modelCalls: 0` and `modelQualityMeasured: false`. Local model results, including the new independent `validation-v4` snapshot, are documented in the [measured report](LOCAL_LLM_EVALUATION_REPORT.md). The current host adapter makes at most one citation-specific retry and stops an uncited response before persistence; published local receipt workflow `09` independently rejects empty citation lists. A returned source ID is accompanied by its approved excerpt for human review. This verifies the ID and exposes the evidence, but it does **not** verify that the cited text actually supports the recommendation. No paid-model call or token bill has been collected. The adapter remains separate from central workflow `07`.

Safe offline command (no API call):

```powershell
node scripts/evaluate-ai-interpretation.mjs --cases=6
```

## Paid OpenAI pilot gate — not authorized or run

Before a paid OpenAI run, choose an available model, confirm its current EUR-equivalent input/output prices, put the API key and model configuration only in the ignored local `.env`, and explicitly authorize the test cost. Never commit `.env` or paste the key into a public issue, screenshot, README, or chat. The live runner requires both `--live` and `AI_LIVE_CALL_APPROVED=yes`. It reserves a conservative amount in an ignored local usage ledger before any call; caps are at most 2 EUR per run and 10 EUR per month. The reservation is intentionally not refunded if a call fails, because a provider may still bill for it. The guard is not a substitute for a provider-side spending limit or billing review.

Only after those decisions, the intended command for the first two synthetic cases is:

```powershell
node --env-file=.env scripts/evaluate-ai-interpretation.mjs --live --cases=2
```

The actual run must be inspected for answer quality, citations, latency, usage and estimated cost. Its results should be added here only after they have really been measured. The opt-in Node module is not yet wired into n8n workflow `07`; adding it there would require a separate tested workflow version and a credential setup that never exports secrets.
