import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const workflowUrl = new URL('../workflows/03-rag-retrieval-api.json', import.meta.url);
const resetWorkflowUrl = new URL('../workflows/04-reset-synthetic-knowledge-base.json', import.meta.url);
const queryUrl = new URL('../database/queries/retrieve-knowledge.sql', import.meta.url);
const workflow = JSON.parse(await readFile(workflowUrl, 'utf8'));
const resetWorkflow = JSON.parse(await readFile(resetWorkflowUrl, 'utf8'));
const retrievalQuery = await readFile(queryUrl, 'utf8');
const validator = workflow.nodes.find((node) => node.name === 'Validate and embed question');
const retrieval = workflow.nodes.find((node) => node.name === 'Run read-only retrieval');

async function executeValidator(payload, executionId = 'test-retrieval-001') {
  const script = new vm.Script(`(async () => { ${validator.parameters.jsCode} })()`);
  const result = await script.runInNewContext({
    $json: { body: payload }, $execution: { id: executionId }, Set, String, Number, Math, RegExp, Array,
  });
  return JSON.parse(JSON.stringify(result[0].json));
}

test('RAG retrieval workflow is read-only and uses the canonical parameterized query', () => {
  assert.equal(workflow.active, false);
  assert.ok(validator);
  assert.ok(retrieval);
  assert.equal(retrieval.parameters.query.trim(), retrievalQuery.trim());
  assert.match(retrievalQuery, /\$1::jsonb/);
  assert.doesNotMatch(retrievalQuery, /\b(insert|update|delete|alter|drop|create)\b/i);
  assert.equal(workflow.nodes.some((node) => /openai|agent|langchain/i.test(node.type)), false);
  assert.equal(workflow.connections['Question valid?'].main[0][0].node, 'Run read-only retrieval');
  assert.equal(workflow.connections['Question valid?'].main[1][0].node, 'Reject invalid question');
});

test('embedded retrieval code validates a question and creates a 1536-dimensional local query vector', async () => {
  const result = await executeValidator({ queryText: 'How do we prevent duplicate webhook deliveries?', limit: 3 });
  assert.equal(result.valid, true);
  assert.equal(result.limit, 3);
  assert.equal(result.embeddingModel, 'local-hash-v1-baseline');
  assert.equal(result.queryEmbedding.split(',').length, 1536);
});

test('embedded retrieval code rejects underspecified or unsafe retrieval input', async () => {
  const shortQuestion = await executeValidator({ queryText: 'short', limit: 3 });
  const invalidLimit = await executeValidator({ queryText: 'How do we prevent duplicate webhook deliveries?', limit: 11 });
  assert.equal(shortQuestion.valid, false);
  assert.match(shortQuestion.errors.join(' '), /queryText/);
  assert.equal(invalidLimit.valid, false);
  assert.match(invalidLimit.errors.join(' '), /limit/);
});

test('synthetic reset workflow is manual and cannot delete non-synthetic knowledge', () => {
  const deletion = resetWorkflow.nodes.find((node) => node.name === 'Delete only synthetic knowledge chunks');
  assert.equal(resetWorkflow.active, false);
  assert.ok(deletion);
  assert.match(deletion.parameters.query, /DELETE FROM knowledge_chunks/i);
  assert.match(deletion.parameters.query, /metadata->>'synthetic' = 'true'/i);
  assert.match(deletion.parameters.query, /deleted_synthetic_chunks/i);
});
