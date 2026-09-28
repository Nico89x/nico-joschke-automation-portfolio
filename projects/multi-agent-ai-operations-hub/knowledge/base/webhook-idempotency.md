# Webhooks and idempotency

A webhook endpoint receives an incoming event from a form, CRM, or SaaS tool. The endpoint must validate the body before any write happens. Required values include an identifiable source, a contact address when relevant, a sufficiently detailed process description, and an idempotency key.

The idempotency key protects the automation from duplicate delivery. A sender may retry because its first request timed out even though the receiver already stored the data. The database therefore keeps a unique idempotency key. The first request creates the record. A later request with the same key returns the original request identifier and is marked as a duplicate instead of creating another CRM record.

Webhook processing should respond with a clear HTTP status. A syntactically valid request that was safely accepted can return 202. A request with missing fields should return 422 and list the validation errors. Every result should be written to the audit trail so an operator can explain what happened without inspecting raw workflow executions.
