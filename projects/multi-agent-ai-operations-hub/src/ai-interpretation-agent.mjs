const OFFICIAL_ENDPOINT = 'https://api.openai.com/v1/responses';
export const AI_PROMPT_VERSION = 'interpretation-v4-trigger-v1-citation-v3';
export const AI_INTERPRETATION_INSTRUCTIONS = [
  'You are an advisory automation discovery analyst. Return only the requested JSON. Use only the supplied synthetic request and approved source excerpts. Never invent integrations or source IDs.',
  'Classify triggerType by the event that STARTS the proposed workflow: a confirmed incoming HTTP callback or webhook is webhook; arrival of a new message in any mailbox, including messages with attachments, is email; a recurring time or calendar event is schedule; an operator clicking Start or Run is manual.',
  'Keep the trigger separate from implementation unknowns: if new mailbox messages are the stated start event, classify email even when authentication, mailbox permissions, or attachment handling still need confirmation. Ask about those details in missingInformation. Use unknown only when the start event is itself unspecified, contradictory, or depends on an unconfirmed event capability. Do not infer webhook support merely because a form or API is mentioned.',
  'In missingInformation, ask at most three short, specific questions that block a reliable initial implementation plan. Prioritize the trigger/source of truth, integration capability or credentials, required fields, and approval owner when relevant. Do not ask for details already confirmed by the request or approved excerpts. Use an empty array when no material blocker remains.',
  'Select one or two approved excerpts that directly apply to the proposed action before writing the recommendation. Ground the concrete recommendation in those excerpts and return exactly their source IDs in relevantSourceIds. Do not cite background, alternative triggers, or generic advice merely related to the topic. If none of the supplied excerpts supports an implementation recommendation, say that the knowledge is insufficient, request human clarification, and return an empty citation list.',
  'Mark unknown facts explicitly. Never authorize execution, messaging, publication, or CRM changes.',
].join(' ');

export const AI_INTERPRETATION_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['problemSummary', 'triggerType', 'missingInformation', 'relevantSourceIds', 'recommendation'],
  properties: {
    problemSummary: { type: 'string' },
    triggerType: { type: 'string', enum: ['webhook', 'email', 'schedule', 'manual', 'unknown'] },
    missingInformation: { type: 'array', items: { type: 'string' } },
    relevantSourceIds: { type: 'array', items: { type: 'string' } },
    recommendation: { type: 'string' },
  },
});

const clean = (value, limit) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : '';
const boundedStrings = (value, count, length) => Array.isArray(value) ? value.slice(0, count).map((item) => clean(item, length)).filter(Boolean) : [];
const directContactPattern = /[^\s@]+@[^\s@]+\.[^\s@]+|\+?\d[\d\s().-]{7,}\d/;

export function prepareAiInput(intake, sources) {
  if (!intake || typeof intake !== 'object' || Array.isArray(intake)) throw new Error('A validated intake object is required.');
  const processDescription = clean(intake.processDescription, 2000);
  const goals = boundedStrings(intake.goals, 8, 160);
  if (processDescription.length < 40 || goals.length === 0) throw new Error('A validated process description and goals are required.');
  const allowedSources = Array.isArray(sources) ? sources.slice(0, 5).map((source) => ({
    sourceId: clean(source?.sourceId, 100),
    excerpt: clean(source?.content ?? source?.excerpt, 700),
  })).filter((source) => source.sourceId && source.excerpt) : [];
  if (allowedSources.length === 0) throw new Error('At least one approved knowledge excerpt is required.');
  const prepared = {
    processDescription,
    goals,
    currentTools: boundedStrings(intake.currentTools, 20, 80),
    dataSensitivity: clean(intake.constraints?.dataSensitivity, 40) || 'unknown',
    sources: allowedSources,
  };
  if (directContactPattern.test(JSON.stringify(prepared))) throw new Error('Direct contact details are not allowed in model input.');
  return prepared;
}

export function validateAiInterpretation(value, allowedSourceIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Model output must be a JSON object.');
  const keys = Object.keys(value).sort();
  const expected = [...AI_INTERPRETATION_SCHEMA.required].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error('Model output has missing or unexpected fields.');
  if (typeof value.problemSummary !== 'string' || !value.problemSummary.trim() || value.problemSummary.length > 500) throw new Error('Invalid problemSummary.');
  if (!AI_INTERPRETATION_SCHEMA.properties.triggerType.enum.includes(value.triggerType)) throw new Error('Invalid triggerType.');
  if (!Array.isArray(value.missingInformation) || value.missingInformation.length > 8 || value.missingInformation.some((item) => typeof item !== 'string' || !item.trim() || item.length > 240)) throw new Error('Invalid missingInformation.');
  if (!Array.isArray(value.relevantSourceIds) || value.relevantSourceIds.length > 5 || value.relevantSourceIds.some((item) => typeof item !== 'string' || !allowedSourceIds.has(item)) || new Set(value.relevantSourceIds).size !== value.relevantSourceIds.length) throw new Error('Unknown or duplicate source citation.');
  if (typeof value.recommendation !== 'string' || !value.recommendation.trim() || value.recommendation.length > 700) throw new Error('Invalid recommendation.');
  return value;
}

function assertEndpoint(endpoint) {
  let url;
  try { url = new URL(endpoint); } catch { throw new Error('Invalid model endpoint.'); }
  if (url.href !== OFFICIAL_ENDPOINT) throw new Error('Only the official OpenAI Responses endpoint is allowed for live calls.');
  return url.href;
}

function extractOutputText(response) {
  if (response?.status !== 'completed') throw new Error('Model response was refused or incomplete.');
  const contents = Array.isArray(response.output) ? response.output.flatMap((item) => Array.isArray(item.content) ? item.content : []) : [];
  if (contents.some((item) => item.type === 'refusal')) throw new Error('Model response was refused.');
  const texts = contents.filter((item) => item.type === 'output_text' && typeof item.text === 'string').map((item) => item.text);
  if (texts.length !== 1) throw new Error('Model response did not contain exactly one output text.');
  return texts[0];
}

export async function runAiInterpretation({ intake, sources, apiKey, model, endpoint = OFFICIAL_ENDPOINT, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  const prepared = prepareAiInput(intake, sources);
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('A model API key is required.');
  if (typeof model !== 'string' || !/^[a-zA-Z0-9._-]{2,100}$/.test(model)) throw new Error('An explicit model ID is required.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) throw new Error('Timeout must be between 1000 and 30000 ms.');
  const url = assertEndpoint(endpoint);
  const requestBody = {
    model,
    store: false,
    max_output_tokens: 400,
    instructions: AI_INTERPRETATION_INSTRUCTIONS,
    input: JSON.stringify(prepared),
    text: { format: { type: 'json_schema', name: 'automation_discovery', strict: true, schema: AI_INTERPRETATION_SCHEMA } },
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    if (!response?.ok) throw new Error(`Model service returned HTTP ${Number(response?.status) || 'unknown'}.`);
    let body;
    try { body = await response.json(); } catch { throw new Error('Model service returned invalid JSON.'); }
    let parsed;
    try { parsed = JSON.parse(extractOutputText(body)); } catch (error) {
      if (error instanceof SyntaxError) throw new Error('Model output was not valid JSON.');
      throw error;
    }
    const data = validateAiInterpretation(parsed, new Set(prepared.sources.map((source) => source.sourceId)));
    const inputTokens = body.usage?.input_tokens;
    const outputTokens = body.usage?.output_tokens;
    if (!Number.isInteger(inputTokens) || inputTokens < 0 || !Number.isInteger(outputTokens) || outputTokens < 0) throw new Error('Model usage metadata is missing or invalid.');
    return {
      agent: 'AI Interpretation Agent', promptVersion: AI_PROMPT_VERSION, model: body.model ?? model,
      data, usage: { inputTokens, outputTokens }, durationMs: Date.now() - started,
      executionGate: false, externalActions: { crmWrites: 0, tasksCreated: 0, messagesSent: 0 },
    };
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Model request timed out.');
    if (error?.name === 'TypeError') throw new Error('Model transport failed: network error.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
