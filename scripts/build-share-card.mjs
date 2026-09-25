import {mkdir,readFile,readdir,writeFile,copyFile} from "node:fs/promises";
import {join,dirname} from "node:path";

const out=process.env.OPENPQ_DIST||"dist";
const target=join(out,"assets/share-card-phu-quoc-v3.jpg");
const file="An Thoi fishing harbour Sunset Town Sun World Phu Quoc Vietnam.jpg";
const redirect="https://commons.wikimedia.org/wiki/Special:Redirect/file/"+encodeURIComponent(file)+"?width=1280";
const api="https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=1280&titles="+encodeURIComponent("File:"+file);
const jpegDimensions=buffer=>{
 if(buffer[0]!==0xff||buffer[1]!==0xd8)return null;
 let i=2;
 while(i<buffer.length-9){
  if(buffer[i]!==0xff){i++;continue}
  const marker=buffer[i+1],len=buffer.readUInt16BE(i+2);
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb].includes(marker))
   return {width:buffer.readUInt16BE(i+7),height:buffer.readUInt16BE(i+5)};
  if(len<2)break;
  i+=len+2;
 }
 return null;
};
async function download(url){
 const response=await fetch(url,{redirect:"follow",headers:{"User-Agent":"OpenPhuQuocSocialPreview/1.0 (https://cms.openphuquoc.com/about/)","Accept":"image/jpeg,image/*;q=0.9,*/*;q=0.3"},signal:AbortSignal.timeout(16000)});
 if(!response.ok)throw Error("HTTP "+response.status);
 const bytes=Buffer.from(await response.arrayBuffer()),size=jpegDimensions(bytes);
 if(!size||size.width<1200||size.height<600||bytes.length<75000||bytes.length>6000000)throw Error("Unexpected preview-image type, dimensions or size");
 return {bytes,size};
}
let photo=null,chosen="Wikimedia Commons / Vivu Vietnam";
// Use the exact artwork approved for social sharing when it is committed.
const approved="assets/share-card-approved.jpg";
try{
 const bytes=await readFile(approved),size=jpegDimensions(bytes);
 if(!size||size.width<1200||size.height<600||bytes.length<75000||bytes.length>6000000)
  throw Error("Approved social card must be a 1200px+ JPEG, 75KB-6MB");
 photo={bytes,size};chosen="Open Phu Quoc approved social card";
}catch(e){if(e.code!=="ENOENT")throw e;}
if(!photo)try{photo=await download(redirect)}catch(e){
 console.warn("Commons direct image unavailable:",e.message);
 try{
  const r=await fetch(api,{headers:{"User-Agent":"OpenPhuQuocSocialPreview/1.0 (https://cms.openphuquoc.com/about/)"},signal:AbortSignal.timeout(13000)});
  if(!r.ok)throw Error("API HTTP "+r.status);
  const d=await r.json(),page=Object.values(d.query?.pages||{})[0],thumb=page?.imageinfo?.[0]?.thumburl;
  if(!thumb)throw Error("Wikimedia did not return thumbnail");
  photo=await download(thumb);
 }catch(e2){console.warn("Commons API unavailable:",e2.message)}
}
if(!photo){
 const fallback=await readFile("assets/photos/tour-3-islands-jotrip-1600.jpg");
 const size=jpegDimensions(fallback);
 if(!size||size.width<1200||size.height<600)throw Error("No usable social preview image");
 photo={bytes:fallback,size};chosen="JoTrip original photo, temporary fallback";
 console.warn("Falling back to a locally stored JoTrip photograph");
}
await mkdir(dirname(target),{recursive:true});
await writeFile(target,photo.bytes);
const root="https://cms.openphuquoc.com/assets/share-card-phu-quoc-v3.jpg";
const walk=async directory=>{
 for(const dirent of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,dirent.name);
  if(dirent.isDirectory()){if(dirent.name==="data"||dirent.name==="assets")continue;await walk(path);continue}
  if(!dirent.name.endsWith(".html"))continue;
  let html=await readFile(path,"utf8");
  if(!html.includes('property="og:image"')&&!html.includes('name="twitter:image"'))continue;
  html=html.replace(/https:\/\/cms\.openphuquoc\.com\/assets\/share-card\.svg/g,root)
   .replace(/https:\/\/cms\.openphuquoc\.com\/assets\/share-card-phu-quoc-v2\.jpg/g,root)
   .replace(/(<meta\s+property="og:image:type"\s+content=")image\/svg\+xml(")/g,'$1image/jpeg$2')
   .replace(/(<meta\s+property="og:image:width"\s+content=")\d+(")/g,(_,a,b)=>a+photo.size.width+b)
   .replace(/(<meta\s+property="og:image:height"\s+content=")\d+(")/g,(_,a,b)=>a+photo.size.height+b);
  const credit=chosen.startsWith("Open Phu Quoc approved")?"Ảnh chia sẻ: Open Phu Quoc.":chosen.startsWith("Wikimedia")?'Ảnh chia sẻ: <a href="https://commons.wikimedia.org/wiki/File:An_Thoi_fishing_harbour_Sunset_Town_Sun_World_Phu_Quoc_Vietnam.jpg">Vivu Vietnam / Wikimedia Commons</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.':"Ảnh chia sẻ: JoTrip.";
  html=html.replaceAll("<!-- SOCIAL_PHOTO_CREDIT -->",credit);
  await writeFile(path,html);
 }
};
await walk(out);
await writeFile(join(out,"assets/share-card-provenance.json"),JSON.stringify({image:"share-card-phu-quoc-v3.jpg",source:chosen,width:photo.size.width,height:photo.size.height,original_source:chosen.startsWith("Wikimedia")?"https://commons.wikimedia.org/wiki/File:An_Thoi_fishing_harbour_Sunset_Town_Sun_World_Phu_Quoc_Vietnam.jpg":null},null,2));
console.log("Social preview JPEG ready:",target,photo.size.width+"x"+photo.size.height,chosen);
