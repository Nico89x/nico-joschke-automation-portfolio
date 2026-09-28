import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../database/init/002_knowledge_base.sql', import.meta.url);
const upsertQueryUrl = new URL('../database/queries/upsert-knowledge-chunks.sql', import.meta.url);
const migration = await readFile(migrationUrl, 'utf8');
const upsertQuery = await readFile(upsertQueryUrl, 'utf8');

const ids = {
  migrationTrigger: '2ce22a3f-1af4-4a21-a7a2-f23e83d86b00',
  migrationNode: '20a1efae-2e95-445a-bdcc-9b08c97be701',
  webhook: '36da004c-646e-4de1-bd9c-1318f2172c00',
  chunker: 'a53a2062-355b-4413-8c44-a0d1464e2a01',
  valid: 'b8f1a2a4-6fd1-4ba7-ae6c-6a66b1ad4b02',
  persist: 'f24a5634-6d9a-4b50-8bc2-3c6974cd5b03',
  accepted: '2f9f5b34-a2b5-4f46-a4bd-3994c09bc404',
  rejected: '9e08bced-88cd-4ad2-a2e8-5df1f23c6d05',
};

const ingestionCode = `const DIMENSION = 1536;
const STOP_WORDS = new Set(['a','an','and','are','as','at','be','bei','by','das','dem','den','der','die','ein','eine','for','from','für','im','in','ist','it','mit','of','on','or','the','to','und','von','with','zu']);
const normalizeText = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
const tokenize = (value) => normalizeText(value).toLocaleLowerCase('de-DE').match(/[\\p{L}\\p{N}][\\p{L}\\p{N}_-]*/gu)?.filter((token) => token.length > 1 && !STOP_WORDS.has(token)) ?? [];
const fnv1a = (value) => { let hash = 0x811c9dc5; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); } return hash >>> 0; };
const fingerprint = (value) => fnv1a(normalizeText(value)).toString(16).padStart(8, '0');
const embedding = (value) => { const vector = new Array(DIMENSION).fill(0); for (const token of tokenize(value)) { const primary = fnv1a(token); const secondary = fnv1a('sign:' + token); vector[primary % DIMENSION] += secondary % 2 === 0 ? 1 : -1; } const length = Math.hypot(...vector); return length === 0 ? vector : vector.map((entry) => entry / length); };
const vectorLiteral = (vector) => '[' + vector.map((entry) => Number(entry).toFixed(8)).join(',') + ']';
const chunkText = (content) => { const paragraphs = String(content).split(/\\n\\s*\\n/).map(normalizeText).filter(Boolean); const chunks = []; let current = []; let wordCount = 0; const flush = () => { if (!current.length) return; chunks.push(current.join('\\n\\n')); const overlap = tokenize(current.join(' ')).slice(-25).join(' '); current = overlap ? [overlap] : []; wordCount = tokenize(overlap).length; }; for (const paragraph of paragraphs) { const paragraphWords = tokenize(paragraph).length; if (wordCount && wordCount + paragraphWords > 150) flush(); current.push(paragraph); wordCount += paragraphWords; } if (current.length) chunks.push(current.join('\\n\\n')); return chunks; };
const input = $json.body && typeof $json.body === 'object' && !Array.isArray($json.body) ? $json.body : $json;
const sourceId = normalizeText(input.sourceId);
const sourceName = normalizeText(input.sourceName);
const sourceUrl = normalizeText(input.sourceUrl) || null;
const content = String(input.content ?? '').trim();
const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map(normalizeText).filter(Boolean))].slice(0, 12) : [];
const errors = [];
if (!/^[a-z0-9][a-z0-9-]{2,80}$/i.test(sourceId)) errors.push('sourceId must use 3-81 letters, numbers, or hyphens');
if (sourceName.length < 3) errors.push('sourceName must contain at least 3 characters');
if (normalizeText(content).length < 120) errors.push('content must contain at least 120 characters');
if (sourceUrl && !/^https?:\\/\\//i.test(sourceUrl)) errors.push('sourceUrl must be an http(s) URL when provided');
if (errors.length) return [{ json: { requestId: 'knowledge-' + $execution.id, valid: false, status: 'rejected', errors, sourceId, sourceName } }];
const chunks = chunkText(content).map((chunkContent, chunkIndex) => { const vector = embedding(chunkContent); return { chunkIndex, content: chunkContent, contentHash: fingerprint(sourceId + ':' + chunkIndex + ':' + chunkContent), tokenCount: tokenize(chunkContent).length, embedding: vectorLiteral(vector) }; });
return [{ json: { requestId: 'knowledge-' + $execution.id, valid: true, status: 'accepted', sourceId, sourceName, sourceUrl, tags, embeddingModel: 'local-hash-v1-baseline', chunks, errors: [] } }];`;

const migrationWorkflow = {
  name: '00 - Apply Knowledge Base Migration',
  nodes: [
    { parameters: {}, id: ids.migrationTrigger, name: 'Start migration', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [-220, 0] },
    { parameters: { operation: 'executeQuery', query: migration, options: {} }, id: ids.migrationNode, name: 'Apply knowledge migration', type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [40, 0], retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 },
  ],
  connections: { 'Start migration': { main: [[{ node: 'Apply knowledge migration', type: 'main', index: 0 }]] } },
  active: false,
  settings: { executionOrder: 'v1' },
  versionId: '00000000-0000-4000-8000-000000000000',
};

const ingestionWorkflow = {
  name: '02 - Knowledge Base Ingestion API',
  nodes: [
    { parameters: { httpMethod: 'POST', path: 'knowledge-base-ingest', responseMode: 'responseNode', options: {} }, id: ids.webhook, name: 'Receive synthetic knowledge document', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-600, 0], webhookId: '825f5e0f-7f53-4b20-bd5b-f343d8b17600' },
    { parameters: { jsCode: ingestionCode }, id: ids.chunker, name: 'Validate and chunk knowledge', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-360, 0] },
    { parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: ids.valid, leftValue: '={{ $json.valid }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }, id: ids.valid, name: 'Document valid?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [-100, 0] },
    { parameters: { operation: 'executeQuery', query: upsertQuery, options: { queryReplacement: '={{ JSON.stringify({ sourceId: $(\'Validate and chunk knowledge\').first().json.sourceId, sourceName: $(\'Validate and chunk knowledge\').first().json.sourceName, sourceUrl: $(\'Validate and chunk knowledge\').first().json.sourceUrl, tags: $(\'Validate and chunk knowledge\').first().json.tags, embeddingModel: $(\'Validate and chunk knowledge\').first().json.embeddingModel, chunks: $(\'Validate and chunk knowledge\').first().json.chunks }) }}' } }, id: ids.persist, name: 'Upsert knowledge chunks', type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [160, -100], retryOnFail: true, maxTries: 3, waitBetweenTries: 1000 },
    { parameters: { respondWith: 'json', responseBody: '={{ { ok: true, status: \'accepted\', sourceId: $(\'Validate and chunk knowledge\').first().json.sourceId, embeddingModel: $(\'Validate and chunk knowledge\').first().json.embeddingModel, upsertedChunks: $json.upserted_chunks } }}', options: { responseCode: 202 } }, id: ids.accepted, name: 'Confirm knowledge ingestion', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.4, position: [430, -100] },
    { parameters: { respondWith: 'json', responseBody: '={{ { ok: false, status: $json.status, sourceId: $json.sourceId, errors: $json.errors } }}', options: { responseCode: 422 } }, id: ids.rejected, name: 'Reject invalid knowledge document', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.4, position: [160, 100] },
  ],
  connections: {
    'Receive synthetic knowledge document': { main: [[{ node: 'Validate and chunk knowledge', type: 'main', index: 0 }]] },
    'Validate and chunk knowledge': { main: [[{ node: 'Document valid?', type: 'main', index: 0 }]] },
    'Document valid?': { main: [[{ node: 'Upsert knowledge chunks', type: 'main', index: 0 }], [{ node: 'Reject invalid knowledge document', type: 'main', index: 0 }]] },
    'Upsert knowledge chunks': { main: [[{ node: 'Confirm knowledge ingestion', type: 'main', index: 0 }]] },
  },
  active: false,
  settings: { executionOrder: 'v1' },
  versionId: '00000000-0000-4000-8000-000000000002',
};

const selected = process.argv[2];
if (selected === 'migration') process.stdout.write(`${JSON.stringify(migrationWorkflow, null, 2)}\n`);
else if (selected === 'ingestion') process.stdout.write(`${JSON.stringify(ingestionWorkflow, null, 2)}\n`);
else process.stderr.write('Usage: node scripts/build-knowledge-workflows.mjs <migration|ingestion>\n');
