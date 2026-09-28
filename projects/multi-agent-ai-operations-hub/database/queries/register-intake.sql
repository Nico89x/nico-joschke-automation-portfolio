WITH payload AS (
  SELECT $1::jsonb AS envelope
),
input AS (
  SELECT
    envelope->'normalized' AS normalized,
    COALESCE(envelope->'rawPayload', envelope->'normalized') AS raw_payload,
    COALESCE(envelope->'warnings', '[]'::jsonb) AS warnings,
    envelope->>'workflowRequestId' AS workflow_request_id,
    COALESCE(envelope->>'schemaVersion', '1.0') AS schema_version
  FROM payload
),
inserted AS (
  INSERT INTO project_requests (
    source,
    company_name,
    contact_name,
    contact_email,
    process_description,
    current_tools,
    goals,
    constraints,
    status,
    raw_payload,
    idempotency_key
  )
  SELECT
    'n8n-intake',
    normalized->>'companyName',
    NULLIF(normalized->>'contactName', ''),
    NULLIF(normalized->>'contactEmail', ''),
    normalized->>'processDescription',
    COALESCE(normalized->'currentTools', '[]'::jsonb),
    COALESCE(normalized->'goals', '[]'::jsonb),
    COALESCE(normalized->'constraints', '{}'::jsonb),
    'accepted',
    raw_payload,
    normalized->>'idempotencyKey'
  FROM input
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id, TRUE AS created
),
resolved AS (
  SELECT id, created
  FROM inserted

  UNION ALL

  SELECT project_requests.id, FALSE AS created
  FROM project_requests
  CROSS JOIN input
  WHERE project_requests.idempotency_key = input.normalized->>'idempotencyKey'
    AND NOT EXISTS (SELECT 1 FROM inserted)
  LIMIT 1
),
audited AS (
  INSERT INTO audit_events (request_id, event_type, actor, details)
  SELECT
    resolved.id,
    CASE WHEN resolved.created THEN 'intake.accepted' ELSE 'intake.duplicate' END,
    'intake-workflow',
    jsonb_build_object(
      'workflowRequestId', input.workflow_request_id,
      'schemaVersion', input.schema_version,
      'idempotencyKey', input.normalized->>'idempotencyKey',
      'created', resolved.created,
      'warnings', input.warnings
    )
  FROM resolved
  CROSS JOIN input
  RETURNING id
)
SELECT
  resolved.id::text AS "requestId",
  input.workflow_request_id AS "workflowRequestId",
  input.schema_version AS "schemaVersion",
  CASE WHEN resolved.created THEN 'accepted' ELSE 'duplicate' END AS status,
  resolved.created,
  input.normalized AS data,
  input.warnings,
  '[]'::jsonb AS errors,
  (SELECT COUNT(*) FROM audited)::integer AS "auditEventsWritten"
FROM resolved
CROSS JOIN input;
