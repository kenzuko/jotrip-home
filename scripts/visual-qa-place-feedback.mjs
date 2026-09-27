/* Mobile-first feedback QA. Mocked endpoints: this test never writes to Cloudflare. */
import assert from "node:assert/strict";
import {mkdirSync} from "node:fs";
import {chromium} from "playwright";

const base=process.env.VISUAL_QA_BASE_URL||"http://127.0.0.1:4173";
mkdirSync("visual-qa-results",{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const errors=[],submitted=[];
async function readyPage(viewport={width:390,height:844},enabled=true){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  page.on("pageerror",err=>errors.push(err.message));
  await page.route("**/api/feedback",async route=>{
    const req=route.request();
    if(req.method()==="GET"){
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        ok:true,enabled,photo_enabled:false,max_photo_bytes:3145728
      })});return;
    }
    if(req.method()==="POST"){
      const body=req.postData()||"";
      submitted.push(body);
      await route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({
        ok:true,received:true,reference:"00000000-0000-4000-8000-000000000001"
      })});return;
    }
    await route.fulfill({status:405});
  });
  return page;
}
try{
  const near=await readyPage();
  await near.goto(base+"/nearme/?area=zone_central_west",{waitUntil:"domcontentloaded"});
  const nearButton=near.locator("#nearResults .near-card [data-openpq-feedback]").first();
  await nearButton.waitFor({timeout:15000});
  const nearId=await nearButton.getAttribute("data-feedback-id");
  assert.ok(nearId);
  await nearButton.click();
  await near.locator(".opq-feedback").waitFor({state:"visible"});
  await near.locator('.opq-feedback select[name="issue"]').selectOption("location");
  assert.equal(await near.locator("#opqFeedbackPhoto").isHidden(),true);
  await near.locator('.opq-feedback textarea[name="details"]').fill("Vị trí mới đã đối chiếu tại chỗ.");
  const box=await near.locator(".opq-feedback").boundingBox();
  assert.ok(box&&box.width<=390&&box.y>=0&&box.y+box.height<=844+2,"Form should fit iPhone viewport");
  await near.screenshot({path:"visual-qa-results/place-feedback-mobile.png"});
  await near.locator(".opq-feedback-send").click();
  await near.getByText("Đã nhận góp ý.",{exact:false}).waitFor();
  assert.ok(submitted.at(-1).includes(nearId),"Feedback must carry the canonical Near Me ID");
  await near.locator(".opq-feedback-close").click();

  const proposal=near.locator('[data-feedback-issue="new_place"]');
  await proposal.click();
  assert.equal(await near.locator('.opq-feedback select[name="issue"]').inputValue(),"new_place");
  await near.locator('.opq-feedback input[name="new_name"]').fill("Quán địa phương kiểm thử");
  await near.locator('.opq-feedback textarea[name="details"]').fill("Đường gần chợ, đối diện bến xe.");
  await near.locator(".opq-feedback-send").click();
  await near.getByText("Đã nhận góp ý.",{exact:false}).waitFor();
  assert.ok(submitted.at(-1).includes("new_place"));
  assert.ok(submitted.at(-1).includes("Quán địa phương kiểm thử"));
  await near.close();

  const story=await readyPage({width:1280,height:850});
  await story.goto(base+"/stories/article.html?id=mui-cay-cua-dat-do",{waitUntil:"domcontentloaded"});
  const articleButton=story.locator('button[data-feedback-query-id][data-feedback-type="article"]');
  await articleButton.waitFor();
  await articleButton.click();
  assert.equal(await story.locator('.opq-feedback select[name="issue"] option').count(),2,
    "Article feedback must not offer irrelevant shop hours and location categories");
  await story.locator(".opq-feedback-close").click();
  await story.evaluate(()=>{
    document.documentElement.lang="ko";
    document.body.dataset.aiTranslation="true";
    document.body.dataset.translationRevision="r1";
    window.OpenPQFeedback.refresh();
  });
  const translatedNotice=story.locator("[data-opq-translation-note]");
  await translatedNotice.waitFor();
  assert.equal(await story.locator('button[data-feedback-type="article"]:not([data-feedback-issue])').isHidden(),true,
    "Only one compact feedback entry should appear on translated articles");
  await translatedNotice.locator("button").click();
  assert.equal(await story.locator('.opq-feedback select[name="issue"]').inputValue(),"translation");
  assert.equal(await story.locator('.opq-feedback input[name="language"]').inputValue(),"ko");
  await story.locator('.opq-feedback textarea[name="quoted_text"]').fill("기존 번역 문장");
  await story.locator('.opq-feedback textarea[name="suggested_text"]').fill("더 자연스러운 문장");
  await story.locator(".opq-feedback-send").click();
  await story.getByText("Thank you!",{exact:false}).waitFor();
  assert.ok(submitted.at(-1).includes("기존 번역 문장")||submitted.at(-1).includes("%EA%B8%B0"),
    "Korean correction should be sent through the single public intake");
  await story.close();

  const guide=await readyPage();
  await guide.goto(base+"/guide/article.html?id=knowledge_001_dinh-cau",{waitUntil:"domcontentloaded"});
  await guide.locator('button[data-feedback-query-id][data-feedback-type="article"]').click();
  assert.equal(await guide.locator('.opq-feedback select[name="issue"] option').count(),2);
  await guide.close();

  const inactive=await readyPage({width:390,height:750},false);
  await inactive.goto(base+"/nearme/?area=zone_south",{waitUntil:"domcontentloaded"});
  await inactive.locator('[data-feedback-issue="new_place"]').click();
  await inactive.getByText("Kênh góp ý chưa sẵn sàng lúc này.",{exact:false}).waitFor();
  assert.equal(await inactive.locator(".opq-feedback-send").isDisabled(),true,
    "Not-configured deployments must never display a fake working send button");
  await inactive.close();

  const cms=await browser.newPage({viewport:{width:390,height:844}});
  cms.on("pageerror",err=>errors.push(err.message));
  await cms.route("**/api/cms/session",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({login:"qa-editor",role:"editor"})
  }));
  let patchCount=0;
  await cms.route("**/api/cms/feedback**",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(req.method()==="PATCH"){
      patchCount++;
      const payload=JSON.parse(req.postData()||"{}");
      assert.equal(payload.status,"resolved");
      assert.ok(payload.note.length>=10);
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,id:payload.id,status:"resolved"})});
      return;
    }
    if(url.searchParams.get("kind")==="translation"){
      const sample={id:"mock_translation_ko",issue:"translation",entity_type:"article",entity_id:"story_test",
        entity_label:"Bài tiếng Hàn",language:"ko",source_revision:"r1",
        quoted_text:'<img src=x onerror=alert(1)>',suggested_text:"더 자연스러운 문장",approved_text:"",
        details:"Cần sửa cho tự nhiên hơn.",source_path:"/stories/article.html?id=story_test",has_photo:0,
        created_at:new Date().toISOString(),status:"new",moderator_note:""};
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        ok:true,items:[sample],limit:50,offset:0,has_more:false,next_offset:null
      })});return;
    }
    const offset=Number(url.searchParams.get("offset")||0),total=51;
    const reports=Array.from({length:Math.min(50,total-offset)},(_,i)=>{
      const n=offset+i;
      return {id:"mock_report_"+n,issue:"location",entity_type:"venue",entity_id:"venue_test",
        entity_label:n===0?'<img src=x onerror=alert(1)>':"Điểm kiểm thử "+n,
        details:"Vị trí hiện tại không chính xác.",source_path:"/nearme/",has_photo:0,
        created_at:new Date(Date.now()-n*1000).toISOString(),status:"new",moderator_note:""};
    });
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
      ok:true,items:reports,limit:50,offset,has_more:offset===0,next_offset:offset===0?50:null
    })});
  });
  await cms.goto(base+"/admin/feedback.html",{waitUntil:"domcontentloaded"});
  await cms.locator(".item").first().waitFor();
  assert.equal(await cms.locator(".item").count(),50);
  assert.equal(await cms.locator(".item img").count(),0,"Public strings must be HTML-escaped");
  await cms.locator("#loadMore").click();
  await cms.locator(".item").nth(50).waitFor({timeout:10000});
  assert.equal(await cms.locator(".item").count(),51,"CMS inbox must not lose reports after first 50");
  const row=cms.locator(".item").first();
  assert.equal(await row.locator('a[href^="index.html?module=venues"]').count(),1);
  await row.locator(".item-state").selectOption("resolved");
  await row.locator(".save").click();
  assert.equal(patchCount,0,"Terminal review needs a meaningful note");
  await row.locator(".item-note").fill("Đã đối chiếu và sửa địa chỉ.");
  await Promise.all([
    cms.waitForResponse(response=>response.url().includes("/api/cms/feedback")&&response.request().method()==="PATCH"),
    row.locator(".save").click()
  ]);
  assert.equal(patchCount,1);
  await cms.locator("#kindFilter").selectOption("translation");
  await cms.locator(".translation-box").waitFor();
  assert.equal(await cms.locator(".translation-box img").count(),0,"Translation suggestions must never render injected HTML");
  await cms.locator("#languageFilter").selectOption("ko");
  await cms.locator(".translation-box").waitFor();
  const translationItem=cms.locator(".item").first();
  await translationItem.locator(".item-state").selectOption("resolved");
  await translationItem.locator(".item-note").fill("Đã kiểm tra đúng câu chữ");
  await translationItem.locator(".save").click();
  assert.equal(patchCount,1,"Cannot mark translation complete without approved text");
  await translationItem.locator(".approved-text").fill("자연스러운 문장으로 수정");
  await Promise.all([
    cms.waitForResponse(response=>response.url().includes("/api/cms/feedback")&&response.request().method()==="PATCH"),
    translationItem.locator(".save").click()
  ]);
  assert.equal(patchCount,2,"Verified translations use the same moderation PATCH");
  await cms.screenshot({path:"visual-qa-results/place-feedback-cms-mobile.png"});
  await cms.close();
  assert.deepEqual(errors,[],"No browser JS errors in feedback flows");
  console.log("UNIFIED FEEDBACK VISUAL QA PASS: translated Korean notice, single dialog, CMS category filter, safe translated text and reviewer gate. PLACE FEEDBACK VISUAL QA PASS: iPhone, Near Me IDs, missing-place intake, editorial context, disabled configuration, CMS permissions, pagination and safe rendering");
}finally{
  await browser.close();
}
