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
  await desktop.page.locator("[data-story-reading]").waitFor();
  assert.equal(await desktop.page.locator("[data-story-select]").count(),1);
  await desktop.page.locator('[data-story-view="outline"]').click();
  await desktop.page.locator('[data-story-outline] [data-story-focus="0"]').waitFor();
  await desktop.page.locator('[data-story-focus="0"]').click();
  await desktop.page.locator('textarea[data-path="stories.0.sections.0.body"]').waitFor();
  await desktop.page.locator("[data-story-writing]").click();
  assert.equal(await desktop.page.locator(".story-desk.writing").count(),1);
  assert.equal(await desktop.page.locator(".story-desk.writing .story-library").isVisible(),false);
  await desktop.page.locator("[data-story-writing]").click();
  await desktop.page.locator('[data-story-insert="text"]').first().click();
  assert.equal(await desktop.page.locator("[data-story-section-card]").count(),2);
  await desktop.page.locator("[data-story-undo]").click();
  assert.equal(await desktop.page.locator("[data-story-section-card]").count(),1);
  assert.ok(await desktop.page.locator("[data-story-editor-checks]").isVisible());
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
  // Real editor composer: use the existing media API through a browser mock, never publish.
  const mockMedia=[];
  await desktop.page.route("**/api/cms/media",route=>{
    const body=route.request().postDataJSON();mockMedia.push({mime:body.mime,name:body.filename});
    return route.fulfill({status:200,contentType:"application/json",
      body:JSON.stringify({ok:true,url:"/assets/media/editorial-bai-sao-local.jpg"})});
  });
  await desktop.page.locator(".section-media-tools").first().evaluate(el=>{el.open=true});
  await desktop.page.locator('[data-story-layout-pick="body"]').first().click();
  assert.equal(await desktop.page.locator('select[data-path="stories.0.sections.0.layout"]').inputValue(),"body");
  const bodyField=desktop.page.locator('textarea[data-path="stories.0.sections.0.body"]');
  await bodyField.evaluate(el=>{el.focus();el.setSelectionRange(8,8)});
  await desktop.page.locator('[data-story-split-photo="0"]').click();
  await desktop.page.locator('[data-story-section-card="1"] [data-media-path]').waitFor();
  const pickerPromise=desktop.page.waitForEvent("filechooser");
  await desktop.page.locator('[data-story-section-card="1"] [data-media-path]').click();
  const picker=await pickerPromise;
  await picker.setFiles("assets/media/editorial-bai-sao-local.jpg");
  await desktop.page.waitForFunction(()=>document.querySelector(
    '[data-path="stories.0.sections.1.image"]')?.value==="/assets/media/editorial-bai-sao-local.jpg");
  assert.equal(mockMedia.length,1,"One image should make exactly one CMS media upload");
  await desktop.page.locator('[data-story-section-card="1"] [data-story-layout-pick="full"]').click();
  assert.equal(await desktop.page.locator('select[data-path="stories.0.sections.1.layout"]').inputValue(),"full");
  await desktop.page.locator('[data-story-view="read"]').click();
  assert.equal(await desktop.page.locator(".story-reading-figure.full img").count(),1);
  await desktop.page.locator('[data-story-view="edit"]').click();
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
  await mobile.page.locator("[data-story-reading]").waitFor();
  await mobile.page.locator('[data-story-view="edit"]').click();
  await mobile.page.locator("[data-story-writing]").click();
  assert.ok(await mobile.page.locator(".story-desk.writing").isVisible());
  const focusWidth=await mobile.page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(focusWidth<=2,"Focused writing overflows iPhone by "+focusWidth+"px");
  await mobile.page.locator("[data-story-writing]").click();
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
  const deskContext=await browser.newContext({viewport:{width:1440,height:900}});
  const desk=await deskContext.newPage(),calls=[];
  await desk.route("**/api/cms/**",route=>{calls.push(route.request().url());return route.abort();});
  await desk.goto(base+"/admin/story-desk-preview.html",{waitUntil:"networkidle"});
  await desk.locator("[data-story-reading]").waitFor();
  await desk.locator("#storyDeskSearch").fill("nha thung");
  assert.equal(await desk.locator("[data-story-select]:visible").count(),1);
  await desk.locator("#storyDeskSearch").fill("");
  await desk.locator('[data-story-select="1"]').click();
  assert.match(await desk.locator(".story-reading h1").textContent(),/Một năm trong nhà thùng/);
  await desk.locator('[data-story-view="outline"]').click();
  await desk.locator('[data-story-focus="0"]').click();
  await desk.locator('[data-demo-field="body"]').fill("Nội dung mới trong bản demo.");
  await desk.locator('[data-story-view="read"]').click();
  assert.match(await desk.locator("[data-story-reading]").textContent(),/Nội dung mới trong bản demo/);
  await desk.locator('[data-story-view="edit"]').click();
  await desk.locator("[data-story-writing]").click();
  assert.equal(await desk.locator(".story-desk.writing").count(),1);
  await desk.locator("[data-story-writing]").click();
  await desk.locator('[data-demo-insert-image="0"]').click();
  await desk.locator('[data-demo-photo-example="1"]').click();
  await desk.locator('[data-demo-section="1"] [data-story-layout-pick="body"]').click();
  await desk.locator('[data-story-view="read"]').click();
  assert.equal(await desk.locator(".story-reading-figure.body img").count(),1);
  await desk.screenshot({path:output+"/cms-story-desk-desktop.png",fullPage:true});
  await desk.setViewportSize({width:390,height:844});
  assert.ok(await desk.locator("#storyDeskSearch").isVisible());
  const deskOverflow=await desk.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(deskOverflow<=2,"Story desk overflows iPhone by "+deskOverflow+"px");
  await desk.screenshot({path:output+"/cms-story-desk-mobile.png",fullPage:true});
  assert.equal(calls.length,0,"Story desk demo must never call CMS API");
  await deskContext.close();

  {
  const inlineContext=await browser.newContext({viewport:{width:1365,height:850}});
  const inline=await inlineContext.newPage();
  inline.on("dialog",d=>d.accept());
  const story={id:"test-draft",title:"Bài đang biên tập",category:"ĐỜI SỐNG ĐẢO",dek:"Mô tả ngắn",
    intro:"Lời mở đang soạn",image:"",read_minutes:3,
    sections:[{heading:"Buổi sáng",body:"Nội dung bản nháp trước khi sửa."}],sources:[]};
  const fixture={version:"1",stories:[story]},posts=[],directPosts=[],reviewPosts=[];
  await inline.route("**/api/cms/session",r=>r.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({login:"inline-qa",role:"admin"})}));
  await inline.route("**/data/content.json?*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(fixture)}));
  await inline.route("**/api/cms/content?*",r=>r.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({sha:"qa-file-sha",content:fixture})}));
  await inline.route("**/api/cms/edit-state?*",r=>r.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({sha:"qa-file-sha",complete:true,conflicts:[]})}));
  await inline.route("**/api/cms/publish",r=>{reviewPosts.push(r.request().postDataJSON());
    return r.fulfill({status:500,contentType:"application/json",body:'{"error":"Admin publish must not create a review PR"}'});
  });
  await inline.route("**/api/cms/direct-save",r=>{
    directPosts.push(r.request().postDataJSON());
    return r.fulfill({status:200,contentType:"application/json",
      body:JSON.stringify({ok:true,commit:"a".repeat(40),deployment_pending:true})});
  });
  await inline.goto(base+"/stories/article.html?id=test-draft&cms-inline-qa=1",{waitUntil:"networkidle"});
  await inline.locator("#inlineCmsOpen").waitFor();
  await inline.locator("#inlineCmsOpen").click();
  await inline.locator(".inline-edit-trigger").first().waitFor();
  const bodySection=inline.locator("#articleRoot .article-section .section-text");
  await bodySection.locator("xpath=following-sibling::button[contains(@class,'inline-edit-trigger')]").click();
  await inline.locator(".inline-edit-panel textarea").fill("Tớ sửa ngay lúc đọc.");
  assert.match(await bodySection.textContent(),/sửa ngay/);
  await inline.locator("#inlineCmsSave").click();
  assert.ok(await inline.evaluate(()=>Boolean(localStorage.getItem("openpq-cms-draft:inline-qa:stories"))));
  assert.equal(directPosts.length,0,"Saving a draft must not push GitHub");
  assert.equal(reviewPosts.length,0,"Saving a draft must not create a review PR");
  assert.equal(await inline.locator("#inlineCmsSubmit").isVisible(),false);
  assert.ok(await inline.locator("#inlineCmsPublish").isVisible());
  await inline.screenshot({path:output+"/cms-inline-desktop.png",fullPage:true});
  await inline.setViewportSize({width:390,height:844});
  const inlineOverflow=await inline.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(inlineOverflow<=2,"Inline editor mobile overflow: "+inlineOverflow);
  await inline.screenshot({path:output+"/cms-inline-mobile.png",fullPage:true});
  await inline.locator("#inlineCmsPublish").click();
  await inline.locator("#inlineCmsStatus a[href*='/commit/']").waitFor();
  assert.equal(directPosts.length,1,"One publish click must create exactly one direct-save request");
  assert.equal(reviewPosts.length,0,"Admin publish must not create a PR");
  assert.equal(directPosts[0].path,"data/content.json");
  assert.equal(directPosts[0].changes.length,1);
  assert.equal(directPosts[0].changes[0].field,"sections.0.body");
  assert.equal(directPosts[0].changes[0].after,"Tớ sửa ngay lúc đọc.");
  await inlineContext.close();
  const anonCtx=await browser.newContext({viewport:{width:390,height:844}});
  const anon=await anonCtx.newPage();
  await anon.route("**/api/cms/session",r=>r.fulfill({status:401,contentType:"application/json",body:'{"error":"Not logged in"}'}));
  await anon.route("**/data/content.json?*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(fixture)}));
  await anon.goto(base+"/stories/article.html?id=test-draft&cms-inline-qa=1",{waitUntil:"networkidle"});
  assert.equal(await anon.locator("#inlineCmsToolbar").count(),0);
  await anonCtx.close();
  }
  // Food article editing is separate from the CMS entity/food mapping form.
  {
  const dish={id:"bun-quay",name:"Bún quậy",category:"local",
    intro:"Món ăn nóng, tự pha chén chấm.",
    origin:"Một món ăn gắn với Phú Quốc.",
    why_name:"Tên món có liên quan tới chén nước chấm.",
    ingredients:["Bún tươi","Chả hải sản"],
    how_to_eat:"Ăn khi còn nóng.",
    tips:["Hỏi thành phần trước khi gọi."],
    allergen_flags:[{key:"shellfish",label:"Giáp xác",level:"high"}],
    allergy_note:"Nước dùng có thể có tôm hoặc cua.",
    ask_staff:["Riêu có thêm tôm không?"],hashtags:[],meal_times:["lunch"]};
  const fixture={schema_version:"1.1",locale:"vi",dishes:[dish]};
  const foodContext=await browser.newContext({viewport:{width:1440,height:900}});
  const food=await foodContext.newPage(),foodDirectPosts=[],foodReviewPosts=[];
  food.on("dialog",dialog=>dialog.accept());
  await food.route("**/api/cms/session",r=>r.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({login:"food-qa",name:"Food QA",role:"admin"})}));
  await food.route("**/data/i18n/vi/food.json?*",r=>r.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify(fixture)}));
  await food.route("**/api/cms/content?*",r=>r.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({path:"data/i18n/vi/food.json",sha:"qa-food-sha",content:fixture})}));
  await food.route("**/api/cms/edit-state?*",r=>r.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({sha:"qa-food-sha",complete:true,conflicts:[]})}));
  await food.route("**/api/cms/publish",r=>{
    foodReviewPosts.push(r.request().postDataJSON());
    return r.fulfill({status:500,contentType:"application/json",body:'{"error":"Admin publish must not create a review PR"}'});
  });
  await food.route("**/api/cms/direct-save",r=>{
    foodDirectPosts.push(r.request().postDataJSON());
    return r.fulfill({status:200,contentType:"application/json",
      body:JSON.stringify({ok:true,commit:"b".repeat(40),deployment_pending:true})});
  });
  await food.goto(base+"/food/article.html?id=bun-quay&cms-inline-qa=1",{waitUntil:"networkidle"});
  await food.locator("#foodInlineLauncher").waitFor();
  await food.locator("#foodInlineLauncher").click();
  await food.locator('[data-food-path="tips.0"] + button.food-inline-trigger').click();
  await food.locator(".food-inline-panel textarea").fill("Lưu ý vừa sửa ngay khi đang đọc.");
  assert.match(await food.locator('[data-food-path="tips.0"]').textContent(),/vừa sửa ngay/);
  await food.locator("#foodInlineSave").click();
  assert.equal(await food.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith("openpq-cms-food-inline:v1:"))),true);
  assert.equal(foodDirectPosts.length,0,"Food draft save must not push GitHub");
  assert.equal(foodReviewPosts.length,0,"Food draft save must not create a PR");
  assert.equal(await food.locator("#foodInlineSubmit").isVisible(),false);
  assert.ok(await food.locator("#foodInlinePublish").isVisible());
  await food.setViewportSize({width:390,height:844});
  const box=await food.locator("#foodArticle .food-safety").evaluate(el=>({
    padding:parseFloat(getComputedStyle(el).paddingLeft),width:el.getBoundingClientRect().width
  }));
  assert.ok(box.padding>=20,"Food safety card text hugs its border: "+box.padding);
  assert.ok(box.width<=390,"Food safety card overflows screen: "+box.width);
  const overflow=await food.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=2,"Food article editor mobile overflow: "+overflow);
  await food.screenshot({path:output+"/cms-inline-food-mobile.png",fullPage:true});
  await food.locator("#foodInlinePublish").click();
  await food.locator("#foodInlineResult a[href*='/commit/']").waitFor();
  assert.equal(foodDirectPosts.length,1,"One food publish click must create exactly one direct-save request");
  assert.equal(foodReviewPosts.length,0,"Admin food publish must not create a PR");
  assert.equal(foodDirectPosts[0].path,"data/i18n/vi/food.json");
  assert.equal(foodDirectPosts[0].changes.length,1);
  assert.equal(foodDirectPosts[0].changes[0].field,"tips.0");
  assert.equal(foodDirectPosts[0].changes[0].after,"Lưu ý vừa sửa ngay khi đang đọc.");
  await foodContext.close();
  const anonCtx=await browser.newContext({viewport:{width:390,height:844}});
  const anon=await anonCtx.newPage();
  await anon.route("**/api/cms/session",r=>r.fulfill({
    status:401,contentType:"application/json",body:'{"error":"Not logged in"}'}));
  await anon.route("**/data/i18n/vi/food.json?*",r=>r.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify(fixture)}));
  await anon.goto(base+"/food/article.html?id=bun-quay&cms-inline-qa=1",{waitUntil:"networkidle"});
  assert.equal(await anon.locator("#foodInlineLauncher").count(),0);
  await anonCtx.close();
  }
  // Safe static copy: drafts span editorial pages but only one Publish request touches GitHub.
  {
  const staticFixture={version:"1.0",hero:{kicker:"K",title:"T",lead:"L"},sections:{},footer:{title:"F",lead:"FL",note:"FN"},site:{about:{heroLead:"Bản gốc",purposeTitle:"Mục đích",purpose1:"Một",purpose2:"Hai",purpose3:"Ba",systemTitle:"Ba lớp",system1:"S1",system2:"S2",system3:"S3",madeTitle:"Làm tại đảo",madeLead1:"M1",madeLead2:"M2",openTitle:"Open",openLead:"OL",footerLead:"Footer",footerNote:"Note"}}};
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage(),directPosts=[];
  page.on("dialog",d=>d.accept());
  await page.route("**/api/cms/session",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({login:"static-qa",role:"admin"})}));
  await page.route("**/data/home-copy.json?*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(staticFixture)}));
  await page.route("**/api/cms/content?*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({sha:"1".repeat(40),content:staticFixture})}));
  await page.route("**/api/cms/direct-save",r=>{directPosts.push(r.request().postDataJSON());return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,commit:"c".repeat(40),deployment_pending:true})});});
  await page.goto(base+"/about/?cms-inline-qa=1",{waitUntil:"networkidle"});
  await page.locator("#cmsStaticLaunch").waitFor();
  await page.locator("#cmsStaticLaunch").click();
  const lead=page.locator('[data-cms-static-field="site.about.heroLead"]');
  await lead.locator("xpath=following-sibling::button[contains(@class,'cms-static-trigger')]").click();
  await page.locator(".cms-static-panel textarea").fill("Bản sửa có cảm xúc hơn.");
  await page.locator("#cmsStaticDraft").click();
  assert.equal(directPosts.length,0,"Static draft must never push GitHub");
  assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith("openpq-cms-site-copy-v1:"))));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=2,"Static copy editor mobile overflow: "+overflow);
  await page.screenshot({path:output+"/cms-inline-static-about-mobile.png",fullPage:true});
  await page.locator("#cmsStaticPublish").click();
  await page.waitForFunction(()=>!localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith("openpq-cms-site-copy-v1:"))||"missing"));
  assert.equal(directPosts.length,1,"One static Publish must cause one GitHub request");
  assert.equal(directPosts[0].path,"data/home-copy.json");
  assert.equal(directPosts[0].changes.filter(x=>x.field==="site.about.heroLead").length,1);
  assert.equal(directPosts[0].changes.find(x=>x.field==="site.about.heroLead").after,"Bản sửa có cảm xúc hơn.");
  await ctx.close();
  }
  console.log("PASS CMS V2 browser QA: desktop/mobile, local editorial preview, record backup, GitHub conflict guard, zero-network demo, Quality D1 action refresh, Review search and role navigation");
}finally{
  await browser.close();
}