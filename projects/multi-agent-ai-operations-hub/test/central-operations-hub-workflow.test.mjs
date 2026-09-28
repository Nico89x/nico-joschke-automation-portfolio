import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const workflow = JSON.parse(readFileSync(new URL('../workflows/07-central-operations-hub.json', import.meta.url), 'utf8'));
const byName = new Map(workflow.nodes.map((node) => [node.name, node]));

test('central operations workflow export is valid and every connection resolves', () => {
  assert.equal(workflow.name, '07 - Multi-Agent AI Operations Hub');
  for (const [source, outputs] of Object.entries(workflow.connections)) {
    assert.ok(byName.has(source), `missing source node ${source}`);
    for (const branch of outputs.main) {
      for (const edge of branch) assert.ok(byName.has(edge.node), `missing target node ${edge.node}`);
    }
  }
  assert.ok(byName.has('Retrieve internal knowledge'));
  assert.ok(byName.has('Run research, architect, risk and estimate agents'));
  assert.ok(byName.has('Persist blueprint and stage audit'));
  assert.ok(byName.has('Return existing request status'));
  assert.ok(byName.has('Audit rejected operations request'));
  assert.match(byName.get('Persist blueprint and stage audit').parameters.query, /jsonb_each\(result->'stages'\)/);
  assert.match(byName.get('Persist blueprint and stage audit').parameters.query, /agent-stage-completed/);
  assert.match(byName.get('Persist blueprint and stage audit').parameters.query, /UPDATE project_requests/);
  assert.equal(byName.get('Retrieve internal knowledge').alwaysOutputData, true);
  assert.match(byName.get('Retrieve internal knowledge').parameters.query, /retrieval_score >= 0\.05/);
});

test('central intake code accepts a complete synthetic request and requires review', () => {
  const code = byName.get('Validate and normalize request').parameters.jsCode;
  const run = new Function('$json', '$execution', code);
  const [result] = run({ body: {
    companyName: 'Synthetic Automation GmbH',
    contactName: 'Synthetic Contact',
    contactEmail: 'synthetic@example.test',
    processDescription: 'Synthetic leads arrive from a web form and staff manually enter them into HubSpot.',
    currentTools: ['HubSpot', 'Slack'],
    goals: ['Reduce manual entry'],
    constraints: { dataSensitivity: 'personal' },
    idempotencyKey: 'synthetic-hub-001',
  } }, { id: 'test-run-1' });
  assert.equal(result.json.valid, true);
  assert.equal(result.json.normalized.constraints.requiresHumanApproval, true);
  assert.equal(result.json.normalized.contactEmail, 'synthetic@example.test');
});

test('central intake code rejects invalid data before persistence', () => {
  const code = byName.get('Validate and normalize request').parameters.jsCode;
  const run = new Function('$json', '$execution', code);
  const [result] = run({ body: { companyName: 'X', processDescription: 'short', goals: [], idempotencyKey: 'x' } }, { id: 'test-run-2' });
  assert.equal(result.json.valid, false);
  assert.ok(result.json.errors.length >= 3);
  assert.equal(workflow.connections['Request valid?'].main[1][0].node, 'Audit rejected operations request');
  assert.equal(workflow.connections['Audit rejected operations request'].main[0][0].node, 'Reject invalid request');
});

test('central intake rejects past deadlines and wrong types', () => {
  const code = byName.get('Validate and normalize request').parameters.jsCode;
  const run = new Function('$json', '$execution', '$vars', code);
  const [result] = run({ body: {
    companyName: 'Synthetic GmbH',
    contactEmail: 123,
    processDescription: 'Synthetic leads arrive through a web form and need structured routing into the internal CRM.',
    currentTools: ['HubSpot'],
    goals: ['Reduce manual work'],
    constraints: { deadline: '2026-09-27', dataSensitivity: 'internal' },
    idempotencyKey: 'synthetic-deadline-001',
  } }, { id: 'test-run-3' }, { TEST_CURRENT_DATE: '2026-09-28' });
  assert.equal(result.json.valid, false);
  assert.match(result.json.errors.join(' '), /contactEmail must be a string/);
  assert.match(result.json.errors.join(' '), /past/);
});

test('central workflow never wires duplicate requests into the planning path', () => {
  const branches = workflow.connections['New request?'].main;
  assert.equal(branches[0][0].node, 'Prepare bounded research and RAG query');
  assert.equal(branches[1][0].node, 'Return existing request status');
});
