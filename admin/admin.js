const $=s=>document.querySelector(s);
const API={session:"/api/cms/session",auth:"/api/cms/auth",content:"/api/cms/content",publish:"/api/cms/publish"};

let session=null,schema=null,currentModule=null,currentData=null,currentSha=null,dirty=false,draftTimer=null;

const ROLE_LABELS={
  admin:"Quản trị viên",
  editor:"Biên tập viên",
  operator:"Vận hành",
  viewer:"Chỉ xem"
};

const LABELS={
  version:"Phiên bản",
  schema_version:"Phiên bản dữ liệu",
  updated:"Cập nhật",
  generated_at:"Thời điểm tạo dữ liệu",
  source_policy:"Chính sách nguồn",
  source_file:"Tệp nguồn",
  source_updated:"Nguồn cập nhật",
  source:"Nguồn",
  sources:"Nguồn tham khảo",
  handbook_source:"Nguồn sổ tay",
  library_updated:"Thư viện cập nhật",
  hero:"Hero đầu trang",
  kicker:"Dòng nhãn",
  title:"Tiêu đề",
  lead:"Đoạn dẫn",
  sections:"Các khối nội dung",
  eyebrow:"Nhãn mục",
  happening:"Có gì hôm nay",
  things:"Hôm nay đi đâu",
  must:"Không nên bỏ lỡ",
  areas:"Khám phá theo khu vực",
  food:"Ăn uống",
  essentials:"Thông tin thực dụng",
  heritage:"Di sản & chất đảo",
  guide:"Cẩm nang",
  stories:"Bài viết",
  id:"Mã nội dung",
  category:"Chuyên mục",
  dek:"Mô tả ngắn",
  read_minutes:"Thời gian đọc (phút)",
  image:"Ảnh",
  intro:"Mở bài",
  heading:"Tiêu đề đoạn",
  body:"Nội dung",
  label:"Tên hiển thị",
  url:"Đường dẫn",
  zones:"Ba vùng chính",
  name:"Tên",
  tag:"Nhãn",
  summary:"Tóm tắt",
  best_for:"Phù hợp nhất",
  north_rhythm:"Nhịp Bắc đảo",
  type:"Loại",
  note:"Ghi chú",
  hotels:"Khách sạn",
  tiers:"Phân hạng",
  itineraries:"Lịch trình",
  days:"Các ngày",
  national_emergency:"Số khẩn cấp quốc gia",
  phu_quoc:"Danh bạ Phú Quốc",
  directory:"Danh bạ hữu ích",
  phone:"Điện thoại",
  phone_alt:"Điện thoại khác",
  verified:"Đã xác minh",
  checked_at:"Ngày kiểm tra",
  ticket_reference:"Giá vé & show tham khảo",
  place:"Địa điểm",
  activity:"Hoạt động",
  price:"Giá",
  dynamic:"Dữ liệu động",
  travel_times:"Thời gian di chuyển",
  from:"Từ",
  to:"Đến",
  min:"Tối thiểu (phút)",
  max:"Tối đa (phút)",
  transport_choices:"Gợi ý phương tiện",
  trip:"Nhu cầu chuyến đi",
  choice:"Gợi ý",
  checklist:"Checklist",
  group:"Nhóm",
  items:"Danh sách",
  sync:"AutoSync",
  status:"Trạng thái",
  users:"Người dùng",
  login:"GitHub username",
  role:"Vai trò",
  enabled:"Đang hoạt động"
};

function show(id){["boot","remoteGate","login","cms"].forEach(x=>$("#"+x)?.classList.toggle("hidden",x!==id))}
function status(msg,type=""){const el=$("#status");if(!el)return;el.textContent=msg;el.className="status-bar"+(type?" "+type:"")}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function labelize(k){
  if(LABELS[k])return LABELS[k];
  return String(k).replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
}
function pathParts(p){return String(p).split(".").filter(Boolean).map(x=>/^\d+$/.test(x)?Number(x):x)}
function setAtPath(obj,path,val){const parts=pathParts(path);let cur=obj;for(let i=0;i<parts.length-1;i++)cur=cur[parts[i]];cur[parts.at(-1)]=val}
function getAtPath(obj,path){return pathParts(path).reduce((a,k)=>a?.[k],obj)}
function deepClone(v){return JSON.parse(JSON.stringify(v))}
function blankLike(v,key=""){
 if(Array.isArray(v))return [];
 if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,blankLike(x,k)]));
 if(typeof v==="boolean")return false;
 if(typeof v==="number")return /read_minutes/i.test(key)?4:0;
 return "";
}
function draftKey(id=currentModule?.id){return id&&session?"openpq-cms-draft:"+session.login+":"+id:null}
function clearDraft(id=currentModule?.id){const k=draftKey(id);if(k)localStorage.removeItem(k)}
function saveDraftNow(){if(!dirty||!currentModule||!session)return;const k=draftKey();if(k)localStorage.setItem(k,JSON.stringify({sha:currentSha,data:currentData,at:Date.now()}))}
function scheduleDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{saveDraftNow();status("Có thay đổi chưa xuất bản. Bản nháp đã tự lưu trên trình duyệt.")},650)}
function markDirty(msg="Có thay đổi chưa xuất bản."){dirty=true;$("#saveBtn").disabled=false;$("#saveBtn").textContent="Xuất bản thay đổi";status(msg);scheduleDraft()}

function itemTitle(v,i){
  if(v&&typeof v==="object"){
    return v.title||v.name||v.label||v.place||v.group||v.heading||v.trip||v.id||("Mục "+(i+1));
  }
  return "Mục "+(i+1);
}

function inputAttrs(key){
  if(/^(url|source|image)$/i.test(key))return ' type="url" inputmode="url"';
  if(/phone/i.test(key))return ' type="tel" inputmode="tel"';
  return ' type="text"';
}

function stringField(key,val,path){
  const text=String(val??"");
  const long=text.length>90||/(body|summary|description|intro|dek|lead|note|items|content)/i.test(key);
  return `<div class="field"><label>${esc(labelize(key))}</label>${long
    ?`<textarea data-path="${esc(path)}">${esc(text)}</textarea>`
    :`<input${inputAttrs(key)} data-path="${esc(path)}" value="${esc(text)}">`
  }</div>`;
}

function primitiveField(key,val,path){
  if(typeof val==="boolean"){
    return `<div class="field"><label>${esc(labelize(key))}</label><select data-path="${esc(path)}" data-type="boolean"><option value="true" ${val?"selected":""}>Có / bật</option><option value="false" ${!val?"selected":""}>Không / tắt</option></select></div>`;
  }
  if(typeof val==="number"){
    return `<div class="field"><label>${esc(labelize(key))}</label><input type="number" step="any" data-path="${esc(path)}" data-type="number" value="${val}"></div>`;
  }
  if(key==="role"){
    return `<div class="field"><label>Vai trò</label><select data-path="${esc(path)}"><option value="admin" ${val==="admin"?"selected":""}>Quản trị viên</option><option value="editor" ${val==="editor"?"selected":""}>Biên tập viên</option><option value="operator" ${val==="operator"?"selected":""}>Vận hành</option><option value="viewer" ${val==="viewer"?"selected":""}>Chỉ xem</option></select></div>`;
  }
  return stringField(key,val??"",path);
}

function renderChildren(obj,path,depth){
  return Object.entries(obj).map(([k,v])=>{
    const p=path?path+"."+k:k;
    if(v&&typeof v==="object")return renderNode(v,p,k,depth);
    return primitiveField(k,v,p);
  }).join("");
}

function renderNode(value,path="",label="Nội dung",depth=0){
  if(value===null||typeof value!=="object")return primitiveField(label,value,path);

  if(Array.isArray(value)){
    const cards=value.map((v,i)=>{
      const p=path?path+"."+i:String(i);
      const title=itemTitle(v,i);
      if(v&&typeof v==="object"){
        return `<details class="array-card" ${i===0&&value.length<4?"open":""}><summary><span>${esc(title)}</span><small>#${i+1}</small></summary><div class="detail-body">${renderChildren(v,p,depth+1)}</div></details>`;
      }
      return `<div class="array-card primitive-array"><div class="array-title">#${i+1}</div>${primitiveField(String(i),v,p)}</div>`;
    }).join("");
    return `<details class="field-group cms-anchor" data-anchor-label="${esc(labelize(label))}" ${depth<=1?"open":""}><summary class="group-summary"><span>${esc(labelize(label))}</span><small>${value.length} mục</small></summary><div class="detail-body">${cards}</div></details>`;
  }

  return `<details class="field-group cms-anchor" data-anchor-label="${esc(labelize(label))}" ${depth<=1?"open":""}><summary class="group-summary"><span>${esc(labelize(label))}</span></summary><div class="detail-body">${renderChildren(value,path,depth+1)}</div></details>`;
}

function renderRoot(){
  if(currentModule?.id==="stories"&&Array.isArray(currentData?.stories)){
    const meta=Object.entries(currentData).filter(([k])=>k!=="stories").map(([k,v])=>primitiveField(k,v,k)).join("");
    const stories=currentData.stories.map((story,i)=>{
      const p="stories."+i;
      return `<details class="field-group story-editor cms-anchor" data-anchor-label="${esc(story.title||("Bài "+(i+1)))}" ${i===0?"open":""}><summary class="group-summary"><span>${esc(story.title||("Bài "+(i+1)))}</span><small>${esc(story.category||"Bài viết")}</small></summary><div class="detail-body">${renderChildren(story,p,1)}</div></details>`;
    }).join("");
    return `<section class="meta-strip">${meta}</section>${stories}`;
  }
  return Object.entries(currentData||{}).map(([k,v])=>{
    if(v&&typeof v==="object")return renderNode(v,k,k,0);
    return primitiveField(k,v,k);
  }).join("");
}

function renderUsers(){
  const users=currentData.users||[];
  $("#editor").innerHTML=
    '<div class="user-admin-head"><div><strong>Người dùng CMS</strong><p>Thêm đúng GitHub username và chọn vai trò. Quyền được kiểm tra lại lúc xuất bản.</p></div><button type="button" id="addUserBtn">+ Thêm người dùng</button></div>'+
    '<div class="role-legend"><span><b>Admin</b> toàn quyền</span><span><b>Editor</b> nội dung</span><span><b>Operator</b> tiện ích</span><span><b>Viewer</b> chỉ xem</span></div>'+
    '<div class="user-cards">'+users.map((u,i)=>
      '<article class="user-card"><div class="user-card-title"><strong>'+esc(u.name||u.login||("Người dùng "+(i+1)))+'</strong><span>'+esc(ROLE_LABELS[u.role]||u.role||"")+'</span></div>'+
      '<div class="field"><label>GitHub username</label><input data-path="users.'+i+'.login" value="'+esc(u.login||"")+'"></div>'+
      '<div class="field"><label>Tên hiển thị</label><input data-path="users.'+i+'.name" value="'+esc(u.name||"")+'"></div>'+
      '<div class="field"><label>Vai trò</label><select data-path="users.'+i+'.role"><option value="admin" '+(u.role==="admin"?"selected":"")+'>Quản trị viên</option><option value="editor" '+(u.role==="editor"?"selected":"")+'>Biên tập viên</option><option value="operator" '+(u.role==="operator"?"selected":"")+'>Vận hành</option><option value="viewer" '+(u.role==="viewer"?"selected":"")+'>Chỉ xem</option></select></div>'+
      '<div class="field"><label>Trạng thái</label><select data-path="users.'+i+'.enabled" data-type="boolean"><option value="true" '+(u.enabled!==false?"selected":"")+'>Đang hoạt động</option><option value="false" '+(u.enabled===false?"selected":"")+'>Tạm khóa</option></select></div>'+
      (u.login==="kenzuko"?'':'<button type="button" class="remove-user" data-user="'+i+'">Xóa người dùng</button>')+
      '</article>'
    ).join("")+'</div>';

  $("#addUserBtn").onclick=()=>{
    currentData.users=currentData.users||[];
    currentData.users.push({login:"",name:"",role:"viewer",enabled:true});
    dirty=true;renderUsers();bindFields();buildEditorNav();$("#saveBtn").disabled=false;
    status("Đã thêm người dùng mới. Nhập GitHub username rồi bấm Xuất bản.");
  };

  document.querySelectorAll(".remove-user").forEach(b=>b.onclick=()=>{
    currentData.users.splice(Number(b.dataset.user),1);
    dirty=true;renderUsers();bindFields();buildEditorNav();$("#saveBtn").disabled=false;
    status("Đã xóa khỏi danh sách. Bấm Xuất bản để áp dụng.");
  });
}

function bindFields(){
  document.querySelectorAll("[data-path]").forEach(el=>{
    el.addEventListener("input",()=>{
      let v=el.value;
      if(el.dataset.type==="number")v=Number(v);
      if(el.dataset.type==="boolean")v=v==="true";
      setAtPath(currentData,el.dataset.path,v);
      dirty=true;
      $("#saveBtn").disabled=false;
      $("#saveBtn").textContent="Xuất bản thay đổi";
      status("Có thay đổi chưa xuất bản.");
    });
  });
}

function buildEditorNav(){
  const host=$("#editorNav");
  if(!host)return;
  const anchors=[...document.querySelectorAll("#editor > .cms-anchor")];
  if(anchors.length<2){host.classList.add("hidden");host.innerHTML="";return}
  anchors.forEach((el,i)=>el.id="cms-section-"+i);
  host.innerHTML='<span>Đi nhanh:</span>'+anchors.map((el,i)=>
    '<button type="button" data-target="cms-section-'+i+'">'+esc(el.dataset.anchorLabel||("Mục "+(i+1)))+'</button>'
  ).join("")+'<button type="button" class="collapse-all">Thu gọn</button>';
  host.classList.remove("hidden");
  host.querySelectorAll("[data-target]").forEach(b=>b.onclick=()=>{
    const el=document.getElementById(b.dataset.target);
    if(el?.tagName==="DETAILS")el.open=true;
    el?.scrollIntoView({behavior:"smooth",block:"start"});
  });
  host.querySelector(".collapse-all")?.addEventListener("click",()=>{
    document.querySelectorAll("#editor details").forEach(d=>d.open=false);
    window.scrollTo({top:0,behavior:"smooth"});
  });
}

async function api(url,opts={}){
  const r=await fetch(url,{
    credentials:"include",
    ...opts,
    headers:{"Content-Type":"application/json",...(opts.headers||{})}
  });
  let b=null;try{b=await r.json()}catch{}
  if(!r.ok){
    const msg=[b?.error,b?.detail].filter(Boolean).join(" · ")||("HTTP "+r.status);
    const err=new Error(msg);err.status=r.status;throw err;
  }
  return b;
}

async function boot(){
  show("boot");
  let r;
  try{r=await fetch(API.session,{credentials:"include",cache:"no-store"})}
  catch{show("remoteGate");return}

  if(r.status===404){show("remoteGate");return}
  if(r.status===401){show("login");return}
  if(r.status===503){show("login");$("#setupHint")?.classList.remove("hidden");return}
  if(!r.ok){show("login");return}

  session=await r.json();
  const sr=await fetch("../cms/schema.json?t="+Date.now(),{cache:"no-store"});
  schema=await sr.json();

  $("#userName").textContent=session.name||session.login;
  $("#userRole").textContent=ROLE_LABELS[session.role]||session.role;
  $("#userRole").dataset.role=session.role;

  renderNav();show("cms");
  const first=schema.modules.find(m=>m.read.includes(session.role));
  if(first)selectModule(first.id);
}

function renderNav(){
  $("#moduleNav").innerHTML=schema.modules
    .filter(m=>m.read.includes(session.role))
    .map(m=>`<button class="module-btn" data-id="${m.id}"><strong>${esc(m.label)}</strong><small>${esc(m.description)}</small></button>`).join("");
  document.querySelectorAll(".module-btn").forEach(b=>b.onclick=()=>selectModule(b.dataset.id));
}

async function selectModule(id){
  if(dirty&&!confirm("Có thay đổi chưa xuất bản. Chuyển mục và bỏ các thay đổi này?"))return;
  currentModule=schema.modules.find(m=>m.id===id);if(!currentModule)return;
  document.querySelectorAll(".module-btn").forEach(b=>b.classList.toggle("active",b.dataset.id===id));

  $("#moduleKicker").textContent="OPEN PHU QUOC CMS";
  $("#moduleTitle").textContent=currentModule.label;
  $("#moduleDesc").textContent=currentModule.description;
  $("#saveBtn").textContent="Xuất bản";

  if(currentModule.preview){
    $("#previewBtn").href=currentModule.preview;
    $("#previewBtn").classList.remove("hidden");
  }else $("#previewBtn").classList.add("hidden");

  status("Đang tải "+currentModule.label+"...");

  try{
    const b=await api(API.content+"?path="+encodeURIComponent(currentModule.path));
    currentData=b.content;currentSha=b.sha;dirty=false;

    if(currentModule.id==="users")renderUsers();
    else $("#editor").innerHTML=renderRoot();

    bindFields();buildEditorNav();

    const writable=currentModule.write.includes(session.role);
    $("#saveBtn").disabled=!writable;
    $("#editor").classList.toggle("readonly",!writable);
    document.querySelectorAll("#editor input,#editor textarea,#editor select,#editor button.remove-user,#addUserBtn")
      .forEach(el=>el.disabled=!writable);

    status(writable?"Sẵn sàng chỉnh sửa. Thay đổi chỉ lên website sau khi bấm Xuất bản.":"Vai trò của bạn chỉ được xem module này.");
  }catch(e){
    $("#editor").innerHTML="";
    $("#editorNav")?.classList.add("hidden");
    status(e.message,"error");
  }
}

async function save(){
  if(!currentModule||!dirty)return;
  $("#saveBtn").disabled=true;
  $("#saveBtn").textContent="Đang xuất bản...";
  status("Đang xuất bản lên Open Phu Quoc...");

  try{
    const b=await api(API.publish,{
      method:"POST",
      body:JSON.stringify({
        path:currentModule.path,
        sha:currentSha,
        content:currentData,
        message:"cms: update "+currentModule.label.toLowerCase()
      })
    });
    currentSha=b.sha||currentSha;dirty=false;
    $("#saveBtn").textContent="Đã xuất bản";
    const commit=b.commit?(" · commit "+String(b.commit).slice(0,7)):"";
    status("Đã xuất bản thành công"+commit+". Website sẽ cập nhật sau deployment.","success");
    setTimeout(()=>{if(!dirty)$("#saveBtn").textContent="Xuất bản"},1800);
  }catch(e){
    status(e.message,"error");
    $("#saveBtn").disabled=false;
    $("#saveBtn").textContent="Thử xuất bản lại";
  }
}

$("#saveBtn").onclick=e=>{e.preventDefault();save()};
$("#logoutBtn").onclick=async()=>{
  await fetch(API.auth+"?action=logout",{method:"POST",credentials:"include"});
  location.reload();
};
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});
boot();
