WITH payload AS (
  SELECT $1::jsonb AS envelope
),
input AS (
  SELECT
    NULLIF(envelope->>'queryEmbedding', '')::vector AS query_embedding,
    COALESCE(envelope->>'queryText', '') AS query_text,
    LEAST(GREATEST(COALESCE((envelope->>'limit')::INTEGER, 3), 1), 10) AS result_limit
  FROM payload
),
scored AS (
  SELECT
    chunk.id,
    chunk.source_id,
    chunk.source_name,
    chunk.source_url,
    chunk.chunk_index,
    chunk.content,
    chunk.metadata,
    1 - (chunk.embedding <=> input.query_embedding) AS semantic_score,
    ts_rank_cd(chunk.search_vector, plainto_tsquery('simple', input.query_text)) AS lexical_score
  FROM knowledge_chunks AS chunk
  CROSS JOIN input
  WHERE chunk.embedding IS NOT NULL AND input.query_embedding IS NOT NULL
)
SELECT
  id, source_id, source_name, source_url, chunk_index, content, metadata,
  semantic_score, lexical_score,
  semantic_score * 0.85 + lexical_score * 0.15 AS retrieval_score
FROM scored
ORDER BY retrieval_score DESC, source_id, chunk_index
LIMIT (SELECT result_limit FROM input);
