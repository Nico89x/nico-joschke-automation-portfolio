import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateAutomationWork } from '../src/estimation-agent.mjs';

const input = { requestId: 'req-estimate-001', blueprint: { status: 'completed', data: { integrations: [{ system: 'HubSpot' }, { system: 'Slack' }], openQuestions: [] } }, riskReview: { status: 'completed', data: { risks: [{ severity: 'high' }] } } };

test('estimation agent uses documented deterministic effort rules', () => {
  const result = estimateAutomationWork(input);
  assert.equal(result.status, 'completed');
  assert.equal(result.data.effortHours.expected, 24);
  assert.equal(result.data.recurringCostsEurPerMonth.localDevelopment.upper, 0);
  assert.equal(result.data.externalPricesVerified, false);
});

test('estimation agent marks open questions as uncertain', () => {
  const result = estimateAutomationWork({ ...input, blueprint: { status: 'needs-human-input', data: { integrations: [], openQuestions: ['Confirm CRM'] } } });
  assert.equal(result.status, 'needs-human-input');
  assert.equal(result.data.uncertainty, 'medium');
});

test('estimation agent rejects missing inputs', () => {
  assert.equal(estimateAutomationWork({ requestId: 'bad' }).status, 'rejected');
});
