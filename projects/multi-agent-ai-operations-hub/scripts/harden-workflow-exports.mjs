import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const outputOnly = process.env.WORKFLOW_OUTPUT || '';
const readWorkflow = async (name) => JSON.parse(await readFile(new URL(`workflows/${name}`, root), 'utf8'));
const writeWorkflow = async (name, workflow) => {
  const serialized = `${JSON.stringify(workflow, null, 2)}\n`;
  if (outputOnly) {
    if (outputOnly === name) process.stdout.write(serialized);
    return;
  }
  await writeFile(fileURLToPath(new URL(`workflows/${name}`, root)), serialized, 'utf8');
};
const nodeByName = (workflow, name) => {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`Missing node: ${name}`);
  return node;
};

const strictValidatorCode = `const emailPattern=/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const datePattern=/^\\d{4}-\\d{2}-\\d{2}$/;
const allowed=new Set(['companyName','contactName','contactEmail','processDescription','currentTools','goals','constraints','idempotencyKey']);
const allowedConstraints=new Set(['budgetEur','deadline','dataSensitivity','requiresHumanApproval']);
const sensitivities=new Set(['public','internal','personal','special-category','unknown']);
const clean=v=>typeof v==='string'?v.trim():'';
const arr=v=>Array.isArray(v)?[...new Set(v.map(clean).filter(Boolean))]:[];
const isDate=value=>{if(!datePattern.test(value))return false;const date=new Date(value+'T00:00:00.000Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;};
const payload=$json.body!==undefined?$json.body:$json;
const payloadIsObject=payload&&typeof payload==='object'&&!Array.isArray(payload);
const body=payloadIsObject?payload:{};
const constraintsAreObject=body.constraints===undefined||(body.constraints&&typeof body.constraints==='object'&&!Array.isArray(body.constraints));
const c=constraintsAreObject&&body.constraints?body.constraints:{};
const normalized={companyName:clean(body.companyName),contactName:clean(body.contactName),contactEmail:clean(body.contactEmail).toLowerCase(),processDescription:clean(body.processDescription),currentTools:arr(body.currentTools),goals:arr(body.goals),constraints:{...c},idempotencyKey:clean(body.idempotencyKey)};
const errors=[],warnings=[];
if(!payloadIsObject)errors.push('payload must be an object');
for(const field of ['companyName','processDescription','idempotencyKey'])if(typeof body[field]!=='string')errors.push(field+' must be a string');
for(const field of ['contactName','contactEmail'])if(body[field]!==undefined&&typeof body[field]!=='string')errors.push(field+' must be a string');
for(const field of ['currentTools','goals']){if(body[field]!==undefined&&!Array.isArray(body[field]))errors.push(field+' must be an array');if(Array.isArray(body[field])&&body[field].some(item=>typeof item!=='string'))errors.push(field+' must contain only strings');}
if(!constraintsAreObject)errors.push('constraints must be an object');
for(const key of Object.keys(body))if(!allowed.has(key))errors.push('unknown field: '+key);
for(const key of Object.keys(c))if(!allowedConstraints.has(key))errors.push('unknown constraint field: '+key);
if(normalized.companyName.length<2)errors.push('companyName must contain at least 2 characters');
if(normalized.companyName.length>120)errors.push('companyName must contain at most 120 characters');
if(normalized.contactName.length>120)errors.push('contactName must contain at most 120 characters');
if(normalized.contactEmail.length>254)errors.push('contactEmail must contain at most 254 characters');
if(normalized.processDescription.length<40)errors.push('processDescription must contain at least 40 characters');
if(normalized.processDescription.length>5000)errors.push('processDescription must contain at most 5000 characters');
if(!normalized.goals.length)errors.push('at least one goal is required');
if(normalized.goals.length>10)errors.push('goals must contain at most 10 items');
if(normalized.goals.some(goal=>goal.length<3||goal.length>240))errors.push('each goal must contain 3 to 240 characters');
if(normalized.currentTools.length>30)errors.push('currentTools must contain at most 30 items');
if(normalized.currentTools.some(tool=>tool.length>80))errors.push('each currentTools item must contain at most 80 characters');
if(normalized.contactEmail&&!emailPattern.test(normalized.contactEmail))errors.push('contactEmail is invalid');
if(normalized.idempotencyKey.length<8)errors.push('idempotencyKey must contain at least 8 characters');
if(normalized.idempotencyKey.length>120)errors.push('idempotencyKey must contain at most 120 characters');
const sensitivity=c.dataSensitivity??'unknown';
if(!sensitivities.has(sensitivity))errors.push('constraints.dataSensitivity is invalid');
if(c.requiresHumanApproval!==undefined&&typeof c.requiresHumanApproval!=='boolean')errors.push('constraints.requiresHumanApproval must be a boolean');
const requiresHumanApproval=c.requiresHumanApproval!==false;
if(['personal','special-category'].includes(sensitivity)&&!requiresHumanApproval)errors.push('sensitive data contradicts requiresHumanApproval=false');
if(c.budgetEur!==undefined&&(typeof c.budgetEur!=='number'||!Number.isFinite(c.budgetEur)||c.budgetEur<0||c.budgetEur>1000000))errors.push('constraints.budgetEur must be between 0 and 1000000');
const deadline=c.deadline;
const currentDate=typeof $vars!=='undefined'&&$vars.TEST_CURRENT_DATE?$vars.TEST_CURRENT_DATE:new Date().toISOString().slice(0,10);
if(deadline!==undefined){if(typeof deadline!=='string'||!isDate(deadline))errors.push('constraints.deadline must be a valid ISO date');else if(deadline<currentDate)errors.push('constraints.deadline must not be in the past');}
if(sensitivity==='unknown')warnings.push('data sensitivity requires clarification');
if(!normalized.currentTools.length)warnings.push('current tools require clarification');
normalized.constraints={...c,dataSensitivity:sensitivity,requiresHumanApproval};`;

const intake = await readWorkflow('01-intake-api.json');
nodeByName(intake, 'Validate and normalize').parameters.jsCode = `${strictValidatorCode}\nreturn [{json:{requestId:'req-'+$execution.id,schemaVersion:'1.0',valid:errors.length===0,status:errors.length===0?'accepted':'rejected',normalized,rawPayload:body,warnings,errors}}];`;
await writeWorkflow('01-intake-api.json', intake);

const ingestion = await readWorkflow('02-knowledge-ingestion-api.json');
nodeByName(ingestion, 'Upsert knowledge chunks').parameters.query = await readFile(new URL('database/queries/upsert-knowledge-chunks.sql', root), 'utf8');
const ingestionNode = nodeByName(ingestion, 'Validate and chunk knowledge');
ingestionNode.parameters.jsCode = ingestionNode.parameters.jsCode.replace(
  /const chunkText=.*?return chunks; \};/,
  "const chunkText=(content)=>{const paragraphs=String(content).split(/\\n\\s*\\n/).map(normalizeText).filter(Boolean);const chunks=[];let current=[],wordCount=0;const flush=()=>{if(!current.length)return;chunks.push(current.join('\\n\\n'));const overlap=tokenize(current.join(' ')).slice(-25).join(' ');current=overlap?[overlap]:[];wordCount=tokenize(overlap).length;};for(const paragraph of paragraphs){const rawWords=paragraph.split(/\\s+/).filter(Boolean);for(let start=0;start<rawWords.length;start+=150){const segment=rawWords.slice(start,start+150).join(' ');const count=tokenize(segment).length;if(wordCount&&wordCount+count>150)flush();current.push(segment);wordCount+=count;}}if(current.length)chunks.push(current.join('\\n\\n'));return chunks;};",
);
nodeByName(ingestion, 'Confirm knowledge ingestion').parameters.responseBody = "={{ { ok: true, status: 'accepted', sourceId: $('Validate and chunk knowledge').first().json.sourceId, embeddingModel: $('Validate and chunk knowledge').first().json.embeddingModel, upsertedChunks: $json.upserted_chunks, deletedStaleChunks: $json.deleted_stale_chunks } }}";
await writeWorkflow('02-knowledge-ingestion-api.json', ingestion);

const hub = await readWorkflow('07-central-operations-hub.json');
nodeByName(hub, 'Validate and normalize request').parameters.jsCode = `${strictValidatorCode}\nreturn[{json:{valid:errors.length===0,errors,warnings,normalized,rawPayload:body,workflowRequestId:'hub-'+$execution.id}}];`;

nodeByName(hub, 'Persist or resolve request').parameters.query = `WITH payload AS (SELECT $1::jsonb AS doc),
inserted AS (
  INSERT INTO project_requests(source,company_name,contact_name,contact_email,process_description,current_tools,goals,constraints,status,raw_payload,idempotency_key)
  SELECT 'operations-hub',doc->'normalized'->>'companyName',NULLIF(doc->'normalized'->>'contactName',''),NULLIF(doc->'normalized'->>'contactEmail',''),doc->'normalized'->>'processDescription',COALESCE(doc->'normalized'->'currentTools','[]'::jsonb),COALESCE(doc->'normalized'->'goals','[]'::jsonb),COALESCE(doc->'normalized'->'constraints','{}'::jsonb),'planning',COALESCE(doc->'rawPayload',doc->'normalized'),doc->'normalized'->>'idempotencyKey'
  FROM payload ON CONFLICT(idempotency_key) DO NOTHING RETURNING id,status,updated_at,TRUE AS created
),
resolved AS (
  SELECT id,status,updated_at,created FROM inserted
  UNION ALL
  SELECT r.id,r.status,r.updated_at,FALSE FROM project_requests r CROSS JOIN payload
  WHERE r.idempotency_key=payload.doc->'normalized'->>'idempotencyKey' AND NOT EXISTS(SELECT 1 FROM inserted) LIMIT 1
),
logged AS (
  INSERT INTO audit_events(request_id,event_type,actor,details)
  SELECT id,CASE WHEN created THEN 'operations-hub.started' ELSE 'operations-hub.duplicate' END,'operations-hub',jsonb_build_object('workflowRequestId',payload.doc->>'workflowRequestId','created',resolved.created,'currentStatus',resolved.status)
  FROM resolved CROSS JOIN payload RETURNING id
)
SELECT resolved.id::text AS "requestDbId",resolved.created,resolved.status AS "currentStatus",resolved.updated_at AS "updatedAt" FROM resolved;`;
nodeByName(hub, 'Return existing request status').parameters.responseBody = "={{ { ok: true, status: 'duplicate', requestDbId: $json.requestDbId, currentStatus: $json.currentStatus, updatedAt: $json.updatedAt, executionGate: false, message: 'The idempotency key already exists; no duplicate planning run was created.' } }}";

const invalidAudit = {
  parameters: {
    operation: 'executeQuery',
    query: `WITH payload AS (SELECT $1::jsonb AS doc), audited AS (
  INSERT INTO audit_events(request_id,event_type,actor,details)
  SELECT NULL,'operations-hub.intake-rejected','operations-hub',jsonb_build_object('workflowRequestId',doc->>'workflowRequestId','idempotencyKey',doc->'normalized'->>'idempotencyKey','warnings',COALESCE(doc->'warnings','[]'::jsonb),'errors',COALESCE(doc->'errors','[]'::jsonb)) FROM payload RETURNING id
) SELECT doc->>'workflowRequestId' AS "workflowRequestId",COALESCE(doc->'warnings','[]'::jsonb) AS warnings,COALESCE(doc->'errors','[]'::jsonb) AS errors,(SELECT COUNT(*) FROM audited)::int AS "auditEventsWritten" FROM payload;`,
    options: { queryReplacement: '={{ JSON.stringify($json) }}' },
  },
  id: '8af68746-d105-4a1e-b344-d097d92fe901',
  name: 'Audit rejected operations request',
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.6,
  position: [-80, 320],
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 1000,
};
const invalidIndex = hub.nodes.findIndex((node) => node.name === invalidAudit.name);
if (invalidIndex === -1) hub.nodes.push(invalidAudit); else hub.nodes[invalidIndex] = invalidAudit;
hub.connections['Request valid?'].main[1] = [{ node: invalidAudit.name, type: 'main', index: 0 }];
hub.connections[invalidAudit.name] = { main: [[{ node: 'Reject invalid request', type: 'main', index: 0 }]] };
nodeByName(hub, 'Reject invalid request').parameters.responseBody = "={{ { ok: false, status: 'rejected', workflowRequestId: $json.workflowRequestId, auditEventsWritten: $json.auditEventsWritten, executionGate: false, warnings: $json.warnings, errors: $json.errors } }}";

const retrieve = nodeByName(hub, 'Retrieve internal knowledge');
retrieve.alwaysOutputData = true;
retrieve.parameters.query = `WITH input AS (SELECT NULLIF($1::jsonb->>'queryEmbedding','')::vector AS query_embedding,COALESCE($1::jsonb->>'queryText','') AS query_text), scored AS (SELECT c.source_id,c.source_name,c.source_url,c.chunk_index,c.content,c.metadata,1-(c.embedding<=>input.query_embedding) AS semantic_score,ts_rank_cd(c.search_vector,plainto_tsquery('simple',input.query_text)) AS lexical_score FROM knowledge_chunks c CROSS JOIN input WHERE c.embedding IS NOT NULL AND input.query_embedding IS NOT NULL), ranked AS (SELECT *,semantic_score*0.85+lexical_score*0.15 AS retrieval_score FROM scored) SELECT source_id,source_name,source_url,chunk_index,content,metadata,semantic_score,lexical_score,retrieval_score FROM ranked WHERE retrieval_score >= 0.05 ORDER BY retrieval_score DESC,source_id,chunk_index LIMIT 5;`;
const agents = nodeByName(hub, 'Run research, architect, risk and estimate agents');
agents.parameters.jsCode = agents.parameters.jsCode.replace("const chunks=$input.all().map(({json})=>json);", "const chunks=$input.all().map(({json})=>json).filter(chunk=>typeof chunk.source_id==='string'&&chunk.source_id.trim()&&Number.isFinite(Number(chunk.retrieval_score)));" );

nodeByName(hub, 'Persist blueprint and stage audit').parameters.query = `WITH payload AS (SELECT $1::jsonb AS result),
saved AS (
  INSERT INTO project_blueprints(request_id,solution_blueprint,risk_review,effort_estimate,approval_status)
  SELECT (result->>'requestDbId')::uuid,result->'stages'->'blueprint',result->'stages'->'riskReview',result->'stages'->'estimate','pending' FROM payload
  ON CONFLICT(request_id) DO UPDATE SET solution_blueprint=EXCLUDED.solution_blueprint,risk_review=EXCLUDED.risk_review,effort_estimate=EXCLUDED.effort_estimate,approval_status='pending',updated_at=NOW() RETURNING id
),
state_updated AS (
  UPDATE project_requests request SET status=CASE WHEN payload.result->>'status'='needs-human-input' THEN 'needs-human-input' ELSE 'awaiting-review' END,updated_at=NOW()
  FROM payload WHERE request.id=(payload.result->>'requestDbId')::uuid RETURNING request.id
),
stage_rows AS (SELECT (result->>'requestDbId')::uuid AS request_id,stage.key,stage.value FROM payload CROSS JOIN LATERAL jsonb_each(result->'stages') AS stage(key,value)),
audited AS (
  INSERT INTO audit_events(request_id,event_type,actor,details)
  SELECT request_id,'agent-stage-completed',CASE key WHEN 'intake' THEN 'Intake Agent' WHEN 'research' THEN 'Research Agent' WHEN 'rag' THEN 'RAG Agent' WHEN 'blueprint' THEN 'Solution Architect Agent' WHEN 'riskReview' THEN 'Risk Reviewer' WHEN 'estimate' THEN 'Estimation Agent' ELSE key END,jsonb_build_object('stage',key,'status',COALESCE(value->>'status','completed'),'promptVersion','local-deterministic-v1','modelName',NULL,'inputTokens',0,'outputTokens',0,'estimatedCostUsd',0,'executionGate',false) FROM stage_rows RETURNING id
)
SELECT (SELECT id::text FROM saved) AS blueprint_id,(SELECT COUNT(*) FROM audited)::int AS audit_events_written,(SELECT result FROM payload) AS result,(SELECT id::text FROM state_updated) AS state_request_id;`;
await writeWorkflow('07-central-operations-hub.json', hub);

const review = await readWorkflow('08-operations-hub-review-api.json');
nodeByName(review, 'Record one-time human decision').parameters.query = `WITH payload AS (SELECT $1::jsonb AS doc),
changed AS (
  UPDATE project_blueprints pb SET approval_status=payload.doc->>'decision',approved_at=NOW(),approved_by=payload.doc->>'reviewer',updated_at=NOW()
  FROM payload WHERE pb.request_id=(payload.doc->>'requestDbId')::uuid AND pb.approval_status='pending'
  RETURNING pb.request_id,pb.solution_blueprint,pb.risk_review,pb.effort_estimate,pb.approval_status,pb.approved_at,pb.approved_by
),
state_updated AS (
  UPDATE project_requests request SET status=changed.approval_status,updated_at=NOW() FROM changed WHERE request.id=changed.request_id RETURNING request.id
),
audited AS (
  INSERT INTO audit_events(request_id,event_type,actor,details)
  SELECT changed.request_id,CASE changed.approval_status WHEN 'approved' THEN 'operations-hub.approved' ELSE 'operations-hub.rejected' END,changed.approved_by,jsonb_build_object('decision',changed.approval_status,'revisionNotes',NULLIF(payload.doc->>'revisionNotes',''),'executionGate',false,'localOnly',true)
  FROM changed CROSS JOIN payload RETURNING id
)
SELECT payload.doc->>'requestDbId' AS request_db_id,COALESCE(changed.approval_status,'not-found-or-already-reviewed') AS status,payload.doc->>'reviewer' AS reviewer,changed.approved_at,changed.solution_blueprint,changed.risk_review,changed.effort_estimate,(SELECT COUNT(*) FROM audited)::int AS audit_events_written FROM payload LEFT JOIN changed ON TRUE;`;
await writeWorkflow('08-operations-hub-review-api.json', review);

if (!outputOnly) console.log('Hardened workflow exports 01, 02, 07 and 08.');
