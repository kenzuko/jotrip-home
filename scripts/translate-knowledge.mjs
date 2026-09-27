import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {languages} from './translate-stories.mjs';
export const fields=o=>({title:o.title,editorial:{short_summary:o.editorial.short_summary,practical:o.editorial.practical,expectation_vs_reality:o.editorial.expectation_vs_reality,before_you_go:o.editorial.before_you_go},images:(o.media?.images||[]).map(p=>({alt:p.alt||'',caption:p.caption||''}))});
export const hash=o=>createHash('sha256').update(JSON.stringify(fields(o))).digest('hex');
export function valid(o,v){
  if(!v||!v.title?.trim()||!v.editorial?.short_summary?.trim()||!v.editorial?.practical?.trim())return false;
  if(!Array.isArray(v.editorial.before_you_go)||v.editorial.before_you_go.length!==o.editorial.before_you_go.length)return false;
  if(!Array.isArray(v.images)||v.images.length!==(o.media?.images||[]).length)return false;
  return true;
}
async function translate(o,locale,key){
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:process.env.OPENPQ_TRANSLATION_MODEL||'gpt-4o-mini',temperature:0,response_format:{type:'json_object'},messages:[
      {role:'system',content:`Translate this Vietnamese Phu Quoc guide into ${languages[locale]}. Return exactly the JSON structure supplied. Keep place names, proper nouns, numbers, dates, uncertainty, and the exact number and order of list items and image captions. Do not add practical claims. Valid JSON only.`},
      {role:'user',content:JSON.stringify(fields(o))}
    ]})
  });
  if(!response.ok)throw Error(`Translation API HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
  const result=JSON.parse((await response.json()).choices?.[0]?.message?.content||'null');
  if(!valid(o,result))throw Error(`Invalid knowledge translation ${locale}/${o.topic_id}`);
  return result;
}
async function main(){
  const key=process.env.OPENAI_API_KEY;if(!key)throw Error('OPENAI_API_KEY is required');
  const source=JSON.parse(await readFile('data/views/knowledge-public.json','utf8'));
  for(const [locale] of Object.entries(languages)){
    const path=`data/i18n/${locale}/knowledge.json`;
    let previous={objects:{}};try{previous=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
    const output={locale,source:'data/views/knowledge-public.json',objects:{}};
    for(const o of source.objects){
      const source_hash=hash(o),old=previous.objects?.[o.topic_id];
      output.objects[o.topic_id]=old?.source_hash===source_hash&&valid(o,old)?old:{...await translate(o,locale,key),source_hash,status:'review',translated_at:new Date().toISOString()};
    }
    await mkdir(`data/i18n/${locale}`,{recursive:true});await writeFile(path,JSON.stringify(output,null,2)+'\n');
    console.log(`${locale}: ${Object.keys(output.objects).length} knowledge translations prepared`);
  }
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)main().catch(error=>{console.error(error.message);process.exitCode=1});
