/* CMS edit preflight, GET-only: detects GitHub SHA drift and pending CMS PRs
 * for the SAME WHOLE JSON FILE. It cannot see another user's unsent work. */
const COOKIE="openpq_cms";
const td=new TextDecoder(),te=new TextEncoder();
const readable={
  "data/home-copy.json":["admin","editor","operator","viewer"],
  "data/content.json":["admin","editor","operator","viewer"],
  "guide/data.json":["admin","editor","operator","viewer"],
  "data/utilities.json":["admin","editor","operator","viewer"],
  "data/entities/destination-venues.json":["admin","editor","operator","viewer"],
  "data/entities/food.json":["admin","editor","operator","viewer"],
  "data/i18n/vi/food.json":["admin","editor","operator","viewer"],
  "data/visual-context.json":["admin","editor","viewer"],
  "cms/users.json":["admin"]
};
const respond=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{"Content-Type":"application/json;charset=utf-8",
    "Cache-Control":"private, no-store","Vary":"Cookie"}
});
function cookie(request){
  for(const part of(request.headers.get("cookie")||"").split(";")){
    const i=part.indexOf("=");
    if(i>0&&part.slice(0,i).trim()===COOKIE){
      try{return decodeURIComponent(part.slice(i+1).trim());}catch{return"";}
    }
  }
  return"";
}
function bytes(data){
  let s=String(data||"").replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
}
async function currentSession(request,secret){
  const token=cookie(request);
  if(!token||!secret)return null;
  try{
    const [iv,value]=token.split(".");
    if(!iv||!value)return null;
    const digest=await crypto.subtle.digest("SHA-256",te.encode(secret));
    const key=await crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);
    const data=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(iv)},key,bytes(value));
    const session=JSON.parse(td.decode(data));
    return session.exp>Date.now()?session:null;
  }catch{return null;}
}
async function github(url,headers){
  const response=await fetch(url,{headers,cache:"no-store"});
  let body=null;
  try{body=await response.json();}catch{}
  if(!response.ok)throw Error("GitHub HTTP "+response.status+": "+String(body?.message||"Không xác định"));
  return{body,response};
}
export async function onRequest({request,env}){
  try{
    if(request.method!=="GET")return respond({error:"Method not allowed"},405);
    const path=new URL(request.url).searchParams.get("path")||"";
    if(!Object.hasOwn(readable,path))return respond({error:"Không hỗ trợ tệp này"},400);
    const user=await currentSession(request,String(env.CMS_SESSION_SECRET||""));
    if(!user)return respond({error:"Chưa đăng nhập CMS"},401);
    if(!user.accessToken)return respond({error:"Phiên đăng nhập thiếu quyền GitHub, hãy đăng nhập lại"},401);
    const roleResponse=await fetch("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json?v="+Date.now(),{
      headers:{"User-Agent":"Open-Phu-Quoc-CMS"},cache:"no-store"
    });
    if(!roleResponse.ok)return respond({error:"Chưa kiểm tra được quyền CMS"},503);
    const roles=await roleResponse.json();
    const role=(roles.users||[]).find(x=>String(x.login).toLowerCase()===
      String(user.login).toLowerCase()&&x.enabled!==false)?.role;
    if(!role||!readable[path].includes(role))return respond({error:"Không có quyền xem tệp này"},403);
    const headers={
      Accept:"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      Authorization:"Bearer "+user.accessToken,
      "User-Agent":"Open-Phu-Quoc-CMS"
    };
    const api="https://api.github.com/repos/kenzuko/jotrip-home";
    const encoded=path.split("/").map(encodeURIComponent).join("/");
    const companionPath=path==="data/i18n/vi/food.json"?"data/food.json":null;
    const [file,pulls,companion]=await Promise.all([
      github(api+"/contents/"+encoded+"?ref=main",headers),
      github(api+"/pulls?state=open&per_page=100&sort=updated&direction=desc",headers),
      companionPath?github(api+"/contents/data/food.json?ref=main",headers):Promise.resolve(null)
    ]);
    if(typeof file.body?.sha!=="string")throw Error("Không có SHA phiên bản live");
    if(!Array.isArray(pulls.body))throw Error("Không đọc được hàng đợi PR");
    const pending=pulls.body.filter(pr=>String(pr.head?.ref||"").startsWith("cms/draft/"));
    const limit=20,inspect=pending.slice(0,limit),conflicts=[];
    let complete=pending.length<=limit&&!/rel="next"/.test(pulls.response.headers.get("link")||"");
    // Limit concurrency to three GitHub file-list reads; avoid a burst on busy days.
    for(let i=0;i<inspect.length;i+=3){
      const items=await Promise.all(inspect.slice(i,i+3).map(async pr=>{
        const result=await github(api+"/pulls/"+pr.number+"/files?per_page=100",headers);
        // A PR with >100 files cannot be exhaustively checked; never claim "clear".
        const partial=/rel="next"/.test(result.response.headers.get("link")||"");
        return{pr,files:result.body,partial};
      }));
      for(const item of items){
        if(!Array.isArray(item.files))throw Error("Không đọc được danh sách tệp thay đổi");
        if(item.partial)complete=false;
        if(item.files.some(f=>f.filename===path||companionPath&&f.filename===companionPath)){
          conflicts.push({number:item.pr.number,title:item.pr.title||"",
            url:item.pr.html_url||"https://github.com/kenzuko/jotrip-home/pull/"+item.pr.number,
            author:item.pr.user?.login||"",updated_at:item.pr.updated_at||null});
        }
      }
    }
    return respond({path,sha:file.body.sha,companion_path:companionPath,companion_sha:companion?.body?.sha||null,conflicts,complete,
      checked_at:new Date().toISOString(),
      note:"Kiểm tra theo tệp dữ liệu và PR đang mở. Không thể nhìn thấy bản chưa gửi từ máy khác."});
  }catch(e){
    return respond({error:"Không kiểm tra được xung đột",detail:String(e?.message||e)},502);
  }
}