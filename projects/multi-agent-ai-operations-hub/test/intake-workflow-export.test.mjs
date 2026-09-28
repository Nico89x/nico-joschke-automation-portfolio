import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { validateAndNormalizeIntake } from '../src/intake-validator.mjs';

const workflowUrl = new URL('../workflows/01-intake-api.json', import.meta.url);
const casesUrl = new URL('../evals/intake-cases.json', import.meta.url);
const registerQueryUrl = new URL('../database/queries/register-intake.sql', import.meta.url);
const rejectQueryUrl = new URL('../database/queries/log-rejected-intake.sql', import.meta.url);
const workflow = JSON.parse(await readFile(workflowUrl, 'utf8'));
const cases = JSON.parse(await readFile(casesUrl, 'utf8'));
const registerQuery = await readFile(registerQueryUrl, 'utf8');
const rejectQuery = await readFile(rejectQueryUrl, 'utf8');
const codeNode = workflow.nodes.find((node) => node.name === 'Validate and normalize');
const persistNode = workflow.nodes.find((node) => node.name === 'Persist accepted intake');
const rejectAuditNode = workflow.nodes.find((node) => node.name === 'Audit rejected intake');

async function executeCodeNode(payload, executionId = 'test-001') {
  const sandbox = {
    $json: { body: payload },
    $execution: { id: executionId },
    $vars: { TEST_CURRENT_DATE: '2026-09-21' },
    Date,
    Set,
    Number,
  };
  const script = new vm.Script('(async () => { ' + codeNode.parameters.jsCode + ' })()');
  const result = await script.runInNewContext(sandbox);
  return JSON.parse(JSON.stringify(result[0].json));
}

test('workflow export has the deterministic intake and persistence paths with no AI nodes', () => {
  assert.equal(workflow.active, false);
  assert.ok(codeNode);
  assert.ok(persistNode);
  assert.ok(rejectAuditNode);
  assert.ok(workflow.nodes.some((node) => node.name === 'Receive project request'));
  assert.ok(workflow.nodes.some((node) => node.name === 'Request valid?'));
  assert.ok(workflow.nodes.some((node) => node.name === 'Accept request'));
  assert.ok(workflow.nodes.some((node) => node.name === 'Reject request'));
  assert.equal(workflow.nodes.some((node) => /agent|openai|langchain/i.test(node.type)), false);
});

test('database queries are embedded without drift and use one parameterized JSON value', () => {
  assert.equal(persistNode.parameters.query.trim(), registerQuery.trim());
  assert.equal(rejectAuditNode.parameters.query.trim(), rejectQuery.trim());
  assert.match(registerQuery, /ON CONFLICT \(idempotency_key\) DO NOTHING/i);
  assert.match(registerQuery, /intake\.duplicate/);
  assert.match(registerQuery, /INSERT INTO audit_events/i);
  assert.match(rejectQuery, /intake\.rejected/);
  assert.match(registerQuery, /\$1::jsonb/);
  assert.match(rejectQuery, /\$1::jsonb/);
  assert.doesNotMatch(registerQuery, /\{\{/);
  assert.doesNotMatch(rejectQuery, /\{\{/);
});

test('valid and invalid branches pass through PostgreSQL before responding', () => {
  assert.equal(workflow.connections['Request valid?'].main[0][0].node, 'Persist accepted intake');
  assert.equal(workflow.connections['Request valid?'].main[1][0].node, 'Audit rejected intake');
  assert.equal(workflow.connections['Persist accepted intake'].main[0][0].node, 'Accept request');
  assert.equal(workflow.connections['Audit rejected intake'].main[0][0].node, 'Reject request');
});

for (const fixture of cases.filter((entry) => ['accepted', 'rejected'].includes(entry.expected))) {
  test('embedded workflow logic: ' + fixture.id, async () => {
    const result = await executeCodeNode(fixture.input, fixture.id);
    assert.equal(result.status, fixture.expected);
    assert.equal(result.valid, fixture.expected === 'accepted');
    if (fixture.errorIncludes) assert.match(result.errors.join(' '), new RegExp(fixture.errorIncludes));
  });
}

test('embedded workflow logic stays in parity with the shared validator', async () => {
  for (const fixture of cases.filter((entry) => ['accepted', 'rejected'].includes(entry.expected))) {
    const workflowResult = await executeCodeNode(fixture.input, fixture.id);
    const moduleResult = validateAndNormalizeIntake(fixture.input, { currentDate: '2026-09-21' });
    assert.equal(workflowResult.valid, moduleResult.valid, fixture.id);
    assert.deepEqual(workflowResult.errors, moduleResult.errors, fixture.id);
    assert.deepEqual(workflowResult.warnings, moduleResult.warnings, fixture.id);
    assert.deepEqual(workflowResult.normalized, moduleResult.normalized, fixture.id);
  }
});
