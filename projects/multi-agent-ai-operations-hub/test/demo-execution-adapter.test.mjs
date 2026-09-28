import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDemoExecution } from '../src/demo-execution-adapter.mjs';

const blueprintFor = (requestId) => ({ requestId, status: 'completed', data: { blueprintVersion: 'local-deterministic-v1', companyScope: 'Synthetic Automation GmbH', integrations: [{ system: 'HubSpot' }], processingSteps: [{ order: 1, name: 'Validate and deduplicate' }], openQuestions: [] } });
const approvalFor = (requestId, open) => ({ requestId, status: 'completed', data: { requestId, decision: open ? 'approved' : 'rejected', approvedVersion: 'local-deterministic-v1', executionGate: { open, blockedActions: open ? [] : ['send messages'] } } });

test('demo execution stays blocked without approval', () => {
  const requestId = 'req-demo-001';
  const result = prepareDemoExecution({ requestId, blueprint: blueprintFor(requestId), humanApproval: approvalFor(requestId, false) });
  assert.equal(result.status, 'blocked');
  assert.equal(result.data.externalActions.crmWrites, 0);
});

test('approved demo execution prepares only a reversible local draft', () => {
  const requestId = 'req-demo-002';
  const result = prepareDemoExecution({ requestId, blueprint: blueprintFor(requestId), humanApproval: approvalFor(requestId, true) });
  assert.equal(result.status, 'prepared');
  assert.equal(result.data.actionsCreated[0].reversible, true);
  assert.equal(result.data.actionsCreated[0].proposal.synthetic, true);
  assert.equal(result.data.externalActions.messagesSent, 0);
  assert.match(result.data.actionsBlocked.join(' '), /CRM/);
});

test('approval cannot be replayed across request IDs', () => {
  const result = prepareDemoExecution({ requestId: 'req-demo-003', blueprint: blueprintFor('req-demo-003'), humanApproval: approvalFor('req-demo-other', true) });
  assert.equal(result.status, 'rejected');
  assert.match(result.errors.join(' '), /requestId/);
});

test('open questions block execution even when a malformed gate claims to be open', () => {
  const requestId = 'req-demo-004';
  const blueprint = blueprintFor(requestId);
  blueprint.status = 'needs-human-input';
  blueprint.data.openQuestions = ['Confirm CRM API access.'];
  const result = prepareDemoExecution({ requestId, blueprint, humanApproval: approvalFor(requestId, true) });
  assert.equal(result.status, 'rejected');
});

test('demo execution rejects missing handoffs', () => {
  assert.equal(prepareDemoExecution({ requestId: 'bad' }).status, 'rejected');
});
