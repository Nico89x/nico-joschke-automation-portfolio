import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toAgentRunRecord } from '../src/audit-persistence.mjs';

const auditSql = await readFile(new URL('../database/queries/insert-audit-event.sql', import.meta.url), 'utf8');
const runSql = await readFile(new URL('../database/queries/insert-agent-run.sql', import.meta.url), 'utf8');

test('audit persistence SQL is parameterized and writes only audit tables', () => {
  assert.match(auditSql, /INSERT INTO audit_events/i);
  assert.match(runSql, /INSERT INTO agent_runs/i);
  assert.match(auditSql, /\$1::jsonb/);
  assert.match(runSql, /\$1::jsonb/);
  assert.doesNotMatch(`${auditSql}\n${runSql}`, /\b(delete|drop|alter|update)\b/i);
});

test('agent-run persistence records only sanitised event summaries', () => {
  const record = toAgentRunRecord({ requestDbId: '00000000-0000-0000-0000-000000000001', actor: 'Research Agent', details: { stage: 'research', status: 'completed', durationMs: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 } });
  assert.equal(record.agentName, 'Research Agent');
  assert.deepEqual(record.inputSummary, { stage: 'research' });
  assert.equal(JSON.stringify(record).includes('contactEmail'), false);
});
