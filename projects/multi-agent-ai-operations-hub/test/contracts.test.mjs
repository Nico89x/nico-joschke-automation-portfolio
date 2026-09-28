import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schemaFiles = [
  '../schemas/intake.schema.json',
  '../schemas/agent-envelope.schema.json',
  '../schemas/intake-result.schema.json',
];

for (const relativePath of schemaFiles) {
  test('JSON Schema parses: ' + relativePath, async () => {
    const schema = JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
  });
}

test('incoming intake requires an idempotency key', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/intake.schema.json', import.meta.url), 'utf8'));
  assert.ok(schema.required.includes('idempotencyKey'));
});
