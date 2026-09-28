import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const workflow = JSON.parse(await readFile(new URL('../workflows/06-audit-event-api.json', import.meta.url), 'utf8'));
const validator = workflow.nodes.find((node) => node.name === 'Validate and minimise audit event');

async function runValidator(payload) {
  const script = new vm.Script(`(async () => { ${validator.parameters.jsCode} })()`);
  const result = await script.runInNewContext({ $json: { body: payload }, String, Object, Array, Number, RegExp });
  return JSON.parse(JSON.stringify(result[0].json));
}

test('audit workflow validates and persists only sanitised events', () => {
  const persist = workflow.nodes.find((node) => node.name === 'Persist audit event');
  assert.equal(workflow.active, false);
  assert.ok(persist);
  assert.match(persist.parameters.query, /INSERT INTO audit_events/i);
  assert.match(persist.parameters.query, /\$1::jsonb/);
  assert.doesNotMatch(persist.parameters.query, /\b(delete|update|drop|alter)\b/i);
});

test('audit workflow rejects contact details and keeps accepted events minimal', async () => {
  const accepted = await runValidator({ eventType: 'agent-stage-completed', actor: 'Research Agent', details: { stage: 'research', status: 'completed' } });
  const rejected = await runValidator({ eventType: 'agent-stage-completed', actor: 'Research Agent', details: { contactEmail: 'synthetic@example.test' } });
  assert.equal(accepted.valid, true);
  assert.equal(JSON.stringify(accepted).includes('contactEmail'), false);
  assert.equal(rejected.valid, false);
});
