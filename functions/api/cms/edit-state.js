import { readCmsSession, readCurrentCmsRole, readMainRef, readRepoFile, scanOpenPullConflicts } from "../../_shared/cms-mutation-core.js";
/* CMS edit preflight, GET-only: detects GitHub SHA drift and pending CMS PRs
 * for the SAME WHOLE JSON FILE. It cannot see another user's unsent work. */
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
export async function onRequest({request,env}){
  try{
    if(request.method!=="GET")return respond({error:"Method not allowed"},405);
    const path=new URL(request.url).searchParams.get("path")||"";
    if(!Object.hasOwn(readable,path))return respond({error:"Không hỗ trợ tệp này"},400);
    const user=await readCmsSession(request,String(env.CMS_SESSION_SECRET||""));
    if(!user)return respond({error:"Chưa đăng nhập CMS"},401);
    if(!user.accessToken)return respond({error:"Phiên đăng nhập thiếu quyền GitHub, hãy đăng nhập lại"},401);
    let role=null;
    try{
      role=await readCurrentCmsRole(user.login,{cacheBustKey:"v",failureMessage:"Chưa kiểm tra được quyền CMS"});
    }catch{
      return respond({error:"Chưa kiểm tra được quyền CMS"},503);
    }
    if(!role||!readable[path].includes(role))return respond({error:"Không có quyền xem tệp này"},403);

    const companionPath=path==="data/i18n/vi/food.json"?"data/food.json":null;
    const mainRef=await readMainRef(user.accessToken);
    if(!mainRef.ok)throw Error("GitHub HTTP "+mainRef.status+": "+String(mainRef.value?.message||"Không xác định"));
    if(!/^[a-f0-9]{40}$/.test(String(mainRef.sha||"")))throw Error("Không có SHA phiên bản main");

    const [file,companion]=await Promise.all([
      readRepoFile(path,mainRef.sha,user.accessToken),
      companionPath?readRepoFile(companionPath,mainRef.sha,user.accessToken):Promise.resolve(null)
    ]);
    if(!file.ok)throw Error("GitHub HTTP "+file.status+": "+String(file.value?.message||"Không xác định"));
    if(typeof file.sha!=="string")throw Error("Không có SHA phiên bản live");
    if(companion&&!companion.ok)throw Error("GitHub HTTP "+companion.status+": "+String(companion.value?.message||"Không xác định"));

    const pathsToCheck=companionPath?[path,companionPath]:[path];
    const scan=await scanOpenPullConflicts(pathsToCheck,user.accessToken,{
      cmsDraftOnly:true,inspectLimit:20,requireComplete:false,concurrency:3
    });
    if(!scan.ok)throw Error("GitHub HTTP "+scan.status+": "+String(scan.detail||"Không xác định"));

    return respond({path,sha:file.sha,companion_path:companionPath,companion_sha:companion?.sha||null,
      conflicts:scan.conflicts,complete:scan.complete,
      checked_at:new Date().toISOString(),
      note:"Kiểm tra theo tệp dữ liệu và PR đang mở. Không thể nhìn thấy bản chưa gửi từ máy khác."});
  }catch(e){
    return respond({error:"Không kiểm tra được xung đột",detail:String(e?.message||e)},502);
  }
}