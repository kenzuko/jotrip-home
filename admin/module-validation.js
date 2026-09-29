/* Open Phu Quoc CMS - pure module validation extracted from admin.js.
 * P2.2A: no DOM, API, routing or mutation behavior. */
(function(root){
"use strict";

function validate({moduleId,data,selectedStoryIndex=null}={}){
  const errors=[];

  if(moduleId==="home"){
    if(!String(data?.hero?.title||"").trim())errors.push("Hero cần có tiêu đề.");
    if(!String(data?.hero?.lead||"").trim())errors.push("Hero cần có đoạn dẫn.");
  }

  if(moduleId==="stories"){
    const stories=data?.stories||[];
    if(!stories.length)errors.push("Cần ít nhất một bài viết.");
    const ids=new Set();
    stories.forEach((s,i)=>{
      if(!String(s.title||"").trim())errors.push("Bài #"+(i+1)+" chưa có tiêu đề.");
      if(!String(s.id||"").trim())errors.push("Bài #"+(i+1)+" chưa có mã bài.");
      else if(ids.has(s.id))errors.push("Mã bài bị trùng: "+s.id);
      else ids.add(s.id);
      if(!Array.isArray(s.sections)||!s.sections.length)errors.push("Bài “"+(s.title||("#"+(i+1)))+"” chưa có đoạn nội dung.");
      if(i===selectedStoryIndex)(s.sections||[]).forEach((part,j)=>{
        if(!String(part?.heading||"").trim()&&!String(part?.body||"").trim()&&!String(part?.image||"").trim())
          errors.push("Bài đang sửa, đoạn "+(j+1)+" đang trống. Thêm ảnh/nội dung hoặc xóa đoạn.");
      });
    });
  }

  if(moduleId==="guide"){
    if(!String(data?.title||"").trim())errors.push("Cẩm nang cần có tiêu đề.");
    (data?.zones||[]).forEach((z,i)=>{if(!String(z.name||"").trim())errors.push("Khu vực #"+(i+1)+" chưa có tên.")});
  }

  if(moduleId==="utilities"){
    (data?.national_emergency||[]).forEach((x,i)=>{
      if(!String(x.label||"").trim()||!String(x.phone||"").trim())errors.push("Số khẩn cấp #"+(i+1)+" thiếu tên hoặc số điện thoại.");
    });
  }

  if(moduleId==="venues"){
    const entities=data?.entities||[];
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

  if(moduleId==="users"){
    const users=data?.users||[];
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

root.OPQModuleValidation={validate};
})(typeof window!=="undefined"?window:globalThis);
