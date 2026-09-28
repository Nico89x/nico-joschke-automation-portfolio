# Changelog

## 0.2.0 — 2026-09-28

- Hardened intake validation against wrong field types, invalid calendar dates, and past deadlines.
- Bound human approvals to request IDs and blueprint versions; unresolved questions now keep the gate closed.
- Rejected cross-request approval replay and malformed risk handoffs.
- Added audited invalid operations-hub intake, explicit request-state transitions, and duplicate status responses.
- Added a minimum RAG retrieval score, safe empty-result handling, long-paragraph chunking, and stale-chunk cleanup.
- Pinned n8n and pgvector Docker images for reproducible local setup.
- Expanded the automated suite from 168 to 178 passing tests.

## 0.1.0 — 2026-09-25

- Added central planning, review, audit, RAG, local Ollama receipt, synthetic evaluation, and isolated-start verification.
