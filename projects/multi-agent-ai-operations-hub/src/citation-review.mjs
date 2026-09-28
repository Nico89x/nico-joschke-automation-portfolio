export function buildCitationReview(data, sources) {
  const ids = data?.relevantSourceIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('Local advisory has no cited knowledge source; human review is required before persistence.');
  }
  const byId = new Map((Array.isArray(sources) ? sources : []).map((source) => [
    source?.sourceId,
    typeof (source?.excerpt ?? source?.content) === 'string'
      ? (source.excerpt ?? source.content).trim().replace(/\s+/g, ' ').slice(0, 700)
      : '',
  ]));
  if (new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || !byId.get(id))) {
    throw new Error('Local advisory cites an unavailable knowledge source; persistence was stopped.');
  }
  return {
    status: 'source-ids-verified',
    semanticSupportVerified: false,
    citations: ids.map((sourceId) => ({ sourceId, excerpt: byId.get(sourceId) })),
  };
}
