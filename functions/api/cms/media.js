const SESSION_COOKIE="openpq_cms";
const te=new TextEncoder(),td=new TextDecoder();

const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
});

const parseCookies=req=>{
  const out={};
  for(const part of (req.headers.get("cookie")||"").split(";")){
    const i=part.indexOf("=");
    if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
};

const fromB64=s=>{
  s=s.replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  const bin=atob(s);
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
};

async function key(secret){
  const digest=await crypto.subtle.digest("SHA-256",te.encode(secret));
  return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);
}

async function session(req,secret){
  const token=parseCookies(req)[SESSION_COOKIE]||"";
  if(!token||!secret)return null;
  try{
    const [a,b]=token.split(".");
    const k=await key(secret);
    const dec=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(a)},k,fromB64(b));
    const obj=JSON.parse(td.decode(dec));
    return obj.exp>Date.now()?obj:null;
  }catch{return null}
}

async function rawUsers(){
  const r=await fetch("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json?v="+Date.now(),{
    headers:{"User-Agent":"Open-Phu-Quoc-CMS"},cache:"no-store"
  });
  if(!r.ok)throw new Error("Không tải được phân quyền");
  return r.json();
}

async function currentRole(login){
  const doc=await rawUsers();
  const u=(doc.users||[]).find(x=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false);
  return u?.role||null;
}

function safeName(name){
  return String(name||"image")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/đ/g,"d").replace(/Đ/g,"D")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,72)||"image";
}

export async function onRequest({request,env}){
  try{
    if(request.method!=="POST")return json({error:"Method not allowed"},405);
    const origin=request.headers.get("Origin");
    const expectedOrigin=new URL(request.url).origin;
    if(origin&&origin!==expectedOrigin)return json({error:"Origin không hợp lệ"},403);

    const s=await session(request,String(env.CMS_SESSION_SECRET||""));
    if(!s)return json({error:"Chưa đăng nhập"},401);

    const role=await currentRole(s.login);
    if(!["admin","editor","operator"].includes(role))return json({error:"Không có quyền tải ảnh"},403);

    const body=await request.json();
    const mime=String(body.mime||"").toLowerCase();
    const allowed={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
    if(!allowed[mime])return json({error:"Chỉ hỗ trợ JPG, PNG hoặc WebP"},415);

    const base64=String(body.content_base64||"").replace(/^data:[^;]+;base64,/,"").replace(/\s/g,"");
    if(!base64)return json({error:"Ảnh rỗng"},400);

    const approxBytes=Math.floor(base64.length*3/4);
    if(approxBytes>6*1024*1024)return json({error:"Ảnh sau xử lý phải nhỏ hơn 6 MB"},413);

    const now=new Date();
    const yyyy=now.getUTCFullYear();
    const mm=String(now.getUTCMonth()+1).padStart(2,"0");
    const ext=allowed[mime];
    const base=safeName(String(body.filename||"image").replace(/\.[^.]+$/,""));
    const rand=crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0,6);
    const path=`assets/uploads/${yyyy}/${mm}/${Date.now()}-${rand}-${base}.${ext}`;

    const gh=await fetch("https://api.github.com/repos/kenzuko/jotrip-home/contents/"+path,{
      method:"PUT",
      headers:{
        Accept:"application/vnd.github+json",
        "Content-Type":"application/json",
        "X-GitHub-Api-Version":"2022-11-28",
        Authorization:"Bearer "+s.accessToken,
        "User-Agent":"Open-Phu-Quoc-CMS"
      },
      body:JSON.stringify({
        message:"media: upload CMS image",
        content:base64,
        branch:"main"
      })
    });

    const result=await gh.json();
    if(!gh.ok)return json({error:"Không tải được ảnh lên GitHub",detail:result?.message||"GitHub upload failed"},gh.status);

    return json({
      ok:true,
      path,
      url:"/"+path,
      commit:result.commit?.sha||null
    });
  }catch(e){
    return json({error:e?.message||String(e)},500);
  }
}
