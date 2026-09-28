import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runLocalAiInterpretation } from './local-ai-interpretation-agent.mjs';
import { buildCitationReview } from './citation-review.mjs';
import { prepareAiInput } from './ai-interpretation-agent.mjs';

const N8N_BASE = 'http://127.0.0.1:5680';
const fixtures = JSON.parse(readFileSync(new URL('../evals/ai-interpretation-cases.json', import.meta.url), 'utf8'));
const directContactPattern = /[^\s@]+@[^\s@]+\.[^\s@]+|\+?\d[\d\s().-]{7,}\d/;

async function requestJson(fetchImpl, path, payload, expectedStatus) {
  const response = await fetchImpl(`${N8N_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(90000),
  });
  if (response.status !== expectedStatus) throw new Error(`n8n ${path} returned HTTP ${response.status}, expected ${expectedStatus}.`);
  try { return await response.json(); } catch { throw new Error(`n8n ${path} returned invalid JSON.`); }
}

export async function runN8nLocalOllamaPilot({ caseId = 'web-form-leads', fetchImpl = globalThis.fetch, modelRunner = runLocalAiInterpretation } = {}) {
  const fixture = fixtures.find((item) => item.id === caseId);
  if (!fixture) throw new Error('Unknown synthetic evaluation case.');

  const health = await fetchImpl(`${N8N_BASE}/healthz`, { signal: AbortSignal.timeout(5000) });
  if (health.status !== 200) throw new Error('The local n8n stack is not healthy.');
  const receiptPreflight = await requestJson(fetchImpl, '/webhook/local-ollama-interpretation-receipt', {}, 422);
  if (receiptPreflight.ok !== false || receiptPreflight.status !== 'rejected') {
    throw new Error('The local receipt webhook did not reject an invalid preflight as expected.');
  }

  const intake = {
    companyName: 'Synthetic Local Ollama Pilot GmbH',
    processDescription: fixture.intake.processDescription,
    currentTools: fixture.intake.currentTools,
    goals: fixture.intake.goals,
    constraints: { ...fixture.intake.constraints, requiresHumanApproval: true },
    idempotencyKey: `ollama-pilot-${randomUUID()}`,
  };
  const plan = await requestJson(fetchImpl, '/webhook/operations-hub', intake, 202);
  if (!plan.ok || !plan.created || !plan.requestDbId || plan.executionGate !== false) throw new Error('The n8n planning response is not a new, review-gated request.');
  const sources = plan.stages?.rag?.sources;
  if (!Array.isArray(sources) || sources.length === 0) throw new Error('n8n returned no approved local knowledge sources; no model call was made.');

  const result = await modelRunner({ intake: fixture.intake, sources });
  if (result.executionGate !== false || !result.externalActions ||
      result.externalActions.crmWrites !== 0 || result.externalActions.tasksCreated !== 0 || result.externalActions.messagesSent !== 0) {
    throw new Error('Model result attempted to open execution or report external actions.');
  }
  if (directContactPattern.test(JSON.stringify(result.data))) throw new Error('Model advisory output contains direct contact data; receipt was not sent.');
  const citationReview = buildCitationReview(result.data, prepareAiInput(fixture.intake, sources).sources);

  const receipt = {
    runId: randomUUID(), requestDbId: plan.requestDbId, model: result.model,
    promptVersion: result.promptVersion, durationMs: result.durationMs,
    usage: result.usage, data: result.data,
  };
  const persisted = await requestJson(fetchImpl, '/webhook/local-ollama-interpretation-receipt', receipt, 201);
  if (!persisted.ok || persisted.runId !== receipt.runId || persisted.auditEventsWritten !== 1 || persisted.executionGate !== false) {
    throw new Error('n8n did not confirm one safe local-agent audit event.');
  }
  return {
    caseId, requestDbId: plan.requestDbId, runId: receipt.runId,
    model: result.model, promptVersion: result.promptVersion,
    durationMs: result.durationMs, usage: result.usage,
    citationReview,
    n8nStatus: persisted.status, auditEventsWritten: 1,
    executionGate: false, externalActions: { crmWrites: 0, tasksCreated: 0, messagesSent: 0 },
  };
}
