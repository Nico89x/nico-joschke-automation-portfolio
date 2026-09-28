import { runN8nLocalOllamaPilot } from '../src/n8n-local-ollama-pilot.mjs';

if (!process.argv.includes('--live')) {
  console.log('No requests sent. Add --live to create one synthetic n8n request, call the local Ollama model, and persist an advisory-only agent run.');
  process.exit(0);
}
const caseId = process.argv.find((item) => item.startsWith('--case='))?.slice('--case='.length) ?? 'web-form-leads';
try {
  const result = await runN8nLocalOllamaPilot({ caseId });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`Local Ollama/n8n pilot stopped safely: ${error.message}`);
  process.exitCode = 1;
}
