import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const migrationWorkflowUrl = new URL('../workflows/00-apply-knowledge-migration.json', import.meta.url);
const ingestionWorkflowUrl = new URL('../workflows/02-knowledge-ingestion-api.json', import.meta.url);
const migrationUrl = new URL('../database/init/002_knowledge_base.sql', import.meta.url);
const upsertQueryUrl = new URL('../database/queries/upsert-knowledge-chunks.sql', import.meta.url);
const migrationWorkflow = JSON.parse(await readFile(migrationWorkflowUrl, 'utf8'));
const ingestionWorkflow = JSON.parse(await readFile(ingestionWorkflowUrl, 'utf8'));
const migration = await readFile(migrationUrl, 'utf8');
const upsertQuery = await readFile(upsertQueryUrl, 'utf8');
const chunker = ingestionWorkflow.nodes.find((node) => node.name === 'Validate and chunk knowledge');
const persist = ingestionWorkflow.nodes.find((node) => node.name === 'Upsert knowledge chunks');
const compactSql = (sql) => sql.replace(/\s+/g, ' ').replace(/\s*([(),=])\s*/g, '$1').trim();

async function executeChunker(payload, executionId = 'test-knowledge-001') {
  const script = new vm.Script(`(async () => { ${chunker.parameters.jsCode} })()`);
  const result = await script.runInNewContext({ $json: { body: payload }, $execution: { id: executionId }, Set, String, Number, Math, RegExp, Array });
  return JSON.parse(JSON.stringify(result[0].json));
}

test('migration workflow applies the versioned knowledge-base schema', () => {
  const node = migrationWorkflow.nodes.find((candidate) => candidate.name === 'Apply knowledge migration');
  assert.ok(node);
  assert.equal(node.parameters.query.trim(), migration.trim());
  assert.match(migration, /search_vector TSVECTOR/i);
  assert.match(migration, /knowledge_chunks_source_chunk_idx/i);
});

test('knowledge ingestion workflow keeps AI out of deterministic ingestion', () => {
  assert.equal(ingestionWorkflow.active, false);
  assert.ok(chunker);
  assert.ok(persist);
  assert.equal(compactSql(persist.parameters.query), compactSql(upsertQuery));
  assert.match(upsertQuery, /\$1::jsonb/);
  assert.equal(ingestionWorkflow.nodes.some((node) => /openai|agent|langchain/i.test(node.type)), false);
  assert.equal(ingestionWorkflow.connections['Document valid?'].main[0][0].node, 'Upsert knowledge chunks');
});

test('embedded ingestion code accepts a synthetic document and creates vectors', async () => {
  const result = await executeChunker({
    sourceId: 'test-source', sourceName: 'Test source', tags: ['synthetic'],
    content: 'A webhook receives a synthetic automation request. The idempotency key protects the system from duplicate delivery. A reviewer approves a CRM write before an external test record is created. This paragraph contains enough detail to become a traceable test document for the local knowledge base.',
  });
  assert.equal(result.valid, true);
  assert.ok(result.chunks.length >= 1);
  assert.equal(result.chunks[0].embedding.split(',').length, 1536);
});

test('embedded ingestion code rejects an undersized document', async () => {
  const result = await executeChunker({ sourceId: 'x', sourceName: '', content: 'too short' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3);
});
