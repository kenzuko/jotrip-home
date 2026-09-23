const SESSION_COOKIE="openpq_cms";
const te=new TextEncoder(),td=new TextDecoder();
const readablePaths=new Set([
  "data/home-copy.json","data/content.json","guide/data.json","data/utilities.json",
  "data/entities/destination-venues.json","data/entities/food.json"
]);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const cookies=req=>Object.fromEntries((req.headers.get("cookie")||"").split(";").map(part=>{const i=part.indexOf("=");return i>0?[part.slice(0,i).trim(),decodeURIComponent(part.slice(i+1).trim())]:["",""]}).filter(x=>x[0]));
function fromB64(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function session(req,secret){const token=cookies(req)[SESSION_COOKIE]||"";if(!token||!secret)return null;try{const[a,b]=token.split(".");const digest=await crypto.subtle.digest("SHA-256",te.encode(secret));const key=await crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(a)},key,fromB64(b));const value=JSON.parse(td.decode(plain));return value.exp>Date.now()?value:null}catch{return null}}
async function role(login){const r=await fetch("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error("Không kiểm tra được quyền CMS");const doc=await r.json();return doc.users?.find(x=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false)?.role||null}
function apiHeaders(token){return{Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",Authorization:"Bearer "+token,"User-Agent":"Open-Phu-Quoc-CMS"}}
async function gh(url,token){const r=await fetch(url,{headers:apiHeaders(token),cache:"no-store"});const data=await r.json();if(!r.ok)throw new Error(data?.message||("GitHub HTTP "+r.status));return data}
function parseFile(file){if(!file?.content)throw new Error("Tệp không phải nội dung văn bản khả dụng");return JSON.parse(td.decode(fromB64(file.content)))}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function collect(before,after,path,out){
  if(same(before,after)||out.length>=200)return;
  const a=before&&typeof before==="object",b=after&&typeof after==="object";
  if(a&&b&&Array.isArray(before)===Array.isArray(after)){
    const keys=new Set([...Object.keys(before),...Object.keys(after)]);
    for(const key of keys)collect(before[key],after[key],Array.isArray(after)?"["+key+"]":(path?path+".":"")+key,out);
    return;
  }
  out.push({field:path||"$",before:before===undefined?null:before,after:after===undefined?null:after});
}
export async function onRequest({request,env}){
  try{
    if(request.method!=="GET")return json({error:"Method not allowed"},405);
    const user=await session(request,String(env.CMS_SESSION_SECRET||""));
    if(!user)return json({error:"Chưa đăng nhập"},401);
    if(!await role(user.login))return json({error:"Tài khoản CMS đã bị vô hiệu hóa"},401);
    const number=Number(new URL(request.url).searchParams.get("pr"));
    if(!Number.isSafeInteger(number)||number<1)return json({error:"Mã PR không hợp lệ"},400);
    const base="https://api.github.com/repos/kenzuko/jotrip-home";
    const pr=await gh(base+"/pulls/"+number,user.accessToken);
    if(!String(pr.head?.ref||"").startsWith("cms/draft/"))return json({error:"Chỉ hỗ trợ PR do CMS tạo"},403);
    const files=await gh(base+"/pulls/"+number+"/files?per_page=30",user.accessToken);
    const changes=[];
    for(const file of files){
      if(!readablePaths.has(file.filename))continue;
      const encoded=file.filename.split("/").map(encodeURIComponent).join("/");
      const [live,proposed]=await Promise.all([
        gh(base+"/contents/"+encoded+"?ref=main",user.accessToken),
        gh(base+"/contents/"+encoded+"?ref="+encodeURIComponent(pr.head.ref),user.accessToken)
      ]);
      const before=parseFile(live),after=parseFile(proposed);
      const fields=[];collect(before,after,"",fields);
      changes.push({path:file.filename,fields});
    }
    return json({number,fields:changes,checked_at:new Date().toISOString()});
  }catch(e){return json({error:"Không tạo được diff theo trường",detail:e?.message||String(e)},502)}
}
