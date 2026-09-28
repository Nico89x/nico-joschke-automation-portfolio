# Reliable workflow execution

An automation should make failure visible instead of silently losing work. Each external API call has a timeout, a limited retry count, and a clear failure path. Retrying is appropriate for temporary network errors, service unavailability, and rate limits. It is not appropriate for validation errors or missing human approval.

Before an external write, the workflow records an intent and an idempotency key. After the call it records the outcome, duration, response category, and a safe error summary. This enables a later recovery run without creating duplicate data. A failed API request moves to a retryable or manual-review state; it never appears as a successful completion.

Operational logs should include a request identifier, workflow or agent name, start and end time, status, model and prompt version where applicable, token counts, estimated cost, and errors. Sensitive payload values are minimized in logs and never copied into public documentation.
