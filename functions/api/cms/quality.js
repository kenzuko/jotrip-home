const SESSION_COOKIE="openpq_cms";
const te=new TextEncoder(),td=new TextDecoder();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const parseCookies=req=>{const out={};for(const part of (req.headers.get("cookie")||"").split(";")){const i=part.indexOf("=");if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}return out};
const fromB64=s=>{s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const bin=atob(s);return Uint8Array.from(bin,c=>c.charCodeAt(0))};
async function session(req,secret){const token=parseCookies(req)[SESSION_COOKIE]||"";if(!token||!secret)return null;try{const[a,b]=token.split(".");const digest=await crypto.subtle.digest("SHA-256",te.encode(secret));const key=await crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);const dec=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(a)},key,fromB64(b));const obj=JSON.parse(td.decode(dec));return obj.exp>Date.now()?obj:null}catch{return null}}
async function rawJson(path){const url="https://raw.githubusercontent.com/kenzuko/jotrip-home/main/"+path.split("/").map(encodeURIComponent).join("/")+"?v="+Date.now();const r=await fetch(url,{cache:"no-store",headers:{"User-Agent":"Open-Phu-Quoc-CMS"}});if(!r.ok)throw new Error("Không tải được "+path+": HTTP "+r.status);return r.json()}
async function currentRole(login){const doc=await rawJson("cms/users.json");return doc.users?.find(x=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false)?.role||null}
function task(rule,entity,field,surface,severity,evidence,nextAction){return{rule_id:rule,entity_id:entity||null,field,surface,severity,evidence,owner:"",next_action:nextAction,status:"open",persistence:"computed"}}
const taskKey=t=>[t.rule_id,t.entity_id||"",t.field].join("|");
function coordValid(value,min,max){const n=Number(value);return value!==null&&value!==""&&value!==undefined&&Number.isFinite(n)&&n>=min&&n<=max}
export async function onRequest({request,env}){
  try{
    if(!["GET","POST"].includes(request.method))return json({error:"Method not allowed"},405);
    const user=await session(request,String(env.CMS_SESSION_SECRET||""));
    if(!user)return json({error:"Chưa đăng nhập"},401);
    const role=await currentRole(user.login);
    if(!role)return json({error:"Tài khoản CMS đã bị vô hiệu hóa"},401);
    if(request.method==="POST"&&role!=="admin")return json({error:"Chỉ quản trị viên được cập nhật công việc"},403);
    const [venueDoc,foodDoc,legacyDoc]=await Promise.all([
      rawJson("data/entities/destination-venues.json"),
      rawJson("data/entities/food.json"),
      rawJson("data/food.json")
    ]);
    const tasks=[],seen=new Set();
    const add=item=>{item.owner=user.login;const key=[item.rule_id,item.entity_id,item.field].join("|");if(seen.has(key))return;seen.add(key);tasks.push(item)};
    const venues=Array.isArray(venueDoc.entities)?venueDoc.entities:[];
    const foods=Array.isArray(foodDoc.entities)?foodDoc.entities:[];
    const legacy=Array.isArray(legacyDoc.dishes)?legacyDoc.dishes:[];
    for(const v of venues){
      const id=String(v?.id||"").trim();
      const name=String(v?.name||id||"Địa điểm chưa có mã");
      if(!coordValid(v?.latitude,-90,90)||!coordValid(v?.longitude,-180,180)){
        add(task("VENUE_COORDINATE_MISSING",id,"latitude/longitude","Bản đồ và chỉ đường","high",name+" đang ACTIVE nhưng tọa độ thiếu hoặc nằm ngoài khoảng hợp lệ.","Kiểm tra cổng vào/vị trí thực tế và ghi nguồn cùng độ chính xác trước khi dùng chỉ đường."));
      }else{
        const missingCoordinateEvidence=[
          ["coordinate_precision","độ chính xác"],
          ["coordinate_source_ref","nguồn kiểm tra tọa độ"],
          ["coordinate_source_type","loại nguồn tọa độ"],
          ["coordinate_observed_at","ngày kiểm tra"],
          ["coordinate_confidence","độ tin cậy"]
        ].filter(([field])=>field==="coordinate_precision"?!String(v?.coordinate_precision||v?.precision||"").trim():!String(v?.[field]||"").trim()).map(([,label])=>label);
        if(missingCoordinateEvidence.length){
          add(task("VENUE_COORDINATE_EVIDENCE_INCOMPLETE",id,"coordinate_evidence","Bản đồ và Near Me","medium",
            name+" có tọa độ nhưng thiếu: "+missingCoordinateEvidence.join(", ")+".",
            "Kiểm tra chính pin này, ghi nguồn và ngày kiểm tra; mô tả pin là cổng vào, khu vực hay điểm tham chiếu."));
        }
      }
      if(String(v?.status||"").toUpperCase()==="ACTIVE"){
        if(!String(v?.source_ref||"").trim())add(task("VENUE_SOURCE_MISSING",id,"source_ref","Địa điểm","high",name+" đang ACTIVE nhưng chưa có nguồn ghi nhận.","Bổ sung nguồn kiểm tra được và thời điểm quan sát."));
        if(!String(v?.verified_at||"").trim())add(task("VENUE_CHECK_DATE_MISSING",id,"verified_at","Địa điểm","medium",name+" đang ACTIVE nhưng thiếu ngày kiểm tra.","Ghi ngày xác minh thực tế; không suy ra ngày từ ngày nhập hệ thống."));
      }
    }
    const articleIds=new Set(legacy.map(x=>String(x?.id||"").trim()).filter(Boolean));
    for(const food of foods){
      const legacyId=String(food?.legacy_id||"").trim();
      if(legacyId&&!articleIds.has(legacyId)){
        add(task("FOOD_ARTICLE_GAP",food.id,"legacy_id","Cẩm nang món ăn","low",food.name+" có thực thể món nhưng chưa có bài cũ map theo ID.","Quyết định có cần biên tập bài riêng hay giữ thực thể ở trạng thái chưa có bài; không tự sinh nội dung."));
      }
    }
    const foodVenues=venues.filter(v=>["LOCAL_FOOD","RESTAURANT","CAFE"].includes(String(v?.category||"").toUpperCase()));
    const readyFoodVenues=foodVenues.filter(v=>
      String(v?.status||"").toUpperCase()==="ACTIVE"&&String(v?.source_ref||"").trim()&&String(v?.verified_at||"").trim()&&
      coordValid(v?.latitude,-90,90)&&coordValid(v?.longitude,-180,180)&&String(v?.coordinate_precision||v?.precision||"").trim()
    );
    if(!readyFoodVenues.length){
      add(task("FOOD_PILOT_NO_READY_VENUES",null,"venues","Ăn quanh tôi","high","Có "+foodVenues.length+" địa điểm mang category quán ăn/nhà hàng/cà phê và 0 địa điểm đạt điều kiện vận hành, nguồn, ngày kiểm tra, tọa độ cùng độ chính xác.","Xác minh địa điểm thực tế, ca bán và quan hệ món-quán; chỉ bật gợi ý sau khi đủ chứng cứ."));
    }
    add(task("FOOD_VENUE_RELATIONSHIPS_NOT_MODELED",null,"venue_food","Món tại quán","high","Trong data/entities CMS chuẩn hiện dùng chưa có tập quan hệ ghi món nào được bán tại venue nào cùng chứng cứ và thời điểm xác nhận.","Thiết kế và nhập quan hệ món-quán từ xác minh thực tế; không suy từ tag, bài món hoặc ảnh menu."));
    const db=env.CMS_DB;
    if(request.method==="POST"){
      if(!db)return json({error:"D1 CMS chưa được gắn vào môi trường này"},503);
      const body=await request.json().catch(()=>null);
      const target=body&&tasks.find(x=>taskKey(x)===body.task_key);
      if(!target)return json({error:"Không tìm thấy công việc hiện còn phát sinh"},404);
      const actions={claim:{status:"in_progress"},resolve:{status:"resolved"},mute:{status:"muted"},reopen:{status:"open"}};
      const action=String(body.action||"");
      if(!actions[action])return json({error:"Thao tác không hợp lệ"},400);
      const before=await db.prepare("SELECT task_key,rule_id,entity_id,field,status,owner,due_at,muted_until,note,created_at FROM cms_quality_work_items WHERE task_key=?").bind(taskKey(target)).first();
      const now=new Date().toISOString();
      const after={
        task_key:taskKey(target),rule_id:target.rule_id,entity_id:target.entity_id,field:target.field,
        status:actions[action].status,owner:action==="reopen"?(before?.owner||user.login):user.login,
        due_at:before?.due_at||null,muted_until:action==="mute"?new Date(Date.now()+7*86400000).toISOString():null,
        note:before?.note||null,created_at:before?.created_at||now,updated_at:now
      };
      await db.batch([
        db.prepare("INSERT INTO cms_quality_work_items (task_key,rule_id,entity_id,field,status,owner,due_at,muted_until,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(task_key) DO UPDATE SET status=excluded.status,owner=excluded.owner,muted_until=excluded.muted_until,updated_at=excluded.updated_at")
          .bind(after.task_key,after.rule_id,after.entity_id,after.field,after.status,after.owner,after.due_at,after.muted_until,after.note,after.created_at,after.updated_at),
        db.prepare("INSERT INTO cms_quality_audit_events (event_id,task_key,actor,action,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(),after.task_key,user.login,action,JSON.stringify(before||null),JSON.stringify(after),now)
      ]);
    }
    let states={};
    if(db){
      try{
        const result=await db.prepare("SELECT task_key,status,owner,due_at,muted_until,note,updated_at FROM cms_quality_work_items").all();
        for(const item of result.results||[])states[item.task_key]=item;
      }catch(e){
        if(request.method==="POST")throw e;
      }
    }
    const storedTasks=tasks.map(item=>{
      const state=states[taskKey(item)];
      return state?{...item,status:state.status,owner:state.owner||"",due_at:state.due_at||null,muted_until:state.muted_until||null,note:state.note||null,persistence:"d1"}:item;
    });
    return json({tasks:storedTasks,count:storedTasks.length,computed_at:new Date().toISOString(),storage:db?"d1":"computed-from-main",note:db?"Tín hiệu được tính từ main; trạng thái công việc và lịch sử thao tác được lưu trong D1.":"Tín hiệu được tính lại từ main; chưa có kết nối D1 trong môi trường này."});
  }catch(e){return json({error:"Không tạo được hàng đợi chất lượng",detail:e?.message||String(e)},503)}
}
