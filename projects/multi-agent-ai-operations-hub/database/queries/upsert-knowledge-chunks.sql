WITH payload AS (
  SELECT $1::jsonb AS envelope
),
chunks AS (
  SELECT
    payload.envelope->>'sourceId' AS source_id,
    payload.envelope->>'sourceName' AS source_name,
    NULLIF(payload.envelope->>'sourceUrl', '') AS source_url,
    COALESCE(payload.envelope->'tags', '[]'::jsonb) AS tags,
    payload.envelope->>'embeddingModel' AS embedding_model,
    item."chunkIndex" AS chunk_index,
    item.content,
    item."contentHash" AS content_hash,
    item."tokenCount" AS token_count,
    item.embedding::vector AS embedding
  FROM payload
  CROSS JOIN LATERAL jsonb_to_recordset(payload.envelope->'chunks') AS item(
    "chunkIndex" INTEGER,
    content TEXT,
    "contentHash" TEXT,
    "tokenCount" INTEGER,
    embedding TEXT
  )
),
deleted AS (
  DELETE FROM knowledge_chunks existing
  USING payload
  WHERE existing.source_id = payload.envelope->>'sourceId'
    AND NOT EXISTS (
      SELECT 1 FROM chunks incoming WHERE incoming.chunk_index = existing.chunk_index
    )
  RETURNING existing.id
),
upserted AS (
  INSERT INTO knowledge_chunks (
    source_id, source_name, source_url, content, metadata, embedding,
    embedding_model, chunk_index, content_hash, token_count, updated_at
  )
  SELECT
    source_id, source_name, source_url, content,
    jsonb_build_object('tags', tags, 'synthetic', true), embedding,
    embedding_model, chunk_index, content_hash, token_count, NOW()
  FROM chunks
  ON CONFLICT (source_id, chunk_index) WHERE source_id IS NOT NULL AND chunk_index IS NOT NULL
  DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    content = EXCLUDED.content,
    metadata = EXCLUDED.metadata,
    embedding = EXCLUDED.embedding,
    embedding_model = EXCLUDED.embedding_model,
    content_hash = EXCLUDED.content_hash,
    token_count = EXCLUDED.token_count,
    updated_at = NOW()
  RETURNING id
)
SELECT
  (SELECT COUNT(*)::INTEGER FROM upserted) AS upserted_chunks,
  (SELECT COUNT(*)::INTEGER FROM deleted) AS deleted_stale_chunks;
