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
      tasks:[
        {rule_id:"VENUE_SOURCE_MISSING",entity_id:"venue_visual",field:"source_ref",
         status:"open",surface:"Địa điểm",severity:"high",
         evidence:"Chưa có nguồn xác minh tọa độ",next_action:"Bổ sung nguồn"}
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
      content:{version:"1",stories:[]}
    })
  }));
  await page.goto(base+"/admin/",{waitUntil:"networkidle"});
  await page.locator(".control-room").waitFor();
  await page.locator(".cr-task").first().waitFor();
  return {page,context,errors};
}
try{
  const desktop=await makePage("admin",{width:1440,height:900});
  assert.equal(await desktop.page.locator("#moduleTitle").textContent(),"Bàn làm việc");
  assert.equal(await desktop.page.locator(".cr-metric strong").first().textContent(),"1");
  assert.equal(await desktop.page.locator(".cr-metric strong").nth(1).textContent(),"1");
  assert.equal(await desktop.page.locator("a[href='index.html?module=venues&record=venue_visual&field=source_ref']").count(),1);
  assert.equal(await desktop.page.locator("button[data-cr-module=analytics]").count(),1);
  await desktop.page.screenshot({path:output+"/cms-control-room-desktop.png",fullPage:true});
  await desktop.page.locator('.module-btn[data-id="stories"]').click();
  await desktop.page.locator("#moduleTitle").getByText("Bài viết").waitFor();
  assert.equal(await desktop.page.locator('.module-btn[data-id="stories"].active').count(),1);
  assert.equal(desktop.errors.length,0,"desktop page errors: "+desktop.errors.join("; "));
  await desktop.context.close();

  const mobile=await makePage("editor",{width:390,height:844});
  const overflow=await mobile.page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=2,"mobile page overflows by "+overflow+" pixels");
  assert.equal(await mobile.page.locator("button[data-cr-module=analytics]").count(),0);
  assert.equal(await mobile.page.locator('.module-btn[data-id="analytics"]').count(),0);
  await mobile.page.screenshot({path:output+"/cms-control-room-mobile.png",fullPage:true});
  assert.equal(mobile.errors.length,0,"mobile page errors: "+mobile.errors.join("; "));
  await mobile.context.close();
  console.log("PASS CMS Control Room browser QA: desktop, mobile, navigation, role, responsive overflow");
}finally{
  await browser.close();
}