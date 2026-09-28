import { readFileSync, writeFileSync, renameSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { prepareAiInput, runAiInterpretation, AI_INTERPRETATION_SCHEMA, AI_PROMPT_VERSION } from '../src/ai-interpretation-agent.mjs';
import { evaluateAiCase, summarizeAiEvaluation } from '../src/ai-interpretation-eval.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cases = JSON.parse(readFileSync(resolve(root, 'evals/ai-interpretation-cases.json'), 'utf8'));
const requested = process.argv.find((item) => item.startsWith('--cases='));
const caseCount = requested ? Number(requested.split('=')[1]) : 2;
if (!Number.isInteger(caseCount) || caseCount < 1 || caseCount > cases.length) throw new Error(`--cases must be 1 to ${cases.length}.`);
const selected = cases.slice(0, caseCount);
for (const fixture of selected) prepareAiInput(fixture.intake, fixture.sources);

if (!process.argv.includes('--live')) {
  console.log(JSON.stringify({ mode: 'offline-fixture-validation', validFixtures: selected.length, modelCalls: 0, modelQualityMeasured: false }, null, 2));
  process.exit(0);
}

if (process.env.AI_LIVE_CALL_APPROVED !== 'yes') throw new Error('Live calls are disabled. Explicitly set AI_LIVE_CALL_APPROVED=yes only after approving the provider and test spend.');
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL;
if (!apiKey || apiKey.startsWith('add-later') || !model) throw new Error('OPENAI_API_KEY and OPENAI_MODEL must be configured outside the repository.');
const inputRate = Number(process.env.AI_INPUT_EUR_PER_1M_TOKENS);
const outputRate = Number(process.env.AI_OUTPUT_EUR_PER_1M_TOKENS);
if (![inputRate, outputRate].every((rate) => Number.isFinite(rate) && rate > 0)) throw new Error('Enter verified positive model prices in EUR per million input/output tokens.');
const monthlyLimit = Number(process.env.AI_MONTHLY_BUDGET_EUR ?? 10);
const runLimit = Number(process.env.AI_TEST_CAP_EUR ?? 2);
if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0 || monthlyLimit > 10 || !Number.isFinite(runLimit) || runLimit <= 0 || runLimit > 2) throw new Error('Budget limits must be positive, at most 10 EUR/month and 2 EUR/run.');

// Conservative reservation: four token equivalents per UTF-8 byte plus 2,000 tokens
// of request overhead, twice the configured price. This is a guard, not a billing guarantee.
const reservationEur = selected.reduce((sum, fixture) => {
  const prepared = prepareAiInput(fixture.intake, fixture.sources);
  const bytes = Buffer.byteLength(JSON.stringify(prepared)) + Buffer.byteLength(JSON.stringify(AI_INTERPRETATION_SCHEMA)) + 1000;
  return sum + 2 * (((4 * bytes + 2000) * inputRate + 400 * outputRate) / 1_000_000);
}, 0);
if (reservationEur > runLimit) throw new Error('The conservative estimated reservation exceeds the run cap; no call was made.');

const monthParts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
const month = `${monthParts.find((part) => part.type === 'year').value}-${monthParts.find((part) => part.type === 'month').value}`;
const ledgerPath = resolve(root, '.local-ai-usage.json');
const lockPath = resolve(root, '.local-ai-usage.lock');
let lock;
try { lock = openSync(lockPath, 'wx'); } catch { throw new Error('Another evaluation or an unresolved usage lock exists; no call was made.'); }
try {
  const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : { months: {} };
  if (!ledger || typeof ledger !== 'object' || !ledger.months || typeof ledger.months !== 'object') throw new Error('Invalid local usage ledger; no call was made.');
  const used = Number(ledger.months[month] ?? 0);
  if (!Number.isFinite(used) || used < 0 || used + reservationEur > monthlyLimit) throw new Error('Monthly budget guard blocked the test; no call was made.');
  ledger.months[month] = used + reservationEur;
  const tempPath = `${ledgerPath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, { flag: 'w' });
  renameSync(tempPath, ledgerPath);

  const rows = [];
  for (const fixture of selected) {
    const result = await runAiInterpretation({ intake: fixture.intake, sources: fixture.sources, apiKey, model });
    const row = evaluateAiCase(fixture, result);
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  const summary = summarizeAiEvaluation(rows);
  const estimatedCostEur = (summary.totalInputTokens * inputRate + summary.totalOutputTokens * outputRate) / 1_000_000;
  console.log(JSON.stringify({ mode: 'live-model-evaluation', model, promptVersion: AI_PROMPT_VERSION, ...summary, estimatedCostEur, reservedBudgetEur: reservationEur, modelQualityMeasured: true }, null, 2));
  console.log('The reserved amount remains charged in the local guard ledger, even if measured cost is lower. Verify provider billing separately.');
} finally {
  closeSync(lock);
  unlinkSync(lockPath);
}
