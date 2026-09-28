import test from 'node:test';
import assert from 'node:assert/strict';
import { recordHumanApproval } from '../src/human-approval.mjs';

const context = { requestId: 'req-approval-001', riskReview: { status: 'completed', data: { risks: [{ id: 'personal-data', severity: 'high' }] } }, estimate: { status: 'completed', data: { uncertainty: 'low' } } };

test('approval opens the gate only after an explicit reviewer decision for a named blueprint version', () => {
  const result = recordHumanApproval({ ...context, decision: 'approved', reviewer: 'Synthetic Reviewer', approvedVersion: 'local-deterministic-v1' });
  assert.equal(result.status, 'completed');
  assert.equal(result.data.executionGate.open, true);
  assert.equal(result.data.retainedRisks[0].id, 'personal-data');
});

test('approval records the decision but keeps the gate closed while questions remain', () => {
  const result = recordHumanApproval({
    ...context,
    estimate: { status: 'needs-human-input', data: { uncertainty: 'medium' } },
    decision: 'approved',
    reviewer: 'Synthetic Reviewer',
    approvedVersion: 'local-deterministic-v1',
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.data.decision, 'approved');
  assert.equal(result.data.executionGate.open, false);
});

test('malformed risk handoff is rejected instead of throwing', () => {
  const result = recordHumanApproval({ ...context, riskReview: { status: 'completed', data: {} }, decision: 'rejected', reviewer: 'Synthetic Reviewer' });
  assert.equal(result.status, 'rejected');
  assert.match(result.errors.join(' '), /risks/);
});

test('rejection keeps all external actions blocked', () => {
  const result = recordHumanApproval({ ...context, decision: 'rejected', reviewer: 'Synthetic Reviewer' });
  assert.equal(result.data.executionGate.open, false);
  assert.match(result.data.executionGate.blockedActions.join(' '), /CRM/);
});

test('approval requires a valid decision and reviewer', () => {
  const result = recordHumanApproval({ ...context, decision: 'maybe', reviewer: '' });
  assert.equal(result.status, 'rejected');
});
