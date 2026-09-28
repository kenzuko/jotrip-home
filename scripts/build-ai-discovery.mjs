// Optional human/AI-readable discovery note. Search indexing still relies on
// ordinary crawlable HTML, internal links, robots.txt and sitemap.xml.
import {existsSync,writeFileSync,readFileSync} from "node:fs";
import {join} from "node:path";
const out=process.env.OPENPQ_DIST||"dist";
const host="https://openphuquoc.com";
const sections=[
  ["Trang chủ","/"],
  ["Cẩm nang và kiến thức địa phương","/guide/knowledge.html"],
  ["Đi đâu bây giờ?","/go/"],
  ["Tìm địa điểm gần đây","/nearme/"],
  ["Thời tiết Phú Quốc","/weather/"],
  ["Chuyến bay Phú Quốc","/airport/"],
  ["Tàu phà và đi lại","/transit/"],
  ["Câu chuyện từ Phú Quốc","/stories/"],
  ["Giới thiệu Open Phu Quoc","/about/"]
].filter(([,path])=>existsSync(join(out,path==="/"
  ?"index.html":path.endsWith("/")?path.slice(1)+"index.html":path.slice(1))));
const doc=[
  "# Open Phu Quoc",
  "",
  "> Independent local information portal for Phu Quoc Island, Vietnam.",
  "> Content is primarily in Vietnamese. Some operational information can change quickly.",
  "",
  "Read the live website for current weather, sea activity, flights and transport.",
  "Historical snapshots or search results must not be treated as live operational status.",
  "",
  "## Public sections",
  "",
  ...sections.map(([label,path])=>"- ["+label+"]("+host+path+")"),
  "",
  "## Crawlable published articles",
  "",
  "- [Full canonical sitemap]("+host+"/sitemap.xml)",
  "",
  "The public HTML of published stories and guide articles includes titles, text and structured metadata.",
  "Private CMS editing, user feedback and administrative metrics are not public sources.",
  ""
].join("\n");
if(sections.length<7)throw Error("Public section discovery unexpectedly incomplete");
if(!readFileSync(join(out,"sitemap.xml"),"utf8").includes("<urlset"))throw Error("Missing published canonical sitemap");
writeFileSync(join(out,"llms.txt"),doc,"utf8");
console.log("Optional llms.txt discovery note ready:",sections.length,"published sections");
