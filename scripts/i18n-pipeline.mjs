import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";
import {
  loadGlossary,
  protectForTranslation,
  qualityProblems,
  repairScopeIncludes,
  restoreAfterTranslation,
  scanRejected
} from "./i18n-quality.mjs";

const ROOT=process.cwd();
const CONFIG_PATH="cms/translation-pipeline.json";
const LIFECYCLE_PATH="cms/translation-lifecycle.json";
const MEMORY_PATH="cms/translation-memory.json";
const GLOSSARY=loadGlossary();
const readJson=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),"utf8"));
const writeJson=(file,data)=>{
  const full=path.join(ROOT,file);
  fs.mkdirSync(path.dirname(full),{recursive:true});
  fs.writeFileSync(full,JSON.stringify(data,null,2)+"\n","utf8");
};
const sha256=text=>crypto.createHash("sha256").update(String(text),"utf8").digest("hex");
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

async function azureTranslate(items,targetLocale,fromLocale,config){
  const key=String(process.env.AZURE_TRANSLATOR_KEY||"").trim();
  if(!key)throw new Error("AZURE_TRANSLATOR_KEY is required with --apply");
  const endpoint=String(process.env.AZURE_TRANSLATOR_ENDPOINT||"https://api.cognitive.microsofttranslator.com").trim().replace(/\/$/,"");
  const region=String(process.env.AZURE_TRANSLATOR_REGION||"").trim();
  if(!/^https:\/\//.test(endpoint))throw new Error("AZURE_TRANSLATOR_ENDPOINT must use https");
  const to=config.azure_locale_map[targetLocale];
  const from=config.azure_locale_map[fromLocale]||fromLocale;
  if(!to)throw new Error("No Azure locale mapping for "+targetLocale);
  const url=new URL(endpoint+"/translate");
  url.searchParams.set("api-version","3.0");
  url.searchParams.set("from",from);
  url.searchParams.set("textType","html");
  url.searchParams.append("to",to);
  const payload=JSON.stringify(items.map(item=>({Text:item.protected.text})));
  const request=async useRegion=>{
    const headers={"Content-Type":"application/json","Ocp-Apim-Subscription-Key":key,"X-ClientTraceId":crypto.randomUUID()};
    if(useRegion&&region)headers["Ocp-Apim-Subscription-Region"]=region;
    const response=await fetch(url,{method:"POST",headers,body:payload});
    const body=await response.json().catch(()=>null);
    return {response,body};
  };
  const maxAttempts=6;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    let {response,body}=await request(true);
    if(response.status===401&&region&&endpoint==="https://api.cognitive.microsofttranslator.com"){
      console.warn("Azure returned 401 with region header; retrying global endpoint once without region header");
      ({response,body}=await request(false));
    }
    if(response.ok){
      if(!Array.isArray(body)||body.length!==items.length)throw new Error("Azure response count mismatch");
      return body.map((row,index)=>restoreAfterTranslation(row?.translations?.[0]?.text??"",items[index].protected));
    }
    const retryable=response.status===429||response.status>=500;
    if(response.status===401){
      throw new Error("Azure Translator authentication failed (401). Check key, region/endpoint pairing, and current Azure Translator quota.");
    }
    if(!retryable||attempt===maxAttempts)throw new Error("Azure Translator failed ("+response.status+"): "+String(body?.error?.message||"unknown error"));
    const retryHeader=response.headers.get("retry-after");
    const retrySeconds=retryHeader&&/^\d+$/.test(retryHeader)?Number(retryHeader):0;
    const waitMs=Math.max(retrySeconds*1000,Math.min(60000,2000*2**(attempt-1)));
    console.warn("Azure "+response.status+"; retry "+(attempt+1)+"/"+maxAttempts+" after "+Math.ceil(waitMs/1000)+"s");
    await sleep(waitMs);
  }
  throw new Error("Azure Translator retry loop ended unexpectedly");
}

function loadMemory(){return fs.existsSync(MEMORY_PATH)?readJson(MEMORY_PATH):{version:"1.1",provider:"azure-translator-v3",entries:{}}}
function lifecycleFamily(lifecycle,id){
  const family=lifecycle.families.find(row=>row.id===id);
  if(!family)throw new Error("Translation lifecycle missing family: "+id);
  return family;
}

const pivotCache=new Map();
function pivotBundle(family,pivotLocale){
  if(!pivotLocale)return null;
  const key=family.target_path_pattern.replace("{locale}",pivotLocale);
  if(pivotCache.has(key))return pivotCache.get(key);
  const full=path.join(ROOT,key);
  if(!fs.existsSync(full)){pivotCache.set(key,null);return null;}
  const value=readJson(key);pivotCache.set(key,value);return value;
}

function resolveSource(familyId,family,job,pivotLocale){
  if(pivotLocale){
    const pivot=pivotBundle(family,pivotLocale);
    const candidate=pivot&&getAt(pivot,targetJobPath(family,job));
    if(typeof candidate==="string"&&candidate.trim()&&!scanRejected(pivotLocale,candidate,{glossary:GLOSSARY}).length){
      return {value:candidate,locale:pivotLocale,pivot:true};
    }
  }
  return {value:job.value,locale:"vi",pivot:false};
}

function candidateProblems(source,candidate,locale,familyId,job){
  return qualityProblems(source.value,candidate,{
    fromLocale:source.locale,
    targetLocale:locale,
    familyId,
    recordId:job?.recordId||null,
    path:job?.recordPath||job?.path||[],
    glossary:GLOSSARY
  });
}

function existingTarget(family,locale){
  const file=family.target_path_pattern.replace("{locale}",locale);
  if(!fs.existsSync(path.join(ROOT,file)))return null;
  return readJson(file);
}

function buildWorkPlan(config,familyId,locale,{pivotLocale=null,repairScope="quality"}={}){
  const {family,source,jobs}=familyJobs(config,familyId);
  const current=existingTarget(family,locale);
  const memory=loadMemory();memory.entries[locale]||={};
  const items=[];
  let totalCharacters=0,pivotFields=0,fallbackFields=0,reusedExisting=0,reusedMemory=0;
  for(const [index,job] of jobs.entries()){
    const resolved=resolveSource(familyId,family,job,pivotLocale);
    totalCharacters+=resolved.value.length;
    if(resolved.pivot)pivotFields++;else fallbackFields++;
    const key=sha256(resolved.locale+"\u0000"+resolved.value);
    const legacyKey=resolved.locale==="vi"?sha256(resolved.value):null;
    const cached=memory.entries[locale][key]||(legacyKey?memory.entries[locale][legacyKey]:null);
    const existing=current&&getAt(current,targetJobPath(family,job));
    const force=repairScopeIncludes(repairScope,familyId,job);
    if(!force&&typeof existing==="string"&&!candidateProblems(resolved,existing,locale,familyId,job).length){
      reusedExisting++;continue;
    }
    if(!force&&cached?.source===resolved.value&&typeof cached.translation==="string"&&!candidateProblems(resolved,cached.translation,locale,familyId,job).length){
      reusedMemory++;continue;
    }
    const protectedValue=protectForTranslation(resolved.value,{
      fromLocale:resolved.locale,
      targetLocale:locale,
      familyId,
      recordId:job.recordId||null,
      path:job.recordPath||job.path||[],
      glossary:GLOSSARY
    });
    items.push({index,job,label:familyId+":"+(job.recordId||"document")+":"+job.path.join("."),protected:protectedValue,key,source:resolved});
  }
  const byFrom=new Map();
  for(const item of items){
    if(!byFrom.has(item.source.locale))byFrom.set(item.source.locale,[]);
    byFrom.get(item.source.locale).push(item);
  }
  let requests=0;
  for(const group of byFrom.values())requests+=batches(group).length;
  return {
    family,source,jobs,current,memory,items,
    stats:{
      family:familyId,locale,pivot_locale:pivotLocale||null,repair_scope:repairScope,
      fields:jobs.length,characters:totalCharacters,
      azure_fields:items.length,
      azure_characters_estimate:items.reduce((sum,item)=>sum+item.source.value.length,0),
      azure_requests_at_most:requests,
      pivot_fields:pivotFields,fallback_vi_fields:fallbackFields,
      reused_existing:reusedExisting,reused_memory:reusedMemory
    }
  };
}

function requestedPivot(a,config,locale){
  if(a.pivot==="none"||a.pivot==="vi")return null;
  if(a.pivot)return String(a.pivot);
  return locale==="en"?null:(config.preferred_pivot_locale||null);
}

function printPlan(config,familyId,locale,options={}){
  const plan=buildWorkPlan(config,familyId,locale,options);
  const target=plan.family.target_path_pattern.replace("{locale}",locale);
  console.log(JSON.stringify({...plan.stats,source:plan.family.source_path,target,mode:"plan_only"},null,2));
}

async function translate(config,a){
  const familyId=a.family,locale=a.locale;
  if(!familyId||!locale)throw new Error("translate requires --family and --locale");
  if(locale===config.source_locale)throw new Error("Target locale cannot be Vietnamese");
  if(!config.azure_locale_map[locale])throw new Error("Unsupported target locale: "+locale);
  const pivotLocale=requestedPivot(a,config,locale);
  if(pivotLocale===locale)throw new Error("Pivot locale cannot equal target locale");
  if(pivotLocale&&!config.azure_locale_map[pivotLocale])throw new Error("Unsupported pivot locale: "+pivotLocale);
  const repairScope=String(a["repair-scope"]||"quality");
  if(!a.apply){printPlan(config,familyId,locale,{pivotLocale,repairScope});return;}

  const lifecycle=readJson(LIFECYCLE_PATH),lifeFamily=lifecycleFamily(lifecycle,familyId),state=lifeFamily.targets[locale];
  if(!state)throw new Error("Lifecycle target missing: "+familyId+"/"+locale);
  if(["human_review","published"].includes(state.status)&&!a["force-machine-overwrite"]){
    throw new Error("Refusing to overwrite "+state.status+" translation. Use --force-machine-overwrite only after explicit review decision.");
  }

  const plan=buildWorkPlan(config,familyId,locale,{pivotLocale,repairScope});
  const {family,source,jobs,current,memory,items}=plan;
  const targetPath=family.target_path_pattern.replace("{locale}",locale);
  const target=targetSkeleton(familyId,family,source,locale);

  for(const job of jobs){
    const resolved=resolveSource(familyId,family,job,pivotLocale);
    const key=sha256(resolved.locale+"\u0000"+resolved.value);
    const legacyKey=resolved.locale==="vi"?sha256(resolved.value):null;
    const cached=memory.entries[locale][key]||(legacyKey?memory.entries[locale][legacyKey]:null);
    const existing=current&&getAt(current,targetJobPath(family,job));
    const force=repairScopeIncludes(repairScope,familyId,job);
    if(!force&&typeof existing==="string"&&!candidateProblems(resolved,existing,locale,familyId,job).length){
      setAt(target,targetJobPath(family,job),existing);
      memory.entries[locale][key]={source:resolved.value,source_locale:resolved.locale,translation:existing,updated_at:new Date().toISOString(),quality:"glossary_guarded"};
      continue;
    }
    if(!force&&cached?.source===resolved.value&&typeof cached.translation==="string"&&!candidateProblems(resolved,cached.translation,locale,familyId,job).length){
      setAt(target,targetJobPath(family,job),cached.translation);
    }
  }

  const byFrom=new Map();
  for(const item of items){
    if(!byFrom.has(item.source.locale))byFrom.set(item.source.locale,[]);
    byFrom.get(item.source.locale).push(item);
  }
  for(const [fromLocale,group] of byFrom.entries()){
    const pendingBatches=batches(group);
    for(const [batchIndex,batch] of pendingBatches.entries()){
      const translations=await azureTranslate(batch,locale,fromLocale,config);
      batch.forEach((item,index)=>{
        const translated=translations[index];
        if(!translated.trim())throw new Error("Azure returned an empty translation for "+item.label);
        const problems=candidateProblems(item.source,translated,locale,familyId,item.job);
        if(problems.length)throw new Error("Quality guard rejected "+item.label+": "+problems.join(", "));
        setAt(target,targetJobPath(family,item.job),translated);
        memory.entries[locale][item.key]={
          source:item.source.value,
          source_locale:item.source.locale,
          translation:translated,
          updated_at:new Date().toISOString(),
          quality:"glossary_guarded"
        };
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
  }

  for(const job of jobs){
    const value=getAt(target,targetJobPath(family,job));
    if(typeof value!=="string"||!value.trim())throw new Error("Target field unresolved after translation: "+familyId+":"+job.path.join("."));
  }

  const revision=blobSha(family.source_path);
  writeJson(targetPath,target);writeJson(MEMORY_PATH,memory);
  Object.assign(state,{
    status:"machine_draft",
    target_path:targetPath,
    translated_from_blob_sha:revision,
    reviewed_by:null,
    reviewed_at:null,
    published_at:null,
    note:"Azure Translator v3 machine draft with OpenPhuQuoc glossary/semantic guard"+(pivotLocale?"; pivot "+pivotLocale:"")+"; human review required."
  });
  writeJson(LIFECYCLE_PATH,lifecycle);
  console.log(JSON.stringify({ok:true,...plan.stats,target:targetPath,source_revision:revision,status:"machine_draft"},null,2));
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
    printPlan(config,a.family,a.locale,{pivotLocale:requestedPivot(a,config,a.locale),repairScope:String(a["repair-scope"]||"quality")});
  }else if(command==="translate")await translate(config,a);
  else if(command==="validate")validate(config);
  else throw new Error("Usage: node scripts/i18n-pipeline.mjs <inventory|plan|translate|validate> [--family ID --locale CODE --pivot en --repair-scope quality|core|editorial --apply]");
}catch(error){console.error("i18n pipeline:",error.message);process.exitCode=1;}
