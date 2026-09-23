const $=s=>document.querySelector(s);
const qsa=s=>Array.from(document.querySelectorAll(s));
const API={session:"/api/cms/session",auth:"/api/cms/auth",content:"/api/cms/content",publish:"/api/cms/publish",media:"/api/cms/media",analytics:"/api/cms/analytics"};

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
  slides:"Ảnh hero",
  alt:"Mô tả ảnh",
  caption:"Chú thích ảnh",
  layout:"Kiểu hiển thị",
  cover_position:"Vị trí cắt cover",
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
  legacy_id:"Mã bài cũ",
  entity_type:"Loại bản ghi",
  slug:"Đường dẫn món",
  aliases:"Tên gọi khác",
  zone_id:"Mã khu vực",
  what_it_is:"Món này là gì",
  why_go:"Vì sao nên thử",
  tips:"Lưu ý khi gọi món",
  intents:"Nhu cầu phù hợp",
  source_refs:"Nguồn kiểm chứng",
  source_id:"Mã nguồn",
  updated_at:"Ngày cập nhật",
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
  enabled:"Đang hoạt động",
  entities:"Địa điểm",
  zone_code:"Khu vực",
  latitude:"Vĩ độ",
  longitude:"Kinh độ",
  address:"Địa chỉ",
  tags:"Nhãn sử dụng",
  opening_hours:"Giờ mở cửa",
  price_level:"Mức giá",
  source_ref:"Nguồn",
  source_type:"Loại nguồn",
  verified_at:"Kiểm tra gần nhất",
  coordinate_precision:"Độ chính xác tọa độ",
  coordinate_source_ref:"Nguồn kiểm tra tọa độ",
  coordinate_source_type:"Loại nguồn tọa độ",
  coordinate_observed_at:"Ngày kiểm tra tọa độ",
  coordinate_confidence:"Độ tin cậy tọa độ",
  coordinate_note:"Ghi chú tọa độ"
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
function markDirty(msg="Có thay đổi chưa xuất bản."){dirty=true;$("#saveBtn").disabled=false;$("#saveBtn").textContent="Gửi duyệt thay đổi";$("#resetBtn")?.classList.remove("hidden");status(msg);scheduleDraft()}

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
  const control=long
    ?`<textarea data-path="${esc(path)}">${esc(text)}</textarea>`
    :`<input${inputAttrs(key)} data-path="${esc(path)}" value="${esc(text)}">`;
  const preview=key==="image"
    ?`<div class="image-preview ${text.trim()?"":"empty"}" data-image-preview="${esc(path)}">${text.trim()?'<img src="'+esc(text.trim())+'" alt="Xem trước ảnh">':'<span>Chưa có ảnh</span>'}</div>`
    :"";
  const media=key==="image"
    ?`<div class="media-actions"><button type="button" class="media-upload" data-media-path="${esc(path)}">Chọn ảnh từ máy</button><span>CMS sẽ thu nhỏ và tối ưu ảnh trước khi tải lên.</span></div>`
    :"";
  let quick="";
  if((key==="source"||key==="url")&&/^https?:\/\//i.test(text.trim()))quick=`<a class="field-quick" href="${esc(text.trim())}" target="_blank" rel="noopener">Mở nguồn ↗</a>`;
  if(/phone/i.test(key)&&text.trim())quick=`<a class="field-quick" href="tel:${esc(text.replace(/[^+\d]/g,""))}">Gọi thử ↗</a>`;
  const fieldLabel=key==="image"&&/^stories\.\d+\.image$/.test(path)?"Ảnh cover":key==="image"&&/\.sections\.\d+\.image$/.test(path)?"Ảnh trong bài":labelize(key);
  return `<div class="field ${key==="image"?"image-field":""}"><label>${esc(fieldLabel)}</label>${control}${media}${preview}${quick}</div>`;
}

function primitiveField(key,val,path){
  if(currentModule?.id==="venues"&&key==="coordinate_confidence"){
    const value=String(val||"");
    return `<div class="field"><label>Độ tin cậy tọa độ</label><select data-path="${esc(path)}">
      <option value="" ${!value?"selected":""}>Chưa đánh giá</option>
      <option value="HIGH" ${value==="HIGH"?"selected":""}>Cao</option>
      <option value="MEDIUM" ${value==="MEDIUM"?"selected":""}>Vừa</option>
      <option value="LOW" ${value==="LOW"?"selected":""}>Thấp</option>
    </select></div>`;
  }
  if(currentModule?.id==="venues"&&key==="coordinate_observed_at"){
    return `<div class="field"><label>Ngày kiểm tra tọa độ</label><input type="date" data-path="${esc(path)}" value="${esc(val||"")}"></div>`;
  }
  if(currentModule?.id==="venues"&&key==="category"){
    const value=String(val||"");
    return `<div class="field"><label>Loại địa điểm</label><select data-path="${esc(path)}">
      <option value="LOCAL_FOOD" ${value==="LOCAL_FOOD"?"selected":""}>Quán ăn địa phương</option>
      <option value="RESTAURANT" ${value==="RESTAURANT"?"selected":""}>Nhà hàng</option>
      <option value="CAFE" ${value==="CAFE"?"selected":""}>Cà phê</option>
      <option value="ATTRACTION" ${value==="ATTRACTION"?"selected":""}>Điểm chơi / trải nghiệm</option>
    </select></div>`;
  }
  if(currentModule?.id==="venues"&&key==="zone_code"){
    const value=String(val||"");
    return `<div class="field"><label>Khu vực</label><select data-path="${esc(path)}">
      <option value="" ${!value?"selected":""}>Chưa gán</option>
      <option value="north" ${value==="north"?"selected":""}>Bắc đảo</option>
      <option value="north_central" ${value==="north_central"?"selected":""}>Ông Lang / Bắc-trung</option>
      <option value="duong_dong" ${value==="duong_dong"?"selected":""}>Dương Đông</option>
      <option value="long_beach" ${value==="long_beach"?"selected":""}>Bãi Trường / Dương Tơ</option>
      <option value="east" ${value==="east"?"selected":""}>Đông đảo / Hàm Ninh</option>
      <option value="south" ${value==="south"?"selected":""}>Nam đảo / An Thới</option>
    </select></div>`;
  }
  if(currentModule?.id==="venues"&&key==="status"){
    const value=String(val||"REVIEW");
    return `<div class="field"><label>Trạng thái</label><select data-path="${esc(path)}">
      <option value="ACTIVE" ${value==="ACTIVE"?"selected":""}>Đang dùng</option>
      <option value="REVIEW" ${value==="REVIEW"?"selected":""}>Cần kiểm tra</option>
      <option value="CLOSED" ${value==="CLOSED"?"selected":""}>Đã đóng</option>
    </select></div>`;
  }
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

function itemTools(arrayPath,index,length){
  return `<div class="item-tools">
    <button type="button" data-array-action="up" data-array-path="${esc(arrayPath)}" data-index="${index}" ${index===0?"disabled":""}>↑ Lên</button>
    <button type="button" data-array-action="down" data-array-path="${esc(arrayPath)}" data-index="${index}" ${index===length-1?"disabled":""}>↓ Xuống</button>
    <button type="button" data-array-action="duplicate" data-array-path="${esc(arrayPath)}" data-index="${index}">Nhân bản</button>
    <button type="button" class="danger" data-array-action="delete" data-array-path="${esc(arrayPath)}" data-index="${index}">Xóa</button>
  </div>`;
}

function renderNode(value,path="",label="Nội dung",depth=0){
  if(value===null||typeof value!=="object")return primitiveField(label,value,path);

  if(Array.isArray(value)){
    const cards=value.map((v,i)=>{
      const p=path?path+"."+i:String(i);
      const title=itemTitle(v,i);
      if(v&&typeof v==="object"){
        return `<details class="array-card" ${i===0&&value.length<4?"open":""}><summary><span>${esc(title)}</span><small>#${i+1}</small></summary><div class="detail-body">${itemTools(path,i,value.length)}${renderChildren(v,p,depth+1)}</div></details>`;
      }
      return `<div class="array-card primitive-array"><div class="array-title">#${i+1}</div>${itemTools(path,i,value.length)}${primitiveField(String(i),v,p)}</div>`;
    }).join("");
    return `<details class="field-group cms-anchor" data-anchor-label="${esc(labelize(label))}" ${depth<=1?"open":""}><summary class="group-summary"><span>${esc(labelize(label))}</span><small>${value.length} mục</small></summary><div class="detail-body">${cards}<button type="button" class="add-array-item" data-array-path="${esc(path)}">+ Thêm mục</button></div></details>`;
  }

  return `<details class="field-group cms-anchor" data-anchor-label="${esc(labelize(label))}" ${depth<=1?"open":""}><summary class="group-summary"><span>${esc(labelize(label))}</span></summary><div class="detail-body">${renderChildren(value,path,depth+1)}</div></details>`;
}

function moduleOverview(){
  if(!currentModule||!currentData)return "";

  if(currentModule.id==="home"){
    const hero=currentData.hero||{};
    const sections=Object.values(currentData.sections||{});
    return `<section class="module-overview home-overview">
      <div class="overview-copy">
        <span class="overview-kicker">${esc(hero.kicker||"TRANG CHỦ")}</span>
        <h2>${esc(hero.title||"Chưa có tiêu đề hero")}</h2>
        <p>${esc(hero.lead||"")}</p>
      </div>
      <div class="overview-section-list">
        ${sections.slice(0,6).map(x=>'<span>'+esc(x.title||x.eyebrow||"Mục")+'</span>').join("")}
      </div>
    </section>`;
  }

  if(currentModule.id==="stories"){
    const stories=currentData.stories||[];
    const totalMinutes=stories.reduce((n,x)=>n+(Number(x.read_minutes)||0),0);
    return `<section class="module-overview stats-overview">
      <div><strong>${stories.length}</strong><span>Bài viết</span></div>
      <div><strong>${stories.reduce((n,x)=>n+(x.sections?.length||0),0)}</strong><span>Đoạn nội dung</span></div>
      <div><strong>${totalMinutes}</strong><span>Phút đọc tổng</span></div>
      <div><strong>${stories.filter(x=>x.image).length}</strong><span>Bài có ảnh</span></div>
    </section>`;
  }

  if(currentModule.id==="guide"){
    const zones=currentData.zones||[];
    return `<section class="module-overview guide-overview">
      <div class="overview-copy"><span class="overview-kicker">CẨM NANG</span><h2>${esc(currentData.title||"Cẩm nang Phú Quốc")}</h2><p>${esc(currentData.intro||"")}</p></div>
      <div class="zone-preview-grid">${zones.map(z=>`<article>${z.image?'<img src="'+esc(z.image)+'" alt="">':""}<div><b>${esc(z.name||"")}</b><span>${esc(z.tag||"")}</span></div></article>`).join("")}</div>
    </section>`;
  }

  if(currentModule.id==="utilities"){
    const emergency=currentData.national_emergency||[];
    const directory=currentData.directory||[];
    const verified=[...(currentData.phu_quoc||[]),...directory].filter(x=>x.verified).length;
    return `<section class="module-overview utilities-overview">
      <div class="emergency-preview">${emergency.map(x=>`<div><strong>${esc(x.phone||x.id||"")}</strong><span>${esc(x.label||"")}</span></div>`).join("")}</div>
      <div class="utility-stats"><span><b>${directory.length}</b> mục danh bạ</span><span><b>${verified}</b> mục đã xác minh</span><span><b>${(currentData.ticket_reference||[]).length}</b> giá/show tham khảo</span></div>
    </section>`;
  }

  if(currentModule.id==="foods"){
    const entities=currentData?.entities||[];
    const ids=new Set(),legacyIds=new Set();
    entities.forEach((x,i)=>{
      const id=String(x.id||"").trim(),legacy=String(x.legacy_id||"").trim(),name=String(x.name||"").trim();
      if(!id)errors.push("Món #"+(i+1)+" chưa có mã món."); else if(ids.has(id))errors.push("Mã món bị trùng: "+id); else ids.add(id);
      if(!legacy)errors.push("Món "+(name||("#"+(i+1)))+" chưa có mã bài cũ."); else if(legacyIds.has(legacy))errors.push("Mã bài cũ bị trùng: "+legacy); else legacyIds.add(legacy);
      if(!name)errors.push("Món #"+(i+1)+" chưa có tên.");
      if(!Array.isArray(x.source_refs)||!x.source_refs.length||x.source_refs.some(ref=>!String(ref?.source_id||"").trim()))errors.push("Món "+(name||id||("#"+(i+1)))+" cần nguồn kiểm chứng có mã nguồn.");
    });
  }

  if(currentModule.id==="venues"){
    const entities=currentData.entities||[];
    const counts=entities.reduce((acc,x)=>{
      const key=x.category||"OTHER";
      acc[key]=(acc[key]||0)+1;
      return acc;
    },{});
    return `<section class="module-overview stats-overview">
      <div><strong>${entities.length}</strong><span>Điểm đang quản lý</span></div>
      <div><strong>${counts.LOCAL_FOOD||0}</strong><span>Quán ăn</span></div>
      <div><strong>${counts.RESTAURANT||0}</strong><span>Nhà hàng</span></div>
      <div><strong>${counts.CAFE||0}</strong><span>Cà phê</span></div>
      <div><strong>${counts.ATTRACTION||0}</strong><span>Điểm chơi</span></div>
    </section>`;
  }

  if(currentModule.id==="users"){
    const users=currentData.users||[];
    return `<section class="module-overview stats-overview">
      <div><strong>${users.length}</strong><span>Người dùng</span></div>
      <div><strong>${users.filter(x=>x.enabled!==false).length}</strong><span>Đang hoạt động</span></div>
      <div><strong>${users.filter(x=>x.role==="admin"&&x.enabled!==false).length}</strong><span>Admin hoạt động</span></div>
    </section>`;
  }

  return "";
}

function slugifyVi(s){
  return String(s||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/đ/g,"d").replace(/Đ/g,"D")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"");
}

function validateCurrent(){
  const errors=[];

  if(currentModule.id==="home"){
    if(!String(currentData?.hero?.title||"").trim())errors.push("Hero cần có tiêu đề.");
    if(!String(currentData?.hero?.lead||"").trim())errors.push("Hero cần có đoạn dẫn.");
  }

  if(currentModule.id==="stories"){
    const stories=currentData?.stories||[];
    if(!stories.length)errors.push("Cần ít nhất một bài viết.");
    const ids=new Set();
    stories.forEach((s,i)=>{
      if(!String(s.title||"").trim())errors.push("Bài #"+(i+1)+" chưa có tiêu đề.");
      if(!String(s.id||"").trim())errors.push("Bài #"+(i+1)+" chưa có mã bài.");
      else if(ids.has(s.id))errors.push("Mã bài bị trùng: "+s.id);
      else ids.add(s.id);
      if(!Array.isArray(s.sections)||!s.sections.length)errors.push("Bài “"+(s.title||("#"+(i+1)))+"” chưa có đoạn nội dung.");
    });
  }

  if(currentModule.id==="guide"){
    if(!String(currentData?.title||"").trim())errors.push("Cẩm nang cần có tiêu đề.");
    (currentData?.zones||[]).forEach((z,i)=>{if(!String(z.name||"").trim())errors.push("Khu vực #"+(i+1)+" chưa có tên.")});
  }

  if(currentModule.id==="utilities"){
    (currentData?.national_emergency||[]).forEach((x,i)=>{
      if(!String(x.label||"").trim()||!String(x.phone||"").trim())errors.push("Số khẩn cấp #"+(i+1)+" thiếu tên hoặc số điện thoại.");
    });
  }

  if(currentModule.id==="venues"){
    const entities=currentData?.entities||[];
    const ids=new Set();
    const allowed=new Set(["LOCAL_FOOD","RESTAURANT","CAFE","ATTRACTION"]);
    entities.forEach((x,i)=>{
      const id=String(x.id||"").trim();
      const name=String(x.name||"").trim();
      if(!id)errors.push("Địa điểm #"+(i+1)+" chưa có mã.");
      else if(ids.has(id))errors.push("Mã địa điểm bị trùng: "+id);
      else ids.add(id);
      if(!name)errors.push("Địa điểm #"+(i+1)+" chưa có tên.");
      if(!allowed.has(String(x.category||"")))errors.push("Địa điểm “"+(name||id||("#"+(i+1)))+"” chưa chọn đúng loại.");
      if(String(x.status||"REVIEW")==="ACTIVE"){
        if(!String(x.verified_at||"").trim())errors.push("Địa điểm đang dùng cần ngày kiểm tra: "+(name||id));
        if(!String(x.source_ref||"").trim())errors.push("Địa điểm đang dùng cần nguồn: "+(name||id));
      }
      const coordinateEvidence=["coordinate_precision","coordinate_source_ref","coordinate_source_type","coordinate_observed_at","coordinate_confidence"].some(key=>String(x[key]||"").trim());
      if(coordinateEvidence){
        if(!String(x.coordinate_precision||"").trim())errors.push("Địa điểm "+(name||id)+" thiếu độ chính xác tọa độ.");
        if(!String(x.coordinate_source_ref||"").trim())errors.push("Địa điểm "+(name||id)+" thiếu nguồn kiểm tra tọa độ.");
        if(!String(x.coordinate_source_type||"").trim())errors.push("Địa điểm "+(name||id)+" thiếu loại nguồn tọa độ.");
        if(!/^\d{4}-\d{2}-\d{2}$/.test(String(x.coordinate_observed_at||"")))errors.push("Địa điểm "+(name||id)+" thiếu ngày kiểm tra tọa độ.");
        if(!["HIGH","MEDIUM","LOW"].includes(String(x.coordinate_confidence||"").toUpperCase()))errors.push("Địa điểm "+(name||id)+" cần chọn độ tin cậy tọa độ.");
      }
      if(x.latitude!==null&&x.latitude!==""&&x.latitude!==undefined){
        const lat=Number(x.latitude);
        if(!Number.isFinite(lat)||lat<-90||lat>90)errors.push("Vĩ độ không hợp lệ: "+(name||id));
      }
      if(x.longitude!==null&&x.longitude!==""&&x.longitude!==undefined){
        const lon=Number(x.longitude);
        if(!Number.isFinite(lon)||lon<-180||lon>180)errors.push("Kinh độ không hợp lệ: "+(name||id));
      }
    });
  }

  if(currentModule.id==="users"){
    const users=currentData?.users||[];
    const activeAdmins=users.filter(x=>x.role==="admin"&&x.enabled!==false);
    if(!activeAdmins.length)errors.push("CMS phải còn ít nhất một Admin đang hoạt động.");
    const seen=new Set();
    users.forEach((u,i)=>{
      const login=String(u.login||"").trim().toLowerCase();
      if(!login)errors.push("Người dùng #"+(i+1)+" chưa có GitHub username.");
      else if(seen.has(login))errors.push("GitHub username bị trùng: "+login);
      else seen.add(login);
    });
  }

  return errors;
}

function storyTools(i,len){
  return `<div class="item-tools story-tools">
    <button type="button" data-story-action="up" data-index="${i}" ${i===0?"disabled":""}>↑ Lên</button>
    <button type="button" data-story-action="down" data-index="${i}" ${i===len-1?"disabled":""}>↓ Xuống</button>
    <button type="button" data-story-action="duplicate" data-index="${i}">Nhân bản bài</button>
    <button type="button" class="danger" data-story-action="delete" data-index="${i}">Xóa bài</button>
  </div>`;
}

function storyWordCount(story){
  const text=[story?.title,story?.dek,story?.intro,...(story?.sections||[]).flatMap(x=>[x?.heading,x?.body])]
    .filter(Boolean).join(" ").trim();
  return text?text.split(/\s+/).length:0;
}

function storyReadMinutes(story){
  return Math.max(1,Math.ceil(storyWordCount(story)/220));
}

function storyLayoutField(val,path){
  const value=val||"wide";
  return `<div class="field"><label>Kiểu hiển thị ảnh</label><select data-path="${esc(path)}">
    <option value="body" ${value==="body"?"selected":""}>Trong cột bài viết</option>
    <option value="wide" ${value==="wide"?"selected":""}>Ảnh rộng</option>
    <option value="full" ${value==="full"?"selected":""}>Ảnh lớn toàn khung</option>
  </select></div>`;
}

function coverPositionField(val,path){
  const value=val||"center";
  return `<div class="field"><label>Vị trí cắt cover</label><select data-path="${esc(path)}">
    <option value="center" ${value==="center"?"selected":""}>Giữa ảnh</option>
    <option value="top" ${value==="top"?"selected":""}>Ưu tiên phía trên</option>
    <option value="bottom" ${value==="bottom"?"selected":""}>Ưu tiên phía dưới</option>
    <option value="left" ${value==="left"?"selected":""}>Ưu tiên bên trái</option>
    <option value="right" ${value==="right"?"selected":""}>Ưu tiên bên phải</option>
  </select></div>`;
}

function renderStoryWorkbench(story,i){
  const p="stories."+i;
  const sections=Array.isArray(story.sections)?story.sections:[];
  const sources=Array.isArray(story.sources)?story.sources:[];
  const slugButton=!String(story.id||"").trim()
    ?`<button type="button" class="story-slug" data-story-slug="${i}">Tạo mã từ tiêu đề</button>`
    :"";

  const previewPos={top:"50% 18%",bottom:"50% 82%",left:"18% 50%",right:"82% 50%",center:"50% 50%"}[story.cover_position]||"50% 50%";
  const cover=story.image
    ?`<img data-story-preview-image="${i}" src="${esc(story.image)}" alt="" style="object-position:${previewPos}">`
    :`<div class="story-cover-empty" data-story-preview-image="${i}">Chưa có ảnh cover</div>`;

  const sectionHtml=sections.map((section,j)=>{
    const sp=p+".sections."+j;
    return `<article class="story-section-card">
      <div class="story-card-head"><strong>Đoạn ${j+1}</strong>${itemTools(p+".sections",j,sections.length)}</div>
      ${primitiveField("heading",section.heading||"",sp+".heading")}
      ${primitiveField("body",section.body||"",sp+".body")}
      <details class="section-media-tools" ${section.image?"open":""}>
        <summary>Ảnh cho đoạn này <small>${section.image?"đã có ảnh":"không bắt buộc"}</small></summary>
        <div class="section-media-body">
          ${primitiveField("image",section.image||"",sp+".image")}
          ${primitiveField("caption",section.caption||"",sp+".caption")}
          ${storyLayoutField(section.layout||"wide",sp+".layout")}
        </div>
      </details>
    </article>`;
  }).join("");

  const sourceHtml=sources.map((source,j)=>{
    const sp=p+".sources."+j;
    return `<article class="story-source-card">
      <div class="story-card-head"><strong>Nguồn ${j+1}</strong>${itemTools(p+".sources",j,sources.length)}</div>
      ${primitiveField("label",source.label||"",sp+".label")}
      ${primitiveField("url",source.url||"",sp+".url")}
    </article>`;
  }).join("");

  return `<details class="field-group story-editor story-workbench cms-anchor" data-anchor-label="${esc(story.title||("Bài "+(i+1)))}" ${i===0?"open":""}>
    <summary class="group-summary">
      <span>${esc(story.title||("Bài "+(i+1)))}</span>
      <small>${esc(story.category||"Bài viết")} · ${storyReadMinutes(story)} phút</small>
    </summary>
    <div class="detail-body">
      ${storyTools(i,currentData.stories.length)}
      <div class="story-editor-grid">
        <aside class="story-live-preview">
          <div class="story-cover">${cover}</div>
          <span data-story-preview-category="${i}">${esc(story.category||"CHUYÊN MỤC")}</span>
          <h2 data-story-preview-title="${i}">${esc(story.title||"Tiêu đề bài viết")}</h2>
          <p class="story-preview-dek" data-story-preview-dek="${i}">${esc(story.dek||"Mô tả ngắn của bài viết sẽ xuất hiện ở đây.")}</p>
          <div class="story-preview-meta"><b data-story-preview-minutes="${i}">${story.read_minutes||storyReadMinutes(story)}</b> phút đọc · <b data-story-preview-words="${i}">${storyWordCount(story)}</b> từ</div>
        </aside>
        <div class="story-main-fields">
          <div class="story-fields-2">
            ${primitiveField("category",story.category||"",p+".category")}
            ${primitiveField("read_minutes",Number(story.read_minutes)||storyReadMinutes(story),p+".read_minutes")}
          </div>
          ${primitiveField("title",story.title||"",p+".title")}
          <div class="story-slug-row">
            ${primitiveField("id",story.id||"",p+".id")}
            ${slugButton}
          </div>
          ${primitiveField("dek",story.dek||"",p+".dek")}
          ${primitiveField("image",story.image||"",p+".image")}
          ${coverPositionField(story.cover_position||"center",p+".cover_position")}
          ${primitiveField("intro",story.intro||"",p+".intro")}
          <button type="button" class="story-readtime" data-story-readtime="${i}">Tính lại thời gian đọc</button>
        </div>
      </div>

      <section class="story-builder-block">
        <div class="story-builder-head"><div><span>NỘI DUNG</span><h3>Các đoạn trong bài</h3></div><button type="button" class="add-array-item" data-array-path="${esc(p+".sections")}">+ Thêm đoạn</button></div>
        <div class="story-section-list">${sectionHtml||'<p class="empty-builder">Chưa có đoạn nội dung.</p>'}</div>
      </section>

      <section class="story-builder-block">
        <div class="story-builder-head"><div><span>NGUỒN</span><h3>Tài liệu tham khảo</h3></div><button type="button" class="add-array-item" data-array-path="${esc(p+".sources")}">+ Thêm nguồn</button></div>
        <div class="story-source-list">${sourceHtml||'<p class="empty-builder">Chưa có nguồn tham khảo.</p>'}</div>
      </section>
    </div>
  </details>`;
}

function renderHomeWorkbench(){
  const hero=currentData.hero||{};
  const slides=Array.isArray(hero.slides)?hero.slides:[];
  const sections=currentData.sections||{};

  const slideCards=slides.map((slide,i)=>{
    const p="hero.slides."+i;
    return `<article class="home-slide-card">
      <div class="home-slide-head"><strong>Ảnh hero ${i+1}</strong><span>${esc(slide.label||"")}</span></div>
      ${primitiveField("label",slide.label||"",p+".label")}
      ${primitiveField("image",slide.image||"",p+".image")}
      ${primitiveField("alt",slide.alt||"",p+".alt")}
    </article>`;
  }).join("");

  const sectionCards=Object.entries(sections).map(([key,section])=>{
    return `<article class="home-section-card">
      <span>${esc(labelize(key))}</span>
      ${primitiveField("eyebrow",section.eyebrow||"","sections."+key+".eyebrow")}
      ${primitiveField("title",section.title||"","sections."+key+".title")}
      ${Object.prototype.hasOwnProperty.call(section,"lead")?primitiveField("lead",section.lead||"","sections."+key+".lead"):""}
    </article>`;
  }).join("");

  return moduleOverview()+
    `<details class="field-group home-workbench cms-anchor" data-anchor-label="Hero đầu trang" open>
      <summary class="group-summary"><span>Hero đầu trang</span></summary>
      <div class="detail-body">
        <div class="home-hero-fields">
          ${primitiveField("kicker",hero.kicker||"","hero.kicker")}
          ${primitiveField("title",hero.title||"","hero.title")}
          ${primitiveField("lead",hero.lead||"","hero.lead")}
        </div>
        <div class="home-slide-grid">${slideCards}</div>
      </div>
    </details>
    <details class="field-group home-workbench cms-anchor" data-anchor-label="Tiêu đề các khối" open>
      <summary class="group-summary"><span>Tiêu đề các khối nội dung</span><small>${Object.keys(sections).length} khối</small></summary>
      <div class="detail-body"><div class="home-section-grid">${sectionCards}</div></div>
    </details>`;
}

function utilityBadge(item){
  if(item?.verified===true)return '<span class="utility-badge verified">Đã xác minh</span>';
  if(item?.verified===false)return '<span class="utility-badge review">Cần kiểm tra</span>';
  if(item?.dynamic===true)return '<span class="utility-badge dynamic">Dữ liệu động</span>';
  return "";
}

function renderGuideArray(path,title,lead){
  const arr=getAtPath(currentData,path);
  const list=Array.isArray(arr)?arr:[];
  const cards=list.map((item,i)=>{
    const p=path+"."+i;
    const titleText=item?.name||item?.group||item?.title||("Mục "+(i+1));
    const sub=item?.tag||item?.best_for||item?.note||"";
    const image=item?.image?`<img class="guide-card-thumb" src="${esc(item.image)}" alt="">`:"";
    return `<article class="guide-edit-card">
      <div class="guide-card-head">${image}<div><strong>${esc(titleText)}</strong>${sub?'<span>'+esc(sub)+'</span>':""}</div></div>
      ${itemTools(path,i,list.length)}
      ${renderChildren(core,p,1)}
      ${renderVenueLocationEvidence(item,p)}
    </article>`;
  }).join("");

  return `<details class="field-group guide-workbench cms-anchor" data-anchor-label="${esc(title)}" open>
    <summary class="group-summary"><span>${esc(title)}</span><small>${list.length} mục</small></summary>
    <div class="detail-body">
      ${lead?'<p class="group-lead">'+esc(lead)+'</p>':""}
      <div class="guide-edit-list">${cards||'<p class="empty-builder">Chưa có dữ liệu.</p>'}</div>
      <button type="button" class="add-array-item" data-array-path="${esc(path)}">+ Thêm mục</button>
    </div>
  </details>`;
}

function renderGuideWorkbench(){
  const meta=["version","source_file","source_updated","title","intro"]
    .map(k=>primitiveField(k,currentData?.[k]??"",k)).join("");

  return moduleOverview()+
    `<section class="meta-strip guide-meta">${meta}</section>`+
    renderGuideArray("zones","Ba vùng chính","Khung định hướng Bắc đảo, Trung tâm & bờ Tây, Nam đảo.")+
    renderGuideArray("north_rhythm","Nhịp Bắc đảo","Cách ghép Safari, VinWonders và Grand World cho hợp nhịp.")+
    renderGuideArray("hotels.tiers","Phân hạng khách sạn","Giải thích khách nên nhìn gì ở từng phân khúc.")+
    renderGuideArray("hotels.areas","Khách sạn theo khu vực","Các cụm lưu trú và cách chọn theo vị trí.")+
    renderGuideArray("food","Ăn gì ở Phú Quốc","Nhóm món và lưu ý thực dụng.")+
    renderGuideArray("itineraries","Lịch trình gợi ý","Các khung hành trình mẫu, ưu tiên nhịp đi hợp lý.");
}

function renderUtilityArray(key,title,lead){
  const arr=Array.isArray(currentData?.[key])?currentData[key]:[];
  const cards=arr.map((item,i)=>{
    const p=key+"."+i;
    const titleText=item?.label||item?.place||item?.trip||item?.group||item?.from||("Mục "+(i+1));
    const sub=item?.phone||item?.price||item?.choice||item?.to||item?.activity||"";
    return `<article class="utility-edit-card">
      <div class="utility-card-head">
        <div><strong>${esc(titleText)}</strong>${sub?'<span>'+esc(sub)+'</span>':""}</div>
        ${utilityBadge(item)}
      </div>
      ${itemTools(key,i,arr.length)}
      ${renderChildren(item,p,1)}
      ${renderVenueLocationEvidence(item,p)}
    </article>`;
  }).join("");

  return `<details class="field-group utility-workbench cms-anchor" data-anchor-label="${esc(title)}" open>
    <summary class="group-summary"><span>${esc(title)}</span><small>${arr.length} mục</small></summary>
    <div class="detail-body">
      ${lead?'<p class="group-lead">'+esc(lead)+'</p>':""}
      <div class="utility-edit-list">${cards||'<p class="empty-builder">Chưa có dữ liệu.</p>'}</div>
      <button type="button" class="add-array-item" data-array-path="${esc(key)}">+ Thêm mục</button>
    </div>
  </details>`;
}

function renderUtilitiesWorkbench(){
  const meta=["schema_version","generated_at","source_policy"].map(k=>primitiveField(k,currentData?.[k]??"",k)).join("");
  const support=["handbook_source","sync"].map(k=>currentData?.[k]?renderNode(currentData[k],k,k,0):"").join("");

  return moduleOverview()+
    `<section class="meta-strip utility-meta">${meta}</section>`+
    renderUtilityArray("national_emergency","Khẩn cấp quốc gia","Nhóm số cần nhìn thấy nhanh nhất. Chỉ dùng nguồn chính thức.")+
    renderUtilityArray("phu_quoc","Danh bạ Phú Quốc","Cơ quan và đầu mối địa phương.")+
    renderUtilityArray("directory","Danh bạ hữu ích","Tàu, vui chơi, y tế và các đầu mối du khách thường cần.")+
    renderUtilityArray("ticket_reference","Giá vé & show","Giá tham khảo động. Luôn giữ ghi chú và điều kiện kiểm tra lại.")+
    renderUtilityArray("travel_times","Thời gian di chuyển","Khoảng thời gian thực dụng để khách hình dung quy mô đảo.")+
    renderUtilityArray("transport_choices","Chọn phương tiện","Gợi ý theo nhu cầu chuyến đi.")+
    renderUtilityArray("checklist","Checklist trước chuyến đi","Những thứ nên kiểm tra trước khi ra đảo.")+
    support;
}

function renderVenueLocationEvidence(item,path){
  const value=key=>item?.[key]??"";
  return `<details class="venue-location-proof">
    <summary>Vị trí và nguồn tọa độ <small>${value("coordinate_precision")&&value("coordinate_source_ref")?"Có thông tin":"Cần bổ sung khi đã kiểm tra"}</small></summary>
    <div class="venue-location-grid">
      ${primitiveField("coordinate_precision",value("coordinate_precision"),path+".coordinate_precision")}
      ${primitiveField("coordinate_source_ref",value("coordinate_source_ref"),path+".coordinate_source_ref")}
      ${primitiveField("coordinate_source_type",value("coordinate_source_type"),path+".coordinate_source_type")}
      ${primitiveField("coordinate_observed_at",value("coordinate_observed_at"),path+".coordinate_observed_at")}
      ${primitiveField("coordinate_confidence",value("coordinate_confidence"),path+".coordinate_confidence")}
      ${primitiveField("coordinate_note",value("coordinate_note"),path+".coordinate_note")}
    </div>
    <p>Ghi nguồn đã dùng để kiểm tra chính tọa độ, ngày kiểm tra và tọa độ đại diện cho cổng vào, khu vực hay điểm tham chiếu. Nguồn bài giới thiệu địa điểm không tự chứng minh vị trí chính xác.</p>
  </details>`;
}

function focusRequestedFood(){
  const params=new URLSearchParams(location.search);
  const id=params.get("record"),field=params.get("field");
  if(!id||currentModule?.id!=="foods")return;
  const card=Array.from(document.querySelectorAll("[data-food-id]")).find(item=>item.dataset.foodId===id);
  if(!card)return;
  card.classList.add("quality-focus");
  card.scrollIntoView({behavior:"smooth",block:"center"});
  if(field){
    const target=Array.from(card.querySelectorAll("[data-path]")).find(item=>item.dataset.path.endsWith("."+field));
    target?.focus({preventScroll:true});
  }
}

function focusRequestedVenue(){
  const params=new URLSearchParams(location.search);
  const id=params.get("record"),requestedField=params.get("field");
  if(!id||currentModule?.id!=="venues")return;
  const card=Array.from(document.querySelectorAll("[data-venue-id]")).find(item=>item.dataset.venueId===id);
  if(!card)return;
  card.classList.add("quality-focus");
  card.scrollIntoView({behavior:"smooth",block:"center"});
  const field=requestedField==="coordinate_evidence"?"coordinate_precision":requestedField;
  const proof=card.querySelector(".venue-location-proof");
  if(["coordinate_precision","coordinate_source_ref","coordinate_source_type","coordinate_observed_at","coordinate_confidence","coordinate_note"].includes(field)&&proof)proof.open=true;
  if(field==="latitude/longitude"){
    const coordinates=Array.from(card.querySelectorAll("[data-path]")).filter(item=>/\\.(latitude|longitude)$/.test(item.dataset.path));
    const target=coordinates.find(item=>!String(item.value||"").trim())||coordinates[0];
    target?.focus({preventScroll:true});
  }else if(field){
    const target=Array.from(card.querySelectorAll("[data-path]")).find(item=>item.dataset.path.endsWith("."+field));
    target?.focus({preventScroll:true});
  }
}

function renderVenueWorkbench(){
  const entities=Array.isArray(currentData?.entities)?currentData.entities:[];
  const cards=entities.map((item,i)=>{
    const p="entities."+i;
    const core={...item};
    ["coordinate_precision","coordinate_source_ref","coordinate_source_type","coordinate_observed_at","coordinate_confidence","coordinate_note"].forEach(key=>delete core[key]);
    const categoryLabel={
      LOCAL_FOOD:"Quán ăn",
      RESTAURANT:"Nhà hàng",
      CAFE:"Cà phê",
      ATTRACTION:"Điểm chơi"
    }[item.category]||item.category||"Chưa phân loại";
    return `<article class="utility-edit-card cms-anchor" data-venue-id="${esc(item.id||"")}" data-anchor-label="${esc(item.name||("Địa điểm "+(i+1)))}">
      <div class="utility-card-head">
        <div><strong>${esc(item.name||("Địa điểm "+(i+1)))}</strong><span>${esc(categoryLabel)} · ${esc(item.zone_code||"chưa gán khu")}</span></div>
        ${item.status==="ACTIVE"?'<span class="utility-badge verified">Đang dùng</span>':item.status==="CLOSED"?'<span class="utility-badge review">Đã đóng</span>':'<span class="utility-badge dynamic">Cần kiểm tra</span>'}
      </div>
      ${itemTools("entities",i,entities.length)}
      ${renderChildren(item,p,1)}
    </article>`;
  }).join("");

  return moduleOverview()+
    `<section class="field-group cms-anchor" data-anchor-label="Danh sách địa điểm">
      <div class="detail-body">
        <p class="group-lead">Đây là nguồn dùng chung cho Near Me và JoTrip. Chỉ nhập tọa độ/giờ mở khi đã kiểm tra; chưa chắc thì để trống hoặc trạng thái REVIEW.</p>
        <div class="utility-edit-list">${cards||'<p class="empty-builder">Chưa có quán/điểm nào. Bấm “Thêm địa điểm”.</p>'}</div>
        <button type="button" id="addVenueBtn" class="add-array-item">+ Thêm địa điểm</button>
      </div>
    </section>`;
}

function renderRoot(){
  if(currentModule?.id==="home")return renderHomeWorkbench();
  if(currentModule?.id==="utilities")return renderUtilitiesWorkbench();
  if(currentModule?.id==="guide")return renderGuideWorkbench();
  if(currentModule?.id==="venues")return renderVenueWorkbench();
  if(currentModule?.id==="foods")return renderFoodWorkbench();

  if(currentModule?.id==="stories"&&Array.isArray(currentData?.stories)){
    const meta=Object.entries(currentData).filter(([k])=>k!=="stories").map(([k,v])=>primitiveField(k,v,k)).join("");
    const stories=currentData.stories.map((story,i)=>renderStoryWorkbench(story,i)).join("");
    return moduleOverview()+`<section class="meta-strip">${meta}<div class="meta-actions"><button type="button" id="addStoryBtn">+ Bài viết mới</button></div></section>${stories}`;
  }

  return moduleOverview()+Object.entries(currentData||{}).map(([k,v])=>{
    if(v&&typeof v==="object")return renderNode(v,k,k,0);
    return primitiveField(k,v,k);
  }).join("");
}

function renderFoodWorkbench(){
  const entities=currentData?.entities||[];
  const cards=entities.map((item,i)=>{
    const editable={...item};delete editable.entity_type;
    return `<article class="food-record" data-food-card data-food-id="${esc(item.id||"")}">
      <header class="food-record-head"><div><span class="food-type-tag">Món ăn</span><h2 data-food-title="${i}">${esc(item.name||"Món mới")}</h2><p>${esc(item.legacy_id||"Chưa ghép mã bài cũ")} · ${esc(item.id||"Chưa có mã món")}</p></div>${itemTools("entities",i,entities.length)}</header>
      <div class="food-record-fields">${renderChildren(editable,"entities."+i,1)}</div>
    </article>`;
  }).join("");
  return moduleOverview()+`<section class="food-workbench"><div class="food-workbench-head"><div><h2>Danh sách món ăn</h2><p>Ghép bài cũ bằng mã legacy ID. Chỉ thêm nội dung và nguồn đã kiểm chứng.</p></div><button type="button" id="addFoodBtn">+ Thêm món</button></div><div class="food-record-list">${cards||'<p class="food-empty">Chưa có món nào trong danh sách.</p>'}</div></section>`;
}

function renderUsers(){
  const users=currentData.users||[];
  $("#editor").innerHTML=moduleOverview()+
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
    markDirty("Đã thêm người dùng mới. Nhập GitHub username rồi bấm Gửi duyệt.");
    rerender();
  };

  document.querySelectorAll(".remove-user").forEach(b=>b.onclick=()=>{
    const i=Number(b.dataset.user);
    const user=currentData.users[i];
    if(!confirm("Xóa "+(user?.name||user?.login||"người dùng này")+" khỏi CMS?"))return;
    currentData.users.splice(i,1);
    markDirty("Đã xóa khỏi danh sách. Bấm Xuất bản để áp dụng.");
    rerender();
  });
}


function readAsDataURL(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(new Error("Không đọc được ảnh"));
    reader.readAsDataURL(blob);
  });
}

function loadBrowserImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Trình duyệt không đọc được định dạng ảnh này"))};
    img.src=url;
  });
}

async function prepareImage(file){
  if(!file)throw new Error("Chưa chọn ảnh");
  if(file.size>18*1024*1024)throw new Error("Ảnh gốc quá lớn. Chọn ảnh dưới 18 MB.");

  const img=await loadBrowserImage(file);
  const maxEdge=2200;
  const scale=Math.min(1,maxEdge/Math.max(img.naturalWidth||1,img.naturalHeight||1));
  const width=Math.max(1,Math.round(img.naturalWidth*scale));
  const height=Math.max(1,Math.round(img.naturalHeight*scale));

  const canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d",{alpha:true});
  ctx.drawImage(img,0,0,width,height);

  let blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",0.86));
  let mime="image/webp",ext="webp";

  if(!blob){
    blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.88));
    mime="image/jpeg";ext="jpg";
  }

  if(!blob)throw new Error("Không tối ưu được ảnh này");
  if(blob.size>6*1024*1024)throw new Error("Ảnh sau tối ưu vẫn lớn hơn 6 MB");

  const original=String(file.name||"image").replace(/\.[^.]+$/,"");
  return {blob,mime,filename:original+"."+ext,width,height};
}

async function uploadMedia(path,button){
  const picker=document.createElement("input");
  picker.type="file";
  picker.accept="image/jpeg,image/png,image/webp,image/heic,image/heif";
  picker.style.display="none";
  document.body.appendChild(picker);

  picker.onchange=async()=>{
    const file=picker.files?.[0];
    picker.remove();
    if(!file)return;

    const oldText=button.textContent;
    button.disabled=true;
    button.textContent="Đang xử lý ảnh...";
    status("Đang tối ưu ảnh để tải lên...");

    try{
      const prepared=await prepareImage(file);
      const dataUrl=await readAsDataURL(prepared.blob);
      const base64=dataUrl.split(",")[1]||"";

      button.textContent="Đang tải ảnh...";
      const result=await api(API.media,{
        method:"POST",
        body:JSON.stringify({
          filename:prepared.filename,
          mime:prepared.mime,
          content_base64:base64
        })
      });

      const input=document.querySelector('[data-path="'+CSS.escape(path)+'"]');
      if(!input)throw new Error("Không tìm thấy ô ảnh");
      input.value=result.url;
      input.dispatchEvent(new Event("input",{bubbles:true}));

      const box=input.closest(".image-field")?.querySelector("[data-image-preview]");
      if(box){
        box.classList.remove("empty");
        box.innerHTML='<img src="'+dataUrl+'" alt="Ảnh vừa chọn">';
      }

      const m=path.match(/^stories\.(\d+)\.image$/);
      if(m){
        const cover=document.querySelector('[data-story-preview-image="'+m[1]+'"]');
        if(cover)cover.outerHTML='<img data-story-preview-image="'+m[1]+'" src="'+dataUrl+'" alt="">';
      }

      status("Đã tải ảnh lên thư viện Open Phu Quoc. Bấm Xuất bản để gắn ảnh vào nội dung.","success");
    }catch(e){
      status(e.message||String(e),"error");
    }finally{
      button.disabled=false;
      button.textContent=oldText;
    }
  };

  picker.click();
}

function bindMediaControls(){
  document.querySelectorAll("[data-media-path]").forEach(btn=>{
    btn.onclick=()=>uploadMedia(btn.dataset.mediaPath,btn);
  });
}

function bindFields(){
  document.querySelectorAll("[data-path]").forEach(el=>{
    el.addEventListener("input",()=>{
      let v=el.value;
      if(el.dataset.type==="number")v=Number(v);
      if(el.dataset.type==="boolean")v=v==="true";
      setAtPath(currentData,el.dataset.path,v);

      if(currentModule?.id==="home"){
        if(el.dataset.path==="hero.kicker")document.querySelector(".home-overview .overview-kicker")?.replaceChildren(document.createTextNode(String(v||"")));
        if(el.dataset.path==="hero.title")document.querySelector(".home-overview h2")?.replaceChildren(document.createTextNode(String(v||"")));
        if(el.dataset.path==="hero.lead")document.querySelector(".home-overview .overview-copy p")?.replaceChildren(document.createTextNode(String(v||"")));
      }
      if(currentModule?.id==="guide"){
        if(el.dataset.path==="title")document.querySelector(".guide-overview h2")?.replaceChildren(document.createTextNode(String(v||"")));
        if(el.dataset.path==="intro")document.querySelector(".guide-overview .overview-copy p")?.replaceChildren(document.createTextNode(String(v||"")));
      }

      if(currentModule?.id==="foods"){
        const match=el.dataset.path.match(/^entities\\.(\\d+)\\.name$/);
        if(match)document.querySelector(`[data-food-title="${match[1]}"]`)?.replaceChildren(document.createTextNode(String(v||"Món mới")));
      }
      if(currentModule?.id==="stories"){
        const m=el.dataset.path.match(/^stories\.(\d+)\.(title|category|dek|image|cover_position|read_minutes|intro|sections\..+)$/);
        if(m){
          const i=Number(m[1]),field=m[2],story=currentData.stories?.[i];
          if(field==="title")document.querySelector('[data-story-preview-title="'+i+'"]')?.replaceChildren(document.createTextNode(String(v||"Tiêu đề bài viết")));
          if(field==="category")document.querySelector('[data-story-preview-category="'+i+'"]')?.replaceChildren(document.createTextNode(String(v||"CHUYÊN MỤC")));
          if(field==="dek")document.querySelector('[data-story-preview-dek="'+i+'"]')?.replaceChildren(document.createTextNode(String(v||"Mô tả ngắn của bài viết sẽ xuất hiện ở đây.")));
          if(field==="read_minutes")document.querySelector('[data-story-preview-minutes="'+i+'"]')?.replaceChildren(document.createTextNode(String(v||"1")));
          if(field==="cover_position"){const cover=document.querySelector('[data-story-preview-image="'+i+'"]');if(cover&&cover.tagName==="IMG")cover.style.objectPosition={top:"50% 18%",bottom:"50% 82%",left:"18% 50%",right:"82% 50%",center:"50% 50%"}[v]||"50% 50%"}
          if(field==="image"){
            const cover=document.querySelector('[data-story-preview-image="'+i+'"]');
            const src=String(v||"").trim();
            if(cover){
              if(cover.tagName==="IMG"){cover.src=src||"";cover.style.display=src?"block":"none"}
              else cover.outerHTML=src?'<img data-story-preview-image="'+i+'" src="'+esc(src)+'" alt="">':'<div class="story-cover-empty" data-story-preview-image="'+i+'">Chưa có ảnh cover</div>';
            }
          }
          if(story){
            document.querySelector('[data-story-preview-words="'+i+'"]')?.replaceChildren(document.createTextNode(String(storyWordCount(story))));
          }
        }
      }

      const imageField=el.closest(".image-field");
      if(imageField){
        const box=imageField.querySelector("[data-image-preview]");
        if(box){
          const src=String(v||"").trim();
          box.classList.toggle("empty",!src);
          box.innerHTML=src?'<img src="'+esc(src)+'" alt="Xem trước ảnh">':'<span>Dán URL ảnh để xem trước</span>';
        }
      }
      markDirty();
    });
  });
}

function bindArrayControls(){
  document.querySelectorAll("[data-array-action]").forEach(btn=>btn.onclick=()=>{
    const arr=getAtPath(currentData,btn.dataset.arrayPath);
    const i=Number(btn.dataset.index);
    if(!Array.isArray(arr)||!Number.isInteger(i))return;
    const action=btn.dataset.arrayAction;

    if(action==="delete"){
      if(!confirm("Xóa mục này? Thay đổi chỉ có hiệu lực sau khi bấm Gửi duyệt."))return;
      arr.splice(i,1);
    }else if(action==="duplicate"){
      arr.splice(i+1,0,deepClone(arr[i]));
    }else if(action==="up"&&i>0){
      [arr[i-1],arr[i]]=[arr[i],arr[i-1]];
    }else if(action==="down"&&i<arr.length-1){
      [arr[i+1],arr[i]]=[arr[i],arr[i+1]];
    }

    markDirty();
    rerender();
  });

  document.querySelectorAll(".add-array-item").forEach(btn=>btn.onclick=()=>{
    const arr=getAtPath(currentData,btn.dataset.arrayPath);
    if(!Array.isArray(arr))return;
    const template=arr.length?blankLike(arr[0]):"";
    arr.push(template);
    markDirty("Đã thêm mục mới. Điền nội dung rồi bấm Gửi duyệt.");
    rerender();
  });
}

function bindFoodControls(){
  $("#addFoodBtn")?.addEventListener("click",()=>{
    currentData.entities=currentData.entities||[];
    currentData.entities.push({id:"",legacy_id:"",entity_type:"food",slug:"",name:"",aliases:[],zone_id:null,category:"local",what_it_is:"",why_go:"",best_for:[],tips:[],intents:[],source_refs:[{source_id:""}],updated_at:""});
    markDirty("Đã thêm món mới. Điền mã, nội dung và nguồn kiểm chứng trước khi gửi duyệt.");
    rerender();
    setTimeout(()=>document.querySelector(".food-record:last-child")?.scrollIntoView({behavior:"smooth",block:"start"}),50);
  });
}

function bindVenueControls(){
  $("#addVenueBtn")?.addEventListener("click",()=>{
    currentData.entities=currentData.entities||[];
    currentData.entities.push({
      id:"",
      name:"",
      category:"CAFE",
      zone_code:"",
      latitude:null,
      longitude:null,
      address:"",
      phone:"",
      tags:[],
      opening_hours:{state:"UNKNOWN",note:""},
      price_level:"",
      source_ref:"",
      source_type:"",
      verified_at:"",
      coordinate_precision:"",
      coordinate_source_ref:"",
      coordinate_source_type:"",
      coordinate_observed_at:"",
      coordinate_confidence:"",
      coordinate_note:"",
      status:"REVIEW"
    });
    markDirty("Đã thêm địa điểm mới. Điền dữ liệu đã kiểm tra rồi bấm Gửi duyệt.");
    rerender();
  });
}

function bindStoryControls(){
  document.querySelectorAll("[data-story-readtime]").forEach(btn=>btn.onclick=()=>{
    const i=Number(btn.dataset.storyReadtime),story=currentData.stories?.[i];
    if(!story)return;
    story.read_minutes=storyReadMinutes(story);
    markDirty("Đã tính lại thời gian đọc theo độ dài bài.");
    rerender();
  });
  document.querySelectorAll("[data-story-slug]").forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.storySlug);const story=currentData.stories?.[i];if(!story)return;story.id=slugifyVi(story.title);markDirty("Đã tạo mã bài từ tiêu đề.");rerender()});
  $("#addStoryBtn")?.addEventListener("click",()=>{
    const arr=currentData.stories;
    let story=arr.length?blankLike(arr[0]):{id:"",category:"",title:"",dek:"",read_minutes:4,image:"",cover_position:"center",intro:"",sections:[],sources:[]};
    story.read_minutes=story.read_minutes||4;
    story.sections=[{heading:"",body:"",image:"",caption:"",layout:"wide"}];
    story.sources=[{label:"",url:""}];
    arr.push(story);
    markDirty("Đã tạo bài viết mới. Điền tiêu đề, nội dung và nguồn trước khi xuất bản.");
    rerender();
    setTimeout(()=>document.querySelectorAll(".story-editor").item(document.querySelectorAll(".story-editor").length-1)?.scrollIntoView({behavior:"smooth",block:"start"}),50);
  });

  document.querySelectorAll("[data-story-action]").forEach(btn=>btn.onclick=()=>{
    const arr=currentData.stories;
    const i=Number(btn.dataset.index);
    const action=btn.dataset.storyAction;

    if(action==="delete"){
      if(!confirm("Xóa bài viết này? Thay đổi chỉ có hiệu lực sau khi bấm Gửi duyệt."))return;
      arr.splice(i,1);
    }else if(action==="duplicate"){
      const copy=deepClone(arr[i]);
      copy.id=copy.id?copy.id+"-copy":"";
      copy.title=copy.title?copy.title+" - bản sao":"";
      arr.splice(i+1,0,copy);
    }else if(action==="up"&&i>0){
      [arr[i-1],arr[i]]=[arr[i],arr[i-1]];
    }else if(action==="down"&&i<arr.length-1){
      [arr[i+1],arr[i]]=[arr[i],arr[i+1]];
    }

    markDirty();
    rerender();
  });
}

function searchableText(el){
  const values=[...el.querySelectorAll("input,textarea,select")].map(x=>x.value||"");
  return (el.textContent+" "+values.join(" ")).toLocaleLowerCase("vi");
}

function filterEditor(){
  const input=$("#cmsSearch");
  const counter=$("#searchCount");
  if(!input||!counter)return;
  const q=input.value.trim().toLocaleLowerCase("vi");
  if(currentModule?.id==="foods"){
    const cards=[...document.querySelectorAll("#editor [data-food-card]")];
    let shown=0;
    cards.forEach(el=>{const hit=!q||searchableText(el).includes(q);el.classList.toggle("search-hidden",!hit);if(hit)shown++});
    counter.textContent=q?shown+" món":"";
    return;
  }
  const blocks=[...document.querySelectorAll("#editor > .cms-anchor, #editor > .user-cards > .user-card")];
  if(!q){
    blocks.forEach(el=>el.classList.remove("search-hidden"));
    counter.textContent="";
    return;
  }
  let shown=0;
  blocks.forEach(el=>{
    const hit=searchableText(el).includes(q);
    el.classList.toggle("search-hidden",!hit);
    if(hit)shown++;
  });
  counter.textContent=shown+" kết quả";
}

function bindSearch(){
  const input=$("#cmsSearch");
  if(!input)return;
  input.oninput=filterEditor;
  filterEditor();
}

function buildEditorNav(){
  const host=$("#editorNav");
  if(!host)return;
  const anchors=[...document.querySelectorAll("#editor > .cms-anchor")];

  if(anchors.length<2){
    host.classList.add("hidden");
    host.innerHTML="";
    return;
  }

  anchors.forEach((el,i)=>el.id="cms-section-"+i);
  host.innerHTML='<span>Đi nhanh:</span>'+
    anchors.map((el,i)=>'<button type="button" data-target="cms-section-'+i+'">'+esc(el.dataset.anchorLabel||("Mục "+(i+1)))+'</button>').join("")+
    '<button type="button" class="collapse-all">Thu gọn</button>';

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


function fmtInt(v){
  const n=Number(v);
  return Number.isFinite(n)?new Intl.NumberFormat("vi-VN").format(n):"—";
}
function fmtMoney(v){
  const n=Number(v);
  return Number.isFinite(n)?new Intl.NumberFormat("vi-VN").format(n)+"đ":"—";
}
function fmtPct(v,digits=0){
  const n=Number(v);
  return Number.isFinite(n)?n.toFixed(digits)+"%":"—";
}
function fmtDateTime(v){
  if(!v)return "—";
  const d=new Date(v);
  if(Number.isNaN(d.getTime()))return esc(v);
  return d.toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"});
}
function fmtClock(v){
  if(!v)return "—";
  const d=new Date(v);
  if(!Number.isNaN(d.getTime()))return d.toLocaleTimeString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit"});
  const m=String(v).match(/(\d{1,2}:\d{2})/);
  return m?m[1]:String(v);
}
function analyticsKpi(label,value,note="",tone=""){
  return `<article class="analytics-kpi ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
}
function loadLabel(v){
  const n=Number(v);
  if(!Number.isFinite(n))return '<span class="analytics-muted">Chưa có</span>';
  const cls=n>=85?"hot":n>=65?"warm":"calm";
  return `<span class="analytics-load ${cls}">${fmtPct(n,0)}</span>`;
}
function renderTrendBars(rows){
  if(!rows?.length)return '<div class="analytics-empty">D1 mới bắt đầu tích lịch sử. Sau vài lần snapshot, xu hướng theo ngày sẽ hiện ở đây.</div>';
  const max=Math.max(1,...rows.flatMap(r=>[Number(r.sea_in)||0,Number(r.sea_out)||0,Number(r.air_in)||0,Number(r.air_out)||0]));
  return '<div class="analytics-trends">'+rows.map(r=>{
    const bars=[
      ["Sea vào",Number(r.sea_in)||0,"sea-in"],
      ["Sea ra",Number(r.sea_out)||0,"sea-out"],
      ["Bay đến",Number(r.air_in)||0,"air-in"],
      ["Bay đi",Number(r.air_out)||0,"air-out"]
    ];
    return `<div class="analytics-trend-row"><time>${esc(r.day||"")}</time><div class="analytics-trend-bars">${bars.map(([label,val,cls])=>`<div class="analytics-trend-bar"><span>${esc(label)}</span><i class="${cls}" style="width:${Math.max(3,val/max*100)}%"></i><b>${fmtInt(val)}</b></div>`).join("")}</div></div>`;
  }).join("")+'</div>';
}
function renderSeaTable(rows){
  const list=(rows||[]).slice().sort((a,b)=>String(a.departure_time||"").localeCompare(String(b.departure_time||"")));
  if(!list.length)return '<div class="analytics-empty">Chưa có snapshot Sea/Transit.</div>';
  return `<div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Hãng</th><th>Tuyến</th><th>Đi</th><th>Đến</th><th>Giá NL</th><th>Phủ</th></tr></thead><tbody>${list.map(r=>`<tr>
    <td><strong>${esc(r.operator||"—")}</strong><small>${esc(r.mode||"")}</small></td>
    <td>${esc((r.origin||"—")+" → "+(r.destination||"—"))}</td>
    <td>${esc(fmtClock(r.departure_time))}</td>
    <td>${esc(fmtClock(r.arrival_time))}</td>
    <td>${fmtMoney(r.adult_fare)}</td>
    <td>${loadLabel(r.load_factor_proxy)}</td>
  </tr>`).join("")}</tbody></table></div>`;
}
function renderAviationTable(rows){
  const list=(rows||[]).slice().sort((a,b)=>String(a.scheduled_time||"").localeCompare(String(b.scheduled_time||"")));
  if(!list.length)return '<div class="analytics-empty">Chưa đọc được snapshot Aviation.</div>';
  return `<div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Chuyến</th><th>Chiều</th><th>Hãng</th><th>Điểm</th><th>Giờ</th><th>Trạng thái</th><th>Phủ</th></tr></thead><tbody>${list.map(r=>`<tr>
    <td><strong>${esc(r.flight_number||"—")}</strong></td>
    <td>${/arrival/i.test(r.direction||"")?"Đến PQ":"Rời PQ"}</td>
    <td>${esc(r.airline||"—")}</td>
    <td>${esc(r.station||"—")}</td>
    <td>${esc(fmtClock(r.scheduled_time))}</td>
    <td>${esc(r.status||"—")}${Number.isFinite(Number(r.delay_minutes))&&Number(r.delay_minutes)>0?'<small>+'+fmtInt(r.delay_minutes)+' phút</small>':""}</td>
    <td>${loadLabel(r.load_factor_proxy)}</td>
  </tr>`).join("")}</tbody></table></div>`;
}
function renderSync(rows,storage){
  const dbOk=storage?.d1;
  return `<div class="analytics-health-head"><span class="analytics-health-dot ${dbOk?"ok":"bad"}"></span><div><strong>D1 ${dbOk?"đã kết nối":"chưa thấy binding"}</strong><small>${dbOk?"Snapshot analytics đang được lưu vào D1.":"Dashboard vẫn đọc live, nhưng chưa lưu được lịch sử."}</small></div></div>
  <div class="analytics-source-grid">${(rows||[]).map(x=>`<article><span>${esc(x.source||"Nguồn")}</span><strong class="${x.status==="ok"?"ok":"bad"}">${esc(String(x.status||"unknown").toUpperCase())}</strong><small>${fmtInt(x.records)} bản ghi · ${esc(fmtDateTime(x.last_success_at))}</small>${x.message?'<em>'+esc(x.message)+'</em>':""}</article>`).join("")}</div>`;
}

function renderAnalytics(){
  if(!window.OPQAnalyticsV3){
    $("#editor").innerHTML='<div class="status-bar error">Analytics V3 chưa tải được.</div>';
    return;
  }
  window.OPQAnalyticsV3.mount({
    getData:()=>currentData||{},
    setData:(next)=>{currentData=next},
    api,
    endpoint:API.analytics,
    status,
    helpers:{
      renderAviationTable,
      renderSync,
      fmtDateTime
    }
  });
}
async function refreshAnalytics(){
  if(!window.OPQAnalyticsV3)return;
  return window.OPQAnalyticsV3.refresh();
}

function applyPermissions(){
  const writable=currentModule?.write?.includes(session.role);
  $("#saveBtn").disabled=!writable||!dirty;
  $("#editor").classList.toggle("readonly",!writable);
  document.querySelectorAll("#editor input,#editor textarea,#editor select,#editor button").forEach(el=>el.disabled=!writable);
  return writable;
}

function rerender(){
  const y=window.scrollY;
  if(currentModule.id==="analytics"){
    $("#editorNav")?.classList.add("hidden");
    renderAnalytics();
    requestAnimationFrame(()=>window.scrollTo(0,y));
    return;
  }
  $("#editor").classList.remove("analytics-editor");
  if(currentModule.id==="users")renderUsers();
  else $("#editor").innerHTML=renderRoot();

  bindFields();
  bindMediaControls();
  bindArrayControls();
  bindVenueControls();
  bindFoodControls();
  bindStoryControls();
  buildEditorNav();
  bindSearch();
  applyPermissions();

  requestAnimationFrame(()=>window.scrollTo(0,y));
}

async function api(url,opts={}){
  const r=await fetch(url,{
    credentials:"include",
    ...opts,
    headers:{"Content-Type":"application/json",...(opts.headers||{})}
  });

  let b=null;
  try{b=await r.json()}catch{}

  if(!r.ok){
    const msg=[b?.error,b?.detail].filter(Boolean).join(" · ")||("HTTP "+r.status);
    const err=new Error(msg);
    err.status=r.status;
    throw err;
  }

  return b;
}


function navShort(label){
  const words=String(label||"").trim().split(/\s+/).filter(Boolean);
  if(!words.length)return "•";
  if(words.length===1)return words[0].slice(0,2).toUpperCase();
  return (words[0][0]+words[1][0]).toUpperCase();
}
function applySidebarState(collapsed){
  const layout=$("#cmsLayout");
  if(!layout)return;
  layout.classList.toggle("side-collapsed",Boolean(collapsed));
  const btn=$("#sideToggle");
  if(btn){
    btn.textContent=collapsed?"›":"‹";
    btn.setAttribute("aria-label",collapsed?"Mở rộng menu":"Thu gọn menu");
    btn.title=collapsed?"Mở rộng menu":"Thu gọn menu";
  }
}
function bindSidebarToggle(){
  const key="openpq_cms_sidebar_collapsed";
  const initial=localStorage.getItem(key)==="1";
  applySidebarState(initial);
  const btn=$("#sideToggle");
  if(!btn)return;
  btn.onclick=()=>{
    const next=!$("#cmsLayout")?.classList.contains("side-collapsed");
    applySidebarState(next);
    localStorage.setItem(key,next?"1":"0");
  };
}

async function boot(){
  if(location.hostname.endsWith(".pages.dev")){
    show("login");
    const loginLink=$("#login .primary");
    if(loginLink){
      loginLink.removeAttribute("href");
      loginLink.setAttribute("aria-disabled","true");
      loginLink.classList.add("preview-disabled");
      loginLink.textContent="Đăng nhập chưa bật trên bản xem trước";
    }
    const hint=$("#setupHint");
    if(hint){
      hint.textContent="Bản xem trước chưa có OAuth riêng. Cậu có thể xem giao diện; thao tác đăng nhập chỉ dùng tại CMS chính.";
      hint.classList.remove("hidden");
    }
    return;
  }
  show("boot");
  let r;

  try{
    r=await fetch(API.session,{credentials:"include",cache:"no-store"});
  }catch{
    show("remoteGate");
    return;
  }

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

  renderNav();
  show("cms");
  bindSidebarToggle();

  const requested=new URLSearchParams(location.search).get("module");
  const first=schema.modules.find(m=>m.id===requested&&m.read.includes(session.role))
    ||schema.modules.find(m=>m.read.includes(session.role));
  if(first)selectModule(first.id);
}

function renderNav(){
  const work='<a class="module-btn" href="quality.html" title="Mở việc cần xử lý"><span class="module-short">!</span><span class="module-copy"><strong>Việc cần xử lý</strong><small>Chất lượng dữ liệu và nguồn</small></span></a>';
  const modules=schema.modules
    .filter(m=>m.read.includes(session.role))
    .map(m=>'<button class="module-btn" type="button" data-id="'+esc(m.id)+'" title="'+esc(m.label)+'"><span class="module-short">'+esc(navShort(m.label))+'</span><span class="module-copy"><strong>'+esc(m.label)+'</strong><small>'+esc(m.description)+'</small></span></button>')
    .join("");
  const extras='<a class="module-btn" href="reviews.html" title="Mở hàng đợi duyệt"><span class="module-short">✓</span><span class="module-copy"><strong>Hàng đợi duyệt</strong><small>Đề xuất CMS chưa public</small></span></a><a class="module-btn" href="../guide/knowledge.html" target="_blank" rel="noopener" title="Mở thư viện 128 bài"><span class="module-short">128</span><span class="module-copy"><strong>Thư viện 128 bài</strong><small>Bài đã xuất bản · mở trang đọc</small></span></a>';
  $("#moduleNav").innerHTML=work+modules+extras;
  document.querySelectorAll("button.module-btn").forEach(b=>b.onclick=()=>selectModule(b.dataset.id));
}

async function selectModule(id){
  if(dirty){
    if(!confirm("Có thay đổi chưa xuất bản. Chuyển mục và bỏ các thay đổi này?"))return;
    clearDraft();
  }
  $("#resetBtn")?.classList.add("hidden");

  currentModule=schema.modules.find(m=>m.id===id);
  if(!currentModule)return;

  document.querySelectorAll(".module-btn").forEach(b=>b.classList.toggle("active",b.dataset.id===id));

  $("#cmsSearch").value="";$("#searchCount").textContent="";
  $("#moduleKicker").textContent=currentModule.id==="analytics"?"OPEN PHU QUOC INTELLIGENCE":"OPEN PHU QUOC CMS";
  $("#moduleTitle").textContent=currentModule.label;
  $("#moduleDesc").textContent=currentModule.description;
  $("#saveBtn").textContent="Gửi duyệt";

  const isAnalytics=currentModule.id==="analytics";
  $("#saveBtn").classList.toggle("hidden",isAnalytics);
  $("#resetBtn")?.classList.add("hidden");
  $("#cmsSearch")?.closest(".cms-filter")?.classList.toggle("hidden",isAnalytics);

  if(currentModule.preview){
    $("#previewBtn").href=currentModule.preview;
    $("#previewBtn").classList.remove("hidden");
  }else{
    $("#previewBtn").classList.add("hidden");
  }

  status("Đang tải "+currentModule.label+"...");

  if(isAnalytics){
    try{
      currentData=await api(API.analytics);
      currentSha=null;
      dirty=false;
      rerender();
      status("Analytics nội bộ · chỉ admin · read-only.","success");
    }catch(e){
      $("#editor").innerHTML="";
      $("#editorNav")?.classList.add("hidden");
      status(e.message,"error");
    }
    return;
  }

  try{
    const b=await api(API.content+"?path="+encodeURIComponent(currentModule.path));
    currentData=b.content;
    currentSha=b.sha;
    dirty=false;

    const k=draftKey();
    const raw=k?localStorage.getItem(k):null;

    if(raw){
      try{
        const draft=JSON.parse(raw);

        if(draft.sha===currentSha&&draft.data){
          const when=new Date(draft.at).toLocaleString("vi-VN");
          if(confirm("Có bản nháp chưa xuất bản lưu lúc "+when+". Khôi phục bản nháp?")){
            currentData=draft.data;
            dirty=true;
          }else{
            clearDraft();
          }
        }else{
          clearDraft();
        }
      }catch{
        clearDraft();
      }
    }

    rerender();
    focusRequestedVenue();
    focusRequestedFood();
    const writable=applyPermissions();

    if(dirty){
      $("#saveBtn").disabled=!writable;
      $("#saveBtn").textContent="Gửi duyệt thay đổi";
      status("Đã khôi phục bản nháp trên trình duyệt.","success");
    }else{
      status(writable
        ?"Sẵn sàng chỉnh sửa. Bản nháp tự lưu trên trình duyệt; gửi duyệt sẽ tạo PR, chưa lên website."
        :"Vai trò của bạn chỉ được xem module này.");
    }
  }catch(e){
    $("#editor").innerHTML="";
    $("#editorNav")?.classList.add("hidden");
    status(e.message,"error");
  }
}

async function save(){
  if(!currentModule||!dirty)return;
  const validationErrors=validateCurrent();
  if(validationErrors.length){status("Chưa thể gửi duyệt: "+validationErrors.slice(0,3).join(" · ")+(validationErrors.length>3?" · …":""),"error");return}

  $("#saveBtn").disabled=true;
  $("#saveBtn").textContent="Đang tạo bản gửi duyệt...";
  status("Đang tạo bản nháp gửi duyệt. Nội dung chưa lên website.");

  try{
    const b=await api(API.publish,{
      method:"POST",
      body:JSON.stringify({
        path:currentModule.path,
        sha:currentSha,
        content:currentData,
        message:"update "+currentModule.label.toLowerCase()
      })
    });

    if(!b.pull_request?.url)throw new Error("Đã lưu nhưng chưa nhận được liên kết PR nháp. Giữ lại bản nháp trên trình duyệt và thử lại.");
    dirty=false;
    clearDraft();
    $("#resetBtn")?.classList.add("hidden");

    $("#saveBtn").textContent="Đã gửi duyệt";
    status("Đã tạo PR nháp #"+b.pull_request.number+". Chưa lên website; cậu kiểm tra diff rồi merge khi sẵn sàng. "+b.pull_request.url,"success");

    setTimeout(()=>{
      if(!dirty)$("#saveBtn").textContent="Gửi duyệt";
    },2400);
  }catch(e){
    status(
      e.status===409
        ?"Nội dung trên GitHub đã đổi trong lúc cậu đang sửa. Tải lại module rồi áp dụng lại thay đổi để tránh ghi đè."
        :e.message,
      "error"
    );
    $("#saveBtn").disabled=false;
    $("#saveBtn").textContent="Thử gửi duyệt lại";
  }
}

$("#saveBtn").onclick=e=>{
  e.preventDefault();
  save();
};

$("#resetBtn")?.addEventListener("click",async()=>{
  if(!dirty)return;
  if(!confirm("Bỏ toàn bộ thay đổi chưa xuất bản trong mục này?"))return;
  clearDraft();
  dirty=false;
  await selectModule(currentModule.id);
});

$("#logoutBtn").onclick=async()=>{
  if(dirty&&!confirm("Có thay đổi chưa xuất bản. Vẫn đăng xuất?"))return;
  await fetch(API.auth+"?action=logout",{method:"POST",credentials:"include"});
  location.reload();
};

window.addEventListener("beforeunload",e=>{
  if(dirty){
    saveDraftNow();
    e.preventDefault();
    e.returnValue="";
  }
});

boot();
