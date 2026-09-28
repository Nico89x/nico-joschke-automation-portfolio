import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('../scripts/verify-isolated-start.ps1', import.meta.url), 'utf8');

test('isolated import check uses a unique project and preserves its volumes', () => {
  assert.match(script, /hubcheck' \+ \[guid\]::NewGuid/);
  assert.match(script, /\[switch\]\$ImportWorkflow09/);
  assert.match(script, /n8n import:workflow.*--input=\/files\/workflows\/\$workflowFile/);
  assert.match(script, /n8n export:workflow --all.*--output=\$containerExportPath/);
  assert.ok(script.includes("w.id==='$workflowId'"));
  assert.match(script, /active:matches\[0\]\.active===true/);
  assert.match(script, /docker compose --project-name \$projectName stop/);
  assert.doesNotMatch(script, /docker compose.*(?:down|volume rm)|docker volume rm/);
});
