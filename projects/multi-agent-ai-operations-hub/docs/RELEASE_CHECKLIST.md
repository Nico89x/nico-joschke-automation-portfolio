# Public release checklist

- [x] Only synthetic input fixtures and knowledge documents are included.
- [x] `.env` is ignored; `.env.example` contains placeholders only.
- [x] Workflow exports are inactive and contain no credential objects.
- [x] Every workflow connection resolves to an existing node.
- [x] JavaScript code nodes compile.
- [x] Local automated suite: 178 passed, 0 failed on 28 September 2026.
- [x] Fresh isolated stack: n8n and PostgreSQL healthy; workflow `09` imported inactive.
- [x] Local LLM limitations and repeated-run variability are disclosed.
- [x] No real CRM writes, task creation, messages, or publication are enabled.
- [ ] Confirm the first remote GitHub Actions run after publication.
- [ ] Re-run the live smoke test after any future n8n version upgrade.
