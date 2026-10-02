/* Full-site English presentation layer.
 * Runs only on published /en/* pages. It translates static and dynamically
 * rendered UI copy without changing any data source, operational rule or API. */
(function(root){
"use strict";
if(root.OpenPQEnglishSite)return;
const isEnglish=()=>String(document.documentElement.lang||"").toLowerCase().startsWith("en")||
  document.querySelector('meta[name="openpq-locale"]')?.content==="en";
if(!isEnglish())return;

const state={copy:{exact:{},routes:{}},ready:null,muting:false};
const DICTIONARY="/data/i18n/en/site-shell.json?v=20261002-homecopy1";
const HOME_DYNAMIC={
  "TIN NHANH":"QUICK UPDATE",
  "LƯU Ý":"NOTICE",
  "PHÚ QUỐC · NGAY LÚC NÀY":"PHU QUOC · RIGHT NOW",
  "Phú Quốc, ngay lúc này.":"Phu Quoc, right now.",
  "Nhìn đúng tình trạng của đảo, chọn đúng việc đáng làm rồi đi tiếp với những thông tin thật sự hữu ích.":"See the island as it is, choose what is worth doing, then move on with information that actually helps.",
  "MỘT NĂM TRONG NHÀ THÙNG":"A YEAR IN THE BARREL HOUSE",
  "AN THỚI LÊN ĐÈN":"AN THOI LIGHTS UP",
  "MÙI CAY CỦA ĐẤT ĐỎ":"THE SPICE OF RED SOIL",
  "NHỊP SỐNG VEN BIỂN":"LIFE BY THE SEA",
  "Những thùng gỗ ủ nước mắm truyền thống ở Phú Quốc":"Traditional wooden fish sauce barrels in Phu Quoc",
  "An Thới và Sunset Town":"An Thoi and Sunset Town",
  "Vườn tiêu Phú Quốc":"Phu Quoc pepper farm",
  "Ghe tàu ven biển Phú Quốc":"Boats along the Phu Quoc coast",
  "CÓ GÌ HÔM NAY":"WHAT'S HAPPENING TODAY",
  "Phú Quốc có gì?":"What's happening in Phu Quoc?",
  "HÔM NAY ĐI ĐÂU":"WHERE TO GO TODAY",
  "Chọn một Phú Quốc hợp với hôm nay.":"Choose the side of Phu Quoc that fits today.",
  "KHÔNG NÊN BỎ LỠ":"DON'T MISS",
  "Nếu chỉ có vài ngày ở đảo.":"If you only have a few days on the island.",
  "KHÁM PHÁ THEO KHU VỰC":"EXPLORE BY AREA",
  "Mỗi khu vực của đảo có một nhịp rất khác.":"Each part of the island has its own rhythm.",
  "ĂN GÌ Ở PHÚ QUỐC":"WHAT TO EAT IN PHU QUOC",
  "Không chỉ là hải sản.":"More than seafood.",
  "CẦN LÀ CÓ":"ESSENTIALS",
  "Thông tin thực dụng.":"Practical information.",
  "DI SẢN & CHẤT ĐẢO":"HERITAGE & ISLAND CHARACTER",
  "Phú Quốc không chỉ có biển.":"Phu Quoc is more than beaches.",
  "Những thứ làm nên mùi, vị và ký ức của đảo — nghề biển, nước mắm, hồ tiêu và những câu chuyện địa phương.":"What gives the island its smell, taste and memory — fishing life, fish sauce, pepper and local stories.",
  "Những thứ làm nên mùi, vị và ký ức của đảo - nghề biển, nước mắm, hồ tiêu và những câu chuyện địa phương.":"What gives the island its smell, taste and memory - fishing life, fish sauce, pepper and local stories.",
  "HIỂU PHÚ QUỐC NHANH":"UNDERSTAND PHU QUOC FAST",
  "Hiểu đảo trong vài phút.":"Understand the island in a few minutes.",
  "Hiểu rõ Phú Quốc, lịch trình thảnh thơi.":"Understand Phu Quoc and travel with less guesswork.",
  "Theo dõi tình trạng, thời tiết và đường đi trước khi di chuyển để không bỏ lỡ những gì đáng trải nghiệm và tránh những chuyến đi xa không cần thiết.":"Check current conditions, weather and routes before you move, so you do not miss what matters or make an unnecessary long trip.",
  "Nền tảng thông tin miễn phí cho cộng đồng & du khách, được xây dựng và vận hành tại Phú Quốc bởi JoTrip.":"A free information platform for the community and visitors, built and operated in Phu Quoc by JoTrip."
};
const COMMON=[
  ["Phú Quốc","Phu Quoc"],["Dương Đông","Duong Dong"],["An Thới","An Thoi"],["Gành Dầu","Ganh Dau"],
  ["Cửa Cạn","Cua Can"],["Bãi Thơm","Bai Thom"],["Hàm Ninh","Ham Ninh"],["Bãi Sao","Bai Sao"],
  ["Hòn Thơm","Hon Thom"],["Rạch Giá","Rach Gia"],["Hà Tiên","Ha Tien"],
  ["Đang tải","Loading"],["Đang mở","Opening"],["Đang xem","Checking"],["Đang cập nhật","Updating"],
  ["Chưa tải được","Could not load"],["Chưa mở được","Could not open"],["Chưa có dữ liệu","No data yet"],
  ["Chưa có thông tin","No information yet"],["Chưa có cập nhật","No update yet"],["Chưa biết chắc","Not confirmed yet"],
  ["Chưa xác định","Not confirmed"],["Hôm nay","Today"],["Ngày mai","Tomorrow"],["Lúc này","Right now"],
  ["Cập nhật","Updated"],["Nguồn","Source"],["Giờ","Time"],["Ngày","Date"],["Tuyến","Route"],["Hãng","Operator"],
  ["Tình trạng","Status"],["Trạng thái","Status"],["Tất cả","All"],["Xem thêm","See more"],["Thu gọn","Show less"],
  ["Mở bản đồ","Open map"],["Xem bản đồ","View map"],["Chỉ đường","Directions"],["Tìm kiếm","Search"],
  ["Chọn khu vực","Choose an area"],["Khu vực","Area"],["Toàn đảo","Whole island"],["Bắc đảo","North island"],
  ["Nam đảo","South island"],["Trung tâm","Central area"],["Bờ Tây","West coast"],["Đông đảo","East coast"],
  ["Thời tiết","Weather"],["Biển","Sea"],["Sân bay","Airport"],["Tàu & Phà","Ferries"],["Tàu & phà","Ferries"],
  ["Tàu cao tốc","Passenger fast ferry"],["Phà","Vehicle ferry"],["Xe buýt","Bus"],["Cano","Speedboat"],
  ["Khám phá","Explore"],["Ăn uống","Food"],["Cẩm nang","Guide"],["Quanh đây","Near me"],["Khách sạn","Hotels"],
  ["Tiện ích","Utilities"],["Tỷ giá","Exchange rates"],["Tin & cập nhật","News & updates"],["Về chúng tôi","About us"],
  ["Mưa","Rain"],["Gió","Wind"],["Gió giật","Gusts"],["Sóng","Waves"],["Nhiệt độ","Temperature"],["Mây","Clouds"],
  ["Quan trắc","Observations"],["Dự báo","Forecast"],["Ước tính","Estimate"],["Mô hình","Model"],["Vệ tinh","Satellite"],
  ["Đang hoạt động","Operating"],["Hoạt động bình thường","Operating normally"],["Tạm dừng","Temporarily suspended"],
  ["Đã đóng","Closed"],["Đang mở","Open"],["Hết vé","Sold out"],["Còn hạn chế","Limited availability"],
  ["Có thể đặt vé","Available to book"],["Theo lịch","Scheduled"],["Theo dõi","Watch"],["Cần để ý","Use caution"],
  ["Khá thuận lợi","Fairly favorable"],["Nên né khung này","Avoid this time window"],["Bình thường","Normal"],
  ["Trực tiếp","Live"],["Dự phòng","Fallback"],["Thấp","Low"],["Vừa","Moderate"],["Mạnh","Strong"],["Rất mạnh","Very strong"],
  ["Miễn phí","Free"],["Giá tham khảo","Indicative price"],["Thời lượng","Duration"],["Lúc nên đi","Best time"],
  ["Phụ thuộc thời tiết","Weather dependent"],["Trước khi đi","Before you go"],["Xem chi tiết","View details"]
];
const RULES=[
  [/\b(\d+)\s*phút trước\b/gi,"$1 min ago"],
  [/\bhơn\s+(\d+)\s*giờ trước\b/gi,"more than $1 hours ago"],
  [/\b(\d+)\s*giờ trước\b/gi,"$1 hours ago"],
  [/\b(\d+)\s*ngày trước\b/gi,"$1 days ago"],
  [/\b(\d+(?:[.,]\d+)?)\s*km đường chim bay\b/gi,"$1 km straight-line"],
  [/\b(\d+(?:[.,]\d+)?)\s*km từ tâm khu\b/gi,"$1 km from the area center"],
  [/\b(\d+)\s*ngày có xác nhận\b/gi,"$1 confirmed days"],
  [/\b(\d+)\s*kết quả phù hợp\b/gi,"$1 matching results"],
  [/\b(\d+)\s*bài\b/gi,"$1 articles"],
  [/\b(\d+)\s*phản hồi chờ gửi\b/gi,"$1 feedback items waiting to send"],
  [/\bTháng\s+(\d+)\b/g,"Month $1"],
  [/\bCập nhật lúc\s+([^·]+)$/i,"Updated at $1"],
  [/\bCập nhật ngày\s+(.+)$/i,"Updated $1"],
  [/\bKhoảng\s+(\d+)\s*phút tới hoàng hôn\b/i,"About $1 minutes until sunset"]
];
function routeKey(){
  const path=(root.OpenPQI18n?.strip?.(location.pathname)||location.pathname||"/").replace(/\/index\.html$/,"/");
  const first=/^\/([^/]+)/.exec(path)?.[1]||"home";
  if(first==="weather"&&/history/i.test(path))return"weather_history";
  if(first==="cano"&&/history/i.test(path))return"cano_history";
  if(first==="places"&&/detail/i.test(path))return"places_detail";
  return first;
}
function normalize(s){return String(s??"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim()}
function preserve(raw,next){
  const lead=(String(raw).match(/^\s*/)||[""])[0],tail=(String(raw).match(/\s*$/)||[""])[0];
  return lead+next+tail;
}
function exactMap(){
  const key=routeKey();
  return Object.assign({},state.copy.exact||{},key==="home"?HOME_DYNAMIC:{},state.copy.routes?.[key]||{});
}
function translateString(raw){
  if(typeof raw!=="string"||!raw.trim())return raw;
  const trimmed=normalize(raw),exact=exactMap();
  if(exact[trimmed])return preserve(raw,exact[trimmed]);
  let value=trimmed;
  const phrases=Array.isArray(state.copy.phrases)?[...state.copy.phrases].sort((a,b)=>String(b?.[0]||"").length-String(a?.[0]||"").length):[];
  for(const [from,to] of phrases)if(from&&value.includes(from))value=value.split(from).join(to);
  for(const [from,to] of COMMON)if(value.includes(from))value=value.split(from).join(to);
  for(const [re,to] of RULES)value=value.replace(re,to);
  return preserve(raw,value);
}
function translateTextNode(node){
  if(!node||node.nodeType!==Node.TEXT_NODE)return;
  const parent=node.parentElement;
  if(!parent||/^(SCRIPT|STYLE|NOSCRIPT|CODE|PRE|TEXTAREA)$/i.test(parent.tagName))return;
  const next=translateString(node.nodeValue);
  if(next!==node.nodeValue)node.nodeValue=next;
}
function translateAttrs(el){
  if(!(el instanceof Element))return;
  for(const name of ["placeholder","aria-label","title","alt","value","data-label"]){
    if(!el.hasAttribute(name))continue;
    const raw=el.getAttribute(name),next=translateString(raw);
    if(next!==raw)el.setAttribute(name,next);
  }
}
function localizeLink(el){
  if(!(el instanceof HTMLAnchorElement))return;
  if(el.hasAttribute("data-openpq-lang")||el.closest?.("[data-openpq-language-static]"))return;
  const raw=el.getAttribute("href")||"";
  if(!raw||raw.startsWith("#")||/^(?:mailto:|tel:|javascript:)/i.test(raw))return;
  let url;
  try{url=new URL(raw,location.href)}catch{return}
  if(url.origin!==location.origin)return;
  const path=url.pathname;
  if(/^\/(?:en|api|admin|cms|assets|core|data|localized-pages)(?:\/|$)/.test(path))return;
  if(root.OpenPQI18n?.canServe?.("en",path)){
    url.pathname=root.OpenPQI18n.localize(path,"en");
    el.setAttribute("href",url.pathname+url.search+url.hash);
  }
}
function walk(rootNode){
  if(!rootNode)return;
  if(rootNode.nodeType===Node.TEXT_NODE){translateTextNode(rootNode);return}
  if(rootNode.nodeType!==Node.ELEMENT_NODE&&rootNode.nodeType!==Node.DOCUMENT_NODE&&rootNode.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
  if(rootNode.nodeType===Node.ELEMENT_NODE){translateAttrs(rootNode);localizeLink(rootNode)}
  const walker=document.createTreeWalker(rootNode,NodeFilter.SHOW_TEXT);
  let node;while((node=walker.nextNode()))translateTextNode(node);
  rootNode.querySelectorAll?.("*").forEach(el=>{translateAttrs(el);localizeLink(el)});
}
function translateHead(){
  if(document.title)document.title=translateString(document.title);
  for(const sel of ['meta[name="description"]','meta[property="og:title"]','meta[property="og:description"]','meta[property="og:image:alt"]','meta[name="twitter:title"]','meta[name="twitter:description"]','meta[name="twitter:image:alt"]']){
    const el=document.querySelector(sel);if(el?.content)el.content=translateString(el.content);
  }
}
async function load(){
  if(state.ready)return state.ready;
  state.ready=(async()=>{
    try{
      const r=await fetch(DICTIONARY,{cache:"no-store"});
      if(r.ok)state.copy=await r.json();
    }catch{}
    const rescan=()=>{walk(document);translateHead()};
    rescan();
    const observer=new MutationObserver(records=>{
      if(state.muting)return;
      state.muting=true;
      try{
        for(const record of records){
          if(record.type==="characterData")translateTextNode(record.target);
          if(record.type==="attributes")translateAttrs(record.target);
          for(const node of record.addedNodes)walk(node);
        }
        translateHead();
      }finally{state.muting=false}
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["placeholder","aria-label","title","alt","value","data-label"]});
    document.documentElement.dataset.openpqEnglishReady="true";
    document.dispatchEvent(new CustomEvent("openpq:english-ready"));
    queueMicrotask(rescan);
    setTimeout(rescan,100);
    setTimeout(rescan,750);
    return state;
  })();
  return state.ready;
}
root.OpenPQEnglishSite={state,load,translateString,walk};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>load(),{once:true});
else load();
})(window);