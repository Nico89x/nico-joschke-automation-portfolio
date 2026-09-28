import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const helper = await readFile(new URL('../scripts/import-workflow-if-missing.ps1', import.meta.url), 'utf8');
const startup = await readFile(new URL('../scripts/start-local.ps1', import.meta.url), 'utf8');
const ragImport = await readFile(new URL('../scripts/import-rag-workflows.ps1', import.meta.url), 'utf8');
const localOllamaImport = await readFile(new URL('../scripts/import-local-ollama-workflow.ps1', import.meta.url), 'utf8');

test('workflow import helper lists existing workflows before any import', () => {
  assert.match(helper, /n8n export:workflow --all .*--output=\$containerExportPath/);
  assert.match(helper, /JSON\.parse\(fs\.readFileSync\(process\.argv\[1\]/);
  assert.match(helper, /Where-Object \{ \$_ -ceq \$WorkflowName \}/);
  assert.match(helper, /refusing to import/);
  assert.match(helper, /skipping import to avoid a duplicate or overwrite/);
  assert.match(helper, /finally \{[\s\S]*rm -f -- \$containerExportPath/);
});

test('local startup uses the guarded intake import helper', () => {
  assert.match(startup, /Import-N8nWorkflowIfMissing/);
  assert.match(startup, /01 - Deterministic Intake API/);
  assert.doesNotMatch(startup, /n8n import:workflow/);
});

test('RAG setup uses the guarded import helper for each named workflow', () => {
  assert.match(ragImport, /Import-N8nWorkflowIfMissing/);
  assert.match(ragImport, /00 - Apply Knowledge Base Migration/);
  assert.match(ragImport, /02 - Knowledge Base Ingestion API/);
  assert.doesNotMatch(ragImport, /n8n import:workflow/);
});

test('local Ollama receipt import uses the guarded helper and never activates a workflow', () => {
  assert.match(localOllamaImport, /Import-N8nWorkflowIfMissing/);
  assert.match(localOllamaImport, /09 - Local Ollama Interpretation Receipt/);
  assert.doesNotMatch(localOllamaImport, /n8n import:workflow|n8n (?:activate|publish)/i);
});
