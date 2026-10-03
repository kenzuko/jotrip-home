// Read-only capability inventory for the normal consumer transfer, never a recovery drill.
import {mkdir,writeFile} from 'node:fs/promises';
const ACCOUNT='1a64a0a081ea758f72be8254030bdf11';
const root='.core2-production-inventory';
if(process.env.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT)throw Error('PRODUCTION_ACCOUNT_PIN_REQUIRED');
if(!process.env.CLOUDFLARE_API_TOKEN)throw Error('EXISTING_DEPLOY_CREDENTIAL_UNAVAILABLE');
const report={contract:'openpq-normal-transfer-capability-inventory-v1',read_only:true,
  account_id:ACCOUNT,code_sha:process.env.GITHUB_SHA??null,started_at:new Date().toISOString(),
  public_cutover_executed:false,credentials_created:false,permissions_broadened:false,reads:[]};
async function get(path){
  const row={path,method:'GET',status:'UNKNOWN'};report.reads.push(row);
  try{
    const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+path,
      {method:'GET',headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});
    row.http_status=response.status;
    const body=await response.json();row.status=response.ok&&body.success===true?'READ_ALLOWED':'READ_DENIED_OR_FAILED';
    if(row.status!=='READ_ALLOWED')return null;
    return body;
  }catch{row.status='READ_UNAVAILABLE';return null;}
}
const [scripts,buckets,namespaces]=await Promise.all([
  get('/workers/scripts'),get('/r2/buckets'),get('/workers/durable_objects/namespaces')]);
report.workers=scripts?.result?.map(x=>({id:x.id}))??null;
report.worker_inventory_complete=Boolean(Array.isArray(scripts?.result)&&(!scripts.result_info?.total_count||scripts.result_info.total_count<=scripts.result.length));
report.buckets=buckets?.result?.buckets?.map(x=>({name:x.name,jurisdiction:x.jurisdiction??'default'}))??null;
report.bucket_inventory_complete=Boolean(Array.isArray(buckets?.result?.buckets)&&!buckets.result.cursor);
report.namespaces=namespaces?.result?.map(x=>({id:x.id,script:x.script,class:x.class}))??null;
report.namespace_inventory_complete=Boolean(Array.isArray(namespaces?.result)&&(!namespaces.result_info?.total_count||namespaces.result_info.total_count<=namespaces.result.length));
if(report.workers?.some(x=>x.id==='openphuquoc-v3')){
  const [settings,deployments]=await Promise.all([
    get('/workers/scripts/openphuquoc-v3/settings'),get('/workers/scripts/openphuquoc-v3/deployments')]);
  // Never serialize binding values: text, secrets and arbitrary provider responses stay private.
  report.public_worker_bindings=settings?.result?.bindings?.map(x=>({name:x.name,type:x.type}))??null;
  report.public_worker_deployments=deployments?.result?.deployments?.map(x=>({id:x.id,versions:x.versions?.map(v=>({version_id:v.version_id,percentage:v.percentage}))}))??null;
}
report.finished_at=new Date().toISOString();
report.status=report.worker_inventory_complete&&report.bucket_inventory_complete&&report.namespace_inventory_complete?'READ_ONLY_INVENTORY_COMPLETE':'READ_ONLY_INVENTORY_PARTIAL';
await mkdir(root,{recursive:true});await writeFile(root+'/INVENTORY.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,account_id:ACCOUNT,workers:report.workers?.length??null,buckets:report.buckets?.length??null,namespaces:report.namespaces?.length??null,public_cutover_executed:false}));
