import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {languages} from './translate-stories.mjs';
const source=JSON.parse(execFileSync('python3',['scripts/extract-cms-ui.py'],{encoding:'utf8',maxBuffer:8*1024*1024}));
const strings=[...new Set(Object.values(source.pages).flat())];
export const chunks=(items,size=25)=>Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));
async function translate(items,locale,key){
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:process.env.OPENPQ_TRANSLATION_MODEL||'gpt-4o-mini',temperature:0,response_format:{type:'json_object'},messages:[
      {role:'system',content:`Translate each Vietnamese website UI string to ${languages[locale]}. Return JSON {"items":[strings]} with exactly the same count and order. Keep dates, numbers, URLs, place names and proper nouns accurate. Don't add claims. Preserve short UI labels. Valid JSON only.`},
      {role:'user',content:JSON.stringify({items})}
    ]})
  });
  if(!response.ok)throw Error(`UI translation API HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
  const output=JSON.parse((await response.json()).choices?.[0]?.message?.content||'null').items;
  if(!Array.isArray(output)||output.length!==items.length||output.some(x=>typeof x!=='string'||!x.trim()))throw Error(`Invalid UI translation batch for ${locale}`);
  return output;
}
async function main(){
  const key=process.env.OPENAI_API_KEY;if(!key)throw Error('OPENAI_API_KEY is required');
  for(const [locale] of Object.entries(languages)){
    const path=`data/i18n/${locale}/site-ui.json`;
    let previous={strings:{}};try{previous=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
    const dictionary={};for(const value of strings)if(previous.strings?.[value])dictionary[value]=previous.strings[value];
    const missing=strings.filter(value=>!dictionary[value]);
    for(const batch of chunks(missing)){
      const translated=await translate(batch,locale,key);
      batch.forEach((value,i)=>dictionary[value]=translated[i]);
    }
    const pages={};for(const [route,values] of Object.entries(source.pages))pages[route]=Object.fromEntries(values.map(value=>[value,dictionary[value]]));
    await mkdir(`data/i18n/${locale}`,{recursive:true});
    const status=missing.length===0&&JSON.stringify(previous.pages)===JSON.stringify(pages)?previous.status:'review';
    await writeFile(path,JSON.stringify({locale,status:status||'review',strings:dictionary,pages},null,2)+'\n');
    console.log(`${locale}: ${missing.length} UI strings prepared across ${Object.keys(pages).length} pages`);
  }
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)main().catch(error=>{console.error(error.message);process.exitCode=1});
