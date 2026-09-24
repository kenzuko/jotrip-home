import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

// Execute the real homepage trip-clock functions in a fixed Asia/Ho_Chi_Minh
// clock, rather than duplicating the cancellation filter inside this test.
const read=p=>JSON.parse(readFileSync(p,"utf8"));
const homepage=readFileSync("home-foundation-v2.js","utf8");
const end=homepage.indexOf("\nfunction renderTripClock(){");
assert.ok(end>0,"Unable to isolate the homepage trip-clock module");
const prelude=homepage.slice(0,end);
const support=read("data/home-support.json");
const notices=read("data/operational-notices.json");
const entities=[...read("data/entities/places.json").entities,...read("data/entities/activities.json").entities];
const cancelled="activity_tinh_hoa_viet_nam";
const venice="activity_sac_mau_venice";

function snapshot(utc){
 const host={__testSupport:support,__testNotices:notices,__testEntities:entities};
 const FixedDate=class extends Date{
  constructor(...args){super(...(args.length?args:[utc]))}
  static now(){return Date.parse(utc)}
 };
 const source=prelude+`
  support=window.__testSupport;
  operationalNotices=window.__testNotices;
  for(const entity of window.__testEntities)entities.set(entity.id,entity);
  window.__test={tripClockSnapshot,activeNotices,localDateKey};
 })();`;
 runInNewContext(source,{window:host,Date:FixedDate});
 return {date:host.__test.localDateKey(),notices:host.__test.activeNotices(),rows:host.__test.tripClockSnapshot()};
}
const day=snapshot("2026-09-24T12:30:00.000Z"); // 19:30 at Phu Quoc
assert.equal(day.date,"2026-09-24");
assert.equal(day.notices.length,1);
assert.equal(day.notices[0].entity_id,cancelled);
assert.ok(!day.rows.some(row=>row.item.entity_id===cancelled),
 "Today's cancelled Tinh Hoa show must not appear in the trip suggestions");
assert.ok(day.rows.some(row=>row.item.entity_id===venice&&row.eligible),
 "An unrelated 21:30 show should remain available");

const tomorrow=snapshot("2026-09-25T12:30:00.000Z");
assert.equal(tomorrow.date,"2026-09-25");
assert.equal(tomorrow.notices.length,0,
 "A dated cancellation must not persist for three days as a live operational status");
assert.ok(tomorrow.rows.some(row=>row.item.entity_id===cancelled&&row.eligible),
 "Normal scheduled performances must return the following day");

const late=snapshot("2026-09-24T16:30:00.000Z"); // 23:30 at Phu Quoc
assert.ok(late.rows.filter(row=>row.eligible).length<3,
 "Late-night trip availability must not be faked to meet daytime QA card counts");
console.log("PASS: dated cancellation, unrelated show, next-day restoration, late-night truth");
