import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const name='hube2e'+randomBytes(6).toString('hex');
const env={...process.env,E2E_DB_PASSWORD:randomBytes(24).toString('hex'),E2E_ENCRYPTION_KEY:randomBytes(32).toString('hex')};
const args=['compose','--project-name',name,'-f','compose.e2e.yml'];
let started=false;const checks=[];
function docker(parts,{input,quiet=false}={}){
  const r=spawnSync('docker',[...args,...parts],{cwd:root,env,input,encoding:'utf8',timeout:360000,maxBuffer:8*1024*1024});
  if(r.error||r.status!==0)throw new Error('Docker command failed: '+parts.slice(0,3).join(' ')+'; check Docker access and logs locally.');
  if(!quiet&&r.stdout)console.log(r.stdout.trim());return r.stdout.trim();
}
async function post(base,path,body,status){
  const response=await fetch(base+'/webhook/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
  assert.equal(response.status,status,path+' HTTP status');return response.json();
}
function intake(key){return{companyName:'Synthetic E2E GmbH',processDescription:'Synthetic website inquiries are copied manually into a CRM. Validate fields, prevent duplicate deliveries and prepare a reviewable automation proposal.',currentTools:['n8n','HubSpot'],goals:['Prevent duplicate records'],constraints:{dataSensitivity:'internal',requiresHumanApproval:true},idempotencyKey:key};}
function pass(check){checks.push(check);console.log('PASS: '+check);}
try{
  // No normal Compose file, existing volumes, API keys or owner credentials are used.
  docker(['config','--quiet'],{quiet:true});
  const fixture=join(root,'.e2e-local');await mkdir(fixture,{recursive:true});
  await writeFile(join(fixture,'credentials.json'),JSON.stringify([{id:'portfolio-e2e-db',name:'Synthetic isolated PostgreSQL',type:'postgres',data:{host:'postgres',database:'portfolio_e2e',user:'portfolio_e2e',password:env.E2E_DB_PASSWORD,port:5432,ssl:'disable'}}]));
  const definitions=[];
  for(const file of (await readdir(join(root,'workflows'))).filter(f=>f.endsWith('.json')).sort()){
    const workflow=JSON.parse(await readFile(join(root,'workflows',file),'utf8'));
    workflow.id='e2e'+file.slice(0,2);workflow.active=false;workflow.versionId=randomUUID();
    for(const node of workflow.nodes){if(node.type==='n8n-nodes-base.postgres')node.credentials={postgres:{id:'portfolio-e2e-db',name:'Synthetic isolated PostgreSQL'}};}
    definitions.push(workflow);
  }
  await writeFile(join(fixture,'workflows.json'),JSON.stringify(definitions));
  started=true;docker(['up','-d','--wait','--wait-timeout','300']);
  pass('new randomly named stack healthy; PostgreSQL not exposed to host');
  const mapping=docker(['port','n8n','5678'],{quiet:true});
  assert.match(mapping,/^127\.0\.0\.1:\d+$/);let base='http://'+mapping;
  const health=await fetch(base+'/healthz',{signal:AbortSignal.timeout(10000)});assert.equal(health.status,200);
  docker(['exec','-T','n8n','n8n','import:credentials','--input=/files/fixture/credentials.json'],{quiet:true});
  docker(['exec','-T','n8n','n8n','import:workflow','--input=/files/fixture/workflows.json'],{quiet:true});
  // All ten exports are imported; only the four local routes needed here are published.
  for(const id of ['e2e02','e2e03','e2e07','e2e08'])docker(['exec','-T','n8n','n8n','publish:workflow','--id='+id],{quiet:true});
  docker(['restart','n8n']);
  // Docker may assign a new ephemeral host port when the container restarts.
  const restartedMapping=docker(['port','n8n','5678'],{quiet:true});
  assert.match(restartedMapping,/^127\.0\.0\.1:\d+$/);base='http://'+restartedMapping;
  let healthy=false;
  for(let i=0;i<60;i++){try{healthy=(await fetch(base+'/healthz',{signal:AbortSignal.timeout(2000)})).status===200;}catch{}if(healthy)break;await new Promise(r=>setTimeout(r,1000));}
  assert.ok(healthy,'restarted n8n healthy');
  // Give webhook registration a bounded interval after the restart.
  await new Promise(r=>setTimeout(r,3000));
  for(const file of (await readdir(join(root,'knowledge/base'))).filter(f=>f.endsWith('.md')).sort()){
    const result=await post(base,'knowledge-base-ingest',{sourceId:file.slice(0,-3),sourceName:file.slice(0,-3).replaceAll('-',' '),content:await readFile(join(root,'knowledge/base',file),'utf8'),tags:['synthetic','e2e']},202);
    assert.equal(result.status,'accepted');
  }
  pass('all ten workflows imported; credential mapping and five-document ingestion verified');
  const key='clean-e2e-'+name, first=intake(key);
  const plan=await post(base,'operations-hub',first,202);assert.equal(plan.status,'awaiting-human-review');assert.equal(plan.executionGate,false);assert.equal(plan.auditEventsWritten,6);assert.ok(plan.requestDbId);
  pass('planning HTTP 202, six stage audits, execution gate closed');
  const duplicate=await post(base,'operations-hub',first,200);assert.equal(duplicate.status,'duplicate');assert.equal(duplicate.requestDbId,plan.requestDbId);pass('duplicate resolves to original request');
  const decision={requestDbId:plan.requestDbId,decision:'approved',reviewer:'Synthetic E2E Reviewer'};
  const approved=await post(base,'operations-hub-review',decision,200);assert.equal(approved.status,'approved-local-draft-prepared');assert.equal(approved.executionGate,false);assert.deepEqual(approved.localDemo.externalActions,{crmWrites:0,tasksCreated:0,messagesSent:0});pass('human approval prepares local draft only');
  const replay=await post(base,'operations-hub-review',decision,409);assert.equal(replay.auditEventsWritten,0);pass('replayed decision HTTP 409, no extra review event');
  const invalid=await post(base,'operations-hub',{...intake(key+'-invalid'),companyName:'X'},422);assert.ok(invalid.errors.length);pass('invalid intake HTTP 422');
  const second=await post(base,'operations-hub',intake(key+'-reject'),202);
  const rejected=await post(base,'operations-hub-review',{requestDbId:second.requestDbId,decision:'rejected',reviewer:'Synthetic E2E Reviewer'},200);assert.equal(rejected.status,'rejected-blocked');assert.equal(rejected.executionGate,false);assert.equal(rejected.localDemo.proposal,null);pass('rejection blocks draft');
  const counts=docker(['exec','-T','postgres','psql','-U','portfolio_e2e','-d','portfolio_e2e','-Atc',"SELECT json_build_object('requests',(SELECT count(*) FROM project_requests WHERE source='n8n-intake'),'blueprints',(SELECT count(*) FROM project_blueprints),'reviews',(SELECT count(*) FROM audit_events WHERE event_type LIKE '%review%'))"],{quiet:true});
  const db=JSON.parse(counts);assert.equal(db.requests,2);assert.equal(db.blueprints,2);pass('two accepted requests and two blueprints persisted in fresh PostgreSQL');
  await writeFile(join(root,'.e2e-local','result.json'),JSON.stringify({status:'passed',checkedAt:new Date().toISOString(),project:name,checks,db,scope:'real Docker + n8n + PostgreSQL HTTP routes; no LLM or external SaaS writes'},null,2));
  console.log('PASS: complete clean-stack route check. Result in .e2e-local/result.json');
}catch(error){
  if(started){try{
    const diagnostics=docker(['logs','--no-color','--tail','80','n8n'],{quiet:true});
    console.error(diagnostics.replaceAll(env.E2E_DB_PASSWORD,'[redacted]').replaceAll(env.E2E_ENCRYPTION_KEY,'[redacted]'));
  }catch{console.error('Isolated n8n diagnostics unavailable.');}}
  throw error;
}finally{
  if(started){try{docker(['stop'],{quiet:true});}catch{console.error('Could not stop isolated test project '+name);}}
  console.log('Isolated project: '+name+'. Containers and volumes are preserved; no existing project was stopped or deleted. Generated secrets remain in ignored .e2e-local, never upload that folder.');
}
