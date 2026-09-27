import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
const root=process.cwd();
function walk(dir){return readdirSync(dir).flatMap(name=>{
  if(['.git','dist','node_modules'].includes(name))return [];
  const path=join(dir,name);return statSync(path).isDirectory()?walk(path):path.endsWith('.html')?[path]:[];
})}
const errors=[];
for(const file of walk(root)){
  const html=readFileSync(file,'utf8');
  for(const match of html.matchAll(/<(?:a|script|link|img)\b[^>]*?\b(?:href|src)=["']([^"']+)["']/gi)){
    const link=match[1];
    if(/^(?:https?:|mailto:|tel:|data:|#|\/\/|javascript:|\/api\/)/i.test(link))continue;
    const pathname=link.split(/[?#]/)[0];if(!pathname)continue;
    let target=pathname.startsWith('/')?resolve(root,'.'+pathname):resolve(dirname(file),pathname);
    if(existsSync(target)&&statSync(target).isDirectory())target=join(target,'index.html');
    if(!existsSync(target))errors.push(`${file.slice(root.length+1)} -> ${link}`);
  }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}
else console.log('CMS public routes and local static assets resolved');
