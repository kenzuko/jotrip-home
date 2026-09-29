import fs from 'node:fs';
import path from 'node:path';
import {parsePack,validateAndApply} from './rewrite-queue-lib.mjs';

function args(argv){
  const out={};
  for(let i=2;i<argv.length;i++){
    const k=argv[i];
    if(!k.startsWith('--')) continue;
    const key=k.slice(2), value=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;
    out[key]=value;
  }
  return out;
}
const a=args(process.argv);
for(const key of ['source','input']) if(!a[key]) throw new Error(`Missing --${key}`);
const source=path.resolve(a.source), input=path.resolve(a.input);
const data=JSON.parse(fs.readFileSync(source,'utf8'));
const blocks=parsePack(fs.readFileSync(input,'utf8'));
const result=validateAndApply(data,blocks);
for(const row of result.report){
  const extra=row.missing?.length?` (${row.missing.join(', ')})`:'';
  console.log(`${row.status.toUpperCase()} ${row.id} ${row.reason||''}${extra}`.trim());
}
if(!result.ok){
  console.error('Import blocked. Fix errors before review.');
  process.exitCode=2;
}else if(a.out){
  fs.mkdirSync(path.dirname(path.resolve(a.out)),{recursive:true});
  fs.writeFileSync(path.resolve(a.out),JSON.stringify(result.data,null,2)+'\n','utf8');
  console.log(`Candidate written -> ${a.out}`);
}else{
  console.log('Check passed. No canonical file was modified. Use --out to write a candidate JSON.');
}
