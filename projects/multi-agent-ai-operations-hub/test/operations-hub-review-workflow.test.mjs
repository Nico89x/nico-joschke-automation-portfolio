import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = JSON.parse(readFileSync(new URL('../workflows/08-operations-hub-review-api.json', import.meta.url), 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));

test('review workflow export is valid, connected, and only changes pending records', () => {
  for (const [source, outputs] of Object.entries(workflow.connections)) {
    assert.ok(nodes.has(source));
    for (const branch of outputs.main) for (const edge of branch) assert.ok(nodes.has(edge.node));
  }
  const sql = nodes.get('Record one-time human decision').parameters.query;
  assert.match(sql, /approval_status='pending'/);
  assert.match(sql, /operations-hub\.approved/);
  assert.match(sql, /operations-hub\.rejected/);
  assert.match(sql, /UPDATE project_requests/);
  const responseCode = nodes.get('Return review outcome').parameters.options.responseCode;
  assert.match(responseCode, /status === 'not-found-or-already-reviewed' \? 409/);
});

test('review input accepts a named decision and rejects malformed or unexpected fields', () => {
  const run = new Function('$json', nodes.get('Validate reviewer decision').parameters.jsCode);
  const [valid] = run({ body: { requestDbId: '462df054-16ad-4a53-9aed-71d904eaba5d', decision: 'approved', reviewer: 'Synthetic Reviewer' } });
  assert.equal(valid.json.valid, true);
  const [invalid] = run({ body: { requestDbId: 'bad', decision: 'approved', reviewer: 'A', password: 'nope' } });
  assert.equal(invalid.json.valid, false);
  assert.ok(invalid.json.errors.length >= 3);
});

test('approval prepares only a synthetic reversible local draft and never external actions', () => {
  const run = new Function('$json', nodes.get('Prepare local-only review result').parameters.jsCode);
  const [result] = run({
    request_db_id: '462df054-16ad-4a53-9aed-71d904eaba5d',
    status: 'approved',
    reviewer: 'Synthetic Reviewer',
    audit_events_written: 1,
    solution_blueprint: { data: { companyScope: 'Synthetic Demo', integrations: [{ system: 'HubSpot' }], processingSteps: [{ order: 1, name: 'Validate' }] } },
  });
  assert.equal(result.json.status, 'approved-local-draft-prepared');
  assert.equal(result.json.localDemo.proposal.synthetic, true);
  assert.equal(result.json.executionGate, false);
  assert.deepEqual(result.json.localDemo.externalActions, { crmWrites: 0, tasksCreated: 0, messagesSent: 0 });
});

test('rejection stays blocked and repeat decisions do not create a draft', () => {
  const run = new Function('$json', nodes.get('Prepare local-only review result').parameters.jsCode);
  const [result] = run({ request_db_id: '462df054-16ad-4a53-9aed-71d904eaba5d', status: 'rejected', reviewer: 'Synthetic Reviewer' });
  assert.equal(result.json.status, 'rejected-blocked');
  assert.equal(result.json.localDemo.proposal, null);
  const [repeat] = run({ request_db_id: '462df054-16ad-4a53-9aed-71d904eaba5d', status: 'not-found-or-already-reviewed', reviewer: 'Synthetic Reviewer' });
  assert.equal(repeat.json.ok, false);
  assert.equal(repeat.json.auditEventsWritten, 0);
});
