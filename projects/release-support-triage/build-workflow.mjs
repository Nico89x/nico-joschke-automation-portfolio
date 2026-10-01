import { writeFile } from 'node:fs/promises';
import { IntegrationError, normalizeRelease, prepareDraft, validateTicket, RELEASE_URL } from './triage.mjs';
const code = [IntegrationError.toString(), normalizeRelease.toString(), validateTicket.toString(), prepareDraft.toString()].join('\n');
const workflow = {
  name: 'Release Watch - Support Draft (read-only)', active: false,
  nodes: [
    { id:'release-start',name:'Manual synthetic demo',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,0],parameters:{} },
    { id:'release-http',name:'Read public n8n release',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[240,0],onError:'continueRegularOutput',parameters:{method:'GET',url:RELEASE_URL,sendHeaders:true,headerParameters:{parameters:[{name:'Accept',value:'application/vnd.github+json'},{name:'X-GitHub-Api-Version',value:'2022-11-28'}]},options:{timeout:6000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}}}} },
    { id:'release-review',name:'Validate metadata and stop for human review',type:'n8n-nodes-base.code',typeVersion:2,position:[480,0],parameters:{jsCode:code+`\ntry {\n if($json.statusCode!==200) throw new IntegrationError('upstream_unavailable');\n const release=normalizeRelease($json.body);\n return [{json:prepareDraft({id:'synthetic-n8n-demo',product:'n8n',category:'update-question',installedVersion:'2.0.0'},release)}];\n} catch { return [{json:{status:'manual-review-required',error:'upstream_or_contract_error',executionGate:false,externalActions:{messagesSent:0,ticketsChanged:0,updatesInstalled:0}}}]; }`} }
  ],
  connections:{'Manual synthetic demo':{main:[[{node:'Read public n8n release',type:'main',index:0}]]},'Read public n8n release':{main:[[{node:'Validate metadata and stop for human review',type:'main',index:0}]]}},
  settings:{executionOrder:'v1'}, tags:[]
};
await writeFile(new URL('workflow.sanitized.json',import.meta.url),JSON.stringify(workflow,null,2)+'\n');
