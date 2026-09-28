import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import {
  EMBEDDING_DIMENSION,
  buildKnowledgeChunks,
  cosineSimilarity,
  createDeterministicEmbedding,
  rankKnowledgeChunks,
  validateKnowledgeDocument,
  vectorLiteral,
  chunkText,
} from '../src/knowledge-ingestion.mjs';

const baseUrl = new URL('../knowledge/base/', import.meta.url);
const caseUrl = new URL('../evals/rag-cases.json', import.meta.url);
const filenames = (await readdir(baseUrl)).filter((filename) => filename.endsWith('.md')).sort();
const documents = await Promise.all(filenames.map(async (filename) => ({
  sourceId: filename.replace(/\.md$/, ''),
  sourceName: filename.replace(/\.md$/, '').replaceAll('-', ' '),
  content: await readFile(new URL(filename, baseUrl), 'utf8'),
  tags: ['synthetic', 'portfolio'],
})));
const chunks = documents.flatMap((document) => buildKnowledgeChunks(document).chunks);
const cases = JSON.parse(await readFile(caseUrl, 'utf8'));

test('knowledge documents validate and create source-preserving chunks', () => {
  assert.equal(documents.length, 5);
  assert.ok(chunks.length >= 5);
  for (const chunk of chunks) {
    assert.match(chunk.sourceId, /^[a-z0-9-]+$/);
    assert.equal(chunk.embedding.length, EMBEDDING_DIMENSION);
    assert.match(chunk.embeddingVector, /^\[-?\d/);
    assert.ok(chunk.contentHash.length === 8);
  }
});

test('knowledge validation rejects untraceable or undersized documents', () => {
  const invalid = validateKnowledgeDocument({ sourceId: 'x', sourceName: '', content: 'too short' });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 3);
});

test('deterministic baseline embeddings are normalized and repeatable', () => {
  const first = createDeterministicEmbedding('webhook idempotency protects CRM writes');
  const second = createDeterministicEmbedding('webhook idempotency protects CRM writes');
  assert.deepEqual(first, second);
  assert.ok(Math.abs(cosineSimilarity(first, first) - 1) < 0.000001);
  assert.equal(vectorLiteral(first).split(',').length, EMBEDDING_DIMENSION);
});

test('one long paragraph is split into bounded overlapping chunks', () => {
  const content = Array.from({ length: 500 }, (_, index) => `token${index}`).join(' ');
  const result = chunkText(content, { targetWords: 150, overlapWords: 25 });
  assert.ok(result.length >= 4);
  assert.ok(result.every((chunk) => chunk.split(/\s+/).length <= 175));
});

for (const entry of cases) {
  test(`retrieval baseline ranks expected source first: ${entry.id}`, () => {
    const [result] = rankKnowledgeChunks(entry.query, chunks, 1);
    assert.equal(result.sourceId, entry.expectedSourceId);
    assert.ok(result.score > 0);
  });
}
