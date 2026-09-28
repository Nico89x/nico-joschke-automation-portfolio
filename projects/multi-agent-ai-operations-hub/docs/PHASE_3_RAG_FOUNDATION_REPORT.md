# Phase 3 report: RAG foundation

Date: 2026-09-22

## Created

- Five synthetic internal knowledge documents covering webhooks, idempotency, approval gates, reliability, RAG governance, and solution discovery.
- Deterministic document validation and chunking with stable source ID, chunk index, token count, and content fingerprint.
- A no-cost `local-hash-v1-baseline` vector generator with 1,536 dimensions, matching the current pgvector column.
- Parameterized PostgreSQL queries for knowledge-chunk upserts and read-only retrieval.
- A versioned database migration for knowledge source metadata and PostgreSQL full-text search.
- Three n8n workflow exports: one local migration workflow, one synthetic knowledge-ingestion API, and one read-only retrieval API.
- Five retrieval evaluation cases.
- A repeatable live smoke-test helper for the five retrieval cases.

## Actually tested

Command: `node --test`

- Total tests: 46
- Passed: 46
- Failed: 0
- Skipped: 0
- All five retrieval evaluation cases ranked the expected source first with the local baseline.
- The n8n knowledge-ingestion export was executed in a sandboxed test: a valid synthetic document produced a 1,536-dimensional vector and an undersized document was rejected.
- The retrieval workflow export is verified as read-only, parameterized, and covered by input-validation tests.

## Important limitation

The local-hash baseline is intentionally a test embedding, not a semantic production embedding model. It makes chunking, source traceability, pgvector storage, and evaluation fully testable without an API key or cost. A later, approved OpenAI-compatible embedding provider will replace it for genuine semantic retrieval.

## Verified locally in the running stack

- The knowledge-base migration was applied through the local n8n migration workflow; PostgreSQL reported `success: true`.
- The knowledge-ingestion workflow was imported into n8n, connected to the existing local PostgreSQL credential, and published only in the local n8n instance.
- A single test delivery through the n8n test webhook returned HTTP 202 and wrote one chunk.
- The five synthetic documents were sent twice to the local production webhook. Both runs returned HTTP 202 with `accepted` status and one upserted chunk each; the second run exercised the update path rather than creating new source/chunk identities.
- The read-only retrieval workflow was published only in the local n8n instance and queried through its local production webhook.
- All five live evaluation queries returned HTTP 200 and `retrieved`; the expected source ranked first for every case, and no response contained duplicate source IDs.
- A deliberately underspecified live query was rejected with HTTP 422 before it could reach PostgreSQL.

## Fixed during verification

The first version of the PowerShell seed helper reported false 422 failures when it processed documents through a pipeline. The workflow itself was not at fault: the same requests succeeded when sent directly. The helper now uses an explicit file loop and string conversion; a rerun completed with five successful HTTP 202 responses.

The initial upsert query did not map the workflow's camelCase chunk metadata (`chunkIndex`, `contentHash`, `tokenCount`) to the database fields. That left the conflict key incomplete and allowed duplicate chunks. The local workflow and its committed export now explicitly map those fields before the conflict check. The synthetic knowledge base was reset, reseeded twice, and the live retrieval tests then completed duplicate-free.

## Still open

- An approved semantic embedding provider has not been selected. The current no-cost hash baseline remains intentionally non-production.
- The retrieval evaluation set is intentionally small and synthetic; it is a quality gate, not a claim of production-grade relevance.

## Next concrete step

Implement the first bounded agent: the Research Agent. It will accept only the validated intake envelope, produce a schema-validated, source-cited research brief, and remain unable to contact external companies or modify data.
