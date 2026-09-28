const clean = (value) => typeof value === 'string' ? value.trim() : '';

export function prepareDemoExecution(input) {
  const request = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const approval = request.humanApproval?.data && typeof request.humanApproval.data === 'object' ? request.humanApproval.data : null;
  const blueprint = request.blueprint?.data && typeof request.blueprint.data === 'object' ? request.blueprint.data : null;
  const errors = [];
  const warnings = [];
  if (!/^.{5,160}$/.test(clean(request.requestId))) errors.push('requestId must contain 5 to 160 characters');
  if (!approval || request.humanApproval?.status !== 'completed') errors.push('a completed human approval record is required');
  if (!blueprint || request.blueprint?.status !== 'completed') errors.push('a completed blueprint is required');
  if (request.humanApproval?.requestId !== clean(request.requestId) || approval?.requestId !== clean(request.requestId)) errors.push('human approval requestId does not match');
  if (request.blueprint?.requestId !== clean(request.requestId)) errors.push('blueprint requestId does not match');
  if (errors.length) return { requestId: clean(request.requestId) || 'invalid-request', schemaVersion: '1.0', status: 'rejected', data: null, warnings, errors };

  const blueprintVersion = clean(blueprint.blueprintVersion);
  const approved = approval.decision === 'approved'
    && approval.executionGate?.open === true
    && blueprintVersion.length > 0
    && clean(approval.approvedVersion) === blueprintVersion
    && Array.isArray(blueprint.openQuestions)
    && blueprint.openQuestions.length === 0;
  if (!approved) return {
    requestId: clean(request.requestId), schemaVersion: '1.0', status: 'blocked',
    data: { executionMode: 'local-demo-only', actionsCreated: [], actionsBlocked: approval.executionGate?.blockedActions ?? ['all external actions'], externalActions: { crmWrites: 0, tasksCreated: 0, messagesSent: 0 } },
    warnings: ['Execution remains blocked until an explicit human approval opens the gate.'], errors: [],
  };

  const proposal = {
    recordType: 'local-demo-execution-draft',
    companyScope: clean(blueprint.companyScope),
    proposedIntegrations: (blueprint.integrations ?? []).map((item) => item.system),
    proposedSteps: (blueprint.processingSteps ?? []).map((step) => ({ order: step.order, name: step.name })),
    requiresAdditionalConfirmationBeforeExternalAction: true,
    synthetic: true,
  };
  warnings.push('Only a local synthetic draft was prepared. No external system was contacted.');
  return {
    requestId: clean(request.requestId), schemaVersion: '1.0', status: 'prepared',
    data: {
      executionMode: 'local-demo-only', actionsCreated: [{ type: 'local-draft', reversible: true, proposal }], actionsBlocked: ['create or update CRM records', 'create tasks in external systems', 'send messages', 'publish externally'],
      externalActions: { crmWrites: 0, tasksCreated: 0, messagesSent: 0 },
    }, warnings, errors: [],
  };
}
