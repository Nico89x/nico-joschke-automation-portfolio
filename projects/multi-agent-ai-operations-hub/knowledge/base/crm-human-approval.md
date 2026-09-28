# CRM writes require human approval

Creating or changing a CRM contact can affect a sales pipeline and may be difficult to reverse. The system may prepare a proposed contact, company, deal, or task, but it must not create or update those records until a human explicitly approves the proposed automation blueprint.

The approval screen should show the target system, fields that will be written, the reason for the action, and any detected duplicate risk. A reviewer can approve, reject, or request revision. The approval decision needs a reviewer name, timestamp, proposal version, and optional notes. Those fields are stored in the audit log.

For this portfolio project the CRM is a demo integration only. No messages are sent and no real people are contacted. If approval is absent, expired, or rejected, the execution agent stops with a controlled result rather than attempting an external write.
