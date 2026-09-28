ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS chunk_index INTEGER;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding_model TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS token_count INTEGER;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_source_chunk_idx
  ON knowledge_chunks (source_id, chunk_index)
  WHERE source_id IS NOT NULL AND chunk_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS knowledge_chunks_search_vector_idx
  ON knowledge_chunks USING GIN (search_vector);
