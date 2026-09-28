import { prepareAiInput, validateAiInterpretation } from './ai-interpretation-agent.mjs';

export function evaluateAiCase(fixture, modelResult) {
  const prepared = prepareAiInput(fixture.intake, fixture.sources);
  const data = validateAiInterpretation(modelResult.data, new Set(prepared.sources.map((source) => source.sourceId)));
  const expectedSourceIds = fixture.expectedRelevantSourceIds;
  const sourceMetrics = Array.isArray(expectedSourceIds)
    ? (() => {
      const expected = new Set(expectedSourceIds);
      const predicted = new Set(data.relevantSourceIds);
      const correct = [...predicted].filter((sourceId) => expected.has(sourceId)).length;
      const precision = predicted.size === 0 ? (expected.size === 0 ? 1 : 0) : correct / predicted.size;
      const recall = expected.size === 0 ? (predicted.size === 0 ? 1 : 0) : correct / expected.size;
      return {
        citationPrecision: precision,
        citationRecall: recall,
        citationsExact: precision === 1 && recall === 1,
      };
    })()
    : { citationPrecision: null, citationRecall: null, citationsExact: null };
  return {
    caseId: fixture.id,
    expectedTrigger: fixture.expectedTrigger,
    observedTrigger: data.triggerType,
    modelTrigger: modelResult.triggerResolution?.modelTrigger ?? data.triggerType,
    triggerResolutionMethod: modelResult.triggerResolution?.method ?? 'model',
    triggerCorrected: (modelResult.triggerResolution?.modelTrigger ?? data.triggerType) !== data.triggerType,
    validStructuredOutput: true,
    triggerCorrect: data.triggerType === fixture.expectedTrigger,
    expectedMissingInformation: fixture.expectMissingInformation,
    missingInformationDetected: fixture.expectMissingInformation ? data.missingInformation.length > 0 : null,
    missingInformationCount: data.missingInformation.length,
    citationsGrounded: data.relevantSourceIds.length > 0 && data.relevantSourceIds.every((id) => prepared.sources.some((source) => source.sourceId === id)),
    citedSourceIds: data.relevantSourceIds,
    citationRetryUsed: modelResult.citationRetryUsed === true,
    ...sourceMetrics,
    latencyMs: modelResult.durationMs,
    inputTokens: modelResult.usage.inputTokens,
    outputTokens: modelResult.usage.outputTokens,
  };
}

export function summarizeAiEvaluation(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('At least one evaluated case is required.');
  const count = rows.length;
  const measured = (key) => rows.filter((row) => row[key] === true).length;
  const clarificationCases = rows.filter((row) => row.missingInformationDetected !== null);
  const citationCases = rows.filter((row) => row.citationPrecision !== null);
  const latencies = rows.map((row) => row.latencyMs).sort((a, b) => a - b);
  return {
    cases: count,
    validStructuredOutputs: measured('validStructuredOutput'),
    correctTriggers: measured('triggerCorrect'),
    correctRawModelTriggers: rows.filter((row) => row.modelTrigger === row.expectedTrigger).length,
    explicitTriggerRulesApplied: rows.filter((row) => row.triggerResolutionMethod === 'explicit-event-rule').length,
    triggerCorrections: measured('triggerCorrected'),
    groundedCitations: measured('citationsGrounded'),
    citationRetries: measured('citationRetryUsed'),
    clarificationDetected: measured('missingInformationDetected'),
    clarificationCases: clarificationCases.length,
    meanMissingInformationItems: rows.reduce((sum, row) => sum + row.missingInformationCount, 0) / count,
    ...(citationCases.length ? {
      citationCases: citationCases.length,
      exactCitationMatches: measured('citationsExact'),
      meanCitationPrecision: citationCases.reduce((sum, row) => sum + row.citationPrecision, 0) / citationCases.length,
      meanCitationRecall: citationCases.reduce((sum, row) => sum + row.citationRecall, 0) / citationCases.length,
    } : {}),
    medianLatencyMs: latencies[Math.floor((count - 1) / 2)],
    totalInputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0),
    totalOutputTokens: rows.reduce((sum, row) => sum + row.outputTokens, 0),
  };
}
