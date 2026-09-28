export const EMBEDDING_DIMENSION = 1536;
export const EMBEDDING_MODEL = 'local-hash-v1-baseline';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'bei', 'by', 'das', 'dem', 'den', 'der', 'die', 'ein', 'eine',
  'for', 'from', 'für', 'im', 'in', 'ist', 'it', 'mit', 'of', 'on', 'or', 'the', 'to', 'und', 'von', 'with', 'zu',
]);

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function tokenize(value) {
  return normalizeText(value)
    .toLocaleLowerCase('de-DE')
    .match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu)
    ?.filter((token) => token.length > 1 && !STOP_WORDS.has(token)) ?? [];
}

export function fingerprint(value) {
  return fnv1a(normalizeText(value)).toString(16).padStart(8, '0');
}

export function createDeterministicEmbedding(value, dimension = EMBEDDING_DIMENSION) {
  const vector = new Array(dimension).fill(0);
  const tokens = tokenize(value);

  for (const token of tokens) {
    const primaryHash = fnv1a(token);
    const secondaryHash = fnv1a(`sign:${token}`);
    const index = primaryHash % dimension;
    const sign = secondaryHash % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const length = Math.hypot(...vector);
  return length === 0 ? vector : vector.map((entry) => entry / length);
}

export function vectorLiteral(vector) {
  return `[${vector.map((entry) => Number(entry).toFixed(8)).join(',')}]`;
}

export function cosineSimilarity(left, right) {
  if (left.length !== right.length) throw new Error('vectors must have the same dimension');
  let dotProduct = 0;
  let leftLength = 0;
  let rightLength = 0;
  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftLength += left[index] ** 2;
    rightLength += right[index] ** 2;
  }
  return leftLength === 0 || rightLength === 0 ? 0 : dotProduct / Math.sqrt(leftLength * rightLength);
}

function lexicalOverlap(query, content) {
  const queryTokens = new Set(tokenize(query));
  const contentTokens = new Set(tokenize(content));
  if (queryTokens.size === 0 || contentTokens.size === 0) return 0;
  let matches = 0;
  for (const token of queryTokens) if (contentTokens.has(token)) matches += 1;
  return matches / queryTokens.size;
}

export function validateKnowledgeDocument(document) {
  const errors = [];
  const normalized = {
    sourceId: normalizeText(document?.sourceId),
    sourceName: normalizeText(document?.sourceName),
    sourceUrl: normalizeText(document?.sourceUrl) || null,
    content: normalizeText(document?.content),
    tags: Array.isArray(document?.tags)
      ? [...new Set(document.tags.map(normalizeText).filter(Boolean))].slice(0, 12)
      : [],
  };

  if (!/^[a-z0-9][a-z0-9-]{2,80}$/i.test(normalized.sourceId)) errors.push('sourceId must use 3-81 letters, numbers, or hyphens');
  if (normalized.sourceName.length < 3) errors.push('sourceName must contain at least 3 characters');
  if (normalized.content.length < 120) errors.push('content must contain at least 120 characters');
  if (normalized.sourceUrl && !/^https?:\/\//i.test(normalized.sourceUrl)) errors.push('sourceUrl must be an http(s) URL when provided');

  return { valid: errors.length === 0, data: normalized, errors };
}

export function chunkText(content, { targetWords = 150, overlapWords = 25 } = {}) {
  const paragraphs = String(content).split(/\n\s*\n/).map(normalizeText).filter(Boolean);
  const chunks = [];
  let current = [];
  let currentWords = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current.join('\n\n'));
    const overlap = tokenize(current.join(' ')).slice(-overlapWords).join(' ');
    current = overlap ? [overlap] : [];
    currentWords = tokenize(overlap).length;
  };

  for (const paragraph of paragraphs) {
    const rawWords = paragraph.split(/\s+/).filter(Boolean);
    const segments = [];
    for (let start = 0; start < rawWords.length; start += targetWords) {
      segments.push(rawWords.slice(start, start + targetWords).join(' '));
    }
    for (const segment of segments) {
      const words = tokenize(segment).length;
      if (currentWords > 0 && currentWords + words > targetWords) flush();
      current.push(segment);
      currentWords += words;
    }
  }
  if (current.length > 0) chunks.push(current.join('\n\n'));
  return chunks;
}

export function buildKnowledgeChunks(document, options = {}) {
  const validation = validateKnowledgeDocument(document);
  if (!validation.valid) return { ...validation, chunks: [] };

  const chunks = chunkText(validation.data.content, options).map((content, chunkIndex) => {
    const embedding = createDeterministicEmbedding(content);
    return {
      sourceId: validation.data.sourceId,
      sourceName: validation.data.sourceName,
      sourceUrl: validation.data.sourceUrl,
      tags: validation.data.tags,
      chunkIndex,
      content,
      contentHash: fingerprint(`${validation.data.sourceId}:${chunkIndex}:${content}`),
      tokenCount: tokenize(content).length,
      embeddingModel: EMBEDDING_MODEL,
      embedding,
      embeddingVector: vectorLiteral(embedding),
    };
  });

  return { valid: true, data: validation.data, errors: [], chunks };
}

export function rankKnowledgeChunks(query, chunks, limit = 3) {
  const queryEmbedding = createDeterministicEmbedding(query);
  return chunks
    .map((chunk) => {
      const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding ?? createDeterministicEmbedding(chunk.content));
      const lexicalScore = lexicalOverlap(query, chunk.content);
      return { ...chunk, semanticScore, lexicalScore, score: semanticScore * 0.85 + lexicalScore * 0.15 };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(limit, 10)));
}
