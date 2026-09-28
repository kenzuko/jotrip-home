// Owner-only dashboard QA in Chromium, without exposing a real CMS session.
export async function testTrafficBrowser(browser,baseUrl,outputDir){
  const now=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  const sample={
    ready:true,first_day:"2024-09-01",from:"2026-09-21",to:now,updated_at:new Date().toISOString(),total_page_views:1287,total_actions:77,
    note:"Dữ liệu minh họa riêng cho kiểm thử. Không chứa dữ liệu khách.",
    comparison:{available:true,from:"2026-09-14",to:"2026-09-20",page_views:950,actions:60,page_views_change_pct:35.5,actions_change_pct:28.3},
    trend:[{period:"2026-09-21",hits:120},{period:"2026-09-22",hits:180},{period:"2026-09-23",hits:205},{period:"2026-09-24",hits:190},{period:"2026-09-25",hits:235},{period:"2026-09-26",hits:202},{period:"2026-09-27",hits:155}],
    pages:[{path:"/",hits:500},{path:"/guide/article.html?id=cau-ca-phu-quoc",hits:190},{path:"/go/",hits:110}],
    channels:[{channel:"search",hits:567},{channel:"direct",hits:401},{channel:"ai",hits:102},{channel:"social",hits:217}],
    referrers:[{ref_domain:"google.com",hits:567},{ref_domain:"chatgpt.com",hits:102}],
    countries:[{country:"VN",hits:802},{country:"KR",hits:246},{country:"RU",hits:239}],
    devices:[{device:"mobile",hits:900},{device:"desktop",hits:387}],
    actions:[{event:"go_open",hits:48},{event:"nearme_open",hits:21},{event:"feedback_open",hits:8}],
    pageGroups:[{label:"guide",hits:500},{label:"home",hits:787}]
  };
  for(const vp of [{name:"desktop",width:1440,height:900},{name:"mobile",width:390,height:844}]){
    const page=await browser.newPage({viewport:vp,acceptDownloads:true});
    const requests=[];
    try{
      await page.route("**/api/cms/traffic?**",route=>{
        const params=new URL(route.request().url(),baseUrl).searchParams;
        requests.push(Object.fromEntries(params));
        if(params.get("format")==="csv"){
          return route.fulfill({status:200,headers:{"content-type":"text/csv; charset=utf-8","content-disposition":'attachment; filename="openpq-traffic-test.csv"'},body:'"day","event","path","hits"\n"2026-09-27","page_view","/",1287\n'});
        }
        const period=params.get("period");
        const grain=period==="all"?"year":period==="365d"||period==="90d"?"month":"day";
        const trend=grain==="year"?[{period:"2024",hits:100},{period:"2025",hits:250},{period:"2026",hits:1287}]:
          grain==="month"?[{period:"2026-07",hits:300},{period:"2026-08",hits:420},{period:"2026-09",hits:567}]:sample.trend;
        return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({...sample,period,grain,trend})});
      });
      await page.goto(baseUrl+"/admin/",{waitUntil:"networkidle"});
      await page.waitForFunction(()=>Boolean(window.OPQTrafficDashboard));
      await page.evaluate(()=>{
        const main=document.createElement("main");main.className="cms-main";
        const host=document.createElement("form");host.id="editor";host.className="editor";
        main.append(host);document.body.replaceChildren(main);
        window.OPQTrafficDashboard.mount({host});
      });
      await page.locator(".traffic-kpi").first().waitFor({timeout:8000});
      if(await page.locator(".traffic-kpi").count()!==4)throw Error("Must display 4 owner KPIs");
      if(!await page.getByText("1.287",{exact:true}).count())throw Error("Pageview KPI missing");
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
      if(overflow)throw Error("Long-term dashboard overflow at "+vp.width+"px");
      await page.screenshot({path:outputDir+"/screenshots/traffic-owner-"+vp.name+".png",fullPage:true});
      await page.locator('[data-traffic-period="365d"]').click();
      await page.getByText("Tổng hợp theo tháng",{exact:false}).waitFor({timeout:6500});
      if(!requests.some(r=>r.period==="365d"))throw Error("365d report was not requested");
      await page.locator('[data-traffic-period="all"]').click();
      await page.getByText("Tổng hợp theo năm",{exact:false}).waitFor({timeout:6500});
      await page.locator("#trafficChannel").selectOption("ai");
      await page.locator("#trafficSort").selectOption("hits_asc");
      await page.waitForTimeout(100);
      if(!requests.some(r=>r.period==="all"&&r.channel==="ai"&&r.sort==="hits_asc"))throw Error("Filter/sort query missing");
      const downloadWait=page.waitForEvent("download",{timeout:8000});
      await page.locator("#trafficExport").click();
      const download=await downloadWait;
      if(download.suggestedFilename()!=="openpq-traffic-test.csv")throw Error("Private CSV download missing");
      if(!requests.some(r=>r.format==="csv"&&r.period==="all"))throw Error("CSV download not filtered");
      if(await page.getByText("180 ngày").count())throw Error("Obsolete 180-day retention claim exposed");
      console.log("LONG-TERM TRAFFIC BROWSER PASS:",vp.name,vp.width+"x"+vp.height,"all-time, annual, filters, sort and CSV");
    }finally{await page.close()}
  }
}
