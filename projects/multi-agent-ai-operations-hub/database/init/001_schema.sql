CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS project_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'portfolio-demo',
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  process_description TEXT NOT NULL,
  current_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received',
  raw_payload JSONB NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES project_requests(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL,
  model_name TEXT,
  prompt_version TEXT,
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_data JSONB,
  duration_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd NUMERIC(12, 6),
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  external_api_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_status TEXT,
  outcome TEXT,
  error_message TEXT,
  CHECK (finished_at IS NULL OR finished_at >= started_at),
  CHECK (duration_ms IS NULL OR duration_ms >= 0),
  CHECK (input_tokens IS NULL OR input_tokens >= 0),
  CHECK (output_tokens IS NULL OR output_tokens >= 0),
  CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd >= 0)
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_name TEXT NOT NULL,
  source_url TEXT,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(1536)
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS project_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID UNIQUE NOT NULL REFERENCES project_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  solution_blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_review JSONB NOT NULL DEFAULT '{}'::jsonb,
  effort_estimate JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID REFERENCES project_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS agent_runs_request_id_idx ON agent_runs(request_id);
CREATE INDEX IF NOT EXISTS audit_events_request_id_idx ON audit_events(request_id);
CREATE INDEX IF NOT EXISTS project_requests_status_idx ON project_requests(status);
