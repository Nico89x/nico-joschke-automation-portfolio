import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createResearchBrief } from '../src/research-agent.mjs';

const schema = JSON.parse(await readFile(new URL('../schemas/research-brief.schema.json', import.meta.url), 'utf8'));
const validEnvelope = {
  requestId: 'req-research-001', schemaVersion: '1.0', status: 'accepted',
  data: {
    companyName: 'Example Automation GmbH', contactName: 'Synthetic Contact', contactEmail: 'synthetic@example.test',
    processDescription: 'Synthetic leads arrive by email and form, then staff manually copy data into HubSpot and notify Slack.',
    currentTools: ['HubSpot', 'Slack'], goals: ['Reduce manual data entry'],
    constraints: { dataSensitivity: 'personal', requiresHumanApproval: true },
  }, warnings: [], errors: [],
};

test('research brief schema is a constrained agent envelope', () => {
  assert.equal(schema.properties.status.enum.includes('completed'), true);
  assert.equal(schema.additionalProperties, false);
});

test('research agent emits source-labelled findings without external actions', () => {
  const result = createResearchBrief(validEnvelope);
  assert.equal(result.status, 'completed');
  assert.equal(result.data.externalActions.contactedCompanies, false);
  assert.equal(result.data.externalActions.webRequests, 0);
  assert.equal(result.data.externalActions.dataModified, false);
  assert.equal(result.data.facts.some((fact) => fact.sourceType === 'synthetic-tool-catalog'), true);
  assert.equal(JSON.stringify(result.data).includes('synthetic@example.test'), false);
  assert.match(result.warnings.join(' '), /Contact details/);
});

test('research agent flags unknown tooling instead of inventing integration facts', () => {
  const result = createResearchBrief({ ...validEnvelope, data: { ...validEnvelope.data, currentTools: ['Mystery CRM'], constraints: { dataSensitivity: 'unknown' } } });
  assert.equal(result.status, 'needs-human-input');
  assert.match(result.data.unknowns.join(' '), /Mystery CRM/);
  assert.equal(result.data.toolFindings.length, 0);
});

test('research agent refuses an unaccepted or incomplete intake envelope', () => {
  const result = createResearchBrief({ requestId: 'bad', schemaVersion: '1.0', status: 'rejected', data: {} });
  assert.equal(result.status, 'rejected');
  assert.equal(result.data, null);
  assert.match(result.errors.join(' '), /accepted intake/);
});
