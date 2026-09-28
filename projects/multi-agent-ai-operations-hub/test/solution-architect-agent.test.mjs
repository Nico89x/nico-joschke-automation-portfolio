import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationBlueprint } from '../src/solution-architect-agent.mjs';

const input = {
  requestId: 'req-blueprint-001',
  intake: { status: 'accepted', data: { companyName: 'Synthetic Automation GmbH', processDescription: 'Synthetic leads arrive by email and forms and are copied into a CRM.', currentTools: ['HubSpot', 'Slack'], goals: ['Reduce manual entry'], constraints: { dataSensitivity: 'personal', requiresHumanApproval: true } } },
  research: { status: 'completed', data: { unknowns: [] } },
  rag: { sources: [{ sourceId: 'webhook-idempotency' }, { sourceId: 'crm-human-approval' }] },
};

test('solution architect creates a non-executable, source-grounded blueprint', () => {
  const result = createAutomationBlueprint(input);
  assert.equal(result.status, 'completed');
  assert.equal(result.data.humanApproval.required, true);
  assert.equal(result.data.externalActions.executed, false);
  assert.equal(result.data.evidence.length, 2);
  assert.match(result.data.errorPaths.map((path) => path.condition).join(' '), /duplicate idempotency/);
});

test('solution architect carries unknowns forward instead of guessing', () => {
  const result = createAutomationBlueprint({ ...input, research: { status: 'needs-human-input', data: { unknowns: ['The local catalog does not cover: Unknown CRM.'] } } });
  assert.equal(result.status, 'needs-human-input');
  assert.match(result.data.openQuestions.join(' '), /Unknown CRM/);
});

test('solution architect rejects incomplete handoffs', () => {
  const result = createAutomationBlueprint({ requestId: 'bad', intake: { status: 'rejected' }, research: { status: 'failed' }, rag: { sources: [] } });
  assert.equal(result.status, 'rejected');
  assert.equal(result.data, null);
});

test('solution architect rejects empty RAG source objects', () => {
  const result = createAutomationBlueprint({ ...input, rag: { sources: [{}] } });
  assert.equal(result.status, 'rejected');
  assert.match(result.errors.join(' '), /sourceId/);
});
