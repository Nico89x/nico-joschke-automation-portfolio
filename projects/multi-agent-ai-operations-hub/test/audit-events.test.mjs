import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticEndToEnd } from '../src/orchestrator.mjs';

const payload = { companyName: 'Synthetic GmbH', contactName: 'Synthetic Contact', contactEmail: 'synthetic@example.test', processDescription: 'Synthetic leads arrive through forms and are manually copied into HubSpot before Slack receives an update.', currentTools: ['HubSpot', 'Slack'], goals: ['Reduce manual entry'], constraints: { dataSensitivity: 'personal', requiresHumanApproval: true }, idempotencyKey: 'audit-synthetic-001' };

test('orchestration emits sanitised audit events for each completed stage', () => {
  const result = runSyntheticEndToEnd(payload, { decision: 'rejected', reviewer: 'Synthetic Reviewer' });
  assert.equal(result.auditEvents.length, 8);
  assert.equal(result.auditEvents.every((event) => event.details.estimatedCostUsd === 0), true);
  assert.equal(JSON.stringify(result.auditEvents).includes('synthetic@example.test'), false);
  assert.equal(result.auditEvents.at(-1).actor, 'Local Demo Execution Adapter');
});

test('invalid intake creates one rejected audit event', () => {
  const result = runSyntheticEndToEnd({ ...payload, processDescription: 'short' });
  assert.equal(result.auditEvents.length, 1);
  assert.equal(result.auditEvents[0].details.status, 'rejected');
});
