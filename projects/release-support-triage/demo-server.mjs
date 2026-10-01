import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createTriage, fetchRelease, IntegrationError } from './triage.mjs';
const live=createTriage();
const mockLimited=createTriage({loadRelease:()=>fetchRelease({fetchImpl:async()=>new Response('',{status:429}),sleep:async()=>{}})});
const server=http.createServer(async(req,res)=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  try {
    if(req.headers.host!==`127.0.0.1:${server.address().port}`){res.writeHead(403,headers);res.end('{}');return;}
    if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"});res.end(await readFile(new URL('demo.html',import.meta.url)));return;}
    if(req.method==='GET'&&req.url==='/demo.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(await readFile(new URL('demo.js',import.meta.url)));return;}
    if(req.method!=='POST'||!['/triage','/simulate-rate-limit'].includes(req.url)){res.writeHead(404,headers);res.end('{}');return;}
    if(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${server.address().port}`){res.writeHead(403,headers);res.end('{}');return;}
    let size=0;const chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>4096){res.writeHead(413,headers);res.end('{"error":"request_too_large"}');return;}chunks.push(chunk);}
    let ticket;try{ticket=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new IntegrationError('invalid_ticket');}
    const simulated=req.url==='/simulate-rate-limit';
    const result=await(simulated?mockLimited:live)(ticket);
    res.writeHead(200,headers);res.end(JSON.stringify({source:simulated?'simulated-rate-limit':'real-public-GitHub-API',result}));
  }catch(error){const code=error instanceof IntegrationError?error.code:'internal_error';res.writeHead(code==='invalid_ticket'?422:code==='idempotency_conflict'?409:503,headers);res.end(JSON.stringify({error:code,executionGate:false,messagesSent:0}));}
});
server.listen(15741,'127.0.0.1',()=>console.log('Demo: http://127.0.0.1:15741 (Node adapter, NOT a live n8n execution)'));
