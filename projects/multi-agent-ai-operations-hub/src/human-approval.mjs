const clean = (value) => typeof value === 'string' ? value.trim() : '';

export function recordHumanApproval(input) {
  const request = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const risk = request.riskReview?.data && typeof request.riskReview.data === 'object' ? request.riskReview.data : null;
  const estimate = request.estimate?.data && typeof request.estimate.data === 'object' ? request.estimate.data : null;
  const errors = [];
  const warnings = [];
  if (!/^.{5,160}$/.test(clean(request.requestId))) errors.push('requestId must contain 5 to 160 characters');
  if (!risk || request.riskReview?.status !== 'completed') errors.push('a completed risk review is required');
  if (!estimate || !['completed', 'needs-human-input'].includes(request.estimate?.status)) errors.push('an estimate is required');
  if (risk && !Array.isArray(risk.risks)) errors.push('riskReview.data.risks must be an array');
  if (estimate && !['low', 'medium', 'high'].includes(estimate.uncertainty)) errors.push('estimate.data.uncertainty is invalid');
  const decision = clean(request.decision).toLowerCase();
  if (!['approved', 'rejected'].includes(decision)) errors.push('decision must be approved or rejected');
  const reviewer = clean(request.reviewer);
  if (reviewer.length < 2) errors.push('reviewer must contain at least 2 characters');
  if (errors.length) return { requestId: clean(request.requestId) || 'invalid-request', schemaVersion: '1.0', status: 'rejected', data: null, warnings, errors };

  const highRisks = risk.risks.filter((item) => item && ['high', 'critical'].includes(item.severity));
  const unresolved = estimate.uncertainty !== 'low';
  const approvedVersion = clean(request.approvedVersion);
  const canOpenGate = decision === 'approved' && request.estimate.status === 'completed' && !unresolved && approvedVersion.length > 0;
  if (decision === 'approved' && highRisks.length) warnings.push('Approval is recorded, but high-impact risks remain visible for the local demo gate.');
  if (decision === 'approved' && unresolved) warnings.push('The decision is recorded, but the execution gate remains closed until estimation uncertainty is resolved.');
  if (decision === 'approved' && !approvedVersion) warnings.push('The decision is recorded, but the execution gate remains closed because no blueprint version was approved.');
  return { requestId: clean(request.requestId), schemaVersion: '1.0', status: 'completed', data: {
    requestId: clean(request.requestId), decision, reviewer, reviewedAt: 'recorded-by-workflow-runtime', revisionNotes: clean(request.revisionNotes) || null,
    approvedVersion: approvedVersion || null,
    executionGate: { open: canOpenGate, blockedActions: canOpenGate ? [] : ['create or update CRM records', 'create tasks', 'send messages', 'publish externally'] },
    retainedRisks: highRisks.map((item) => ({ id: item.id, severity: item.severity })),
  }, warnings, errors: [] };
}
