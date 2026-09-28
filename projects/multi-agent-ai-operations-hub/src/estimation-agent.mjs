const clean = (value) => typeof value === 'string' ? value.trim() : '';

export function estimateAutomationWork(input) {
  const request = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const blueprint = request.blueprint?.data && typeof request.blueprint.data === 'object' ? request.blueprint.data : null;
  const risk = request.riskReview?.data && typeof request.riskReview.data === 'object' ? request.riskReview.data : null;
  const errors = [];
  const warnings = [];
  if (!/^.{5,160}$/.test(clean(request.requestId))) errors.push('requestId must contain 5 to 160 characters');
  if (!blueprint || !['completed', 'needs-human-input'].includes(request.blueprint?.status)) errors.push('a blueprint is required');
  if (!risk || request.riskReview?.status !== 'completed') errors.push('a completed risk review is required');
  if (errors.length) return { requestId: clean(request.requestId) || 'invalid-request', schemaVersion: '1.0', status: 'rejected', data: null, warnings, errors };

  const integrationCount = Array.isArray(blueprint.integrations) ? blueprint.integrations.length : 0;
  const riskCount = Array.isArray(risk.risks) ? risk.risks.length : 0;
  const questionCount = Array.isArray(blueprint.openQuestions) ? blueprint.openQuestions.length : 0;
  const baseHours = 12;
  const integrationHours = integrationCount * 5;
  const riskHours = riskCount * 2;
  const clarificationHours = questionCount * 3;
  const estimateHours = baseHours + integrationHours + riskHours + clarificationHours;
  const lower = Math.max(8, Math.round(estimateHours * 0.75));
  const upper = Math.round(estimateHours * 1.35);
  if (questionCount) warnings.push('Open questions increase the upper estimate; the estimate must be revised after clarification.');
  if (risk.risks?.some((item) => item.severity === 'critical')) warnings.push('Critical risks must be resolved before any execution estimate can be treated as actionable.');
  return { requestId: clean(request.requestId), schemaVersion: '1.0', status: questionCount ? 'needs-human-input' : 'completed', data: {
    estimationVersion: 'local-rule-based-v1', effortHours: { lower, expected: estimateHours, upper, formula: `12 base + ${integrationCount}*5 integration + ${riskCount}*2 risk + ${questionCount}*3 clarification` },
    recurringCostsEurPerMonth: { localDevelopment: { lower: 0, upper: 0, note: 'Uses the local Docker stack and no paid AI provider.' }, optionalHosting: { lower: 5, upper: 15, note: 'Illustrative portfolio hosting range; no provider quote or purchase.' }, modelApi: { lower: 0, upper: 10, note: 'Only if a separately approved API budget is used.' } },
    assumptions: ['Synthetic data only.', 'One reviewer is available for approval.', 'No real CRM, messaging, or paid API is enabled.', 'Each confirmed integration uses documented API access.'],
    uncertainty: questionCount ? 'medium' : 'low', externalPricesVerified: false,
  }, warnings, errors: [] };
}
