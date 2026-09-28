import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticEndToEnd } from '../src/orchestrator.mjs';

const payload = { companyName: 'Synthetic Automation GmbH', contactName: 'Synthetic Contact', contactEmail: 'synthetic@example.test', processDescription: 'Synthetic leads arrive by email and forms, then staff manually copy the details into HubSpot and notify Slack.', currentTools: ['HubSpot', 'Slack'], goals: ['Reduce manual data entry'], constraints: { dataSensitivity: 'personal', requiresHumanApproval: true }, idempotencyKey: 'synthetic-e2e-001' };

test('end-to-end orchestration keeps execution closed when rejected', () => {
  const result = runSyntheticEndToEnd(payload, { decision: 'rejected', reviewer: 'Synthetic Reviewer' });
  assert.equal(result.status, 'completed');
  assert.equal(result.executionGate, false);
  assert.equal(result.stages.riskReview.data.execution.allowed, false);
  assert.equal(result.stages.demoExecution.status, 'blocked');
});

test('end-to-end orchestration opens only the explicit approved gate', () => {
  const result = runSyntheticEndToEnd(payload, { decision: 'approved', reviewer: 'Synthetic Reviewer' });
  assert.equal(result.executionGate, true);
  assert.equal(result.stages.humanApproval.data.executionGate.open, true);
  assert.equal(result.stages.demoExecution.status, 'prepared');
});

test('end-to-end orchestration stops immediately at invalid intake', () => {
  const result = runSyntheticEndToEnd({ ...payload, processDescription: 'too short' });
  assert.equal(result.status, 'rejected');
  assert.deepEqual(Object.keys(result.stages), ['intake']);
});

test('approval cannot open the gate when research leaves open questions', () => {
  const result = runSyntheticEndToEnd({
    ...payload,
    currentTools: ['Unknown CRM'],
    constraints: { dataSensitivity: 'unknown', requiresHumanApproval: true },
    idempotencyKey: 'synthetic-e2e-open-questions',
  }, { decision: 'approved', reviewer: 'Synthetic Reviewer' });
  assert.equal(result.stages.blueprint.status, 'needs-human-input');
  assert.equal(result.executionGate, false);
  assert.notEqual(result.stages.demoExecution.status, 'prepared');
});

test('deadline validation uses the supplied runtime date instead of a frozen date', () => {
  const result = runSyntheticEndToEnd({
    ...payload,
    constraints: { ...payload.constraints, deadline: '2026-09-27' },
    idempotencyKey: 'synthetic-e2e-stale-deadline',
  }, undefined, { currentDate: '2026-09-28' });
  assert.equal(result.status, 'rejected');
  assert.match(result.stages.intake.errors.join(' '), /past/);
});
