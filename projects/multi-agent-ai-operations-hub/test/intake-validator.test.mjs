import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndNormalizeIntake } from '../src/intake-validator.mjs';

const validPayload = {
  companyName: 'Example GmbH',
  contactName: 'Erika Beispiel',
  contactEmail: 'ERIKA@EXAMPLE.DE',
  processDescription: 'Incoming website leads are copied manually into the CRM and frequently lose important context.',
  currentTools: ['HubSpot', 'Gmail', 'HubSpot'],
  goals: ['Reduce manual data entry', 'Prevent lost leads'],
  constraints: { dataSensitivity: 'personal' },
  idempotencyKey: 'demo-request-001'
};

test('accepts and normalizes a complete intake', () => {
  const result = validateAndNormalizeIntake(validPayload, { currentDate: '2026-09-21' });
  assert.equal(result.valid, true);
  assert.equal(result.normalized.contactEmail, 'erika@example.de');
  assert.deepEqual(result.normalized.currentTools, ['HubSpot', 'Gmail']);
  assert.equal(result.normalized.constraints.requiresHumanApproval, true);
});

test('rejects a short process description', () => {
  const result = validateAndNormalizeIntake({ ...validPayload, processDescription: 'Automate leads.' }, { currentDate: '2026-09-21' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /processDescription/);
});

test('rejects an invalid email address', () => {
  const result = validateAndNormalizeIntake({ ...validPayload, contactEmail: 'not-an-email' }, { currentDate: '2026-09-21' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /contactEmail/);
});

test('requires an idempotency key', () => {
  const result = validateAndNormalizeIntake({ ...validPayload, idempotencyKey: '' }, { currentDate: '2026-09-21' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /idempotencyKey/);
});

test('keeps human approval enabled by default', () => {
  const result = validateAndNormalizeIntake({ ...validPayload, constraints: {} }, { currentDate: '2026-09-21' });
  assert.equal(result.normalized.constraints.requiresHumanApproval, true);
  assert.equal(result.normalized.constraints.dataSensitivity, 'unknown');
});

test('rejects sensitive data when human approval is disabled', () => {
  const result = validateAndNormalizeIntake({
    ...validPayload,
    constraints: { dataSensitivity: 'special-category', requiresHumanApproval: false },
  }, { currentDate: '2026-09-21' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /contradicts/);
});

test('rejects a past deadline', () => {
  const result = validateAndNormalizeIntake({
    ...validPayload,
    constraints: { dataSensitivity: 'internal', deadline: '2026-09-20' },
  }, { currentDate: '2026-09-21' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /past/);
});

test('rejects unknown fields instead of silently ignoring them', () => {
  const result = validateAndNormalizeIntake({ ...validPayload, unexpected: true }, { currentDate: '2026-09-21' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /unknown field/);
});

test('rejects a negative budget', () => {
  const result = validateAndNormalizeIntake({
    ...validPayload,
    constraints: { dataSensitivity: 'internal', budgetEur: -1 },
  }, { currentDate: '2026-09-21' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /budgetEur/);
});

test('warns when tools and data sensitivity need clarification', () => {
  const result = validateAndNormalizeIntake({ ...validPayload, currentTools: [], constraints: {} }, { currentDate: '2026-09-21' });
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 2);
});

test('rejects wrong field types instead of silently normalizing them away', () => {
  const result = validateAndNormalizeIntake({
    ...validPayload,
    contactEmail: 123,
    currentTools: ['HubSpot', 42],
    goals: ['Reduce manual data entry', null],
    constraints: [],
  }, { currentDate: '2026-09-21' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /contactEmail must be a string/);
  assert.match(result.errors.join(' '), /currentTools must contain only strings/);
  assert.match(result.errors.join(' '), /goals must contain only strings/);
  assert.match(result.errors.join(' '), /constraints must be an object/);
});
