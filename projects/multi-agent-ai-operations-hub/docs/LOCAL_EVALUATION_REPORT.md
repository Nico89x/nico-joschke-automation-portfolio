# Local evaluation report

Date: 2026-09-23

## Local planning route benchmark

The benchmark script `scripts/benchmark-local-hub.ps1` sent five unique, synthetic requests to the locally running `POST /webhook/operations-hub` route. It measured client-observed HTTP round-trip time, including local HTTP, n8n workflow execution, and PostgreSQL work.

| Result | Measurement |
|---|---:|
| Samples | 5 |
| Successful planning responses | 5/5, HTTP 202 |
| Median round-trip | 89.2 ms |
| Minimum round-trip | 70.7 ms |
| Maximum round-trip | 378.2 ms |
| Stage audit events per request | 6 |
| Execution gate | Closed for all samples |
| External actions | 0 |
| LLM API calls / LLM API cost | 0 / Not applicable; no provider is configured |

Individual round-trip times were 378.2, 89.2, 92.2, 74.3, and 70.7 ms. The slowest first request may reflect warm-up, but this run does not establish the cause. The sample is deliberately small and local; it is not a production load test and should not be used as a service-level guarantee.

The run stored five synthetic request records and 30 stage-audit events in the local database. It did not approve those requests, invoke external services, or delete existing records.

## How to reproduce

With the local stack running and workflows `07` and `08` published:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\benchmark-local-hub.ps1
```

The default is five samples. The script accepts 3–20 samples and verifies every response is HTTP 202, waits for human review, writes six audit events, and keeps the external execution gate closed.

## Interpretation and limits

- The reported time is client-observed end-to-end round-trip latency on this local machine, not the summed n8n node durations.
- No LLM token usage or model cost can be reported because the current agents and embedding baseline are deterministic and no model API is connected.
- Hosting, electricity, and hardware costs are not included.
- Repeat on the target machine and with a larger sample before making comparative or performance claims.
