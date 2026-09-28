import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { runN8nLocalOllamaPilot } from '../src/n8n-local-ollama-pilot.mjs';

const workflow = JSON.parse(readFileSync(new URL('../workflows/09-local-ollama-interpretation-receipt.json', import.meta.url), 'utf8'));
const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
const sample = {
  runId: 'f140cc22-54bb-4e38-a65b-9d2d95e3c408', requestDbId: '1c27fd93-2408-4b1a-bb8a-bec722da371e',
  model: 'qwen3.5:4b', promptVersion: 'interpretation-v4-trigger-v1-citation-v3', durationMs: 2345,
  usage: { inputTokens: 150, outputTokens: 80 },
  data: { problemSummary: 'Leads are copied manually.', triggerType: 'webhook', missingInformation: ['Confirm CRM API.'], relevantSourceIds: ['webhook-idempotency'], recommendation: 'Prepare a reviewable deduplicated proposal.' },
};
const validate = (payload) => JSON.parse(JSON.stringify(new vm.Script(`(() => { ${byName.get('Validate local advisory result').parameters.jsCode} })()`).runInNewContext({ $json: { body: payload }, String, Object, Array, Number, RegExp, JSON, Set })[0].json));

test('receipt workflow is separate, inactive, connected and cannot execute external actions', () => {
  assert.match(workflow.id, /^[0-9a-f-]{36}$/i);
  assert.equal(workflow.active, false);
  assert.equal(workflow.name, '09 - Local Ollama Interpretation Receipt');
  assert.equal(byName.get('Receive local model interpretation').parameters.path, 'local-ollama-interpretation-receipt');
  for (const outputs of Object.values(workflow.connections)) for (const branch of outputs.main) for (const edge of branch) assert.ok(byName.has(edge.node));
  const sql = byName.get('Persist local agent run and audit').parameters.query;
  assert.match(sql, /INSERT INTO agent_runs/i);
  assert.match(sql, /INSERT INTO audit_events/i);
  assert.match(sql, /ON CONFLICT\(id\) DO NOTHING/i);
  assert.match(sql, /approval_status='pending'/i);
  assert.match(sql, /jsonb_array_elements_text.*relevantSourceIds/i);
  assert.doesNotMatch(sql, /\b(?:DELETE|DROP|ALTER|TRUNCATE)\b/i);
  assert.equal(byName.get('Confirm local advisory persistence').parameters.options.responseCode, 201);
});

test('receipt accepts a bounded advisory result and keeps execution closed', () => {
  const result = validate(sample);
  assert.equal(result.valid, true);
  assert.equal(result.executionGate, false);
  assert.equal(result.data.triggerType, 'webhook');
});

test('receipt rejects cloud tags, unexpected fields, contact data and bad token usage', () => {
  assert.equal(validate({ ...sample, model: 'qwen3.5:cloud' }).valid, false);
  assert.equal(validate({ ...sample, executionGate: true }).valid, false);
  assert.equal(validate({ ...sample, data: { ...sample.data, recommendation: 'Mail jane@example.test' } }).valid, false);
  assert.equal(validate({ ...sample, usage: { inputTokens: -1, outputTokens: 10 } }).valid, false);
  assert.equal(validate({ ...sample, data: { ...sample.data, relevantSourceIds: [] } }).valid, false);
});

test('host pilot sends synthetic intake, model result and receipt only to local n8n', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/healthz')) return new Response('', { status: 200 });
    if (url.endsWith('/webhook/operations-hub')) return Response.json({ ok: true, created: true, requestDbId: sample.requestDbId, executionGate: false, stages: { rag: { sources: [{ sourceId: 'webhook-idempotency', content: 'Validate and deduplicate before CRM writes.' }] } } }, { status: 202 });
    if (url.endsWith('/webhook/local-ollama-interpretation-receipt') && options.body === '{}') return Response.json({ ok: false, status: 'rejected', errors: ['invalid'] }, { status: 422 });
    if (url.endsWith('/webhook/local-ollama-interpretation-receipt')) return Response.json({ ok: true, runId: JSON.parse(options.body).runId, auditEventsWritten: 1, executionGate: false, status: 'local-advisory-persisted' }, { status: 201 });
    throw new Error('Unexpected endpoint.');
  };
  const result = await runN8nLocalOllamaPilot({ fetchImpl, modelRunner: async ({ sources }) => {
    assert.equal(sources[0].sourceId, 'webhook-idempotency');
    return { ...sample, executionGate: false, externalActions: { crmWrites: 0, tasksCreated: 0, messagesSent: 0 } };
  } });
  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => call.url.startsWith('http://127.0.0.1:5680/')));
  const intake = JSON.parse(calls[2].options.body);
  assert.ok(intake.companyName.startsWith('Synthetic '));
  assert.equal(intake.constraints.requiresHumanApproval, true);
  assert.equal(intake.contactEmail, undefined);
  assert.equal(result.auditEventsWritten, 1);
  assert.equal(result.executionGate, false);
  assert.equal(result.citationReview.citations[0].sourceId, 'webhook-idempotency');
});

test('host pilot does not send an uncited model result to the receipt webhook', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/healthz')) return new Response('', { status: 200 });
    if (url.endsWith('/webhook/local-ollama-interpretation-receipt')) return Response.json({ ok: false, status: 'rejected' }, { status: 422 });
    return Response.json({ ok: true, created: true, requestDbId: sample.requestDbId, executionGate: false, stages: { rag: { sources: [{ sourceId: 'webhook-idempotency', content: 'Deduplicate before CRM writes.' }] } } }, { status: 202 });
  };
  await assert.rejects(runN8nLocalOllamaPilot({ fetchImpl, modelRunner: async () => ({
    ...sample, data: { ...sample.data, relevantSourceIds: [] }, executionGate: false,
    externalActions: { crmWrites: 0, tasksCreated: 0, messagesSent: 0 },
  }) }), /no cited knowledge source/);
  assert.equal(calls.length, 3);
});

test('host pilot does not call model or receipt when n8n has no approved source', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    if (url.endsWith('/healthz')) return new Response('', { status: 200 });
    if (url.endsWith('/webhook/local-ollama-interpretation-receipt')) return Response.json({ ok: false, status: 'rejected', errors: ['invalid'] }, { status: 422 });
    return Response.json({ ok: true, created: true, requestDbId: sample.requestDbId, executionGate: false, stages: { rag: { sources: [] } } }, { status: 202 });
  };
  await assert.rejects(runN8nLocalOllamaPilot({ fetchImpl, modelRunner: async () => { throw new Error('Model must not run.'); } }), /no approved local knowledge sources/);
  assert.equal(calls, 3);
});

test('host pilot stops before creating a request when receipt webhook is absent', async () => {
  let calls = 0;
  await assert.rejects(runN8nLocalOllamaPilot({ fetchImpl: async (url) => {
    calls++;
    if (url.endsWith('/healthz')) return new Response('', { status: 200 });
    return Response.json({ code: 404 }, { status: 404 });
  }, modelRunner: async () => { throw new Error('Model must not run.'); } }), /returned HTTP 404/);
  assert.equal(calls, 2);
});
