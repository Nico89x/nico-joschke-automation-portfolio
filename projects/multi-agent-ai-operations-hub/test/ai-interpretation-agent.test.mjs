import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_INTERPRETATION_SCHEMA, prepareAiInput, runAiInterpretation, validateAiInterpretation } from '../src/ai-interpretation-agent.mjs';

const intake = {
  companyName: 'Synthetic Example GmbH',
  contactName: 'Synthetic Contact',
  contactEmail: 'synthetic@example.test',
  processDescription: 'Synthetic leads arrive from a web form and staff manually copy each lead into a CRM.',
  currentTools: ['HubSpot', 'n8n'],
  goals: ['Avoid duplicate leads'],
  constraints: { dataSensitivity: 'personal' },
};
const sources = [{ sourceId: 'webhook-idempotency', content: 'Validate webhook payloads and use idempotency keys before writing CRM records.' }];
const answer = {
  problemSummary: 'Form leads are copied manually into a CRM.',
  triggerType: 'webhook',
  missingInformation: ['Confirm CRM API permissions.'],
  relevantSourceIds: ['webhook-idempotency'],
  recommendation: 'Prepare a validated, deduplicated proposal for human review.',
};
const resultBody = (value = answer) => ({ status: 'completed', model: 'mock-model', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage: { input_tokens: 110, output_tokens: 70 } });
const config = (fetchImpl) => ({ intake, sources, apiKey: 'synthetic-test-key', model: 'mock-model', fetchImpl });

test('structured schema is strict and does not expose an execution decision', () => {
  assert.equal(AI_INTERPRETATION_SCHEMA.additionalProperties, false);
  assert.deepEqual(AI_INTERPRETATION_SCHEMA.required.sort(), ['problemSummary', 'triggerType', 'missingInformation', 'relevantSourceIds', 'recommendation'].sort());
  assert.equal(Object.hasOwn(AI_INTERPRETATION_SCHEMA.properties, 'executionGate'), false);
});

test('model input omits explicit contact and company fields', () => {
  const prepared = prepareAiInput(intake, sources);
  assert.equal(JSON.stringify(prepared).includes('synthetic@example.test'), false);
  assert.equal(JSON.stringify(prepared).includes('Synthetic Contact'), false);
  assert.equal(JSON.stringify(prepared).includes('Synthetic Example GmbH'), false);
  assert.equal(prepared.sources[0].sourceId, 'webhook-idempotency');
});

test('contact details hidden inside free text are rejected before transmission', () => {
  assert.throws(() => prepareAiInput({ ...intake, processDescription: `${intake.processDescription} Mail jane@example.test for details.` }, sources), /Direct contact details/);
});

test('valid model response is structured, source-grounded and advisory', async () => {
  let sent;
  const fetchImpl = async (url, options) => {
    sent = { url, options };
    return Response.json(resultBody());
  };
  const result = await runAiInterpretation(config(fetchImpl));
  assert.equal(sent.url, 'https://api.openai.com/v1/responses');
  assert.equal(sent.options.method, 'POST');
  const payload = JSON.parse(sent.options.body);
  assert.equal(payload.store, false);
  assert.equal(payload.text.format.strict, true);
  assert.equal(payload.max_output_tokens, 400);
  assert.equal(JSON.stringify(payload).includes('synthetic@example.test'), false);
  assert.deepEqual(result.data, answer);
  assert.deepEqual(result.usage, { inputTokens: 110, outputTokens: 70 });
  assert.equal(result.executionGate, false);
  assert.deepEqual(result.externalActions, { crmWrites: 0, tasksCreated: 0, messagesSent: 0 });
});

test('missing key fails before any network call', async () => {
  let called = false;
  await assert.rejects(runAiInterpretation({ ...config(() => { called = true; }), apiKey: '' }), /key is required/);
  assert.equal(called, false);
});

test('arbitrary endpoint is rejected before any network call', async () => {
  let called = false;
  await assert.rejects(runAiInterpretation({ ...config(() => { called = true; }), endpoint: 'https://example.test/v1/responses' }), /official OpenAI/);
  assert.equal(called, false);
});

test('invented source citation is rejected', async () => {
  const fetchImpl = async () => Response.json(resultBody({ ...answer, relevantSourceIds: ['invented-source'] }));
  await assert.rejects(runAiInterpretation(config(fetchImpl)), /source citation/);
});

test('unexpected output fields are rejected', () => {
  assert.throws(() => validateAiInterpretation({ ...answer, executionGate: true }, new Set(['webhook-idempotency'])), /unexpected fields/);
});

test('refusal and incomplete output fail closed', async () => {
  await assert.rejects(runAiInterpretation(config(async () => Response.json({ status: 'incomplete', output: [] }))), /refused or incomplete/);
  await assert.rejects(runAiInterpretation(config(async () => Response.json({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }))), /refused/);
});

test('HTTP rate limit is reported without response body or key', async () => {
  await assert.rejects(runAiInterpretation(config(async () => new Response('secret diagnostic', { status: 429 }))), (error) => error.message === 'Model service returned HTTP 429.');
});

test('malformed model JSON is rejected', async () => {
  const fetchImpl = async () => Response.json({ ...resultBody(), output: [{ content: [{ type: 'output_text', text: '{bad' }] }] });
  await assert.rejects(runAiInterpretation(config(fetchImpl)), /not valid JSON/);
});

test('missing token usage is rejected rather than claiming a measured cost', async () => {
  const fetchImpl = async () => Response.json({ ...resultBody(), usage: null });
  await assert.rejects(runAiInterpretation(config(fetchImpl)), /usage metadata/);
});

test('timeout fails closed without an automatic paid retry', async () => {
  let calls = 0;
  const fetchImpl = async (_url, { signal }) => {
    calls++;
    return await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  };
  await assert.rejects(runAiInterpretation({ ...config(fetchImpl), timeoutMs: 1000 }), /timed out/);
  assert.equal(calls, 1);
});
