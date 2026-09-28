import test from 'node:test';
import assert from 'node:assert/strict';
import { runLocalAiInterpretation } from '../src/local-ai-interpretation-agent.mjs';

const intake = {
  companyName: 'Synthetic Example GmbH', contactEmail: 'synthetic@example.test',
  processDescription: 'Synthetic website leads arrive via form and are copied manually into the demo CRM.',
  currentTools: ['n8n'], goals: ['Avoid duplicate leads'], constraints: { dataSensitivity: 'personal' },
};
const sources = [{ sourceId: 'webhook-idempotency', content: 'Use an idempotency key before CRM writes.' }];
const answer = {
  problemSummary: 'Form leads are copied manually.', triggerType: 'webhook',
  missingInformation: ['Confirm CRM API access.'], relevantSourceIds: ['webhook-idempotency'],
  recommendation: 'Prepare a deduplicated proposal for human review.',
};
const responseBody = (data = answer) => ({
  model: 'qwen3.5:4b', done: true, done_reason: 'stop', message: { content: JSON.stringify(data) },
  prompt_eval_count: 115, eval_count: 55,
});

test('local request uses only loopback, strict schema and redacted synthetic input', async () => {
  let sent;
  const result = await runLocalAiInterpretation({ intake, sources, fetchImpl: async (url, options) => {
    sent = { url, options };
    return Response.json(responseBody());
  } });
  assert.equal(sent.url, 'http://127.0.0.1:11434/api/chat');
  const request = JSON.parse(sent.options.body);
  assert.equal(request.model, 'qwen3.5:4b');
  assert.equal(request.stream, false);
  assert.equal(request.think, false);
  assert.equal(request.format.additionalProperties, false);
  assert.equal(JSON.stringify(request).includes('synthetic@example.test'), false);
  assert.deepEqual(result.data, answer);
  assert.deepEqual(result.usage, { inputTokens: 115, outputTokens: 55 });
  assert.equal(result.citationReview.status, 'source-ids-verified');
  assert.equal(result.citationReview.semanticSupportVerified, false);
  assert.equal(result.executionGate, false);
  assert.deepEqual(result.externalActions, { crmWrites: 0, tasksCreated: 0, messagesSent: 0 });
});

test('cloud model tag is rejected before calling the model', async () => {
  let called = false;
  await assert.rejects(runLocalAiInterpretation({ intake, sources, model: 'qwen3.5:cloud', fetchImpl: () => { called = true; } }), /cloud models are not allowed/);
  assert.equal(called, false);
});

test('unknown source ID is rejected', async () => {
  await assert.rejects(runLocalAiInterpretation({ intake, sources, fetchImpl: async () => Response.json(responseBody({ ...answer, relevantSourceIds: ['invented'] })) }), /source citation/);
});

test('uncited local-model advisory is blocked before it can be persisted', async () => {
  let calls = 0;
  await assert.rejects(runLocalAiInterpretation({ intake, sources, fetchImpl: async () => { calls++; return Response.json(responseBody({ ...answer, relevantSourceIds: [] })); } }), /no cited knowledge source/);
  assert.equal(calls, 2);
});

test('one bounded citation retry can recover a source-grounded advisory', async () => {
  const requests = [];
  const result = await runLocalAiInterpretation({ intake, sources, fetchImpl: async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json(responseBody(requests.length === 1 ? { ...answer, relevantSourceIds: [] } : answer));
  } });
  assert.equal(requests.length, 2);
  assert.match(requests[1].messages.at(-1).content, /Citation check/);
  assert.equal(result.citationRetryUsed, true);
  assert.deepEqual(result.usage, { inputTokens: 230, outputTokens: 110 });
  assert.deepEqual(result.data.relevantSourceIds, ['webhook-idempotency']);
});

test('local interpretation records a transparent rule correction for an explicit mailbox event', async () => {
  const emailIntake = { ...intake, processDescription: 'New synthetic supplier invoices arrive in a dedicated mailbox. Prepare review records, but mailbox permissions are not yet known.' };
  const result = await runLocalAiInterpretation({ intake: emailIntake, sources, fetchImpl: async () => Response.json(responseBody({ ...answer, triggerType: 'unknown' })) });
  assert.equal(result.data.triggerType, 'email');
  assert.deepEqual(result.triggerResolution, {
    modelTrigger: 'unknown', selectedTrigger: 'email', method: 'explicit-event-rule',
  });
});

test('incomplete and malformed outputs fail closed', async () => {
  await assert.rejects(runLocalAiInterpretation({ intake, sources, fetchImpl: async () => Response.json({ ...responseBody(), done_reason: 'length' }) }), /incomplete/);
  await assert.rejects(runLocalAiInterpretation({ intake, sources, fetchImpl: async () => Response.json({ ...responseBody(), message: { content: '{bad' } }) }), /not valid JSON/);
});

test('missing token usage is not reported as measured', async () => {
  await assert.rejects(runLocalAiInterpretation({ intake, sources, fetchImpl: async () => Response.json({ ...responseBody(), eval_count: undefined }) }), /token usage/);
});
