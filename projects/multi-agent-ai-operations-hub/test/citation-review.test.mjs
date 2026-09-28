import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCitationReview } from '../src/citation-review.mjs';

const sources = [{ sourceId: 'source-one', excerpt: 'Check API access before implementation.' }];

test('citation review fails closed when the model provides no source', () => {
  assert.throws(() => buildCitationReview({ relevantSourceIds: [] }, sources), /no cited knowledge source/);
});

test('citation review rejects unknown and duplicate source IDs', () => {
  assert.throws(() => buildCitationReview({ relevantSourceIds: ['invented'] }, sources), /unavailable knowledge source/);
  assert.throws(() => buildCitationReview({ relevantSourceIds: ['source-one', 'source-one'] }, sources), /unavailable knowledge source/);
});

test('citation review exposes the supplied excerpt without claiming semantic verification', () => {
  assert.deepEqual(buildCitationReview({ relevantSourceIds: ['source-one'] }, sources), {
    status: 'source-ids-verified', semanticSupportVerified: false,
    citations: [{ sourceId: 'source-one', excerpt: 'Check API access before implementation.' }],
  });
});
