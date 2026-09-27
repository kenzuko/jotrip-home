// Owner-only access: validate the encrypted CMS session AND current live CMS role.
// Client-side menu hiding is a convenience, never the access boundary.
const OWNER="kenzuko";
const B64=s=>{s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";return Uint8Array.from(atob(s),c=>c.charCodeAt(0))};
const deny=(status,error)=>new Response(JSON.stringify({error}),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store","X-Robots-Tag":"noindex"}});
function sessionCookie(request){
  for(const part of (request.headers.get("cookie")||"").split(";")){
    const i=part.indexOf("=");
    if(i>0&&part.slice(0,i).trim()==="openpq_cms"){
      try{return decodeURIComponent(part.slice(i+1).trim())}catch{return ""}
    }
  }
  return "";
}
export async function verifyTrafficOwner(request,env){
  const token=sessionCookie(request),secret=String(env.CMS_SESSION_SECRET||"");
  if(!token||!secret)return {denied:deny(401,"Chưa đăng nhập CMS")};
  try{
    const [iv,ciphertext]=token.split(".");
    if(!iv||!ciphertext)return {denied:deny(401,"Phiên đăng nhập không hợp lệ")};
    const text=new TextEncoder(),digest=await crypto.subtle.digest("SHA-256",text.encode(secret));
    const key=await crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);
    const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:B64(iv)},key,B64(ciphertext));
    const user=JSON.parse(new TextDecoder().decode(plain));
    if(user.exp<=Date.now()||user.login!==OWNER||user.role!=="admin")return {denied:deny(403,"Chỉ chủ sở hữu CMS được xem")};
    const response=await fetch("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json?v="+Date.now(),{headers:{"User-Agent":"Open-Phu-Quoc-CMS"},cache:"no-store"});
    if(!response.ok)return {denied:deny(503,"Chưa kiểm tra được quyền quản trị")};
    const users=(await response.json()).users||[];
    const owner=users.find(u=>u.login===OWNER&&u.enabled===true&&u.role==="admin");
    if(!owner)return {denied:deny(403,"Quyền xem đã bị thu hồi")};
    return {login:OWNER};
  }catch(error){
    console.warn("Traffic owner auth unavailable",error);
    return {denied:deny(401,"Phiên đăng nhập không hợp lệ hoặc chưa xác minh được quyền")};
  }
}
