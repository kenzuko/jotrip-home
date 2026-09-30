import fs from "node:fs";
import path from "node:path";

const ROOT=process.cwd();
const GLOSSARY_PATH="data/i18n/translation-glossary.json";

const readJson=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),"utf8"));
const regexSpecial=new Set("\\^$.*+?()[]{}|".split(""));
export const regexEscape=value=>[...String(value)].map(char=>regexSpecial.has(char)?"\\"+char:char).join("");

export function loadGlossary(){
  return readJson(GLOSSARY_PATH);
}

function familyAllowed(rule,familyId){
  return !Array.isArray(rule.families)||!rule.families.length||rule.families.includes(familyId);
}

export function glossaryMatches(text,{fromLocale="vi",targetLocale,familyId=null,glossary=loadGlossary()}={}){
  const source=String(text??"");
  const matches=[];
  for(const rule of glossary.terms||[]){
    if(!familyAllowed(rule,familyId))continue;
    const forms=rule.forms?.[fromLocale]||[];
    for(const form of forms){
      if(!form)continue;
      const re=new RegExp(regexEscape(form),"giu");
      if(re.test(source)){
        matches.push({
          id:rule.id,
          form,
          canonical:rule.canonical||form,
          target:rule.targets?.[targetLocale]||rule.canonical||form
        });
      }
    }
  }
  matches.sort((a,b)=>b.form.length-a.form.length);
  const seen=new Set();
  return matches.filter(row=>{
    const key=row.id+"\u0000"+row.form.toLocaleLowerCase();
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}

export function rejectedLiterals(locale,{glossary=loadGlossary()}={}){
  return glossary.rejected_literals?.[locale]||[];
}

export function scanRejected(locale,text,{glossary=loadGlossary()}={}){
  const value=String(text??"").toLocaleLowerCase();
  return rejectedLiterals(locale,{glossary}).filter(literal=>value.includes(String(literal).toLocaleLowerCase()));
}

export function qualityProblems(sourceText,targetText,{fromLocale="vi",targetLocale,familyId=null,glossary=loadGlossary()}={}){
  const problems=[];
  const target=String(targetText??"");
  if(!target.trim())problems.push("empty");
  for(const literal of scanRejected(targetLocale,target,{glossary}))problems.push("rejected:"+literal);
  for(const match of glossaryMatches(sourceText,{fromLocale,targetLocale,familyId,glossary})){
    if(!target.toLocaleLowerCase().includes(String(match.target).toLocaleLowerCase())){
      problems.push("glossary:"+match.id+"=>"+match.target);
    }
  }
  return [...new Set(problems)];
}

const tokenPatterns=[
  /https?:\/\/[^\s)\]}>"']+/g,
  /\{[A-Za-z0-9_.-]+\}/g,
  /\b\d{1,2}:\d{2}\b/g,
  /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g,
  /\b\d+(?:[.,]\d+)?\s?(?:%|km|m|cm|mm|kg|g|ml|l|VND|đ|₫|USD|EUR)\b/gi,
  /(?:\+?84|0)(?:[ .-]?\d){8,10}\b/g
];

function protectedTokens(text){
  const found=[];
  for(const pattern of tokenPatterns)for(const match of String(text).matchAll(pattern))found.push(match[0]);
  return [...new Set(found)].sort((a,b)=>b.length-a.length);
}

export function protectForTranslation(text,{fromLocale="vi",targetLocale,familyId=null,glossary=loadGlossary()}={}){
  let output=String(text);
  const markers=[];
  let counter=0;

  for(const match of glossaryMatches(output,{fromLocale,targetLocale,familyId,glossary})){
    const marker="OPENPQTERM"+counter+++"XQZ";
    const re=new RegExp(regexEscape(match.form),"giu");
    if(!re.test(output))continue;
    output=output.replace(re,marker);
    markers.push({marker,replacement:match.target,type:"glossary",id:match.id});
  }

  for(const token of protectedTokens(output)){
    const marker="OPENPQTOKEN"+counter+++"XQZ";
    output=output.split(token).join(marker);
    markers.push({marker,replacement:token,type:"token"});
  }

  for(const row of markers){
    output=output.split(row.marker).join('<span translate="no" class="notranslate">'+row.marker+"</span>");
  }
  return {text:output,markers};
}

export function restoreAfterTranslation(text,protectedValue){
  let output=String(text??"");
  for(const {marker,replacement} of protectedValue.markers||[]){
    const tag=new RegExp("<span\\b[^>]*>\\s*"+regexEscape(marker)+"\\s*<\\/span>","giu");
    output=output.replace(tag,marker);
    output=output.split(marker).join(replacement);
  }
  if(/OPENPQ(?:TERM|TOKEN)\d+XQZ/.test(output))throw new Error("Unresolved OpenPhuQuoc translation marker");
  return output;
}

export function repairScopeIncludes(scope,familyId,job){
  if(!scope||scope==="quality")return false;
  if(scope==="all"||scope==="editorial")return true;
  if(scope!=="core")throw new Error("Unknown repair scope: "+scope);
  if(familyId==="ui"||familyId==="food"||familyId==="stories")return true;
  if(familyId!=="knowledge")return false;
  const p=(job.recordPath||job.path||[]).join(".");
  return p==="title"||
    p==="editorial.short_summary"||
    p==="editorial.practical"||
    p==="editorial.expectation_vs_reality";
}
