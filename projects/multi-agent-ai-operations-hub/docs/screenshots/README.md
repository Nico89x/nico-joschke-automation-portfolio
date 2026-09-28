# Workflow screenshots

Two authentic n8n UI screenshots were captured on 2026-09-23 and preserved here as SVG wrappers containing the original, unmodified JPEG bytes. Their embedded images were SHA-256 checked against the captures. The wrappers are text files because the current workspace blocks direct copying of binary files. These are screenshots, unlike the separately drawn architecture diagram.

The shareable [architecture overview](../architecture-overview.svg) is an illustration created from the implemented flow. It can be used in the README without implying it is a captured n8n screen.

Available evidence:

1. [Central Operations Hub](01-central-operations-hub.svg) — published workflow `07`, showing the visible validation, idempotency, retrieval, planning and audit path.
2. [Human Review](02-human-review.svg) — published workflow `08`, showing the one-time approval/rejection path and local-only response.

Workflow `09` is now included as the [local Ollama-to-n8n flow illustration](../local-ollama-n8n-flow.svg), not as a third captured editor screenshot. Its published state and successful synthetic receipt run are documented in [the integration report](../LOCAL_OLLAMA_N8N_INTEGRATION.md); the fresh-stack check separately verifies an import that remains inactive.

The screenshots show workflow structure and publication state, **not** a successful execution result. The synthetic HTTP 202/409/422 and closed execution gate are evidenced by the reproducible [live smoke test](../../scripts/smoke-test-operations-hub.ps1) and [test report](../PHASE_12_HUMAN_REVIEW_API_REPORT.md). A separate execution-response screenshot can be added later, but is not required to interpret the evidence honestly.

The captured views show no credentials, `.env` values or personal execution payloads. Future captures must use synthetic data and hide personal information.
