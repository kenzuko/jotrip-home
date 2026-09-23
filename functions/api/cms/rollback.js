const SESSION_COOKIE="openpq_cms";
const te=new TextEncoder(),td=new TextDecoder();
const paths=new Set(["data/home-copy.json","data/content.json","guide/data.json","data/utilities.json","data/entities/destination-venues.json","data/entities/food.json"]);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const cookies=req=>Object.fromEntries((req.headers.get("cookie")||"").split(";").map(part=>{const i=part.indexOf("=");return i>0?[part.slice(0,i).trim(),decodeURIComponent(part.slice(i+1).trim())]:["",""]}).filter(x=>x[0]));
function fromB64(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
function toB64(bytes){let raw="";for(const byte of bytes)raw+=String.fromCharCode(byte);return btoa(raw)}
async function session(req,secret){const token=cookies(req)[SESSION_COOKIE]||"";if(!token||!secret)return null;try{const[a,b]=token.split(".");const digest=await crypto.subtle.digest("SHA-256",te.encode(secret));const key=await crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(a)},key,fromB64(b));const value=JSON.parse(td.decode(plain));return value.exp>Date.now()?value:null}catch{return null}}
async function currentRole(login){const r=await fetch("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error("Không kiểm tra được quyền CMS");const doc=await r.json();return doc.users?.find(x=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false)?.role||null}
function headers(token){return{Accept:"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28",Authorization:"Bearer "+token,"User-Agent":"Open-Phu-Quoc-CMS"}}
async function gh(url,token,options={}){const r=await fetch(url,{...options,headers:{...headers(token),...(options.headers||{})},cache:"no-store"});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data?.message||("GitHub HTTP "+r.status)),{status:r.status});return data}
function fail(message,status){return json({error:message},status)}
export async function onRequest({request,env}){
  try{
    if(request.method!=="POST")return fail("Method not allowed",405);
    const origin=request.headers.get("Origin"),expected=new URL(request.url).origin;
    if(origin&&origin!==expected)return fail("Origin không hợp lệ",403);
    const user=await session(request,String(env.CMS_SESSION_SECRET||""));
    if(!user)return fail("Chưa đăng nhập",401);
    if(await currentRole(user.login)!=="admin")return fail("Chỉ Admin được tạo đề xuất rollback",403);
    const body=await request.json(),number=Number(body.pr_number);
    if(!Number.isSafeInteger(number)||number<1)return fail("Mã PR không hợp lệ",400);
    const base="https://api.github.com/repos/kenzuko/jotrip-home";
    const original=await gh(base+"/pulls/"+number,user.accessToken);
    if(!original.merged||!String(original.head?.ref||"").startsWith("cms/draft/"))return fail("Chỉ rollback được PR CMS đã merge",409);
    const open=await gh(base+"/pulls?state=open&per_page=100",user.accessToken);
    const existing=(Array.isArray(open)?open:[]).find(pr=>pr.title==="CMS: rollback #"+number);
    if(existing)return json({ok:true,existing:true,pull_request:{number:existing.number,url:existing.html_url}});
    const files=await gh(base+"/pulls/"+number+"/files?per_page=10",user.accessToken);
    if(files.length!==1||files[0].status!=="modified"||!paths.has(files[0].filename))return fail("PR này không phải thay đổi một tệp CMS có thể rollback an toàn tự động",422);
    const file=files[0],encoded=file.filename.split("/").map(encodeURIComponent).join("/");
    const commit=await gh(base+"/commits/"+original.merge_commit_sha,user.accessToken);
    const parent=commit.parents?.[0]?.sha;
    if(!parent)return fail("Không tìm thấy phiên bản trước PR",409);
    const ref=await gh(base+"/git/ref/heads/main",user.accessToken);
    const current=await gh(base+"/contents/"+encoded+"?ref="+encodeURIComponent(ref.object.sha),user.accessToken);
    if(current.sha!==file.sha)return fail("Tệp đã thay đổi sau PR này. Tớ không tạo rollback tự động để tránh xóa sửa đổi mới.",409);
    const previous=await gh(base+"/contents/"+encoded+"?ref="+parent,user.accessToken);
    if(previous.encoding!=="base64"||!previous.content)return fail("Không đọc được phiên bản trước để tạo rollback",422);
    const safeLogin=String(user.login||"owner").toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,24)||"owner";
    const branch="cms/draft/rollback-"+number+"-"+safeLogin+"-"+Date.now();
    await gh(base+"/git/refs",user.accessToken,{method:"POST",body:JSON.stringify({ref:"refs/heads/"+branch,sha:ref.object.sha})});
    const restoredText=td.decode(fromB64(previous.content));
    const write=await gh(base+"/contents/"+encoded,user.accessToken,{method:"PUT",body:JSON.stringify({
      message:"cms: propose rollback of #"+number,
      content:toB64(te.encode(restoredText)),
      sha:current.sha,
      branch
    })});
    const proposal=await gh(base+"/pulls",user.accessToken,{method:"POST",body:JSON.stringify({
      title:"CMS: rollback #"+number,
      head:branch,base:"main",draft:false,
      body:"## Đề xuất rollback CMS\n\n- PR nguồn: #"+number+"\n- Tệp: "+file.filename+"\n- Khôi phục nội dung ngay trước commit "+parent+".\n- Base main đã được kiểm tra khớp phiên bản do PR nguồn tạo.\n\nĐây vẫn là PR review; chưa public cho tới khi chủ CMS kiểm tra và merge."
    })});
    return json({ok:true,pull_request:{number:proposal.number,url:proposal.html_url},file:file.filename,rollback_commit:write.commit?.sha||null});
  }catch(e){return json({error:"Không tạo được đề xuất rollback",detail:e?.message||String(e)},e?.status||502)}
}
