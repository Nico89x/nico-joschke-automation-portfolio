# Security notes

This repository is a local portfolio prototype. It is intentionally configured for loopback-only access and synthetic data.

## Safe-use boundary

- Do not expose the n8n or PostgreSQL ports to the public internet.
- Do not import real customer, employee, lead, or credential data.
- Keep `.env`, n8n credentials, API keys, and local execution data out of Git.
- Published workflows are inactive and contain no credential objects; select credentials locally after import.
- The review route is a demonstration endpoint, not a production authentication or authorization layer.
- The local execution adapter creates a reversible synthetic draft only. It never sends messages or writes to a real CRM.

## Reporting

If you find a secret or personal data in the repository, do not open a public issue containing it. Remove the material from the working copy and contact the repository owner privately through the profile contact channel.

## Production gaps

Before production use, add authenticated endpoints, least-privilege service credentials, rate limiting, central secret management, retention rules, structured dead-letter/replay handling, dependency scanning, and an incident-response process.
