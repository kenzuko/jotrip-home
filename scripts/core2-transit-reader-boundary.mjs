import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const ACCOUNT='1a64a0a081ea758f72be8254030bdf11',NAME='openpq-intelligence-transit-reader';
const CODE='7af398a88d0875d4be79a802923fa2229f7ff81b',ORIGIN='https://'+NAME+'.kenzuko.workers.dev';
const root='.core2-transit-reader-boundary',proof={status:'RUNNING',code_sha:CODE,release_sha:process.env.GITHUB_SHA,account_id:ACCOUNT,target:NAME,mode:'LEGACY',canonical_transferred:false,public_app_switched:false,producer_independent:false,started_at:new Date().toISOString()};
await mkdir(root,{recursive:true});
const save=()=>writeFile(root+'/PROOF.json',JSON.stringify(proof,null,2)+'\n');
if(process.env.CLOUDFLARE_ACCOUNT_ID?.trim()!==ACCOUNT)throw Error('PRODUCTION_ACCOUNT_PIN_REQUIRED');
const token=process.env.CLOUDFLARE_API_TOKEN?.trim();if(!token)throw Error('EXISTING_WORKER_DEPLOY_TOKEN_REQUIRED');
async function api(path,method='GET'){
 if(method!=='GET'&&!(method==='DELETE'&&path==='/workers/scripts/'+NAME))throw Error('READER_RELEASE_WRITE_SCOPE_DENIED');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{authorization:'Bearer '+token}});
 if(method==='DELETE'&&r.status===404)return null;
 const b=await r.json();if(!r.ok||b.success!==true)throw Error('READER_RELEASE_API_HTTP_'+r.status);return b.result;
}
const protectedNames=['openphuquoc-v3','jotrip-airport-live'];
async function versions(){return Object.fromEntries(await Promise.all(protectedNames.map(async name=>[name,(await api('/workers/scripts/'+name+'/deployments')).deployments[0].versions])));}
const sha=raw=>createHash('sha256').update(raw).digest('hex');
let created=false;
try{
 const ci=await fetch('https://api.github.com/repos/kenzuko/openpq-intelligence/actions/runs?head_sha='+CODE+'&per_page=20',{redirect:'error',signal:AbortSignal.timeout(15000),headers:{accept:'application/vnd.github+json'}});
 if(!ci.ok)throw Error('PINNED_CODE_CI_UNAVAILABLE');const runs=(await ci.json()).workflow_runs;
 if(!runs.some(r=>r.head_sha===CODE&&r.name==='Isolated foundation verification'&&r.status==='completed'&&r.conclusion==='success'))throw Error('PINNED_CODE_CI_NOT_PASSED');
 proof.code_ci_runs=runs.filter(r=>r.head_sha===CODE&&r.name==='Isolated foundation verification').map(r=>({id:r.id,status:r.status,conclusion:r.conclusion}));
 const scripts=await api('/workers/scripts');if(scripts.some(s=>s.id===NAME))throw Error('READER_TARGET_ALREADY_EXISTS_REINVENTORY_REQUIRED');
 proof.protected_before=await versions();
 const config=JSON.parse(await (await import('node:fs/promises')).readFile('core2/.transit-transfer/consumer.json','utf8'));
 if(config.name!==NAME||config.account_id!==ACCOUNT||config.routes.length!==0||config.vars.TRANSIT_READER_MODE!=='LEGACY'||config.services||config.r2_buckets||config.durable_objects)throw Error('READER_DEPLOY_CONFIG_DENIED');
 // This is the only deployment target. No command, R2, native or signing binding is installed.
 const deploy=spawnSync('node_modules/.bin/wrangler',['deploy','--config','.transit-transfer/consumer.json'],{cwd:'core2',encoding:'utf8',timeout:90000,env:{...process.env,CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false'}});
 if(deploy.status!==0)throw Error('READER_DEPLOY_FAILED');created=true;
 proof.probes=[];let witness;const deadline=Date.now()+180000;
 for(let n=0;n<45&&Date.now()<deadline;n++){
  try{
   const r=await fetch(ORIGIN+'/network.json',{redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(15000,deadline-Date.now())))});
   const raw=await r.text();let d;try{d=JSON.parse(raw);}catch{}
   proof.probes.push({attempt:n,http_status:r.status,content_type:r.headers.get('content-type'),reader:r.headers.get('x-openpq-reader'),body_digest:sha(raw),source_digest:r.headers.get('x-openpq-source-digest'),error:typeof d?.error==='string'&&/^[A-Z0-9_]+$/.test(d.error)?d.error:null});await save();
   if(r.ok&&d?.schema_version==='1.1'&&r.headers.get('x-openpq-reader')==='LEGACY'&&r.headers.get('x-openpq-source-digest')===sha(raw)&&r.headers.get('cache-control')==='no-store'&&r.headers.get('access-control-allow-origin')==='*'){
    witness={checked_at:new Date().toISOString(),status:r.status,source_digest:sha(raw),generated_at:d.generated_at,departures:d.departures?.length,services:d.services?.length};
    await writeFile(root+'/GATEWAY_SOURCE.json',raw);break;
   }
  }catch{proof.probes.push({attempt:n,error:'PROBE_TRANSPORT_UNAVAILABLE'});await save();}
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 if(!witness)throw Error('READER_DATA_WITNESS_UNAVAILABLE');proof.gateway_witness=witness;
 const direct=await fetch('https://raw.githubusercontent.com/kenzuko/transit-jotrip/main/data/network.json',{redirect:'error',signal:AbortSignal.timeout(15000)});if(!direct.ok)throw Error('LEGACY_SOURCE_WITNESS_UNAVAILABLE');const raw=await direct.text();
 proof.direct_source_digest=sha(raw);if(proof.direct_source_digest!==witness.source_digest)throw Error('READER_SOURCE_CHANGED_OR_PARITY_FAILED');await writeFile(root+'/DIRECT_SOURCE.json',raw);
 proof.denied_methods=[];
 for(const method of ['POST','PUT','DELETE']){const r=await fetch(ORIGIN+'/network.json',{method,redirect:'error',signal:AbortSignal.timeout(15000)});proof.denied_methods.push({method,status:r.status});if(r.status!==405)throw Error('READER_WRITE_ROUTE_NOT_DENIED');}
 const head=await fetch(ORIGIN+'/network.json',{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(15000)});proof.head_status=head.status;if(head.status!==200||(await head.text())!=='')throw Error('READER_HEAD_CONTRACT_FAILED');
 proof.protected_after=await versions();if(JSON.stringify(proof.protected_before)!==JSON.stringify(proof.protected_after))throw Error('PROTECTED_VERSION_CHANGED_DURING_RELEASE');
 proof.current_deployment=(await api('/workers/scripts/'+NAME+'/deployments')).deployments[0];
 proof.status='LEGACY_READER_BOUNDARY_DEPLOYED_EXACT_SOURCE_PARITY';proof.finished_at=new Date().toISOString();await save();console.log(JSON.stringify({status:proof.status,target:NAME,canonical_transferred:false,public_app_switched:false}));
}catch(e){
 proof.status='READER_BOUNDARY_NOT_ACCEPTED';proof.error=/^[A-Z0-9_]+$/.test(e.message)?e.message:'READER_BOUNDARY_FAILED';
 if(created){try{await api('/workers/scripts/'+NAME,'DELETE');proof.cleanup='NEW_UNACCEPTED_TARGET_REMOVED';}catch{proof.cleanup='NEW_TARGET_REMOVAL_UNVERIFIED';}}
 proof.finished_at=new Date().toISOString();await save();console.error(proof.error);process.exitCode=1;
}
