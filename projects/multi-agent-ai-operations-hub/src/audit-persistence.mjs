export function toAgentRunRecord(event) {
  const details = event?.details ?? {};
  return {
    requestDbId: event?.requestDbId ?? '', agentName: event?.actor ?? 'unknown', status: details.status ?? 'unknown',
    modelName: details.modelName ?? '', promptVersion: details.promptVersion ?? 'local-deterministic-v1',
    inputSummary: { stage: details.stage ?? 'unknown' }, outputSummary: { status: details.status ?? 'unknown' },
    durationMs: details.durationMs ?? 0, inputTokens: details.inputTokens ?? 0, outputTokens: details.outputTokens ?? 0,
    estimatedCostUsd: details.estimatedCostUsd ?? 0, validationErrors: [], externalApiErrors: [],
    approvalStatus: details.approvalStatus ?? '', outcome: details.status ?? 'unknown',
  };
}
