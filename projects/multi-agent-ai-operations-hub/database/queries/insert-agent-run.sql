INSERT INTO agent_runs (
  request_id,
  agent_name,
  status,
  model_name,
  prompt_version,
  input_data,
  output_data,
  duration_ms,
  input_tokens,
  output_tokens,
  estimated_cost_usd,
  validation_errors,
  external_api_errors,
  approval_status,
  outcome
)
VALUES (
  NULLIF($1::jsonb->>'requestDbId', '')::uuid,
  $1::jsonb->>'agentName',
  $1::jsonb->>'status',
  NULLIF($1::jsonb->>'modelName', ''),
  NULLIF($1::jsonb->>'promptVersion', ''),
  COALESCE($1::jsonb->'inputSummary', '{}'::jsonb),
  COALESCE($1::jsonb->'outputSummary', '{}'::jsonb),
  COALESCE(($1::jsonb->>'durationMs')::integer, 0),
  COALESCE(($1::jsonb->>'inputTokens')::integer, 0),
  COALESCE(($1::jsonb->>'outputTokens')::integer, 0),
  COALESCE(($1::jsonb->>'estimatedCostUsd')::numeric, 0),
  COALESCE($1::jsonb->'validationErrors', '[]'::jsonb),
  COALESCE($1::jsonb->'externalApiErrors', '[]'::jsonb),
  NULLIF($1::jsonb->>'approvalStatus', ''),
  NULLIF($1::jsonb->>'outcome', '')
)
RETURNING id, started_at, agent_name, status;
