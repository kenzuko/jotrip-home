// Authenticated operational override. This is NOT the CMS news publisher.
const MAIN_REPO="kenzuko/jotrip-home";
const DATA_REPO="kenzuko/Jotrip-Lab";
const BRANCH="data-marine-ops";
const COOKIE="openpq_cms";
const enc=new TextEncoder(),dec=new TextDecoder();
const reply=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function parseCookie(header){
  const pair=header.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="));
  return pair?decodeURIComponent(pair.slice(COOKIE.length+1)):"";
}
function bytesFromB64(s){
  s=String(s).replace(/-/g,"+").replace(/_/g,"/").replace(/\s/g,"");
  while(s.length%4)s+="=";
  return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
}
function b64Utf8(value){
  const bytes=enc.encode(value);let result="";
  for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.slice(i,i+8192));
  return btoa(result);
}
async function session(request,secret){
  const raw=parseCookie(request.headers.get("cookie")||"");
  if(!raw||!secret)return null;
  try{
    const [iv,body]=raw.split(".");
    if(!iv||!body)return null;
    const digest=await crypto.subtle.digest("SHA-256",enc.encode(secret));
    const key=await crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);
    const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytesFromB64(iv)},key,bytesFromB64(body));
    const user=JSON.parse(dec.decode(plain));
    return user.exp>Date.now()&&user.accessToken?user:null;
  }catch{return null;}
}
function dateParts(date=new Date()){
  const fields=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
  }).formatToParts(date);
  return Object.fromEntries(fields.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
}
function timeVN(date=new Date()){
  const p=dateParts(date);
  return p.year+"-"+p.month+"-"+p.day+"T"+p.hour+":"+p.minute+":"+p.second+"+07:00";
}
function todayVN(date=new Date()){
  const p=dateParts(date);
  return p.year+"-"+p.month+"-"+p.day;
}
function displayDay(day){return day.slice(8,10)+"/"+day.slice(5,7)+"/"+day.slice(0,4);}
function urlFile(repo,path,branch){
  return "https://api.github.com/repos/"+repo+"/contents/"+path.split("/").map(encodeURIComponent).join("/")+"?ref="+encodeURIComponent(branch);
}
async function github(url,token,options={}){
  const r=await fetch(url,{...options,cache:"no-store",headers:{
    Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",
    Authorization:"Bearer "+token,"User-Agent":"OpenPQ-Marine-Operations",
    ...(options.body?{"Content-Type":"application/json"}:{})
  }});
  let data={};
  try{data=await r.json();}catch{}
  return {ok:r.ok,status:r.status,data};
}
async function currentRole(user){
  const {ok,status,data}=await github(urlFile(MAIN_REPO,"cms/users.json","main"),user.accessToken);
  if(!ok)throw new Error("Không kiểm tra được quyền CMS (GitHub "+status+")");
  const users=JSON.parse(dec.decode(bytesFromB64(data.content||"")));
  const entry=(users.users||[]).find(x=>String(x.login).toLowerCase()===String(user.login).toLowerCase()&&x.enabled!==false);
  return entry?.role||null;
}
async function readData(path,token){
  const r=await github(urlFile(DATA_REPO,path,BRANCH),token);
  if(r.status===404)return {sha:null,content:null};
  if(!r.ok)throw new Error("Không đọc được marine_ops: GitHub "+r.status);
  return {sha:r.data.sha,content:JSON.parse(dec.decode(bytesFromB64(r.data.content||"")))};
}
async function updateData(path,token,makeContent,message){
  // SHA precondition and retry avoid overwriting a concurrently running collector.
  for(let attempt=0;attempt<4;attempt++){
    const file=await readData(path,token);
    const content=makeContent(file.content);
    const body={message,branch:BRANCH,content:b64Utf8(JSON.stringify(content,null,2)+"\n")};
    if(file.sha)body.sha=file.sha;
    const out=await github(urlFile(DATA_REPO,path,BRANCH).split("?")[0],token,{method:"PUT",body:JSON.stringify(body)});
    if(out.ok)return {content,sha:out.data.commit?.sha||null};
    if(out.status===409||out.status===422)continue;
    throw new Error("GitHub không ghi được "+path+" ("+out.status+")");
  }
  throw new Error("Nguồn dữ liệu đang có cập nhật đồng thời, thử lại sau.");
}
function emptyCategory(){return {state:"UNKNOWN",confidence_cap:59,evidence_count:0,evidence:[],source_tiers:[]};}
function makeLatest(old,day,state,manual,now){
  // Never carry prior-day ferry/fast-boat status into a new operating day.
  const same=old?.source_date===displayDay(day);
  const data=same?structuredClone(old):{
    schema_version:"marine-ops-1.0",source_date:displayDay(day),collected_at_vn:now,
    categories:{fast_boat:emptyCategory(),ferry:emptyCategory()},errors:[],
    rules:{cano_independent:true,no_cross_category_inference:true}
  };
  data.categories||={};
  data.categories.cano={
    state,evidence:[manual.evidence],evidence_count:1,source_tiers:["FIELD"],
    confidence_cap:90,confirmed_at_vn:now
  };
  if(!data.collected_at_vn)data.collected_at_vn=now;
  return data;
}
function makeHistory(old,day,state,manual,now){
  const data=old&&old.schema_version==="1.0"&&old.category==="cano"?structuredClone(old):{
    schema_version:"1.0",category:"cano",events:[],
    source_policy:"Only confirmed day-specific operations; no inference from weather or other transport."
  };
  const item={
    date:day,time:now.slice(11,16),state,label:manual.status_label,scope:"Phú Quốc / An Thới",
    note:manual.evidence.evidence_note,source:{tier:"FIELD_ARCHIVE",label:"Xác nhận thực địa"},
    recorded_at_vn:now
  };
  data.events=(data.events||[]).filter(x=>x.date!==day).concat(item).sort((a,b)=>a.date.localeCompare(b.date));
  data.archive_through_date=data.events.at(-1).date;
  data.generated_at_vn=now;
  return data;
}
export async function onRequest({request,env}){
  const user=await session(request,String(env.CMS_SESSION_SECRET||""));
  if(!user)return reply({error:"Cậu cần đăng nhập CMS."},401);
  let role;
  try{role=await currentRole(user);}catch(e){return reply({error:e.message},503);}
  if(!["admin","operator"].includes(role))return reply({error:"Chỉ quản trị và vận hành được xác nhận cano."},403);
  try{
    if(request.method==="GET"){
      const [latest,history]=await Promise.all([
        readData("data/marine_ops/latest.json",user.accessToken),
        readData("data/marine_ops/cano-history.json",user.accessToken)
      ]);
      const day=todayVN(),live=latest.content,valid=live?.source_date===displayDay(day);
      return reply({ok:true,today:day,state:valid?live?.categories?.cano?.state||"FIELD_REQUIRED":"FIELD_REQUIRED",
        confirmed_at_vn:valid?live?.categories?.cano?.confirmed_at_vn||null:null,
        archive_through_date:history.content?.archive_through_date||null,
        history_count:history.content?.events?.length||0});
    }
    if(request.method!=="POST")return reply({error:"Phương thức không hỗ trợ"},405);
    if(role!=="admin"||String(user.login).toLowerCase()!=="kenzuko")return reply({error:"Chỉ chủ dự án có quyền xác nhận trạng thái cano."},403);
    const origin=request.headers.get("Origin")||"";
    if(origin!==new URL(request.url).origin)return reply({error:"Yêu cầu không cùng miền CMS"},403);
    if(!request.headers.get("Content-Type")?.startsWith("application/json"))return reply({error:"Yêu cầu phải là JSON"},415);
    const body=await request.json();
    const today=todayVN();
    if(body.date!==today)return reply({error:"Chỉ xác nhận trạng thái của ngày hôm nay ("+displayDay(today)+")."},422);
    const state=body.state;
    if(!["RUNNING","SUSPENDED"].includes(state))return reply({error:"Trạng thái không hợp lệ"},422);
    const note=String(body.note||"").trim();
    if(note.length>160)return reply({error:"Ghi chú tối đa 160 ký tự"},422);
    const now=timeVN(),label=state==="RUNNING"?"Hoạt động bình thường":"Tạm dừng";
    const manual={
      schema_version:"marine-ops-manual-1.0",category:"cano",date:displayDay(today),
      state,status_label:label,valid_scope:"Ngày "+displayDay(today)+" - cano du lịch An Thới, Phú Quốc",
      recorded_at_vn:now,confirmation_channel:"CMS Admin - xác nhận trực tiếp",confirmed_by:user.login,
      evidence:{category:"cano",source:"JOTRIP_FIELD_CONFIRMATION",source_tier:"FIELD",
        evidence_class:"DIRECT",status:label,area:"Phú Quốc / An Thới",
        confirmed_at_text:displayDay(today)+" "+now.slice(11,16),
        evidence_note:note||("Cano An Thới "+(state==="RUNNING"?"hoạt động bình thường.":"tạm dừng."))
      },
      verification_note:"Xác nhận vận hành theo ngày; dự báo biển và trạng thái tàu/phà không xác định hoạt động cano."
    };
    const file="data/marine_ops/manual-confirmations/"+today+"-cano-an-thoi.json";
    await updateData(file,user.accessToken,()=>manual,"ops(cano): "+today+" "+state+" confirmed by "+user.login);
    let latest,history;
    try{
      latest=await updateData("data/marine_ops/latest.json",user.accessToken,
        old=>makeLatest(old,today,state,manual,now),"ops(cano): sync confirmed "+today+" to live status");
      history=await updateData("data/marine_ops/cano-history.json",user.accessToken,
        old=>makeHistory(old,today,state,manual,now),"ops(cano): archive confirmed "+today);
    }catch(e){
      return reply({ok:false,recorded:true,synced:false,
        error:"Đã lưu xác nhận nhưng chưa đồng bộ hết sang website. "+e.message},503);
    }
    const [verifyLatest,verifyHistory]=await Promise.all([
      readData("data/marine_ops/latest.json",user.accessToken),
      readData("data/marine_ops/cano-history.json",user.accessToken)
    ]);
    const l=verifyLatest.content,h=verifyHistory.content;
    const passed=l?.source_date===displayDay(today)&&l?.categories?.cano?.state===state&&
      l?.categories?.cano?.confirmed_at_vn===now&&
      h?.events?.some(e=>e.date===today&&e.state===state&&e.recorded_at_vn===now);
    if(!passed)return reply({ok:false,recorded:true,synced:false,error:"Đã ghi dữ liệu, nhưng lượt đọc lại chưa khớp. Vui lòng tải lại."},409);
    return reply({ok:true,recorded:true,synced:true,date:today,state,label,confirmed_at_vn:now,
      history_count:h.events.length,commit:history.sha});
  }catch(e){return reply({error:e.message||String(e)},503);}
}

export {session,currentRole,reply,timeVN,makeLatest,makeHistory};
