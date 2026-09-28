const stageMap = Object.freeze({ intake: 'Intake Agent', research: 'Research Agent', rag: 'RAG Agent', blueprint: 'Solution Architect Agent', riskReview: 'Risk Reviewer', estimate: 'Estimation Agent', humanApproval: 'Human-in-the-Loop', demoExecution: 'Local Demo Execution Adapter' });

export function createAuditEvents(requestId, stages, requestDbId = null) {
  return Object.entries(stages).map(([stage, result]) => ({
    requestId,
    requestDbId,
    eventType: 'agent-stage-completed',
    actor: stageMap[stage] ?? stage,
    details: {
      stage,
      status: result?.status ?? 'unknown',
      modelName: null,
      promptVersion: 'local-deterministic-v1',
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      approvalStatus: result?.data?.decision ?? null,
      errorCount: Array.isArray(result?.errors) ? result.errors.length : 0,
    },
  }));
}
