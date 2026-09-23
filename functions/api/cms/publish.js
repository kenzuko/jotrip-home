const SESSION_COOKIE="openpq_cms";
const te=new TextEncoder(),td=new TextDecoder();

const writable={
  "data/home-copy.json":["admin","editor"],
  "data/content.json":["admin","editor"],
  "guide/data.json":["admin","editor"],
  "data/utilities.json":["admin","operator"],
  "data/entities/destination-venues.json":["admin","editor","operator"],
  "data/entities/food.json":["admin","editor"],
  "cms/users.json":["admin"]
};

const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
});

const parseCookies=req=>{
  const out={};
  for(const part of (req.headers.get("cookie")||"").split(";")){
    const i=part.indexOf("=");
    if(i>0) out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
};

const fromB64=s=>{
  s=s.replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  const bin=atob(s);
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
};

const toStdB64=u8=>{
  let s="";
  for(const b of u8)s+=String.fromCharCode(b);
  return btoa(s);
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
    headers:{"User-Agent":"Open-Phu-Quoc-CMS"},
    cache:"no-store"
  });
  if(!r.ok)throw new Error("Không tải được danh sách phân quyền: HTTP "+r.status);
  return r.json();
}

async function currentRole(login){
  const doc=await rawUsers();
  const u=(doc.users||[]).find(x=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false);
  return u?.role||null;
}

function validatePayload(path,content){
  const errors=[];

  if(!content||typeof content!=="object")return ["Dữ liệu không hợp lệ"];

  if(path==="data/home-copy.json"){
    if(!String(content?.hero?.title||"").trim())errors.push("Hero cần có tiêu đề");
    if(!String(content?.hero?.lead||"").trim())errors.push("Hero cần có đoạn dẫn");
  }

  if(path==="data/content.json"){
    const stories=Array.isArray(content.stories)?content.stories:[];
    if(!stories.length)errors.push("Cần ít nhất một bài viết");
    const ids=new Set();

    stories.forEach((story,i)=>{
      const id=String(story?.id||"").trim();
      const title=String(story?.title||"").trim();

      if(!title)errors.push("Bài #"+(i+1)+" chưa có tiêu đề");
      if(!id)errors.push("Bài #"+(i+1)+" chưa có mã bài");
      else if(ids.has(id))errors.push("Mã bài bị trùng: "+id);
      else ids.add(id);

      if(!Array.isArray(story?.sections)||!story.sections.length){
        errors.push("Bài "+(title||("#"+(i+1)))+" chưa có nội dung");
      }
    });
  }

  if(path==="guide/data.json"){
    if(!String(content?.title||"").trim())errors.push("Cẩm nang cần có tiêu đề");
  }

  if(path==="data/utilities.json"){
    const emergency=Array.isArray(content.national_emergency)?content.national_emergency:[];
    emergency.forEach((x,i)=>{
      if(!String(x?.label||"").trim()||!String(x?.phone||"").trim()){
        errors.push("Số khẩn cấp #"+(i+1)+" thiếu tên hoặc số điện thoại");
      }
    });
  }

  if(path==="data/entities/destination-venues.json"){
    const entities=Array.isArray(content.entities)?content.entities:[];
    const ids=new Set();
    const allowed=new Set(["LOCAL_FOOD","RESTAURANT","CAFE","ATTRACTION"]);
    entities.forEach((x,i)=>{
      const id=String(x?.id||"").trim();
      const name=String(x?.name||"").trim();
      const category=String(x?.category||"").trim();
      if(!id)errors.push("Địa điểm #"+(i+1)+" chưa có id");
      else if(ids.has(id))errors.push("Venue id bị trùng: "+id);
      else ids.add(id);
      if(!name)errors.push("Địa điểm #"+(i+1)+" chưa có tên");
      if(!allowed.has(category))errors.push("Địa điểm "+(name||("#"+(i+1)))+" có category không hợp lệ");
      if(String(x?.status||"REVIEW")==="ACTIVE"){
        if(!String(x?.verified_at||"").trim())errors.push("Địa điểm đang dùng cần ngày kiểm tra: "+(name||id));
        if(!String(x?.source_ref||"").trim())errors.push("Địa điểm đang dùng cần nguồn: "+(name||id));
      }
      const coordinateEvidence=["coordinate_precision","coordinate_source_ref","coordinate_source_type","coordinate_observed_at","coordinate_confidence"].some(key=>String(x?.[key]||"").trim());
      if(coordinateEvidence){
        if(!String(x?.coordinate_precision||"").trim())errors.push("Địa điểm "+(name||id)+" thiếu độ chính xác tọa độ.");
        if(!String(x?.coordinate_source_ref||"").trim())errors.push("Địa điểm "+(name||id)+" thiếu nguồn kiểm tra tọa độ.");
        if(!String(x?.coordinate_source_type||"").trim())errors.push("Địa điểm "+(name||id)+" thiếu loại nguồn tọa độ.");
        if(!/^\d{4}-\d{2}-\d{2}$/.test(String(x?.coordinate_observed_at||"")))errors.push("Địa điểm "+(name||id)+" thiếu ngày kiểm tra tọa độ.");
        if(!["HIGH","MEDIUM","LOW"].includes(String(x?.coordinate_confidence||"").toUpperCase()))errors.push("Địa điểm "+(name||id)+" cần chọn độ tin cậy tọa độ.");
      }
      if(x?.latitude!==null&&x?.latitude!==""&&x?.latitude!==undefined){
        const lat=Number(x.latitude); if(!Number.isFinite(lat)||lat<-90||lat>90)errors.push("Latitude không hợp lệ: "+(name||id));
      }
      if(x?.longitude!==null&&x?.longitude!==""&&x?.longitude!==undefined){
        const lon=Number(x.longitude); if(!Number.isFinite(lon)||lon<-180||lon>180)errors.push("Longitude không hợp lệ: "+(name||id));
      }
    });
  }

  if(path==="data/entities/food.json"){
    const entities=Array.isArray(content.entities)?content.entities:[];
    if(!entities.length)errors.push("Danh sách món ăn không được để trống");
    const ids=new Set(),legacyIds=new Set();
    entities.forEach((x,i)=>{
      const id=String(x?.id||"").trim();
      const legacy=String(x?.legacy_id||"").trim();
      if(x?.entity_type!=="food")errors.push("Bản ghi #"+(i+1)+" phải có entity_type food");
      if(!id)errors.push("Món #"+(i+1)+" chưa có food_id");
      else if(ids.has(id))errors.push("food_id bị trùng: "+id);
      else ids.add(id);
      if(!legacy)errors.push("Món "+(id||("#"+(i+1)))+" chưa có legacy_id");
      else if(legacyIds.has(legacy))errors.push("legacy_id bị trùng: "+legacy);
      else legacyIds.add(legacy);
      if(!String(x?.name||"").trim())errors.push("Món "+(id||("#"+(i+1)))+" chưa có tên");
      if(!Array.isArray(x?.source_refs)||!x.source_refs.length)errors.push("Món "+(id||("#"+(i+1)))+" chưa có nguồn");
    });
  }

  if(path==="cms/users.json"){
    const users=Array.isArray(content.users)?content.users:[];
    const activeAdmins=users.filter(x=>x?.role==="admin"&&x?.enabled!==false);
    if(!activeAdmins.length)errors.push("Phải còn ít nhất một Admin đang hoạt động");

    const seen=new Set();
    users.forEach((u,i)=>{
      const login=String(u?.login||"").trim().toLowerCase();
      if(!login)errors.push("Người dùng #"+(i+1)+" chưa có GitHub username");
      else if(seen.has(login))errors.push("GitHub username bị trùng: "+login);
      else seen.add(login);
    });
  }

  return errors;
}


export async function onRequest({request,env}){
  try{
    if(request.method!=="POST")return json({error:"Method not allowed"},405);
    const origin=request.headers.get("Origin");
    const expectedOrigin=new URL(request.url).origin;
    if(origin&&origin!==expectedOrigin)return json({error:"Origin không hợp lệ"},403);

    const s=await session(request,String(env.CMS_SESSION_SECRET||""));
    if(!s)return json({error:"Chưa đăng nhập"},401);

    const body=await request.json();
    const path=String(body.path||"");
    const role=await currentRole(s.login);
    if(!role||!(writable[path]||[]).includes(role))return json({error:"Vai trò hiện tại không được xuất bản module này"},403);
    if(!body.sha)return json({error:"Thiếu SHA phiên bản hiện tại"},409);

    const validationErrors=validatePayload(path,body.content);
    if(validationErrors.length)return json({error:"Dữ liệu chưa hợp lệ",detail:validationErrors.slice(0,5).join(" · ")},422);

    const text=path.endsWith(".json")?JSON.stringify(body.content,null,2)+"\n":String(body.content??"");
    if(path.endsWith(".json"))JSON.parse(text);
    if(text.length>1200000)return json({error:"Nội dung vượt giới hạn CMS"},413);

    const headers={
      Accept:"application/vnd.github+json",
      "Content-Type":"application/json",
      "X-GitHub-Api-Version":"2022-11-28",
      Authorization:"Bearer "+s.accessToken,
      "User-Agent":"Open-Phu-Quoc-CMS"
    };
    const api="https://api.github.com/repos/kenzuko/jotrip-home";
    const fileResponse=await fetch(api+"/contents/"+path+"?ref=main",{headers,cache:"no-store"});
    const file=await fileResponse.json();
    if(!fileResponse.ok)return json({error:"Không đọc được bản live hiện tại",github_status:fileResponse.status,detail:file?.message||"Không rõ nguyên nhân"},fileResponse.status);
    if(file.sha!==body.sha)return json({error:"Nội dung trên GitHub đã đổi trong lúc cậu đang sửa. Tải lại module rồi áp dụng lại thay đổi để tránh ghi đè.",latest_sha:file.sha},409);

    const openResponse=await fetch(api+"/pulls?state=open&per_page=100",{headers,cache:"no-store"});
    const openPulls=await openResponse.json();
    if(!openResponse.ok)return json({error:"Không kiểm tra được đề xuất đang mở",github_status:openResponse.status,detail:openPulls?.message||"Không rõ nguyên nhân"},openResponse.status);
    for(const openPr of (Array.isArray(openPulls)?openPulls:[]).filter(pr=>String(pr.head?.ref||"").startsWith("cms/draft/"))){
      const filesResponse=await fetch(api+"/pulls/"+openPr.number+"/files?per_page=100",{headers,cache:"no-store"});
      const changedFiles=await filesResponse.json();
      if(!filesResponse.ok)return json({error:"Không kiểm tra được tệp trong đề xuất đang mở",github_status:filesResponse.status,detail:changedFiles?.message||"Không rõ nguyên nhân"},filesResponse.status);
      if((Array.isArray(changedFiles)?changedFiles:[]).some(file=>file.filename===path)){
        return json({error:"Đang có đề xuất CMS khác sửa cùng tệp.",detail:"Kiểm tra hoặc đóng PR #"+openPr.number+" trước khi gửi thay đổi mới để tránh ghi đè.",conflicting_pr:{number:openPr.number,url:openPr.html_url}},409);
      }
    }

    const refResponse=await fetch(api+"/git/ref/heads/main",{headers,cache:"no-store"});
    const ref=await refResponse.json();
    if(!refResponse.ok)return json({error:"Không đọc được nhánh main",github_status:refResponse.status,detail:ref?.message||"Không rõ nguyên nhân"},refResponse.status);

    const safeLogin=String(s.login||"editor").toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,30)||"editor";
    const branch="cms/draft/"+safeLogin+"-"+Date.now();
    const branchResponse=await fetch(api+"/git/refs",{
      method:"POST",headers,
      body:JSON.stringify({ref:"refs/heads/"+branch,sha:ref.object?.sha})
    });
    const branchResult=await branchResponse.json();
    if(!branchResponse.ok)return json({error:"Không tạo được nhánh bản nháp",github_status:branchResponse.status,detail:branchResult?.message||"Không rõ nguyên nhân"},branchResponse.status);

    const fileWrite=await fetch(api+"/contents/"+path,{
      method:"PUT",headers,
      body:JSON.stringify({
        message:String(body.message||"cms: propose "+path).slice(0,120),
        content:toStdB64(te.encode(text)),
        sha:file.sha,
        branch
      })
    });
    const fileResult=await fileWrite.json();
    if(!fileWrite.ok)return json({error:"Không lưu được bản đề xuất",github_status:fileWrite.status,detail:fileResult?.message||"Không rõ nguyên nhân"},fileWrite.status);

    const pullResponse=await fetch(api+"/pulls",{
      method:"POST",headers,
      body:JSON.stringify({
        title:"CMS: "+String(body.message||"Cập nhật nội dung").slice(0,100),
        head:branch,
        base:"main",
        draft:false,
        body:"## Đề xuất từ CMS\n\n- Module: `"+path+"`\n- Người đề xuất: @"+safeLogin+"\n- Base file SHA: `"+file.sha+"`\n- File commit: `"+String(fileResult.commit?.sha||"")+"`\n\nChủ CMS kiểm tra diff và nguồn rồi tự merge khi sẵn sàng. PR chưa được xuất bản cho khách."
      })
    });
    const pull=await pullResponse.json();
    if(!pullResponse.ok)return json({error:"Đã lưu nhánh nhưng không tạo được PR nháp",github_status:pullResponse.status,detail:pull?.message||"Không rõ nguyên nhân",branch},pullResponse.status);

    return json({ok:true,branch,commit:fileResult.commit?.sha||null,pull_request:{number:pull.number,url:pull.html_url,draft:pull.draft}});

  }catch(e){
    return json({error:e?.message||String(e)},500);
  }
}
