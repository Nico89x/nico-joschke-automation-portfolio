import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareAiInput, AI_INTERPRETATION_SCHEMA } from '../src/ai-interpretation-agent.mjs';

const cases = JSON.parse(readFileSync(new URL('../evals/ai-interpretation-cases.json', import.meta.url), 'utf8'));

test('AI evaluation set contains six distinct synthetic cases', () => {
  assert.equal(cases.length, 6);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
});

for (const fixture of cases) {
  test(`AI input fixture is valid and bounded: ${fixture.id}`, () => {
    const prepared = prepareAiInput(fixture.intake, fixture.sources);
    assert.ok(AI_INTERPRETATION_SCHEMA.properties.triggerType.enum.includes(fixture.expectedTrigger));
    assert.equal(typeof fixture.expectMissingInformation, 'boolean');
    assert.ok(prepared.sources.length >= 1);
    assert.ok(JSON.stringify(prepared).length < 6000);
    assert.equal(JSON.stringify(prepared).includes('@'), false);
  });
}
