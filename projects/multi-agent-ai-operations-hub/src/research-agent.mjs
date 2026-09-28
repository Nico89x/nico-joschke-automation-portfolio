const TOOL_CATALOG = Object.freeze({
  hubspot: { label: 'HubSpot', capabilities: ['CRM records', 'contacts', 'deals', 'webhooks'] },
  notion: { label: 'Notion', capabilities: ['databases', 'pages', 'API integration'] },
  'google sheets': { label: 'Google Sheets', capabilities: ['tabular data', 'API integration'] },
  slack: { label: 'Slack', capabilities: ['notifications', 'approval messages', 'API integration'] },
  gmail: { label: 'Gmail', capabilities: ['email drafts', 'API integration'] },
  salesforce: { label: 'Salesforce', capabilities: ['CRM records', 'contacts', 'API integration'] },
  zapier: { label: 'Zapier', capabilities: ['workflow automation', 'webhooks'] },
  'make.com': { label: 'Make.com', capabilities: ['workflow automation', 'webhooks'] },
  make: { label: 'Make.com', capabilities: ['workflow automation', 'webhooks'] },
  n8n: { label: 'n8n', capabilities: ['workflow automation', 'webhooks', 'API integration'] },
});

const clean = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const unique = (items) => [...new Set(items.filter(Boolean))];

function supportedTool(tool) {
  return TOOL_CATALOG[clean(tool).toLocaleLowerCase('en-US')] ?? null;
}

export function createResearchBrief(envelope) {
  const input = envelope && typeof envelope === 'object' && !Array.isArray(envelope) ? envelope : {};
  const data = input.data && typeof input.data === 'object' && !Array.isArray(input.data) ? input.data : {};
  const errors = [];
  const warnings = [];

  if (!/^.{5,160}$/.test(clean(input.requestId))) errors.push('requestId must contain 5 to 160 characters');
  if (input.schemaVersion !== '1.0') errors.push('schemaVersion must be 1.0');
  if (input.status !== 'accepted') errors.push('research requires an accepted intake envelope');
  if (clean(data.companyName).length < 2) errors.push('data.companyName is required');
  if (clean(data.processDescription).length < 40) errors.push('data.processDescription must contain at least 40 characters');
  if (!Array.isArray(data.goals) || data.goals.filter((goal) => clean(goal)).length === 0) errors.push('data.goals must contain at least one goal');

  if (errors.length) return {
    requestId: clean(input.requestId) || 'invalid-request', schemaVersion: '1.0', status: 'rejected', data: null, warnings, errors,
  };

  const tools = Array.isArray(data.currentTools) ? unique(data.currentTools.map(clean)) : [];
  const recognizedTools = tools.map((tool) => ({ tool, catalog: supportedTool(tool) })).filter(({ catalog }) => catalog);
  const unknownTools = tools.filter((tool) => !supportedTool(tool));
  const sensitivity = clean(data.constraints?.dataSensitivity) || 'unknown';
  const facts = [
    {
      factId: 'intake-company-name',
      statement: `The request identifies the company as ${clean(data.companyName)}.`,
      sourceType: 'validated-intake', sourceRef: 'data.companyName', confidence: 'provided',
    },
    {
      factId: 'intake-process-description',
      statement: clean(data.processDescription),
      sourceType: 'validated-intake', sourceRef: 'data.processDescription', confidence: 'provided',
    },
    ...recognizedTools.map(({ tool, catalog }) => ({
      factId: `catalog-${catalog.label.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-')}`,
      statement: `${catalog.label} is present in the validated tool list; the local catalog lists ${catalog.capabilities.join(', ')} as relevant integration capabilities.`,
      sourceType: 'synthetic-tool-catalog', sourceRef: `local-tool-catalog:${catalog.label}`, confidence: 'catalog-only', tool,
    })),
  ];
  const unknowns = [];
  if (!tools.length) unknowns.push('Current tools are not specified; no integration assumptions may be made.');
  if (unknownTools.length) unknowns.push(`The local catalog does not cover: ${unknownTools.join(', ')}.`);
  if (sensitivity === 'unknown') unknowns.push('Data sensitivity must be clarified before architecture or execution design.');
  if (!clean(data.processDescription).match(/api|webhook|email|form|crm|lead|ticket|invoice/i)) unknowns.push('The trigger and source system are not yet explicit.');
  if (unknowns.length) warnings.push('This brief contains explicit unknowns; no external company research was performed.');
  if (Object.prototype.hasOwnProperty.call(data, 'contactEmail') || Object.prototype.hasOwnProperty.call(data, 'contactName')) warnings.push('Contact details were deliberately excluded under data-minimization rules.');

  return {
    requestId: clean(input.requestId),
    schemaVersion: '1.0',
    status: unknowns.length ? 'needs-human-input' : 'completed',
    data: {
      researchMode: 'local-synthetic-tool-catalog-v1',
      companyScope: clean(data.companyName),
      facts,
      toolFindings: recognizedTools.map(({ tool, catalog }) => ({ inputTool: tool, catalogTool: catalog.label, capabilities: catalog.capabilities })),
      goals: unique(data.goals.map(clean)),
      unknowns,
      externalActions: { contactedCompanies: false, webRequests: 0, dataModified: false },
    },
    warnings,
    errors: [],
  };
}
