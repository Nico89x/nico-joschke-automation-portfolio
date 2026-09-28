import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { runLocalAiInterpretation } from '../src/local-ai-interpretation-agent.mjs';
import { AI_PROMPT_VERSION } from '../src/ai-interpretation-agent.mjs';
import { evaluateAiCase, summarizeAiEvaluation } from '../src/ai-interpretation-eval.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const selectedSuite = process.argv.find((item) => item.startsWith('--suite='))?.slice('--suite='.length) ?? 'historical';
const suiteFiles = {
  historical: 'ai-interpretation-cases.json',
  'regression-v1': 'ai-interpretation-holdout-v1.json',
  'blind-v1': 'ai-interpretation-blind-v1.json',
  'validation-v2': 'ai-interpretation-validation-v2.json',
  'validation-v3': 'ai-interpretation-validation-v3.json',
  'validation-v4': 'ai-interpretation-validation-v4.json',
};
if (!Object.hasOwn(suiteFiles, selectedSuite)) throw new Error(`Unknown --suite. Choose: ${Object.keys(suiteFiles).join(', ')}.`);
const cases = JSON.parse(readFileSync(resolve(root, `evals/${suiteFiles[selectedSuite]}`), 'utf8'));
const requested = process.argv.find((item) => item.startsWith('--cases='));
const caseCount = requested ? Number(requested.split('=')[1]) : cases.length;
if (!Number.isInteger(caseCount) || caseCount < 1 || caseCount > cases.length) throw new Error(`--cases must be 1 to ${cases.length}.`);
const model = process.argv.find((item) => item.startsWith('--model='))?.slice('--model='.length) ?? 'qwen3.5:4b';
const rows = [];
const failures = [];
for (const fixture of cases.slice(0, caseCount)) {
  try {
    const result = await runLocalAiInterpretation({ intake: fixture.intake, sources: fixture.sources, model });
    const row = evaluateAiCase(fixture, result);
    rows.push(row);
    console.log(JSON.stringify(row));
  } catch (error) {
    const failure = {
      caseId: fixture.id,
      failureKind: /no cited knowledge source/.test(error.message) ? 'missing-citation-controlled-stop' : 'other-error',
      error: error.message,
    };
    failures.push(failure);
    console.log(JSON.stringify(failure));
  }
}
console.log(JSON.stringify({
  mode: 'live-local-model-evaluation', suite: selectedSuite, model, promptVersion: AI_PROMPT_VERSION, casesAttempted: caseCount, casesSucceeded: rows.length,
  casesFailed: failures.length, successfulAdvisoryRate: rows.length / caseCount,
  missingCitationControlledStops: failures.filter((failure) => failure.failureKind === 'missing-citation-controlled-stop').length,
  ...(rows.length ? summarizeAiEvaluation(rows) : {}),
  failures, apiCostEur: 0, modelQualityMeasured: true,
}, null, 2));
if (failures.length) process.exitCode = 1;
