const clean = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const unique = (items) => [...new Set(items.filter(Boolean))];

export function createAutomationBlueprint(input) {
  const request = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const intake = request.intake?.data && typeof request.intake.data === 'object' ? request.intake.data : {};
  const research = request.research?.data && typeof request.research.data === 'object' ? request.research.data : {};
  const ragSources = Array.isArray(request.rag?.sources) ? request.rag.sources : [];
  const errors = [];
  const warnings = [];

  if (!/^.{5,160}$/.test(clean(request.requestId))) errors.push('requestId must contain 5 to 160 characters');
  if (request.intake?.status !== 'accepted') errors.push('an accepted intake is required');
  if (!['completed', 'needs-human-input'].includes(request.research?.status)) errors.push('a bounded research brief is required');
  const sourceIds = unique(ragSources.map((source) => clean(source?.sourceId)).filter(Boolean));
  if (sourceIds.length === 0) errors.push('at least one valid RAG sourceId is required');
  if (errors.length) return { requestId: clean(request.requestId) || 'invalid-request', schemaVersion: '1.0', status: 'rejected', data: null, warnings, errors };

  const tools = Array.isArray(intake.currentTools) ? intake.currentTools.map(clean).filter(Boolean) : [];
  const unknowns = Array.isArray(research.unknowns) ? research.unknowns.map(clean).filter(Boolean) : [];
  const hasLeadLanguage = /lead|form|email|inquiry|anfrage/i.test(clean(intake.processDescription));
  const trigger = hasLeadLanguage
    ? { type: 'webhook-or-form-event', description: 'A validated inbound request or lead event starts the workflow.' }
    : { type: 'approved-source-event', description: 'A validated event from the yet-to-be-confirmed source system starts the workflow.' };
  const requiresApproval = intake.constraints?.requiresHumanApproval !== false;
  if (unknowns.length) warnings.push('Open research questions are carried forward; the blueprint must not be executed until they are resolved.');

  return {
    requestId: clean(request.requestId), schemaVersion: '1.0', status: unknowns.length ? 'needs-human-input' : 'completed',
    data: {
      blueprintVersion: 'local-deterministic-v1', companyScope: clean(intake.companyName), trigger,
      inputs: [{ name: 'validated request', source: 'intake', sensitivity: intake.constraints?.dataSensitivity ?? 'unknown' }],
      processingSteps: [
        { order: 1, name: 'Validate and deduplicate', purpose: 'Validate schema and use the idempotency key before any downstream action.', deterministic: true },
        { order: 2, name: 'Enrich with approved knowledge', purpose: 'Retrieve only source-grounded internal guidance and retain citations.', deterministic: true },
        { order: 3, name: 'Prepare proposed records', purpose: `Prepare CRM or task payloads for the confirmed tools: ${tools.join(', ') || 'not yet confirmed'}.`, deterministic: true },
        { order: 4, name: 'Human approval gate', purpose: 'Require explicit approval before creating records, tasks, or drafts.', deterministic: true },
      ],
      outputs: ['reviewable automation proposal', 'draft CRM or task payloads after approval only'],
      integrations: tools.map((tool) => ({ system: tool, action: 'pending-confirmation', externalActionAllowed: false })),
      errorPaths: [
        { condition: 'invalid input', response: 'reject and audit without external action' },
        { condition: 'duplicate idempotency key', response: 'return existing request state without a duplicate record' },
        { condition: 'missing source or tool details', response: 'stop for human clarification' },
        { condition: 'external API failure after approval', response: 'record a recoverable failure and do not retry destructive actions automatically' },
      ],
      humanApproval: { required: requiresApproval, actionsBlocked: ['create or update CRM records', 'create tasks', 'send messages', 'publish externally'] },
      evidence: sourceIds.map((sourceId) => ({ sourceId, use: 'solution pattern or control requirement' })),
      openQuestions: unknowns,
      externalActions: { executed: false, contactsCreated: 0, messagesSent: 0 },
    }, warnings, errors: [],
  };
}
