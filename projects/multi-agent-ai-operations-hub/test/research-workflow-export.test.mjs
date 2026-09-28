import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const workflow = JSON.parse(await readFile(new URL('../workflows/05-research-brief-api.json', import.meta.url), 'utf8'));
const worker = workflow.nodes.find((node) => node.name === 'Create bounded research brief');

async function runWorker(input) {
  const script = new vm.Script(`(async () => { ${worker.parameters.jsCode} })()`);
  const items = await script.runInNewContext({ $json: { body: input }, String, Array, Object, Set, RegExp });
  return JSON.parse(JSON.stringify(items[0].json));
}

test('research workflow stays local, bounded, and non-destructive', () => {
  assert.equal(workflow.active, false);
  assert.ok(worker);
  assert.equal(workflow.nodes.some((node) => /httpRequest|postgres|openai|langchain|gmail|slack|hubspot/i.test(node.type)), false);
  assert.match(worker.parameters.jsCode, /synthetic-tool-catalog/);
  assert.match(worker.parameters.jsCode, /contactedCompanies:false/);
  assert.match(worker.parameters.jsCode, /webRequests:0/);
  assert.match(worker.parameters.jsCode, /dataModified:false/);
  assert.equal(workflow.connections['Receive accepted intake envelope'].main[0][0].node, 'Create bounded research brief');
});

test('embedded research workflow produces a bounded completed brief', async () => {
  const result = await runWorker({
    requestId: 'req-research-live-shape', schemaVersion: '1.0', status: 'accepted',
    data: { companyName: 'Synthetic GmbH', processDescription: 'Synthetic leads arrive by email and must be copied into HubSpot and announced in Slack.', currentTools: ['HubSpot', 'Slack'], goals: ['Reduce manual entry'], constraints: { dataSensitivity: 'personal' } },
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.data.externalActions.webRequests, 0);
  assert.equal(result.data.toolFindings.length, 2);
});

test('embedded research workflow asks for clarification instead of inventing facts', async () => {
  const result = await runWorker({
    requestId: 'req-research-unknown', schemaVersion: '1.0', status: 'accepted',
    data: { companyName: 'Synthetic GmbH', processDescription: 'Synthetic process description that is long enough to be accepted but contains no integration information.', currentTools: ['Unknown CRM'], goals: ['Clarify'], constraints: { dataSensitivity: 'unknown' } },
  });
  assert.equal(result.status, 'needs-human-input');
  assert.match(result.data.unknowns.join(' '), /Unknown CRM/);
});
