// Zero-credential live QA for canonical public traffic plus private CMS reporting.
// Checks anonymous-visible public assets, the CMS admin shell, and origin isolation.
import assert from "node:assert/strict";
const PUBLIC_BASE="https://openphuquoc.com";
const CMS_BASE="https://cms.openphuquoc.com";
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(base,path,method="GET",extra={}){
  const url=base+path;
  let error;
  for(let attempt=1;attempt<=4;attempt++){
    try{
      const res=await fetch(url,{method,redirect:"manual",signal:AbortSignal.timeout(17000),headers:{"User-Agent":"OpenPQ-traffic-smoke/1.0",...extra.headers},body:extra.body});
      return {res,body:await res.text()};
    }catch(e){error=e;if(attempt<4)await wait(1500*attempt)}
  }
  throw new Error(method+" "+url+" unreachable: "+String(error));
}
const publicChecks=[
  ["/",200,html=>html.includes("/core/traffic.js"),"Homepage must load tracker"],
  ["/core/traffic.js",200,js=>js.includes("globalPrivacyControl")&&js.includes("/api/traffic/collect")&&js.includes('location.hostname!=="openphuquoc.com"'),"Public tracker must target canonical host"],
  ["/sitemap.xml",200,xml=>xml.includes("<urlset")&&xml.includes("/guide/article.html?id="),"Sitemap must contain public article URLs"]
];
const cmsChecks=[
  ["/admin/",200,html=>!html.includes('src="/core/traffic.js')&&html.includes("traffic-dashboard.js"),"Admin must never collect public pageviews"],
  ["/admin/traffic-dashboard.js",200,js=>js.includes("OPQTrafficDashboard")&&js.includes("/api/cms/traffic")&&js.includes("data-traffic-period")&&js.includes("Xuất CSV")&&!js.includes("được giữ tối đa 180 ngày"),"Long-term owner-only dashboard with all-time filters and CSV must be deployed"],
  ["/admin/traffic-dashboard.css",200,css=>css.includes(".traffic-kpis")&&css.includes(".traffic-filter-grid")&&css.includes(".traffic-export"),"Long-term owner dashboard controls must be deployed"]
];
let problems=[];
for(const [base,label,checks] of [[PUBLIC_BASE,"public",publicChecks],[CMS_BASE,"cms",cmsChecks]]){
  for(const [path,status,check,message] of checks){
    try{
      const {res,body}=await request(base,path);
      assert.equal(res.status,status,label+" "+path+" status "+res.status);
      assert.ok(check(body),message);
      console.log("PASS",label,path,res.status,"bytes="+body.length);
    }catch(error){problems.push(label+" "+path+": "+error.message);console.error("FAIL",label,path,error.message)}
  }
}
try{
  const {res}=await request(CMS_BASE,"/");
  assert.equal(res.status,301,"CMS public homepage must redirect");
  assert.equal(res.headers.get("location"),PUBLIC_BASE+"/");
  console.log("PASS cms / canonical redirect");
}catch(error){problems.push("cms redirect: "+error.message);console.error("FAIL cms redirect",error.message)}
for(const [base,path,method,headers,body,expected] of [
  [CMS_BASE,"/api/cms/traffic","GET",{},undefined,401],
  [PUBLIC_BASE,"/api/traffic/collect","GET",{},undefined,405],
  [PUBLIC_BASE,"/api/traffic/collect","POST",{"Origin":"https://invalid.example","Content-Type":"application/json"},JSON.stringify({event:"page_view",path:"/"}),403]
]){
  try{
    const {res}=await request(base,path,method,{headers,body});
    assert.equal(res.status,expected,method+" "+path+" must return "+expected+" (got "+res.status+")");
    console.log("PASS",method,new URL(base).hostname+path,"HTTP",res.status);
  }catch(error){problems.push(method+" "+path+": "+error.message);console.error("FAIL",method,path,error.message)}
}
if(problems.length){console.error("LIVE TRAFFIC QA FAILED:",problems.join(" | "));process.exitCode=1}
else console.log("LIVE TRAFFIC QA PASS: canonical tracker, CMS owner UI, sitemap, redirects and origin isolation");
