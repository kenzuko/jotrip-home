/* Open Phu Quoc CMS - generic structured JSON field renderer extracted from admin.js.
 * P2.2C: rendering only; no mutation, API or workflow behavior. */
(function(root){
"use strict";

function create({getModuleId,labelize,esc}){
  if(typeof getModuleId!=="function"||typeof labelize!=="function"||typeof esc!=="function")
    throw new Error("OPQEditorFields requires getModuleId, labelize and esc");

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
    const moduleId=getModuleId();
    const isVisualImage=moduleId==="visuals"&&key==="url"&&/(?:^|\.)images\.\d+\.url$/.test(path);
    const hasUploader=key==="image"||isVisualImage;
    const long=text.length>90||/(body|summary|description|intro|dek|lead|note|items|content)/i.test(key);
    const control=long
      ?`<textarea data-path="${esc(path)}">${esc(text)}</textarea>`
      :`<input${inputAttrs(key)} data-path="${esc(path)}" value="${esc(text)}">`;
    const preview=hasUploader
      ?`<div class="image-preview ${text.trim()?"":"empty"}" data-image-preview="${esc(path)}">${text.trim()?'<img src="'+esc(text.trim())+'" alt="Xem trước ảnh">':'<span>Chưa có ảnh</span>'}</div>`
      :"";
    const media=hasUploader
      ?`<div class="media-actions"><button type="button" class="media-upload" data-media-path="${esc(path)}">Chọn ảnh từ máy</button><span>CMS sẽ thu nhỏ và tối ưu ảnh trước khi tải lên.</span></div>`
      :"";
    let quick="";
    if((key==="source"||key==="url")&&/^https?:\/\//i.test(text.trim()))quick=`<a class="field-quick" href="${esc(text.trim())}" target="_blank" rel="noopener">Mở nguồn ↗</a>`;
    if(/phone/i.test(key)&&text.trim())quick=`<a class="field-quick" href="tel:${esc(text.replace(/[^+\d]/g,""))}">Gọi thử ↗</a>`;
    const fieldLabel=isVisualImage?"Ảnh - tải lên hoặc dán URL":key==="image"&&/^stories\.\d+\.image$/.test(path)?"Ảnh cover":key==="image"&&/\.sections\.\d+\.image$/.test(path)?"Ảnh trong bài":labelize(key);
    return `<div class="field ${hasUploader?"image-field":""}"><label>${esc(fieldLabel)}</label>${control}${media}${preview}${quick}</div>`;
  }

  function primitiveField(key,val,path){
    const moduleId=getModuleId();
    if(moduleId==="venues"&&key==="coordinate_confidence"){
      const value=String(val||"");
      return `<div class="field"><label>Độ tin cậy tọa độ</label><select data-path="${esc(path)}">
        <option value="" ${!value?"selected":""}>Chưa đánh giá</option>
        <option value="HIGH" ${value==="HIGH"?"selected":""}>Cao</option>
        <option value="MEDIUM" ${value==="MEDIUM"?"selected":""}>Vừa</option>
        <option value="LOW" ${value==="LOW"?"selected":""}>Thấp</option>
      </select></div>`;
    }
    if(moduleId==="venues"&&key==="coordinate_observed_at"){
      return `<div class="field"><label>Ngày kiểm tra tọa độ</label><input type="date" data-path="${esc(path)}" value="${esc(val||"")}"></div>`;
    }
    if(moduleId==="venues"&&key==="category"){
      const value=String(val||"");
      return `<div class="field"><label>Loại địa điểm</label><select data-path="${esc(path)}">
        <option value="LOCAL_FOOD" ${value==="LOCAL_FOOD"?"selected":""}>Quán ăn địa phương</option>
        <option value="RESTAURANT" ${value==="RESTAURANT"?"selected":""}>Nhà hàng</option>
        <option value="CAFE" ${value==="CAFE"?"selected":""}>Cà phê</option>
        <option value="ATTRACTION" ${value==="ATTRACTION"?"selected":""}>Điểm chơi / trải nghiệm</option>
      </select></div>`;
    }
    if(moduleId==="venues"&&key==="zone_code"){
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
    if(moduleId==="venues"&&key==="status"){
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

  return{itemTitle,inputAttrs,stringField,primitiveField,renderChildren,itemTools,renderNode};
}

root.OPQEditorFields={create};
})(typeof window!=="undefined"?window:globalThis);
