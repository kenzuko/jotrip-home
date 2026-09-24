import fs from "node:fs";

const files=[
  "index.html",
  "app.js",
  "home-foundation-v2.js",
  "home-live-v3.js",
  "home-experience-v1.js",
  "nearme/index.html",
  "nearme/nearme.js",
  "news/index.html",
  "about/index.html",
  "food/index.html",
  "stories/index.html",
  "airport/index.html",
  "weather/index.html",
  "news/news.js",
  "utilities/index.html",
  "utilities/utilities.js",
  "explore/index.html",
  "guide/index.html",
  "guide/guide.js",
  "places/detail.js",
  "currency/index.html",
  "currency/currency.js",
  "hotels/index.html",
  "hotels/app.js",
  "bus/index.html",
  "bus/app.js",
  "cano/index.html",
  "cano/app.js",
  "ferry/index.html",
  "ferry/app.js",
  "transit/index.html",
  "transit/app.js",
  "about/index.html",
  "stories/story.js",
  "food/food.js"
];

const banned=[
  "Hợp nhất:",
  "ĐÃ ĐỐI CHIẾU",
  "CẦN KIỂM TRA",
  "Chưa có giờ đáng tin",
  "Khung giờ tham khảo",
  "Đang nạp dữ liệu",
  "Đang tải dữ liệu",
  "cập nhật còn hiệu lực",
  "trạng thái kiểm tra",
  "xác nhận vận hành",
  "link đi thẳng tới dữ liệu live",
  "Thông tin nền được đối chiếu từ đâu?",
  "Không poll số ghế",
  "Collector chưa có snapshot",
  "Nguồn online",
  "Unknown, stale",
  "DỮ LIỆU DI CHUYỂN",
  "VẬN HÀNH BIỂN",
  "JoTrip Marine Ops",
  "Hạng đang dùng để lọc",
  "Khu vực đang cập nhật",
  "LIVE · VIETCOMBANK",
  "Chưa có giá chuẩn hóa",
  "LẦN KIỂM TRA",
  "ĐO THỰC",
  "CẦN CẬP NHẬT",
  "Nguồn tham khảo"
];

const violations=[];
const knowledge=JSON.parse(fs.readFileSync("data/knowledge/objects.json","utf8"));
const ready=knowledge.objects.filter(x=>x.status==="READY_PUBLIC");
const untranslatedTitles=new Set(["Airport transfer","Pharmacy","Clinic / Hospital","Toilet","Parking","Fuel stations","Minimart / convenience store","Emergency numbers & practical help","Snorkeling","Diving","Night Market","Safari visit","VinWonders visit","Visit fish sauce house / pepper farm","Kayak","Beach day","Sunset watching","Sunrise watching","Cable car Hòn Thơm","Bãi Trường trước và sau resort development"]);
for(const item of ready)if(untranslatedTitles.has(item.title))violations.push({file:"data/knowledge/objects.json",phrase:"Untranslated public title: "+item.title});
const stories=JSON.parse(fs.readFileSync("data/content.json","utf8"));
for(const story of stories.stories||[])for(const section of story.sections||[])if(/^open phu quoc note$/i.test(section.heading||""))violations.push({file:"data/content.json",phrase:"Internal note heading: "+section.heading});
for(const file of files){
  if(!fs.existsSync(file))continue;
  const text=fs.readFileSync(file,"utf8");
  for(const phrase of banned){
    if(text.includes(phrase))violations.push({file,phrase});
  }
}

if(violations.length){
  console.error("Public copy validation failed. Machine-like phrases found:");
  for(const v of violations)console.error(" - "+v.file+": "+v.phrase);
  process.exit(1);
}
console.log("Public copy validation passed:",files.length,"surfaces checked");
