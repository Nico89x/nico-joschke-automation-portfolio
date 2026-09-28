# RAG foundation

## What exists now

The local knowledge base contains five synthetic implementation documents. Each document is validated, split into stable chunks, and enriched with a source ID, chunk index, content fingerprint, tag metadata, token count, and a 1536-dimensional vector.

The baseline vector is `local-hash-v1-baseline`: a deterministic hashed token vector. It is free, repeatable, and useful for testing PostgreSQL/pgvector storage, source tracing, chunking, ranking, and failure paths. It is **not** represented as a semantic embedding model and is not the final production choice.

## Retrieval contract

The retrieval query accepts only a parameterized JSON envelope:

```json
{
  "queryText": "How do we prevent duplicate webhook deliveries?",
  "queryEmbedding": "[0.00000000,...]",
  "limit": 3
}
```

It returns source metadata, the retrieved chunk, semantic score, lexical score, and combined retrieval score. The RAG component is read-only: it cannot mutate the knowledge base, browse the web, or contact any company.

## Database migration

`database/init/002_knowledge_base.sql` extends `knowledge_chunks` with stable source and chunk metadata plus a PostgreSQL full-text-search index. Docker applies it automatically for a newly created database volume. In the current local stack, the migration was also applied successfully through the local migration workflow.

## Next phase

1. Run the retrieval cases through PostgreSQL and compare them with the local baseline.
2. Add an approved OpenAI-compatible embedding provider only after a model, pricing, and €10 test-budget allocation are agreed.
