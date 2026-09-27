/* Browser QA for the CMS UI. All API responses are mocked: no live data is changed. */
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const base=process.env.VISUAL_QA_BASE_URL||"http://127.0.0.1:4173";
const browser=await chromium.launch({headless:true});
const output="visual-qa-results";
await mkdir(output,{recursive:true});
async function makePage(role,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/api/cms/session",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({login:"visual-qa",name:"OpenPQ QA",role})
  }));
  await page.route("**/api/cms/quality",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({
      computed_at:"2026-09-27T09:20:00+07:00",
      storage:"d1",tasks:[
        {rule_id:"VENUE_SOURCE_MISSING",entity_id:"venue_bai_khem",field:"source_ref",
         status:"open",surface:"Địa điểm",severity:"high",
         evidence:"Bãi Khem đang ACTIVE nhưng chưa có nguồn ghi nhận.",next_action:"Bổ sung nguồn"},
        {rule_id:"VENUE_CHECK_DATE_MISSING",entity_id:"venue_bai_sao",field:"verified_at",
         status:"in_progress",surface:"Địa điểm",severity:"medium",owner:"visual-qa",due_at:"2020-01-01",
         evidence:"Bãi Sao đang ACTIVE nhưng thiếu ngày kiểm tra.",next_action:"Kiểm chứng"}
      ]
    })
  }));
  await page.route("**/api/cms/reviews",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({
      items:[{number:40,title:"CMS: cập nhật địa điểm",draft:false,author:"qa",updated_at:"2026-09-27T08:10:00+07:00"}],
      history:[]
    })
  }));
  await page.route("**/api/cms/content?*",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({
      path:"data/content.json",sha:"0123456789012345678901234567890123456789",
      content:{version:"1",stories:[{
        id:"test-draft",title:"Bài đang biên tập",category:"ĐỜI SỐNG ĐẢO",
        dek:"Mô tả ngắn kiểm thử",intro:"Lời mở đang soạn",
        image:"",read_minutes:3,
        sections:[{heading:"Buổi sáng",body:"Nội dung bản nháp trước khi sửa."}],
        sources:[{label:"Nguồn minh họa",url:"https://example.com"}]
      }]}
    })
  }));
  await page.route("**/api/cms/edit-state?*",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({
      path:"data/content.json",sha:"0123456789012345678901234567890123456789",
      complete:true,conflicts:[],checked_at:"2026-09-27T08:00:00Z"
    })
  }));
  const publishes=[];
  await page.route("**/api/cms/publish",route=>{
    publishes.push(route.request().method());return route.abort();
  });
  page.__publishAttempts=publishes;
  await page.goto(base+"/admin/",{waitUntil:"networkidle"});
  await page.locator(".control-room").waitFor();
  await page.locator(".cr-task").first().waitFor();
  return {page,context,errors};
}
try{
  const desktop=await makePage("admin",{width:1440,height:900});
  assert.equal(await desktop.page.locator("#moduleTitle").textContent(),"Bàn làm việc");
  assert.equal(await desktop.page.locator(".cr-metric strong").first().textContent(),"2");
  assert.equal(await desktop.page.locator(".cr-metric strong").nth(1).textContent(),"1");
  assert.equal(await desktop.page.locator("a[href='index.html?module=venues&record=venue_bai_khem&field=source_ref']").count(),1);
  assert.equal(await desktop.page.locator(".cr-task h3").first().textContent(),"Bãi Khem");
  await desktop.page.locator('.cr-filter[data-cr-filter="priority"]').click();
  assert.equal(await desktop.page.locator(".cr-task").count(),1);
  await desktop.page.locator('.cr-filter[data-cr-filter="progress"]').click();
  assert.equal(await desktop.page.locator(".cr-task").count(),1);
  assert.equal(await desktop.page.locator(".cr-task h3").first().textContent(),"Bãi Sao");
  await desktop.page.locator('.cr-filter[data-cr-filter="all"]').click();
  assert.equal(await desktop.page.locator(".cr-task").count(),2);
  await desktop.page.locator('.cr-filter[data-cr-filter="mine"]').click();
  assert.equal(await desktop.page.locator(".cr-task").count(),1);
  assert.equal(await desktop.page.locator(".cr-task h3").first().textContent(),"Bãi Sao");
  await desktop.page.locator('.cr-filter[data-cr-filter="late"]').click();
  assert.equal(await desktop.page.locator(".cr-task").count(),1);
  await desktop.page.locator('.cr-filter[data-cr-filter="all"]').click();
  const search=desktop.page.locator("[data-cr-search]");
  await search.fill("bai sao");
  await search.press("Enter");
  assert.equal(await desktop.page.locator(".cr-task").count(),1);
  await desktop.page.locator("[data-cr-search-clear]").click();
  assert.equal(await desktop.page.locator(".cr-task").count(),2);
  // Regression for the owner's screenshot: site link must remain below the scroller.
  for(const height of [900,600]){
    await desktop.page.setViewportSize({width:1440,height});
    const sidebar=await desktop.page.evaluate(()=>{
      const nav=document.querySelector("#moduleNav"),link=document.querySelector(".site-link"),
            side=document.querySelector(".cms-side");
      return {navBottom:nav.getBoundingClientRect().bottom,linkTop:link.getBoundingClientRect().top,
        linkBottom:link.getBoundingClientRect().bottom,sideBottom:side.getBoundingClientRect().bottom,
        canScroll:nav.scrollHeight>nav.clientHeight,navClient:nav.clientHeight};
    });
    assert.ok(sidebar.canScroll,"sidebar menu must scroll separately at "+height+"px");
    assert.ok(sidebar.linkTop>=sidebar.navBottom+4,"website link overlaps menu at "+height+"px");
    assert.ok(sidebar.linkBottom<=sidebar.sideBottom+1,"website link below sidebar at "+height+"px");
    await desktop.page.locator("#moduleNav").evaluate(el=>el.scrollTop=el.scrollHeight);
    assert.ok(await desktop.page.locator('.module-btn[data-id="users"]').isVisible(),
      "last navigation item must be accessible at "+height+"px");
  }
  await desktop.page.setViewportSize({width:1440,height:900});
  assert.equal(await desktop.page.locator("button[data-cr-module=analytics]").count(),1);
  await desktop.page.screenshot({path:output+"/cms-control-room-desktop.png",fullPage:true});
  await desktop.page.locator('.module-btn[data-id="stories"]').click();
  await desktop.page.locator("#moduleTitle").getByText("Bài viết").waitFor();
  assert.equal(await desktop.page.locator('.module-btn[data-id="stories"].active').count(),1);
  await desktop.page.locator("#editorTools").waitFor({state:"visible"});
  await desktop.page.locator(".ew-story-preview").first().click();
  await desktop.page.locator("#ewPreviewDialog[open]").waitFor();
  assert.match(await desktop.page.locator("#ewPreviewDialog h1").textContent(),/Bài đang biên tập/);
  await desktop.page.screenshot({path:output+"/cms-draft-preview-desktop.png",fullPage:true});
  await desktop.page.locator("[data-ew-close]").click();
  const titleField=desktop.page.locator('input[data-path="stories.0.title"]');
  await titleField.fill("Bài vừa chỉnh chưa xuất bản");
  await desktop.page.waitForTimeout(850);
  const checkpoint=await desktop.page.evaluate(()=>{
    const keys=Object.keys(localStorage).filter(k=>k.startsWith("openpq-cms-article-v1:"));
    return{keys,record:keys.length?JSON.parse(localStorage.getItem(keys[0])).record:null};
  });
  assert.equal(checkpoint.keys.length,1,"article should have one local record checkpoint");
  assert.equal(checkpoint.record?.title,"Bài vừa chỉnh chưa xuất bản");
  await desktop.page.locator(".ew-story-preview").first().click();
  assert.match(await desktop.page.locator("#ewPreviewDialog h1").textContent(),/Bài vừa chỉnh chưa xuất bản/);
  await desktop.page.locator("[data-ew-close]").click();
  await desktop.page.screenshot({path:output+"/cms-editor-workflow-desktop.png",fullPage:true});
  // A competing PR touching the same JSON file must block publication, even if
  // it is changing a different article. The API is mocked and must not receive POST.
  await desktop.page.route("**/api/cms/edit-state?*",route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({path:"data/content.json",
      sha:"0123456789012345678901234567890123456789",complete:true,
      conflicts:[{number:99,title:"CMS: bài khác cùng tệp",
        url:"https://github.com/kenzuko/jotrip-home/pull/99"}]})
  }));
  await desktop.page.locator("[data-ew-check]").click();
  await desktop.page.locator(".ew-warning").waitFor();
  assert.match(await desktop.page.locator(".ew-warning").textContent(),/PR khác sửa cùng tệp/);
  await desktop.page.locator("#saveBtn").click();
  await desktop.page.locator("#status.error").waitFor();
  assert.equal(desktop.page.__publishAttempts.length,0,"pending PR must block POST");
  assert.equal(desktop.errors.length,0,"desktop page errors: "+desktop.errors.join("; "));
  await desktop.context.close();

  const mobile=await makePage("editor",{width:390,height:844});
  const overflow=await mobile.page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=2,"mobile page overflows by "+overflow+" pixels");
  assert.equal(await mobile.page.locator("button[data-cr-module=analytics]").count(),0);
  assert.ok(await mobile.page.locator("[data-cr-search]").isVisible(),
    "mobile inbox search should be visible");
  assert.equal(await mobile.page.locator('.module-btn[data-id="analytics"]').count(),0);
  assert.ok(await mobile.page.locator(".site-link").isVisible(),"public website link must be visible on mobile");
  const mobileNav=await mobile.page.evaluate(()=>{
    const link=document.querySelector(".site-link").getBoundingClientRect(),
          nav=document.querySelector("#moduleNav").getBoundingClientRect();
    return {linkRight:link.right,linkLeft:link.left,navRight:nav.right};
  });
  assert.ok(mobileNav.linkRight<=392&&mobileNav.linkLeft>=mobileNav.navRight-1,
    "mobile link must stay beside, not over, the horizontal nav");
  await mobile.page.screenshot({path:output+"/cms-control-room-mobile.png",fullPage:true});
  await mobile.page.locator('.module-btn[data-id="stories"]').click();
  await mobile.page.locator("#editorTools").waitFor({state:"visible"});
  assert.ok(await mobile.page.locator(".ew-story-preview").first().isVisible());
  const editorOverflow=await mobile.page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(editorOverflow<=2,"iPhone editor horizontal overflow: "+editorOverflow+"px");
  await mobile.page.screenshot({path:output+"/cms-editor-workflow-mobile.png",fullPage:true});
  assert.equal(mobile.errors.length,0,"mobile page errors: "+mobile.errors.join("; "));
  await mobile.context.close();

  const demoContext=await browser.newContext({viewport:{width:1440,height:900}});
  const demo=await demoContext.newPage();
  const unsafe=[];
  await demo.route("**/api/cms/**",route=>{unsafe.push(route.request().url());return route.abort();});
  await demo.goto(base+"/admin/control-room-preview.html",{waitUntil:"networkidle"});
  await demo.locator(".control-room").waitFor();
  assert.equal(await demo.locator(".cr-task").count(),3);
  assert.equal(await demo.locator(".preview-banner").count(),1);
  assert.equal(unsafe.length,0,"visual preview must not fetch CMS endpoints");
  await demo.screenshot({path:output+"/cms-control-room-public-preview.png",fullPage:true});
  await demoContext.close();
  const editorialContext=await browser.newContext({viewport:{width:1440,height:900}});
  const editorial=await editorialContext.newPage();
  const liveCalls=[];
  await editorial.route("**/api/cms/**",route=>{
    liveCalls.push(route.request().url());return route.abort();
  });
  await editorial.goto(base+"/admin/editor-workflow-preview.html",{waitUntil:"networkidle"});
  await editorial.locator("#editorTools").waitFor({state:"visible"});
  await editorial.locator("#demoTitle").fill("Tiêu đề demo chưa công bố");
  await editorial.locator("#demoPreview").click();
  await editorial.locator("#ewPreviewDialog[open]").waitFor();
  assert.match(await editorial.locator("#ewPreviewDialog h1").textContent(),/Tiêu đề demo chưa công bố/);
  await editorial.screenshot({path:output+"/cms-editor-workflow-demo-desktop.png",fullPage:true});
  await editorial.locator("[data-ew-close]").click();
  assert.equal(liveCalls.length,0,"editor demo must not call real CMS APIs");
  await editorial.setViewportSize({width:390,height:844});
  const demoOverflow=await editorial.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(demoOverflow<=2,"editor demo mobile overflow "+demoOverflow+"px");
  await editorial.screenshot({path:output+"/cms-editor-workflow-demo-mobile.png",fullPage:true});
  await editorialContext.close();
  // V2: global work switcher, role boundaries and text scaling.
  const palette=await makePage("admin",{width:1440,height:900});
  await palette.page.locator("#quickOpen").click();
  await palette.page.locator("#quickDialog[open]").waitFor();
  await palette.page.locator("#quickInput").fill("nguoi dung");
  assert.equal(await palette.page.locator('#quickResults [data-quick-id="users"]').count(),1);
  await palette.page.locator("#quickClose").click();
  await palette.page.keyboard.press("Control+k");
  await palette.page.locator("#quickDialog[open]").waitFor();
  await palette.page.keyboard.press("Escape");
  await palette.page.locator("#quickDialog").waitFor({state:"hidden"});
  await palette.page.screenshot({path:output+"/cms-v2-workspace-desktop.png",fullPage:true});
  await palette.context.close();

  const qualityContext=await browser.newContext({viewport:{width:1440,height:900}});
  const qp=await qualityContext.newPage();
  qp.on("pageerror",e=>{throw e});
  let qualityData={
    storage:"d1",can_manage:true,computed_at:"2026-09-27T08:00:00Z",
    tasks:[
      {rule_id:"VENUE_SOURCE_MISSING",entity_id:"venue_bai_sao",field:"source_ref",
        surface:"Địa điểm",severity:"high",status:"open",owner:"",due_at:null,
        evidence:"Bãi Sao đang ACTIVE nhưng thiếu nguồn",next_action:"Ghi nguồn kiểm chứng."},
      {rule_id:"VENUE_CHECK_DATE_MISSING",entity_id:"venue_bai_khem",field:"verified_at",
        surface:"Địa điểm",severity:"medium",status:"open",owner:"",due_at:null,
        evidence:"Bãi Khem đang ACTIVE nhưng thiếu ngày",next_action:"Ghi thời điểm kiểm tra."}
    ]
  };
  const posts=[];
  await qp.route("**/api/cms/session",route=>route.fulfill({status:200,
    contentType:"application/json",body:JSON.stringify({login:"visual-qa",role:"admin"})}));
  await qp.route("**/api/cms/quality",async route=>{
    if(route.request().method()==="POST"){
      const payload=route.request().postDataJSON();posts.push(payload);
      const target=qualityData.tasks.find(t=>
        [t.rule_id,t.entity_id||"",t.field].join("|")===payload.task_key);
      assert.ok(target,"quality POST must have an existing task");
      if(payload.action==="claim"){target.status="in_progress";target.owner="visual-qa";}
      if(payload.action==="due")target.due_at=payload.due_at||null;
      // The real Quality API returns persistence=d1 after a successful D1 write.
      target.persistence="d1";
    }
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(qualityData)});
  });
  await qp.route("**/api/cms/reviews",route=>route.fulfill({status:200,
    contentType:"application/json",body:JSON.stringify({items:[],history:[],checked_at:"2026-09-27T08:00:00Z"})}));
  await qp.goto(base+"/admin/quality.html",{waitUntil:"networkidle"});
  await qp.locator("#qualityQueue .task-card").first().waitFor();
  assert.equal(await qp.locator("#qualityQueue .task-card").count(),2);
  await qp.locator("#workSearch").fill("bai sao");
  assert.equal(await qp.locator("#qualityQueue .task-card").count(),1);
  assert.match(await qp.locator("#qualityQueue .task-title").textContent(),/Bãi Sao/);
  await qp.locator("#workClear").click();
  await qp.locator("[data-quality-action='claim']").first().click();
  await qp.locator("#notice.success").waitFor();
  assert.equal(posts.length,1,"Claim should cause exactly one POST");
  assert.equal(qualityData.tasks[0].owner,"visual-qa");
  assert.match(await qp.locator("#qualityQueue").textContent(),/Phụ trách: visual-qa/);
  await qp.locator("[data-quality-due]").first().fill("2026-10-01");
  await qp.locator("[data-quality-action='due']").first().click();
  await qp.locator("#notice.success").waitFor();
  assert.equal(posts.length,2,"Save due date should cause one additional POST");
  assert.equal(qualityData.tasks[0].due_at,"2026-10-01");
  assert.match(await qp.locator("#qualityQueue").textContent(),/01\/10\/2026/);
  await qp.screenshot({path:output+"/cms-v2-quality-desktop.png",fullPage:true});
  await qp.setViewportSize({width:390,height:844});
  assert.ok(await qp.locator("#workSearch").isVisible());
  const qOverflow=await qp.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(qOverflow<=2,"V2 quality overflows iPhone by "+qOverflow+"px");
  await qp.screenshot({path:output+"/cms-v2-quality-mobile.png",fullPage:true});
  await qualityContext.close();

  const reviewContext=await browser.newContext({viewport:{width:1440,height:900}});
  const rp=await reviewContext.newPage();
  const reviewErrors=[];rp.on("pageerror",e=>reviewErrors.push(e.message));
  await rp.route("**/api/cms/reviews",route=>route.fulfill({status:200,
    contentType:"application/json",body:JSON.stringify({
      items:[
        {number:151,title:"CMS: Bún quậy",draft:true,author:"editor",updated_at:"2026-09-27T08:00:00Z"},
        {number:152,title:"CMS: Hạt tiêu",draft:false,author:"kenzuko",updated_at:"2026-09-27T08:15:00Z"}
      ],history:[{number:142,title:"CMS: đã merge",url:"https://github.com/kenzuko/jotrip-home/pull/142",
        author:"kenzuko",can_rollback:false,merged_at:"2026-09-27T06:00:00Z"}],
      checked_at:"2026-09-27T08:20:00Z"
    })}));
  await rp.route("**/api/cms/quality",route=>route.fulfill({status:200,
    contentType:"application/json",body:JSON.stringify(qualityData)}));
  await rp.route("**/api/cms/review-diff?*",route=>route.fulfill({status:200,
    contentType:"application/json",body:JSON.stringify({checked_at:"2026-09-27T08:20:00Z",
      fields:[{path:"data/content.json",fields:[{field:"stories[0].title",
        before:"Bún quậy cũ",after:"Bún quậy mới"}]}]})}));
  await rp.goto(base+"/admin/reviews.html",{waitUntil:"networkidle"});
  await rp.locator(".review-pr-card").first().waitFor();
  assert.equal(await rp.locator(".review-pr-card").count(),2);
  await rp.locator("[data-review-filter='draft']").click();
  await rp.locator("#reviewSearch").fill("bun quay");
  assert.equal(await rp.locator(".review-pr-card").count(),1);
  await rp.locator(".field-toggle").first().click();
  await rp.locator(".field-diff h4").waitFor();
  assert.match(await rp.locator(".field-diff").textContent(),/So sánh với main hiện tại/);
  assert.equal(await rp.locator(".field-toggle").getAttribute("aria-expanded"),"true");
  await rp.screenshot({path:output+"/cms-v2-reviews-desktop.png",fullPage:true});
  await rp.setViewportSize({width:390,height:844});
  const rOverflow=await rp.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(rOverflow<=2,"V2 reviews overflow iPhone by "+rOverflow+"px");
  await rp.screenshot({path:output+"/cms-v2-reviews-mobile.png",fullPage:true});
  assert.deepEqual(reviewErrors,[],"review page console exceptions");
  await reviewContext.close();


  // The public preview of the full V2 design is static. Never load CMS APIs.
  const fullDemoContext=await browser.newContext({viewport:{width:1440,height:900}});
  const fullDemo=await fullDemoContext.newPage();
  const demoNetwork=[];
  await fullDemo.route("**/api/cms/**",route=>{
    demoNetwork.push(route.request().url());return route.abort();
  });
  await fullDemo.goto(base+"/admin/admin-v2-preview.html",{waitUntil:"networkidle"});
  await fullDemo.locator('[data-demo-tab="quality"]').click();
  await fullDemo.locator("#demoSearch").fill("bai sao");
  assert.equal(await fullDemo.locator('#demo-quality [data-demo-item="quality"]:visible').count(),1);
  await fullDemo.locator('[data-demo-filter="progress"]').click();
  assert.equal(await fullDemo.locator('#demo-quality [data-demo-item="quality"]:visible').count(),0);
  await fullDemo.locator('[data-demo-tab="reviews"]').click();
  await fullDemo.locator("#demoDiff").click();
  assert.equal(await fullDemo.locator("#demoDiffContent").isVisible(),true);
  await fullDemo.screenshot({path:output+"/cms-v2-full-demo-desktop.png",fullPage:true});
  await fullDemo.setViewportSize({width:390,height:844});
  const fullOverflow=await fullDemo.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(fullOverflow<=2,"Full V2 demo overflows mobile by "+fullOverflow+"px");
  await fullDemo.screenshot({path:output+"/cms-v2-full-demo-mobile.png",fullPage:true});
  assert.equal(demoNetwork.length,0,"Full V2 demo must not fetch CMS APIs");
  await fullDemoContext.close();
  console.log("PASS CMS V2 browser QA: desktop/mobile, local editorial preview, record backup, GitHub conflict guard, zero-network demo, Quality D1 action refresh, Review search and role navigation");
}finally{
  await browser.close();
}