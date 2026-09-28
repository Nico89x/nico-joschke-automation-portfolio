INSERT INTO audit_events (
  request_id,
  event_type,
  actor,
  details
)
VALUES (
  NULLIF($1::jsonb->>'requestDbId', '')::uuid,
  $1::jsonb->>'eventType',
  $1::jsonb->>'actor',
  COALESCE($1::jsonb->'details', '{}'::jsonb)
)
RETURNING id, created_at, event_type, actor;
