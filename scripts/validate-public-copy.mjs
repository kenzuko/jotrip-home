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
  "about/index.html"
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
  "CẦN CẬP NHẬT"
];

const violations=[];
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
