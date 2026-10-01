const ticket={id:'synthetic-video-001',product:'n8n',category:'update-question',installedVersion:'2.0.0'};
async function run(body,path='/triage'){
  for(const button of document.querySelectorAll('button'))button.disabled=true;
  document.querySelector('#status').textContent=path==='/simulate-rate-limit'?'Simulierter Fehler: maximal drei Versuche':'Verarbeitung läuft …';
  try{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();document.querySelector('#status').textContent=`HTTP ${response.status} · ${data.result?.status??data.error} · Ausführung gesperrt`;document.querySelector('#output').textContent=JSON.stringify(data,null,2);}catch{document.querySelector('#status').textContent='Lokaler Server nicht erreichbar';}
  finally{for(const button of document.querySelectorAll('button'))button.disabled=false;}
}
document.querySelector('#live').onclick=()=>run(ticket);
document.querySelector('#duplicate').onclick=()=>run(ticket);
document.querySelector('#invalid').onclick=()=>run({...ticket,email:'synthetic@example.test'});
document.querySelector('#limited').onclick=()=>run({...ticket,id:'synthetic-rate-limit'},'/simulate-rate-limit');
