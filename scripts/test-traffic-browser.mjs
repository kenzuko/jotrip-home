// Imported by the existing visual QA runner; uses its Chromium instance and static build server.
export async function testTrafficBrowser(browser,baseUrl,outputDir){
  const sample={
    ready:true,from:"2026-09-21",to:"2026-09-27",updated_at:"2026-09-27T11:00:00Z",total_page_views:1287,
    note:"Dữ liệu giả lập chỉ dùng trong kiểm thử.",
    trend:[{day:"2026-09-21",hits:120},{day:"2026-09-22",hits:180},{day:"2026-09-23",hits:205},{day:"2026-09-24",hits:190},{day:"2026-09-25",hits:235},{day:"2026-09-26",hits:202},{day:"2026-09-27",hits:155}],
    pages:[{path:"/",hits:500},{path:"/guide/article.html?id=cau-ca-phu-quoc",hits:190},{path:"/go/",hits:110}],
    channels:[{channel:"search",hits:567},{channel:"direct",hits:401},{channel:"ai",hits:102},{channel:"social",hits:217}],
    referrers:[{ref_domain:"google.com",hits:567},{ref_domain:"chatgpt.com",hits:102}],
    countries:[{country:"VN",hits:802},{country:"KR",hits:246},{country:"RU",hits:239}],
    devices:[{device:"mobile",hits:900},{device:"desktop",hits:387}],
    actions:[{event:"go_open",hits:48},{event:"nearme_open",hits:21},{event:"feedback_open",hits:8}]
  };
  for(const vp of [{name:"desktop",width:1440,height:900},{name:"mobile",width:390,height:844}]){
    const page=await browser.newPage({viewport:vp});
    try{
      await page.route("**/api/cms/traffic?**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(sample)}));
      await page.goto(baseUrl+"/admin/",{waitUntil:"networkidle"});
      await page.waitForFunction(()=>Boolean(window.OPQTrafficDashboard));
      await page.evaluate(()=>{
        const main=document.createElement("main");
        main.className="cms-main";
        const host=document.createElement("form");
        host.id="editor";
        host.className="editor";
        main.append(host);
        document.body.replaceChildren(main);
        window.OPQTrafficDashboard.mount({host});
      });
      await page.locator(".traffic-kpi").first().waitFor({timeout:7000});
      const kpis=await page.locator(".traffic-kpi").count();
      if(kpis!==4)throw Error("Expected 4 private KPIs, saw "+kpis);
      if(!await page.getByText("1.287",{exact:true}).count())throw Error("Missing pageview KPI");
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
      if(overflow)throw Error("Traffic dashboard horizontal overflow at "+vp.width+"px");
      await page.screenshot({path:outputDir+"/screenshots/traffic-owner-"+vp.name+".png",fullPage:true});
      await page.locator('[data-traffic-days="90"]').click();
      await page.getByText("Gộp theo tuần").waitFor({timeout:5000});
      console.log("PRIVATE TRAFFIC BROWSER PASS:",vp.name,vp.width+"x"+vp.height,"4 KPIs, no overflow, 90-day grouping");
    }finally{await page.close()}
  }
}
