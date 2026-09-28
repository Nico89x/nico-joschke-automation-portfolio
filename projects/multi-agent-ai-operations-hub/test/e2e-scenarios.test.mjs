import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticEndToEnd } from '../src/orchestrator.mjs';

const base = { companyName: 'Synthetic Test GmbH', contactName: 'Synthetic Contact', contactEmail: 'synthetic@example.test', processDescription: 'Synthetic leads arrive through web forms and email, then staff manually copy them into a CRM and notify the internal team.', goals: ['Reduce manual data entry'], constraints: { dataSensitivity: 'personal', requiresHumanApproval: true } };
const validTools = [['HubSpot'], ['Slack'], ['Notion'], ['n8n'], ['HubSpot', 'Slack']];
const cases = [
  ...Array.from({ length: 20 }, (_, index) => ({ id: `valid-${index + 1}`, payload: { ...base, currentTools: validTools[index % validTools.length], idempotencyKey: `e2e-valid-${String(index + 1).padStart(2, '0')}` }, expected: 'completed' })),
  ...Array.from({ length: 5 }, (_, index) => ({ id: `clarify-${index + 1}`, payload: { ...base, currentTools: [`Unknown Tool ${index + 1}`], constraints: { dataSensitivity: 'unknown', requiresHumanApproval: true }, idempotencyKey: `e2e-clarify-${index + 1}` }, expected: 'completed', blueprint: 'needs-human-input' })),
  { id: 'invalid-email', payload: { ...base, contactEmail: 'invalid', currentTools: ['HubSpot'], idempotencyKey: 'e2e-invalid-email' }, expected: 'rejected' },
  { id: 'missing-goals', payload: { ...base, goals: [], currentTools: ['HubSpot'], idempotencyKey: 'e2e-missing-goals' }, expected: 'rejected' },
  { id: 'short-description', payload: { ...base, processDescription: 'short', currentTools: ['HubSpot'], idempotencyKey: 'e2e-short-description' }, expected: 'rejected' },
  { id: 'missing-idempotency', payload: { ...base, currentTools: ['HubSpot'], idempotencyKey: '' }, expected: 'rejected' },
  { id: 'sensitive-without-approval', payload: { ...base, currentTools: ['HubSpot'], constraints: { dataSensitivity: 'personal', requiresHumanApproval: false }, idempotencyKey: 'e2e-sensitive-without-approval' }, expected: 'rejected' },
];

for (const scenario of cases) {
  test(`end-to-end scenario: ${scenario.id}`, () => {
    const result = runSyntheticEndToEnd(scenario.payload, { decision: 'rejected', reviewer: 'Synthetic Reviewer' });
    assert.equal(result.status, scenario.expected);
    assert.equal(result.executionGate, false);
    if (scenario.blueprint) assert.equal(result.stages.blueprint.status, scenario.blueprint);
    if (scenario.expected === 'rejected') assert.equal(result.auditEvents.length, 1);
    else assert.equal(result.auditEvents.length, 8);
  });
}
