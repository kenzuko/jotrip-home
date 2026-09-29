import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";
const root=process.env.OPENPQ_DIST||"dist";
const read=p=>JSON.parse(readFileSync(p,"utf8"));
const manifest=read(join(root,"data/i18n/locales.json"));
const locales=(manifest.locales||[]).map(x=>({...x}));
const ids=(rows,key)=>Array.from(new Set((rows||[]).map(x=>x?.[key]).filter(Boolean))).sort();
const availability={stories:{},knowledge:{},food:{}};
const sourceStories=read(join(root,"data/content.json"));
const sourceKnowledge=read(join(root,"data/views/knowledge-public.json"));
const sourceFood=existsSync(join(root,"data/i18n/vi/food.json"))?read(join(root,"data/i18n/vi/food.json")):{dishes:[]};
availability.stories.vi=ids((sourceStories.stories||[]).filter(x=>!["draft","pending","review","scheduled"].includes(x.status)),"id");
availability.knowledge.vi=ids((sourceKnowledge.objects||[]).filter(x=>x.status!=="draft"&&x.public_ready!==false),"topic_id");
availability.food.vi=ids(sourceFood.dishes||[],"id");
for(const locale of locales){
  if(locale.code==="vi")continue;
  const dir=join(root,"data/i18n",locale.code);
  const storyFile=join(dir,"stories.json"),knowledgeFile=join(dir,"knowledge.json"),foodFile=join(dir,"food.json");
  availability.stories[locale.code]=existsSync(storyFile)?ids(read(storyFile).stories||[],"id"):[];
  availability.knowledge[locale.code]=existsSync(knowledgeFile)?ids(read(knowledgeFile).objects||[],"topic_id"):[];
  availability.food[locale.code]=existsSync(foodFile)?ids(read(foodFile).dishes||[],"id"):[];
}
const catalog={schema_version:"1.0",default_locale:manifest.default_locale||"vi",
  locales:locales.map(({code,url_code,html_lang,native_name,name,direction,published})=>({code,url_code,html_lang,native_name,name,direction,published:Boolean(published)})),
  availability};
writeFileSync(join(root,"data/i18n/catalog.json"),JSON.stringify(catalog,null,2)+"\n","utf8");
console.log("i18n catalog ready:",locales.length,"locales;",locales.filter(x=>x.published).length,"published");
