import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const [workflow] = JSON.parse(await readFile(new URL('../lead-intake-system.sanitized.json', import.meta.url), 'utf8'));
const code = workflow.nodes.find(node => node.name === 'Duplikat + CRM-Payload').parameters.jsCode;
const lead = {
  leadId: 'NEW-LEAD-ID',
  name: 'Testkontakt',
  email: 'portfolio-crm@example.com',
  createdAt: '2026-11-23',
  receivedAt: '2026-11-23',
  message: 'Aktualisierte Anfrage',
};
const existing = {
  id: 'existing-page',
  properties: { 'Lead ID': { rich_text: [{ plain_text: 'EXISTING-LEAD-ID' }] } },
};

function prepare(response) {
  const [entry] = runInNewContext(`(function () { ${code} })()`, {
    $json: response,
    $: () => ({ item: { json: lead } }),
  });
  return entry.json;
}

test('Lead Intake updates the same Notion page without resetting lifecycle fields', () => {
  const result = prepare({ results: [existing] });
  assert.equal(result.storageReady, true);
  assert.equal(result.duplicatePageId, existing.id);
  assert.equal(result.leadId, 'EXISTING-LEAD-ID');
  const properties = result.notionUpdateBody.properties;
  assert.equal(properties.Nachricht.rich_text[0].text.content, lead.message);
  for (const field of ['Lead ID', 'Erstellungsdatum', 'Lead-Quelle', 'Status', 'Nächster Schritt', 'Follow-up Datum', 'Angebot erstellt', 'Angebot versendet', 'Kunde']) {
    assert.equal(Object.hasOwn(properties, field), false, field);
  }
});

test('Lead Intake initializes a new record and backfills a missing legacy lead ID', () => {
  const created = prepare({ results: [] });
  assert.equal(created.duplicate, false);
  assert.equal(created.notionCreateBody.properties['Lead ID'].rich_text[0].text.content, lead.leadId);
  assert.equal(created.notionCreateBody.properties.Status.select.name, 'Neu');
  assert.equal(created.notionCreateBody.properties['Angebot erstellt'].checkbox, false);
  const legacy = prepare({ results: [{ id: existing.id }] });
  assert.equal(legacy.duplicatePageId, existing.id);
  assert.equal(legacy.notionUpdateBody.properties['Lead ID'].rich_text[0].text.content, lead.leadId);
});

test('Lead Intake stops on unavailable, missing or ambiguous lookup results', () => {
  for (const response of [
    { error: true, statusCode: 503 },
    {},
    { results: [{}] },
    { results: [existing, { id: 'second-page' }] },
  ]) {
    const result = prepare(response);
    assert.equal(result.storageReady, false);
    assert.equal(Object.hasOwn(result, 'notionCreateBody'), false);
    assert.equal(Object.hasOwn(result, 'notionUpdateBody'), false);
  }
});
