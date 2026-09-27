// First-public-publication ledger for stories and published Destination Knowledge.
// Run --stamp only on main after merge, not during an editorial draft or PR.
// Existing live legacy articles have an unknown first publication date: do NOT
// silently assign the migration/build/SEO rollout day to historical content.
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
export const STATUS_EXCLUDED=new Set(["draft","pending","review","scheduled"]);
export const publicStory=s=>Boolean(s?.id&&!STATUS_EXCLUDED.has(s.status));
export const publicGuide=g=>Boolean(g?.topic_id&&g.status==="READY_PUBLIC"&&g.public_ready===true);
const isoDay=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==="object"
  ?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):x;
function fingerprint(obj,kind){
 const visible=kind==="guides"?
   {topic_id:obj.topic_id,title:obj.title,topic_type:obj.topic_type,canonical_entity_id:obj.canonical_entity_id,
     related_entity_ids:obj.related_entity_ids,status:obj.status,public_ready:obj.public_ready,
     editorial:obj.editorial,public_links:obj.public_links}:
   Object.fromEntries(Object.entries(obj).filter(([key])=>!["created_at","updated_at","published_at","publication_date"].includes(key)));
 return createHash("sha256").update(JSON.stringify(stable(visible))).digest("hex");
}
export function vietnamDay(value){
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))throw Error("A verified merge commit timestamp is required");
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const fields=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return fields.year+"-"+fields.month+"-"+fields.day;
}
export function synchronizePublication({stories,guides,ledger},mergedAt,{stamp=false}={}){
 if(!ledger||ledger.version!==1||!ledger.legacy_unknown||!ledger.first_publication)throw Error("Publication ledger is missing or its version is unsupported");
 const releaseDate=vietnamDay(mergedAt);
 const changed={stories:0,guides:0,firstPublications:0,updates:0,legacyInitialized:0};
 ledger.last_seen ||= {stories:{},guides:{}};
 for(const kind of ["stories","guides"]){
   const arr=kind==="stories"?stories:guides,publicNow=kind==="stories"?publicStory:publicGuide;
   const idFor=kind==="stories"?x=>x.id:x=>x.topic_id;
   ledger.last_seen[kind]||={};ledger.first_publication[kind]||={};
   const legacy=new Set(ledger.legacy_unknown[kind]||[]);
   const ids=new Set();
   for(const item of arr){
     const id=String(idFor(item)||"").trim();
     if(!id)continue;
     if(ids.has(id))throw Error("Duplicate "+kind+" id: "+id);
     ids.add(id);
     const currentPublic=publicNow(item);
     const first=ledger.first_publication[kind][id]||null;
     if(first&&!isoDay(first))throw Error("Corrupt first-publication date for "+id);
     const seen=ledger.last_seen[kind][id];
     if(first){
       if(item.published_at!==first){
         if(!stamp)throw Error("Locked first publication date was edited or deleted: "+kind+"/"+id);
         item.published_at=first;changed[kind]++;
       }
     }else if(legacy.has(id)){
       // Older articles: leave datePublished empty until the editor provides
       // independently verified evidence; never infer it from repo migration.
       if(item.published_at){
         if(!stamp)throw Error("Legacy article acquired an unverified publication date: "+kind+"/"+id);
         delete item.published_at;changed[kind]++;
       }
     }else if(currentPublic){
       if(!stamp&&item.published_at)throw Error("New publication date must be assigned by the post-merge workflow: "+kind+"/"+id);
       if(stamp){
         ledger.first_publication[kind][id]=releaseDate;
         if(item.published_at!==releaseDate){item.published_at=releaseDate;changed[kind]++}
         changed.firstPublications++;
       }
     }
     if(!currentPublic)continue;
     const hash=fingerprint(item,kind);
     if(!seen){
       if(!stamp)continue; // New public record in a review branch.
       ledger.last_seen[kind][id]={hash,modified_at:isoDay(item.updated_at)?item.updated_at:releaseDate};
       if(!legacy.has(id)){item.updated_at=releaseDate;changed[kind]++}
       else changed.legacyInitialized++;
       continue;
     }
     if(seen.hash!==hash){
       if(stamp){
         ledger.last_seen[kind][id]={hash,modified_at:releaseDate};
         if(item.updated_at!==releaseDate){item.updated_at=releaseDate;changed[kind]++}
         changed.updates++;
       }
       // In review mode the editorial content may legitimately differ. Only
       // the immutable first publication field is checked above.
     }else if(seen.modified_at&&item.updated_at!==seen.modified_at){
       if(!stamp)throw Error("Content unchanged but dateModified was edited: "+kind+"/"+id);
       item.updated_at=seen.modified_at;changed[kind]++;
     }
   }
 }
 return changed;
}
export function run(root=ROOT,{stamp=false,at}={}){
 const paths={
   stories:path.join(root,"data/content.json"),
   guides:path.join(root,"data/knowledge/objects.json"),
   ledger:path.join(root,"data/seo/publication-ledger.json")
 };
 const documents=Object.fromEntries(Object.entries(paths).map(([key,p])=>[key,JSON.parse(fs.readFileSync(p,"utf8"))]));
 const changes=synchronizePublication({
   stories:documents.stories.stories||[],guides:documents.guides.objects||[],ledger:documents.ledger
 },at||"2026-09-27T00:00:00+07:00",{stamp});
 if(stamp){
   // Avoid modifying unrelated files and timestamps for idempotent reruns.
   for(const [key,p]of Object.entries(paths)){
     const result=JSON.stringify(documents[key],null,2)+"\n";
     // Normalize only files with actual source-field changes. In particular,
     // do not rewrite 500KB of legacy guide records just to reformat JSON.
     if(key==="ledger"||changes[key]>0){
       const prev=fs.readFileSync(p,"utf8");
       if(prev!==result)fs.writeFileSync(p,result);
     }
   }
 }
 return changes;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 const stamp=args.includes("--stamp"),rootArg=args.find(x=>x.startsWith("--root="));
 const atArg=args.find(x=>x.startsWith("--at="));
 if(stamp&&!atArg)throw Error("--stamp requires --at=<actual merge commit timestamp>; build time is not publication time");
 const report=run(rootArg?path.resolve(rootArg.slice(7)):ROOT,{stamp,at:atArg?.slice(5)});
 console.log("SEO PUBLICATION DATE",stamp?"STAMP":"CHECK",JSON.stringify(report));
}
