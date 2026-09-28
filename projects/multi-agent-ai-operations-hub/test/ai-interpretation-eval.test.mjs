import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateAiCase, summarizeAiEvaluation } from '../src/ai-interpretation-eval.mjs';
import { prepareAiInput } from '../src/ai-interpretation-agent.mjs';

const fixtures = JSON.parse(readFileSync(new URL('../evals/ai-interpretation-cases.json', import.meta.url), 'utf8'));
const holdout = JSON.parse(readFileSync(new URL('../evals/ai-interpretation-holdout-v1.json', import.meta.url), 'utf8'));
const blind = JSON.parse(readFileSync(new URL('../evals/ai-interpretation-blind-v1.json', import.meta.url), 'utf8'));
const validationV2 = JSON.parse(readFileSync(new URL('../evals/ai-interpretation-validation-v2.json', import.meta.url), 'utf8'));
const validationV3 = JSON.parse(readFileSync(new URL('../evals/ai-interpretation-validation-v3.json', import.meta.url), 'utf8'));
const validationV4 = JSON.parse(readFileSync(new URL('../evals/ai-interpretation-validation-v4.json', import.meta.url), 'utf8'));

test('regression suite has 20 unique, balanced, schema-ready synthetic cases with prelabelled citations', () => {
  assert.equal(holdout.length, 20);
  assert.equal(new Set(holdout.map((fixture) => fixture.id)).size, 20);
  for (const trigger of ['webhook', 'email', 'schedule', 'manual', 'unknown']) {
    assert.equal(holdout.filter((fixture) => fixture.expectedTrigger === trigger).length, 4);
  }
  for (const fixture of holdout) {
    assert.ok(fixture.intake.processDescription.length >= 40, fixture.id);
    assert.ok(fixture.sources.length >= 2, fixture.id);
    assert.ok(fixture.expectedRelevantSourceIds.length > 0, fixture.id);
    assert.ok(fixture.expectedRelevantSourceIds.every((id) => fixture.sources.some((source) => source.sourceId === id)), fixture.id);
  }
});

test('independent blind evaluation set has 15 unique synthetic cases across all trigger classes', () => {
  assert.equal(blind.length, 15);
  assert.equal(new Set(blind.map((fixture) => fixture.id)).size, blind.length);
  const counts = Object.groupBy(blind, (fixture) => fixture.expectedTrigger);
  for (const trigger of ['webhook', 'email', 'schedule', 'manual', 'unknown']) assert.equal(counts[trigger]?.length, 3);
  for (const fixture of blind) {
    assert.doesNotThrow(() => prepareAiInput(fixture.intake, fixture.sources));
    assert.ok(fixture.expectedRelevantSourceIds.length > 0);
    assert.ok(fixture.expectedRelevantSourceIds.every((sourceId) => fixture.sources.some((source) => source.sourceId === sourceId)));
  }
});

test('new validation suite contains 15 distinct, prelabelled synthetic scenarios', () => {
  assert.equal(validationV2.length, 15);
  assert.equal(new Set(validationV2.map((fixture) => fixture.id)).size, 15);
  for (const trigger of ['webhook', 'email', 'schedule', 'manual', 'unknown']) {
    assert.equal(validationV2.filter((fixture) => fixture.expectedTrigger === trigger).length, 3);
  }
  for (const fixture of validationV2) {
    assert.doesNotThrow(() => prepareAiInput(fixture.intake, fixture.sources));
    assert.ok(fixture.expectedRelevantSourceIds.every((id) => fixture.sources.some((source) => source.sourceId === id)));
  }
});

test('current validation suite contains 15 distinct, balanced cases with valid inputs and citations', () => {
  assert.equal(validationV3.length, 15);
  assert.equal(new Set(validationV3.map((fixture) => fixture.id)).size, 15);
  for (const trigger of ['webhook', 'email', 'schedule', 'manual', 'unknown']) {
    assert.equal(validationV3.filter((fixture) => fixture.expectedTrigger === trigger).length, 3);
  }
  for (const fixture of validationV3) {
    assert.doesNotThrow(() => prepareAiInput(fixture.intake, fixture.sources));
    assert.ok(fixture.expectedRelevantSourceIds.every((id) => fixture.sources.some((source) => source.sourceId === id)));
  }
});

test('post-gate validation suite is balanced and labelled before model evaluation', () => {
  assert.equal(validationV4.length, 15);
  assert.equal(new Set(validationV4.map((fixture) => fixture.id)).size, 15);
  for (const trigger of ['webhook', 'email', 'schedule', 'manual', 'unknown']) {
    assert.equal(validationV4.filter((fixture) => fixture.expectedTrigger === trigger).length, 3);
  }
  for (const fixture of validationV4) {
    assert.doesNotThrow(() => prepareAiInput(fixture.intake, fixture.sources));
    assert.ok(fixture.expectedRelevantSourceIds.length > 0);
    assert.ok(fixture.expectedRelevantSourceIds.every((id) => fixture.sources.some((source) => source.sourceId === id)));
  }
});

test('evaluation detects a correct, grounded answer without inventing quality results', () => {
  const row = evaluateAiCase(fixtures[0], {
    data: {
      problemSummary: 'Synthetic leads are copied manually into CRM.',
      triggerType: 'webhook',
      missingInformation: ['Confirm CRM API permissions.'],
      relevantSourceIds: ['webhook-idempotency'],
      recommendation: 'Prepare a draft for human review.',
    },
    durationMs: 123,
    usage: { inputTokens: 80, outputTokens: 42 },
  });
  assert.equal(row.triggerCorrect, true);
  assert.equal(row.missingInformationDetected, true);
  assert.equal(row.citationsGrounded, true);
  assert.deepEqual(summarizeAiEvaluation([row]), {
    cases: 1, validStructuredOutputs: 1, correctTriggers: 1, correctRawModelTriggers: 1,
    explicitTriggerRulesApplied: 0, triggerCorrections: 0, groundedCitations: 1, citationRetries: 0,
    clarificationDetected: 1, clarificationCases: 1, meanMissingInformationItems: 1, medianLatencyMs: 123,
    totalInputTokens: 80, totalOutputTokens: 42,
  });
});

test('evaluation reports incorrect trigger instead of silently passing', () => {
  const row = evaluateAiCase(fixtures[1], {
    data: {
      problemSummary: 'Emails need triage.', triggerType: 'webhook', missingInformation: [],
      relevantSourceIds: [], recommendation: 'Ask a human.',
    }, durationMs: 100, usage: { inputTokens: 60, outputTokens: 30 },
  });
  assert.equal(row.triggerCorrect, false);
  assert.equal(row.missingInformationDetected, false);
  assert.equal(row.citationsGrounded, false);
});

test('regression citation scoring penalizes irrelevant but allowed sources', () => {
  const fixture = holdout[0];
  const row = evaluateAiCase(fixture, {
    data: {
      problemSummary: 'A synthetic form triggers lead intake.', triggerType: 'webhook',
      missingInformation: ['Confirm required fields.'],
      relevantSourceIds: ['webhook-idempotency', 'mailbox-triage'],
      recommendation: 'Validate the event and prepare a reviewable draft.',
    }, durationMs: 100, usage: { inputTokens: 80, outputTokens: 40 },
  });
  assert.equal(row.citationPrecision, 0.5);
  assert.equal(row.citationRecall, 1);
  assert.equal(row.citationsExact, false);
});
