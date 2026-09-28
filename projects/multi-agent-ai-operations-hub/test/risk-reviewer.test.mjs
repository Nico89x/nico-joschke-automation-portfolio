import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewAutomationRisk } from '../src/risk-reviewer.mjs';

const blueprint = { status: 'completed', data: { inputs: [{ sensitivity: 'personal' }], humanApproval: { required: true }, integrations: [{ system: 'HubSpot' }], errorPaths: [{ condition: 'duplicate idempotency key' }], openQuestions: [] } };

test('risk reviewer blocks execution and requires human review', () => {
  const result = reviewAutomationRisk({ requestId: 'req-risk-001', blueprint });
  assert.equal(result.status, 'completed');
  assert.equal(result.data.decision, 'requires-human-review');
  assert.equal(result.data.execution.allowed, false);
  assert.equal(result.data.risks.some((risk) => risk.id === 'personal-data'), true);
});

test('risk reviewer finds missing approval and duplicate controls', () => {
  const result = reviewAutomationRisk({ requestId: 'req-risk-002', blueprint: { status: 'completed', data: { inputs: [{ sensitivity: 'public' }], humanApproval: { required: false }, integrations: [], errorPaths: [], openQuestions: ['Confirm CRM'] } } });
  assert.equal(result.data.risks.some((risk) => risk.id === 'missing-approval-gate'), true);
  assert.equal(result.data.risks.some((risk) => risk.id === 'duplicate-records'), true);
});

test('risk reviewer rejects an absent blueprint', () => {
  const result = reviewAutomationRisk({ requestId: 'bad', blueprint: { status: 'rejected' } });
  assert.equal(result.status, 'rejected');
});
