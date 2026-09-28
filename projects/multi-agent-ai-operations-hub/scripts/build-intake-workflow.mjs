import { readFile } from 'node:fs/promises';

const workflowUrl = new URL('../workflows/01-intake-api.json', import.meta.url);
const registerQueryUrl = new URL('../database/queries/register-intake.sql', import.meta.url);
const rejectQueryUrl = new URL('../database/queries/log-rejected-intake.sql', import.meta.url);

const workflow = JSON.parse(await readFile(workflowUrl, 'utf8'));
const registerQuery = await readFile(registerQueryUrl, 'utf8');
const rejectQuery = await readFile(rejectQueryUrl, 'utf8');

const validator = workflow.nodes.find((node) => node.name === 'Validate and normalize');
if (!validator) throw new Error('Validate and normalize node is missing');
if (!validator.parameters.jsCode.includes('rawPayload: input')) {
  validator.parameters.jsCode = validator.parameters.jsCode.replace(
    '  normalized,\n  warnings,',
    '  normalized,\n  rawPayload: input,\n  warnings,',
  );
}

const persistNode = {
  parameters: {
    operation: 'executeQuery',
    query: registerQuery,
    options: {
      queryReplacement:
        '={{ JSON.stringify({ normalized: $json.normalized, rawPayload: $json.rawPayload, warnings: $json.warnings, workflowRequestId: $json.requestId, schemaVersion: $json.schemaVersion }) }}',
    },
  },
  id: 'ed381335-42f4-49a8-a940-57af86eaee08',
  name: 'Persist accepted intake',
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.6,
  position: [180, -100],
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 1000,
};

const rejectAuditNode = {
  parameters: {
    operation: 'executeQuery',
    query: rejectQuery,
    options: {
      queryReplacement:
        '={{ JSON.stringify({ normalized: $json.normalized, warnings: $json.warnings, errors: $json.errors, workflowRequestId: $json.requestId, schemaVersion: $json.schemaVersion }) }}',
    },
  },
  id: '0d9723df-209b-4eb3-baa7-4f6fbeeaee09',
  name: 'Audit rejected intake',
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.6,
  position: [180, 100],
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 1000,
};

for (const node of [persistNode, rejectAuditNode]) {
  const existingIndex = workflow.nodes.findIndex((candidate) => candidate.name === node.name);
  if (existingIndex === -1) workflow.nodes.push(node);
  else workflow.nodes[existingIndex] = { ...workflow.nodes[existingIndex], ...node };
}

const acceptNode = workflow.nodes.find((node) => node.name === 'Accept request');
const rejectNode = workflow.nodes.find((node) => node.name === 'Reject request');
if (!acceptNode || !rejectNode) throw new Error('Response nodes are missing');

acceptNode.position = [460, -100];
acceptNode.parameters.responseBody =
  '={{ { ok: true, requestId: $json.requestId, workflowRequestId: $json.workflowRequestId, schemaVersion: $json.schemaVersion, status: $json.status, idempotentReplay: !$json.created, auditEventsWritten: $json.auditEventsWritten, data: $json.data, warnings: $json.warnings, errors: [] } }}';
rejectNode.position = [460, 100];

workflow.connections['Request valid?'] = {
  main: [
    [{ node: 'Persist accepted intake', type: 'main', index: 0 }],
    [{ node: 'Audit rejected intake', type: 'main', index: 0 }],
  ],
};
workflow.connections['Persist accepted intake'] = {
  main: [[{ node: 'Accept request', type: 'main', index: 0 }]],
};
workflow.connections['Audit rejected intake'] = {
  main: [[{ node: 'Reject request', type: 'main', index: 0 }]],
};

workflow.active = false;
process.stdout.write(`${JSON.stringify(workflow, null, 2)}\n`);
