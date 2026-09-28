const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const allowedTopLevelFields = new Set([
  'companyName',
  'contactName',
  'contactEmail',
  'processDescription',
  'currentTools',
  'goals',
  'constraints',
  'idempotencyKey',
]);
const allowedConstraintFields = new Set([
  'budgetEur',
  'deadline',
  'dataSensitivity',
  'requiresHumanApproval',
]);
const allowedSensitivity = new Set(['public', 'internal', 'personal', 'special-category', 'unknown']);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanString).filter(Boolean))];
}

function isValidCalendarDate(value) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateAndNormalizeIntake(payload, options = {}) {
  const payloadIsObject = payload && typeof payload === 'object' && !Array.isArray(payload);
  const input = payloadIsObject ? payload : {};
  const rawConstraints = input.constraints && typeof input.constraints === 'object' && !Array.isArray(input.constraints)
    ? input.constraints
    : {};
  const currentDate = options.currentDate ?? new Date().toISOString().slice(0, 10);
  const normalized = {
    companyName: cleanString(input.companyName),
    contactName: cleanString(input.contactName),
    contactEmail: cleanString(input.contactEmail).toLowerCase(),
    processDescription: cleanString(input.processDescription),
    currentTools: cleanStringArray(input.currentTools),
    goals: cleanStringArray(input.goals),
    constraints: { ...rawConstraints },
    idempotencyKey: cleanString(input.idempotencyKey),
  };

  const errors = [];
  const warnings = [];
  if (!payloadIsObject) errors.push('payload must be an object');
  for (const field of ['companyName', 'processDescription', 'idempotencyKey']) {
    if (typeof input[field] !== 'string') errors.push(`${field} must be a string`);
  }
  for (const field of ['contactName', 'contactEmail']) {
    if (input[field] !== undefined && typeof input[field] !== 'string') errors.push(`${field} must be a string`);
  }
  for (const field of ['currentTools', 'goals']) {
    if (input[field] !== undefined && !Array.isArray(input[field])) errors.push(`${field} must be an array`);
    if (Array.isArray(input[field]) && input[field].some((item) => typeof item !== 'string')) {
      errors.push(`${field} must contain only strings`);
    }
  }
  if (input.constraints !== undefined && (typeof input.constraints !== 'object' || input.constraints === null || Array.isArray(input.constraints))) {
    errors.push('constraints must be an object');
  }
  for (const field of Object.keys(input)) {
    if (!allowedTopLevelFields.has(field)) errors.push(`unknown field: ${field}`);
  }
  for (const field of Object.keys(rawConstraints)) {
    if (!allowedConstraintFields.has(field)) errors.push(`unknown constraint field: ${field}`);
  }
  if (normalized.companyName.length < 2) errors.push('companyName must contain at least 2 characters');
  if (normalized.companyName.length > 120) errors.push('companyName must contain at most 120 characters');
  if (normalized.processDescription.length < 40) errors.push('processDescription must contain at least 40 characters');
  if (normalized.processDescription.length > 5000) errors.push('processDescription must contain at most 5000 characters');
  if (normalized.goals.length === 0) errors.push('at least one goal is required');
  if (normalized.goals.length > 10) errors.push('goals must contain at most 10 items');
  if (normalized.goals.some((goal) => goal.length < 3 || goal.length > 240)) errors.push('each goal must contain 3 to 240 characters');
  if (normalized.currentTools.length > 30) errors.push('currentTools must contain at most 30 items');
  if (normalized.currentTools.some((tool) => tool.length > 80)) errors.push('each currentTools item must contain at most 80 characters');
  if (normalized.contactName.length > 120) errors.push('contactName must contain at most 120 characters');
  if (normalized.contactEmail.length > 254) errors.push('contactEmail must contain at most 254 characters');
  if (normalized.contactEmail && !emailPattern.test(normalized.contactEmail)) errors.push('contactEmail is invalid');
  if (normalized.idempotencyKey.length < 8) errors.push('idempotencyKey must contain at least 8 characters');
  if (normalized.idempotencyKey.length > 120) errors.push('idempotencyKey must contain at most 120 characters');

  const sensitivity = normalized.constraints.dataSensitivity ?? 'unknown';
  if (!allowedSensitivity.has(sensitivity)) errors.push('constraints.dataSensitivity is invalid');

  const approvalValue = normalized.constraints.requiresHumanApproval;
  if (approvalValue !== undefined && typeof approvalValue !== 'boolean') {
    errors.push('constraints.requiresHumanApproval must be a boolean');
  }
  const requiresHumanApproval = approvalValue !== false;
  if (['personal', 'special-category'].includes(sensitivity) && !requiresHumanApproval) {
    errors.push('sensitive data contradicts requiresHumanApproval=false');
  }

  const budget = normalized.constraints.budgetEur;
  if (budget !== undefined && (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0 || budget > 1000000)) {
    errors.push('constraints.budgetEur must be between 0 and 1000000');
  }

  const deadline = normalized.constraints.deadline;
  if (deadline !== undefined) {
    if (typeof deadline !== 'string' || !isValidCalendarDate(deadline)) {
      errors.push('constraints.deadline must be a valid ISO date');
    } else if (deadline < currentDate) {
      errors.push('constraints.deadline must not be in the past');
    }
  }

  if (sensitivity === 'unknown') warnings.push('data sensitivity requires clarification');
  if (normalized.currentTools.length === 0) warnings.push('current tools require clarification');

  normalized.constraints = {
    ...normalized.constraints,
    dataSensitivity: sensitivity,
    requiresHumanApproval,
  };

  return { valid: errors.length === 0, errors, warnings, normalized };
}
