import { validateAndNormalizeIntake } from './intake-validator.mjs';
import { createResearchBrief } from './research-agent.mjs';
import { createAutomationBlueprint } from './solution-architect-agent.mjs';
import { reviewAutomationRisk } from './risk-reviewer.mjs';
import { estimateAutomationWork } from './estimation-agent.mjs';
import { recordHumanApproval } from './human-approval.mjs';
import { createAuditEvents } from './audit-events.mjs';
import { prepareDemoExecution } from './demo-execution-adapter.mjs';

export function runSyntheticEndToEnd(payload, approval = { decision: 'rejected', reviewer: 'Synthetic Reviewer' }, options = {}) {
  const intakeValidation = validateAndNormalizeIntake(payload, { currentDate: options.currentDate ?? new Date().toISOString().slice(0, 10) });
  const requestId = intakeValidation.normalized.idempotencyKey || 'invalid-request';
  if (!intakeValidation.valid) {
    const stages = { intake: { status: 'rejected', errors: intakeValidation.errors } };
    return { status: 'rejected', stages, auditEvents: createAuditEvents(requestId, stages), executionGate: false };
  }
  const intake = { requestId, schemaVersion: '1.0', status: 'accepted', data: intakeValidation.normalized };
  const research = createResearchBrief(intake);
  const rag = { sources: [{ sourceId: 'webhook-idempotency' }, { sourceId: 'crm-human-approval' }, { sourceId: 'reliability-error-handling' }] };
  const blueprint = createAutomationBlueprint({ requestId, intake, research, rag });
  const riskReview = reviewAutomationRisk({ requestId, blueprint });
  const estimate = estimateAutomationWork({ requestId, blueprint, riskReview });
  const humanApproval = recordHumanApproval({ requestId, riskReview, estimate, approvedVersion: blueprint.data?.blueprintVersion, ...approval });
  const demoExecution = prepareDemoExecution({ requestId, blueprint, humanApproval });
  const stages = { intake, research, rag, blueprint, riskReview, estimate, humanApproval, demoExecution };
  return { status: humanApproval.status, stages, auditEvents: createAuditEvents(requestId, stages), executionGate: humanApproval.data?.executionGate?.open === true };
}
