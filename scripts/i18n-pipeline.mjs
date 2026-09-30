import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";

const ROOT=process.cwd();
const CONFIG_PATH="cms/translation-pipeline.json";
const LIFECYCLE_PATH="cms/translation-lifecycle.json";
const MEMORY_PATH="cms/translation-memory.json";
const readJson=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),"utf8"));
const writeJson=(file,data)=>{
  const full=path.join(ROOT,file);
  fs.mkdirSync(path.dirname(full),{recursive:true});
  fs.writeFileSync(full,JSON.stringify(data,null,2)+"\n","utf8");
};
const sha=text=>crypto.createHash("sha256").update(String(text),"utf8").digest("hex");
const blobSha=file=>execFileSync("git",["hash-object",file],{encoding:"utf8"}).trim();
const clone=value=>structuredClone(value);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function args(argv){
  const out={_:[]};
  for(let i=2;i<argv.length;i++){
    const token=argv[i];
    if(!token.startsWith("--")){out._.push(token);continue;}
    const key=token.slice(2),next=argv[i+1];
    out[key]=next&&!next.startsWith("--")?argv[++i]:true;
  }
  return out;
}

function matches(value,parts,base=[],out=[]){
  if(!parts.length){if(typeof value==="string"&&value.trim())out.push({path:base,value});return out;}
  const [head,...tail]=parts;
  if(head==="*"){
    if(Array.isArray(value))value.forEach((item,index)=>matches(item,tail,[...base,index],out));
    else if(value&&typeof value==="object")Object.entries(value).forEach(([key,item])=>matches(item,tail,[...base,key],out));
    return out;
  }
  if(value&&typeof value==="object"&&head in value)matches(value[head],tail,[...base,head],out);
  return out;
}

function stringLeaves(value,base=[],out=[],excluded=new Set()){
  if(typeof value==="string"){if(value.trim())out.push({path:base,value});return out;}
  if(Array.isArray(value)){value.forEach((item,index)=>stringLeaves(item,[...base,index],out,excluded));return out;}
  if(value&&typeof value==="object")for(const [key,item] of Object.entries(value)){
    if(!base.length&&excluded.has(key))continue;
    stringLeaves(item,[...base,key],out,excluded);
  }
  return out;
}

function getAt(value,parts){return parts.reduce((cur,key)=>cur?.[key],value)}
function setAt(value,parts,next){
  let cur=value;
  for(let i=0;i<parts.length-1;i++){
    const key=parts[i],following=parts[i+1];
    if(cur[key]==null)cur[key]=typeof following==="number"?[]:{};
    cur=cur[key];
  }
  cur[parts.at(-1)]=next;
}

function protectedTokens(text){
  const patterns=[
    /https?:\/\/[^\s)\]}>"']+/g,
    /\{[A-Za-z0-9_.-]+\}/g,
    /\b\d{1,2}:\d{2}\b/g,
    /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g,
    /\b\d+(?:[.,]\d+)?\s?(?:%|km|m|cm|mm|kg|g|ml|l|VND|đ|₫|USD|EUR)\b/gi,
    /(?:\+?84|0)(?:[ .-]?\d){8,10}\b/g
  ];
  const found=[];
  for(const pattern of patterns)for(const match of text.matchAll(pattern))found.push(match[0]);
  return [...new Set(found)].sort((a,b)=>b.length-a.length);
}

const regexSpecial=new Set("\\^$.*+?()[]{}|".split(""));
const regexEscape=value=>[...String(value)].map(char=>regexSpecial.has(char)?"\\"+char:char).join("");
const htmlEscape=value=>String(value).replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
function protect(text){
  const tokens=protectedTokens(text);let output=String(text);
  const markers=tokens.map((token,index)=>{
    const encoded=htmlEscape(token),lock="OPENPQLOCK"+index+"XQZ";
    return {token,encoded,lock,marker:'<span translate="no" class="notranslate">'+lock+'</span>'};
  });
  for(const {token,marker} of markers)output=output.split(token).join(marker);
  return {text:output,markers};
}
function restore(text,markers){
  let output=String(text);
  for(const {token,encoded,lock} of markers){
    const tag=new RegExp("<span\\b[^>]*>\\s*"+regexEscape(lock)+"\\s*<\\/span>","gi");
    output=output.replace(tag,token);
    output=output.split(lock).join(token);
    if(encoded!==token)output=output.split(encoded).join(token);
    if(!output.includes(token))throw new Error("Azure changed a protected token: "+token);
  }
  if(/OPENPQLOCK\d+XQZ/.test(output))throw new Error("Unresolved protected token in translated text");
  return output;
}

function familyJobs(config,familyId){
  const family=config.families[familyId];
  if(!family)throw new Error("Unknown family: "+familyId);
  const source=readJson(family.source_path),jobs=[];
  if(family.mode==="document"){
    for(const row of stringLeaves(source,[],[],new Set(family.exclude_root_keys||[])))jobs.push({...row,recordId:null});
  }else{
    const records=source[family.collection];
    if(!Array.isArray(records))throw new Error(family.source_path+" missing "+family.collection);
    records.forEach((record,index)=>{
      const recordId=record?.[family.id_field];
      if(!recordId)throw new Error(familyId+" record missing "+family.id_field+" at "+index);
      for(const pattern of family.fields||[])for(const row of matches(record,pattern.split("."))){
        jobs.push({...row,path:[family.collection,index,...row.path],recordPath:row.path,recordId});
      }
    });
  }
  return {family,source,jobs};
}

function targetSkeleton(familyId,family,source,locale){
  if(family.mode==="document"){
    const out=clone(source);out.locale=locale;out.updated_at=new Date().toISOString().slice(0,10);return out;
  }
  if(family.mode==="document_records"){
    const out=clone(source);out.locale=locale;return out;
  }
  return {schema_version:"1.0",locale,[family.collection]:(source[family.collection]||[]).map(row=>({[family.id_field]:row[family.id_field]}))};
}

function targetJobPath(family,job){
  if(family.mode!=="overlay")return job.path;
  const sourceIndex=job.path[1];
  return [family.collection,sourceIndex,...job.recordPath];
}

function batches(items){
  const out=[];let batch=[],chars=0;
  for(const item of items){
    const size=item.protected.text.length;
    if(size>5000)throw new Error("One translation field exceeds Azure 5,000-character limit: "+item.label);
    if(batch.length&&(batch.length>=25||chars+size>4800)){out.push(batch);batch=[];chars=0;}
    batch.push(item);chars+=size;
  }
  if(batch.length)out.push(batch);return out;
}

async function azureTranslate(items,locale,config){
  const key=process.env.AZURE_TRANSLATOR_KEY;
  if(!key)throw new Error("AZURE_TRANSLATOR_KEY is required with --apply");
  const endpoint=String(process.env.AZURE_TRANSLATOR_ENDPOINT||"https://api.cognitive.microsofttranslator.com").replace(/\/$/,"");
  if(!/^https:\/\//.test(endpoint))throw new Error("AZURE_TRANSLATOR_ENDPOINT must use https");
  const to=config.azure_locale_map[locale];
  if(!to)throw new Error("No Azure locale mapping for "+locale);
  const url=new URL(endpoint+"/translate");
  url.searchParams.set("api-version","3.0");url.searchParams.set("from","vi");url.searchParams.set("textType","html");url.searchParams.append("to",to);
  const maxAttempts=6;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    const headers={"Content-Type":"application/json","Ocp-Apim-Subscription-Key":key,"X-ClientTraceId":crypto.randomUUID()};
    if(process.env.AZURE_TRANSLATOR_REGION)headers["Ocp-Apim-Subscription-Region"]=process.env.AZURE_TRANSLATOR_REGION;
    const response=await fetch(url,{method:"POST",headers,body:JSON.stringify(items.map(item=>({Text:item.protected.text})))});
    const body=await response.json().catch(()=>null);
    if(response.ok){
      if(!Array.isArray(body)||body.length!==items.length)throw new Error("Azure response count mismatch");
      return body.map((row,index)=>restore(row?.translations?.[0]?.text??"",items[index].protected.markers));
    }
    const retryable=response.status===429||response.status>=500;
    if(!retryable||attempt===maxAttempts)throw new Error("Azure Translator failed ("+response.status+"): "+String(body?.error?.message||"unknown error"));
    const retryHeader=response.headers.get("retry-after");
    const retrySeconds=retryHeader&&/^\d+$/.test(retryHeader)?Number(retryHeader):0;
    const waitMs=Math.max(retrySeconds*1000,Math.min(60000,2000*2**(attempt-1)));
    console.warn("Azure "+response.status+"; retry "+(attempt+1)+"/"+maxAttempts+" after "+Math.ceil(waitMs/1000)+"s");
    await sleep(waitMs);
  }
  throw new Error("Azure Translator retry loop ended unexpectedly");
}

function loadMemory(){return fs.existsSync(MEMORY_PATH)?readJson(MEMORY_PATH):{version:"1.0",provider:"azure-translator-v3",entries:{}}}
function lifecycleFamily(lifecycle,id){
  const family=lifecycle.families.find(row=>row.id===id);
  if(!family)throw new Error("Translation lifecycle missing family: "+id);
  return family;
}

function printPlan(config,familyId,locale){
  const {family,jobs}=familyJobs(config,familyId),characters=jobs.reduce((sum,row)=>sum+row.value.length,0);
  const target=family.target_path_pattern.replace("{locale}",locale);
  console.log(JSON.stringify({family:familyId,locale,source:family.source_path,target,fields:jobs.length,characters,azure_requests_at_most:batches(jobs.map((job,index)=>({label:String(index),protected:protect(job.value)}))).length,mode:"plan_only"},null,2));
}

async function translate(config,a){
  const familyId=a.family,locale=a.locale;
  if(!familyId||!locale)throw new Error("translate requires --family and --locale");
  if(locale===config.source_locale)throw new Error("Target locale cannot be Vietnamese");
  if(!config.azure_locale_map[locale])throw new Error("Unsupported target locale: "+locale);
  if(!a.apply){printPlan(config,familyId,locale);return;}

  const {family,source,jobs}=familyJobs(config,familyId);
  const lifecycle=readJson(LIFECYCLE_PATH),lifeFamily=lifecycleFamily(lifecycle,familyId),state=lifeFamily.targets[locale];
  if(!state)throw new Error("Lifecycle target missing: "+familyId+"/"+locale);
  if(["human_review","published"].includes(state.status)&&!a["force-machine-overwrite"]){
    throw new Error("Refusing to overwrite "+state.status+" translation. Use --force-machine-overwrite only after explicit review decision.");
  }
  const targetPath=family.target_path_pattern.replace("{locale}",locale),target=targetSkeleton(familyId,family,source,locale);
  const memory=loadMemory();memory.entries[locale]||={};
  const pending=[];
  for(const [index,job] of jobs.entries()){
    const key=sha(job.value),cached=memory.entries[locale][key];
    if(cached?.source===job.value&&typeof cached.translation==="string")setAt(target,targetJobPath(family,job),cached.translation);
    else pending.push({index,job,label:familyId+":"+(job.recordId||"document")+":"+job.path.join("."),protected:protect(job.value),key});
  }
  const pendingBatches=batches(pending);
  for(const [batchIndex,batch] of pendingBatches.entries()){
    const translations=await azureTranslate(batch,locale,config);
    batch.forEach((item,index)=>{
      const translated=translations[index];
      if(!translated.trim())throw new Error("Azure returned an empty translation for "+item.label);
      setAt(target,targetJobPath(family,item.job),translated);
      memory.entries[locale][item.key]={source:item.job.value,translation:translated,updated_at:new Date().toISOString()};
    });
    writeJson(MEMORY_PATH,memory);
    if(batchIndex<pendingBatches.length-1){
      const chars=batch.reduce((sum,item)=>sum+item.protected.text.length,0);
      const hourlyRate=Number(process.env.AZURE_TRANSLATOR_CHARS_PER_HOUR||1900000);
      const waitMs=Math.max(1000,Math.ceil(chars*3600000/hourlyRate));
      console.warn("Azure F0 pacing: waiting "+Math.ceil(waitMs/1000)+"s before next batch");
      await sleep(waitMs);
    }
  }
  const revision=blobSha(family.source_path);
  writeJson(targetPath,target);writeJson(MEMORY_PATH,memory);
  Object.assign(state,{status:"machine_draft",target_path:targetPath,translated_from_blob_sha:revision,reviewed_by:null,reviewed_at:null,published_at:null,note:"Azure Translator v3 machine draft; human review required."});
  writeJson(LIFECYCLE_PATH,lifecycle);
  console.log(JSON.stringify({ok:true,family:familyId,locale,target:targetPath,source_revision:revision,fields:jobs.length,azure_fields:pending.length,memory_hits:jobs.length-pending.length,status:"machine_draft"},null,2));
}

function inventory(config){
  const lifecycle=readJson(LIFECYCLE_PATH),rows=[];
  for(const [id,family] of Object.entries(config.families)){
    const {jobs}=familyJobs(config,id),characters=jobs.reduce((sum,row)=>sum+row.value.length,0),life=lifecycleFamily(lifecycle,id);
    rows.push({family:id,source:family.source_path,fields:jobs.length,characters,targets:Object.fromEntries(Object.entries(life.targets).map(([locale,state])=>[locale,state.status]))});
  }
  console.log(JSON.stringify({source_locale:config.source_locale,families:rows},null,2));
}

function validate(config){
  const lifecycle=readJson(LIFECYCLE_PATH),errors=[];
  for(const [id,family] of Object.entries(config.families)){
    const life=lifecycleFamily(lifecycle,id),sourceRevision=blobSha(family.source_path);
    for(const [locale,state] of Object.entries(life.targets)){
      if(state.status==="missing")continue;
      const expected=family.target_path_pattern.replace("{locale}",locale);
      if(state.target_path!==expected)errors.push(id+"/"+locale+": target path mismatch");
      if(!fs.existsSync(expected))errors.push(id+"/"+locale+": target missing");
      if(state.status!=="stale"&&state.translated_from_blob_sha!==sourceRevision)errors.push(id+"/"+locale+": source revision mismatch");
    }
  }
  if(errors.length){errors.forEach(error=>console.error("ERROR "+error));process.exitCode=2;return;}
  console.log("PASS i18n pipeline lifecycle and target-path validation");
}

const a=args(process.argv),command=a._[0],config=readJson(CONFIG_PATH);
try{
  if(command==="inventory")inventory(config);
  else if(command==="plan"){
    if(!a.family||!a.locale)throw new Error("plan requires --family and --locale");
    printPlan(config,a.family,a.locale);
  }else if(command==="translate")await translate(config,a);
  else if(command==="validate")validate(config);
  else throw new Error("Usage: node scripts/i18n-pipeline.mjs <inventory|plan|translate|validate> [--family ID --locale CODE --apply]");
}catch(error){console.error("i18n pipeline:",error.message);process.exitCode=1;}
