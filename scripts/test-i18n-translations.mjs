import assert from "node:assert/strict";
import {existsSync,readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {loadGlossary,scanRejected} from "./i18n-quality.mjs";

const read=p=>JSON.parse(readFileSync(p,"utf8"));
const manifest=read("data/i18n/locales.json");
const sourceStories=read("data/content.json");
// Translation coverage follows the canonical editorial source, including
// unpublished records. The public view intentionally filters that source and
// must not make valid machine drafts fail during a production build.
const sourceKnowledge=existsSync("data/knowledge/objects.json")?read("data/knowledge/objects.json"):null;
const sourceFood=read("data/i18n/vi/food.json");
const storyIds=new Set((sourceStories.stories||[]).map(x=>x.id));
const knowledgeIds=new Set((sourceKnowledge?.objects||[]).map(x=>x.topic_id));
const foodIds=new Set((sourceFood.dishes||[]).map(x=>x.id));
const leafPaths=(value,prefix="",out=[])=>{
  if(value&&typeof value==="object"&&!Array.isArray(value)){
    for(const [k,v] of Object.entries(value)){
      if(["schema_version","locale","updated_at"].includes(k)&&!prefix)continue;
      leafPaths(v,prefix?prefix+"."+k:k,out);
    }
  }else out.push(prefix);
  return out;
};
const viUi=read("data/i18n/vi/ui.json");
const viUiKeys=new Set(leafPaths(viUi));
const ensureUnique=(rows,key,label)=>{
  const ids=rows.map(x=>x?.[key]).filter(Boolean);
  assert.equal(ids.length,new Set(ids).size,label+" contains duplicate "+key);
};
const ensureAllowed=(obj,allowed,label)=>{
  for(const key of Object.keys(obj||{}))assert.ok(allowed.includes(key),label+" contains non-translatable field "+key);
};
const editorialText=value=>{
  if(typeof value==="string")return value;
  if(Array.isArray(value))return value.map(editorialText).join("\n");
  if(value&&typeof value==="object")return Object.values(value).map(editorialText).join("\n");
  return "";
};
const glossary=loadGlossary();
for(const locale of manifest.locales||[]){
  if(locale.code==="vi")continue;
  const dir=join("data/i18n",locale.code);
  if(!existsSync(dir)){
    assert.equal(locale.published,false,"Published locale directory missing: "+locale.code);
    continue;
  }
  const uiPath=join(dir,"ui.json");
  if(existsSync(uiPath)){
    const ui=read(uiPath);
    if(ui.locale)assert.equal(ui.locale,locale.code,locale.code+" ui locale mismatch");
    const keys=new Set(leafPaths(ui));
    for(const key of keys)assert.ok(viUiKeys.has(key),locale.code+" UI has unknown key "+key);
    if(locale.published)for(const key of viUiKeys)assert.ok(keys.has(key),locale.code+" published UI missing "+key);
  }else assert.equal(locale.published,false,"Published locale requires ui.json: "+locale.code);

  const storyPath=join(dir,"stories.json");
  if(existsSync(storyPath)){
    const data=read(storyPath),rows=data.stories||[];
    if(data.locale)assert.equal(data.locale,locale.code,locale.code+" stories locale mismatch");
    ensureUnique(rows,"id",locale.code+" stories");
    for(const row of rows){
      assert.ok(storyIds.has(row.id),locale.code+" story id not found in Vietnamese source: "+row.id);
      ensureAllowed(row,["id","title","category","dek","intro","image_alt","image_caption","sections"],locale.code+" story "+row.id);
      for(const section of row.sections||[])ensureAllowed(section,["heading","body","caption"],locale.code+" story section "+row.id);
    }
  }

  const knowledgePath=join(dir,"knowledge.json");
  if(existsSync(knowledgePath)){
    const data=read(knowledgePath),rows=data.objects||[];
    if(data.locale)assert.equal(data.locale,locale.code,locale.code+" knowledge locale mismatch");
    ensureUnique(rows,"topic_id",locale.code+" knowledge");
    for(const row of rows){
      if(knowledgeIds.size)assert.ok(knowledgeIds.has(row.topic_id),locale.code+" knowledge id not found: "+row.topic_id);
      ensureAllowed(row,["topic_id","title","editorial","media","links"],locale.code+" knowledge "+row.topic_id);
      if(row.editorial)ensureAllowed(row.editorial,["short_summary","practical","expectation_vs_reality","before_you_go","curiosity_questions"],locale.code+" knowledge editorial "+row.topic_id);
      if(row.media){
        ensureAllowed(row.media,["images"],locale.code+" knowledge media "+row.topic_id);
        for(const img of row.media.images||[])ensureAllowed(img,["alt","caption"],locale.code+" knowledge image "+row.topic_id);
      }
      for(const link of row.links||[])ensureAllowed(link,["label"],locale.code+" knowledge link "+row.topic_id);
    }
  }

  const foodPath=join(dir,"food.json");
  if(existsSync(foodPath)){
    const data=read(foodPath),rows=data.dishes||[];
    if(data.locale)assert.equal(data.locale,locale.code,locale.code+" food locale mismatch");
    ensureUnique(rows,"id",locale.code+" food");
    for(const row of rows)assert.ok(foodIds.has(row.id),locale.code+" food id not found in Vietnamese source: "+row.id);
  }

  if(locale.published){
    assert.ok(Array.isArray(locale.surfaces)&&locale.surfaces.length>0,"Published locale needs at least one enabled surface: "+locale.code);
  }

  const text=editorialText({
    ui:existsSync(uiPath)?read(uiPath):null,
    stories:existsSync(storyPath)?read(storyPath):null,
    knowledge:existsSync(knowledgePath)?read(knowledgePath):null,
    food:existsSync(foodPath)?read(foodPath):null
  });
  const rejected=scanRejected(locale.code,text,{glossary});
  assert.deepEqual(rejected,[],locale.code+" editorial bundle contains rejected machine literals: "+rejected.join(", "));
}
console.log("PASS i18n translation guard: stable IDs, UI-key parity, text-only editorial overlays and publication locks");
