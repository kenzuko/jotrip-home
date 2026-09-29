/* Open Phu Quoc CMS - one-click proposal rollback for a verified direct-save commit.
 * Never reverts main directly. */
(function(root){
"use strict";
const VALID=/^[a-f0-9]{40}$/;
async function propose(commit,{fetchFn=root.fetch}={}){
  const sha=String(commit||"").toLowerCase();
  if(!VALID.test(sha))throw new Error("Commit direct-save không hợp lệ");
  const response=await fetchFn("/api/cms/rollback",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json"},body:JSON.stringify({direct_save_commit:sha})
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.detail||body.error||("HTTP "+response.status));
  if(!/^https:\/\/github\.com\/kenzuko\/jotrip-home\/pull\/\d+$/.test(body.pull_request?.url||""))
    throw new Error("CMS chưa trả về PR hoàn tác hợp lệ");
  return body;
}
function mount(host,commit,{confirmFn=root.confirm,fetchFn=root.fetch}={}){
  if(!host||!VALID.test(String(commit||"").toLowerCase()))return null;
  if(host.querySelector?.("[data-cms-direct-rollback]"))return host.querySelector("[data-cms-direct-rollback]");
  const button=(host.ownerDocument||root.document).createElement("button");
  button.type="button";button.dataset.cmsDirectRollback="1";button.textContent="Tạo PR hoàn tác";
  button.addEventListener("click",async()=>{
    if(confirmFn&&confirmFn("Tạo PR hoàn tác commit vừa xuất bản? Hệ thống chỉ tạo đề xuất để cậu kiểm tra, không tự ghi đè website.")===false)return;
    button.disabled=true;const old=button.textContent;button.textContent="Đang kiểm tra...";
    try{
      const result=await propose(commit,{fetchFn});
      button.remove();
      const a=(host.ownerDocument||root.document).createElement("a");
      a.href=result.pull_request.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Mở PR hoàn tác ↗";
      host.append(a);
    }catch(error){button.disabled=false;button.textContent="Thử tạo PR hoàn tác lại";button.title=String(error?.message||error);}
  });
  host.append(button);return button;
}
root.OPQDirectSaveRollback={propose,mount};
})(typeof window!=="undefined"?window:globalThis);
