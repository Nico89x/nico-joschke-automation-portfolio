const clean = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

export function reviewAutomationRisk(input) {
  const request = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const blueprint = request.blueprint?.data && typeof request.blueprint.data === 'object' ? request.blueprint.data : null;
  const errors = [];
  const warnings = [];
  if (!/^.{5,160}$/.test(clean(request.requestId))) errors.push('requestId must contain 5 to 160 characters');
  if (!['completed', 'needs-human-input'].includes(request.blueprint?.status) || !blueprint) errors.push('a completed or needs-human-input blueprint is required');
  if (errors.length) return { requestId: clean(request.requestId) || 'invalid-request', schemaVersion: '1.0', status: 'rejected', data: null, warnings, errors };

  const sensitivity = clean(blueprint.inputs?.[0]?.sensitivity) || 'unknown';
  const approvalRequired = blueprint.humanApproval?.required !== false;
  const risks = [];
  if (['personal', 'special-category'].includes(sensitivity)) risks.push({ id: 'personal-data', severity: 'high', affectedData: sensitivity, finding: 'Personal or special-category data requires a human approval gate and data minimization.', mitigation: 'Keep contact data out of agent outputs and require recorded reviewer approval.' });
  if (!approvalRequired) risks.push({ id: 'missing-approval-gate', severity: 'critical', affectedData: 'external actions', finding: 'The blueprint does not require human approval before external actions.', mitigation: 'Block execution until explicit human approval is enabled.' });
  if (!blueprint.errorPaths?.some((path) => /duplicate/i.test(path.condition))) risks.push({ id: 'duplicate-records', severity: 'high', affectedData: 'CRM or task records', finding: 'No explicit idempotency or duplicate-record path was found.', mitigation: 'Require an idempotency key and lookup before create or update.' });
  if (!blueprint.integrations?.length) risks.push({ id: 'unconfirmed-integrations', severity: 'medium', affectedData: 'permissions', finding: 'No target integration is confirmed.', mitigation: 'Collect API scope and least-privilege requirements during review.' });
  if (blueprint.openQuestions?.length) risks.push({ id: 'open-questions', severity: 'medium', affectedData: 'solution assumptions', finding: 'Open questions remain in the proposed design.', mitigation: 'Resolve every open question before approval.' });

  const approvalGates = [
    { action: 'create or update CRM records', required: true },
    { action: 'create tasks', required: true },
    { action: 'send messages', required: true },
    { action: 'publish externally', required: true },
  ];
  if (risks.some((risk) => ['critical', 'high'].includes(risk.severity))) warnings.push('High-impact risks require a human decision; this reviewer cannot approve them.');
  return { requestId: clean(request.requestId), schemaVersion: '1.0', status: 'completed', data: { reviewVersion: 'local-deterministic-v1', decision: 'requires-human-review', risks, approvalGates, permissions: { leastPrivilegeRequired: true, credentialsMayBeStoredInRepository: false }, execution: { allowed: false, reason: 'Risk reviewer never grants execution permission.' } }, warnings, errors: [] };
}
