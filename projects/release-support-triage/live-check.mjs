import { fetchRelease, prepareDraft } from './triage.mjs';
const result = prepareDraft({ id: 'synthetic-live-check', product: 'n8n', category: 'update-question', installedVersion: '2.0.0' }, await fetchRelease());
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), source: 'GitHub public releases API, real GET', result }, null, 2));
