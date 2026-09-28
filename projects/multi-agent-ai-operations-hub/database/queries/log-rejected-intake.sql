WITH payload AS (
  SELECT $1::jsonb AS envelope
),
audited AS (
  INSERT INTO audit_events (request_id, event_type, actor, details)
  SELECT
    NULL,
    'intake.rejected',
    'intake-workflow',
    jsonb_build_object(
      'workflowRequestId', envelope->>'workflowRequestId',
      'schemaVersion', COALESCE(envelope->>'schemaVersion', '1.0'),
      'idempotencyKey', envelope->'normalized'->>'idempotencyKey',
      'companyName', envelope->'normalized'->>'companyName',
      'warnings', COALESCE(envelope->'warnings', '[]'::jsonb),
      'errors', COALESCE(envelope->'errors', '[]'::jsonb)
    )
  FROM payload
  RETURNING id
)
SELECT
  envelope->>'workflowRequestId' AS "requestId",
  COALESCE(envelope->>'schemaVersion', '1.0') AS "schemaVersion",
  'rejected' AS status,
  FALSE AS valid,
  NULL::jsonb AS data,
  COALESCE(envelope->'warnings', '[]'::jsonb) AS warnings,
  COALESCE(envelope->'errors', '[]'::jsonb) AS errors,
  (SELECT COUNT(*) FROM audited)::integer AS "auditEventsWritten"
FROM payload;
