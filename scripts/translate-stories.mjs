import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export const languages={en:'English',ko:'Korean',ru:'Russian',lo:'Lao',zh:'Simplified Chinese','zh-TW':'Traditional Chinese used in Taiwan',fr:'French'};
export const sourceFields=s=>({title:s.title,category:s.category,dek:s.dek,intro:s.intro,sections:s.sections,image_alt:s.image_alt,image_caption:s.image_caption});
export const sourceHash=s=>createHash('sha256').update(JSON.stringify(sourceFields(s))).digest('hex');
export function validateTranslation(source,result){
  const errors=[];
  for(const key of ['title','category','dek','intro','image_alt','image_caption']){
    if(typeof result?.[key]!=='string'||!result[key].trim())errors.push(key);
  }
  if(!Array.isArray(result?.sections)||result.sections.length!==source.sections.length)errors.push('sections count');
  else source.sections.forEach((section,i)=>{
    if(typeof result.sections[i]?.heading!=='string'||!result.sections[i].heading.trim())errors.push(`sections[${i}].heading`);
    if(typeof result.sections[i]?.body!=='string'||!result.sections[i].body.trim())errors.push(`sections[${i}].body`);
    // Preserve images, captions, sources and exact paragraph breaks in the Vietnamese master.
    if((section.body.match(/\n\n/g)||[]).length!==(result.sections[i].body.match(/\n\n/g)||[]).length)errors.push(`sections[${i}].paragraphs`);
  });
  return errors;
}
async function translate(story,locale,key){
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:process.env.OPENPQ_TRANSLATION_MODEL||'gpt-4o-mini',temperature:0,
      response_format:{type:'json_object'},messages:[
        {role:'system',content:`Translate Vietnamese travel editorial into ${languages[locale]}. Return JSON with exactly these fields: title, category, dek, intro, image_alt, image_caption, sections array of {heading, body}. Preserve factual meaning, paragraph breaks, names, numbers, dates, place names and uncertainty. Do not add facts or translate URLs. Return valid JSON only.`},
        {role:'user',content:JSON.stringify(sourceFields(story))}
      ]})
  });
  if(!response.ok)throw Error(`Translation API HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
  const result=JSON.parse((await response.json()).choices?.[0]?.message?.content||'null');
  const errors=validateTranslation(story,result);
  if(errors.length)throw Error(`${story.id}/${locale}: invalid fields ${errors.join(', ')}`);
  return result;
}
async function main(){
  const key=process.env.OPENAI_API_KEY;
  if(!key)throw Error('OPENAI_API_KEY is required; no translation was generated');
  const source=JSON.parse(await readFile('data/content.json','utf8'));
  for(const [locale] of Object.entries(languages)){
    const path=`data/i18n/${locale}/stories.json`;
    let previous={stories:{}};
    try{previous=JSON.parse(await readFile(path,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
    const output={locale,source:'data/content.json',stories:{}};
    for(const story of source.stories){
      const hash=sourceHash(story),existing=previous.stories?.[story.id];
      if(existing?.source_hash===hash&&validateTranslation(story,existing).length===0){output.stories[story.id]=existing;continue}
      const result=await translate(story,locale,key);
      output.stories[story.id]={...result,source_hash:hash,status:'review',translated_at:new Date().toISOString()};
      console.log(`Prepared ${locale}/${story.id}`);
    }
    await mkdir(`data/i18n/${locale}`,{recursive:true});
    await writeFile(path,JSON.stringify(output,null,2)+'\n');
  }
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)main().catch(error=>{console.error(error.message);process.exitCode=1});
