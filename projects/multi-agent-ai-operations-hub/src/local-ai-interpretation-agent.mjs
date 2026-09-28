import { AI_INTERPRETATION_INSTRUCTIONS, AI_INTERPRETATION_SCHEMA, AI_PROMPT_VERSION, prepareAiInput, validateAiInterpretation } from './ai-interpretation-agent.mjs';
import { resolveExplicitTrigger } from './explicit-trigger.mjs';
import { buildCitationReview } from './citation-review.mjs';

const LOCAL_ENDPOINT = 'http://127.0.0.1:11434/api/chat';

export async function runLocalAiInterpretation({ intake, sources, model = 'qwen3.5:4b', fetchImpl = globalThis.fetch, timeoutMs = 120000 }) {
  const prepared = prepareAiInput(intake, sources);
  if (typeof model !== 'string' || !/^[a-zA-Z0-9._-]+:[a-zA-Z0-9._-]+$/.test(model) || model.endsWith(':cloud')) {
    throw new Error('An explicit local Ollama model tag is required; cloud models are not allowed.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 180000) throw new Error('Timeout must be between 1000 and 180000 ms.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const allowedSourceIds = new Set(prepared.sources.map((source) => source.sourceId));
    const callModel = async (messages) => {
      const response = await fetchImpl(LOCAL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          think: false,
          keep_alive: '2m',
          format: AI_INTERPRETATION_SCHEMA,
          options: { temperature: 0, num_ctx: 4096, num_predict: 400 },
          messages,
        }),
        signal: controller.signal,
      });
      if (!response?.ok) throw new Error(`Local model returned HTTP ${Number(response?.status) || 'unknown'}.`);
      let body;
      try { body = await response.json(); } catch { throw new Error('Local model returned invalid JSON.'); }
      if (body?.done !== true || (body.done_reason && body.done_reason !== 'stop')) throw new Error('Local model response was incomplete.');
      if (typeof body.message?.content !== 'string') throw new Error('Local model response has no text content.');
      let parsed;
      try { parsed = JSON.parse(body.message.content); } catch { throw new Error('Local model output was not valid JSON.'); }
      const data = validateAiInterpretation(parsed, allowedSourceIds);
      const inputTokens = body.prompt_eval_count;
      const outputTokens = body.eval_count;
      if (!Number.isInteger(inputTokens) || inputTokens < 0 || !Number.isInteger(outputTokens) || outputTokens < 0) throw new Error('Local model token usage is missing or invalid.');
      return { body, data, inputTokens, outputTokens };
    };
    const initialMessages = [
      { role: 'system', content: AI_INTERPRETATION_INSTRUCTIONS },
      { role: 'user', content: JSON.stringify(prepared) },
    ];
    const first = await callModel(initialMessages);
    let selected = first;
    if (first.data.relevantSourceIds.length === 0) {
      selected = await callModel([
        ...initialMessages,
        { role: 'user', content: 'Citation check: Reconsider each approved excerpt against the request. A source supporting the trigger, validation, duplicate control, or human review is enough to support that specific recommendation, even if other implementation details are still unknown. Ground the recommendation in the most relevant excerpt and cite its exact sourceId. Only leave relevantSourceIds empty if no excerpt supports any concrete step. Return the complete JSON object only.' },
      ]);
    }
    const modelData = selected.data;
    const explicitTrigger = resolveExplicitTrigger(prepared.processDescription);
    const data = explicitTrigger && explicitTrigger !== modelData.triggerType
      ? { ...modelData, triggerType: explicitTrigger }
      : modelData;
    const citationReview = buildCitationReview(data, prepared.sources);
    const inputTokens = first.inputTokens + (selected === first ? 0 : selected.inputTokens);
    const outputTokens = first.outputTokens + (selected === first ? 0 : selected.outputTokens);
    return {
      agent: 'AI Interpretation Agent', promptVersion: AI_PROMPT_VERSION, model: selected.body.model ?? model,
      data, usage: { inputTokens, outputTokens }, durationMs: Date.now() - started,
      citationReview,
      citationRetryUsed: selected !== first,
      triggerResolution: {
        modelTrigger: modelData.triggerType,
        selectedTrigger: data.triggerType,
        method: explicitTrigger ? 'explicit-event-rule' : 'model',
      },
      executionGate: false, externalActions: { crmWrites: 0, tasksCreated: 0, messagesSent: 0 },
    };
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Local model request timed out.');
    if (error?.name === 'TypeError') throw new Error('Local model transport failed.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
