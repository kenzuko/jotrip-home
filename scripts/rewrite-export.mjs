import fs from 'node:fs';
import path from 'node:path';
import {makeBlocks,renderPack} from './rewrite-queue-lib.mjs';

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
for(const key of ['source','record-path','id','fields','out']){
  if(!a[key]) throw new Error(`Missing --${key}`);
}
const source=path.resolve(a.source);
const data=JSON.parse(fs.readFileSync(source,'utf8'));
const fields=String(a.fields).split(',').map(x=>x.trim()).filter(Boolean);
const blocks=makeBlocks({sourcePath:a.source,sourceSha:a['source-sha']||'',recordPath:a['record-path'],idField:a['id-field']||'id',recordId:a.id,fields,data});
const md=renderPack({sourcePath:a.source,sourceSha:a['source-sha']||'',recordPath:a['record-path'],recordId:a.id},blocks);
fs.mkdirSync(path.dirname(path.resolve(a.out)),{recursive:true});
fs.writeFileSync(path.resolve(a.out),md,'utf8');
console.log(`Exported ${blocks.length} blocks -> ${a.out}`);
