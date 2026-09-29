import assert from 'node:assert/strict';
import {makeBlocks,renderPack,parsePack,validateAndApply} from './rewrite-queue-lib.mjs';

const source={
  dishes:[{
    id:'goi-ca-trich',
    name:'Gỏi cá trích',
    intro:'Gỏi cá trích là món quen thuộc ở Phú Quốc. Giá 100.000 đ.',
    tips:['Ăn lúc 12:30.']
  }]
};

const blocks=makeBlocks({
  sourcePath:'food.json',sourceSha:'abc',recordPath:'dishes',recordId:'goi-ca-trich',
  fields:['intro','tips.0'],data:source
});
let pack=renderPack({sourcePath:'food.json',sourceSha:'abc',recordPath:'dishes',recordId:'goi-ca-trich'},blocks);
pack=pack.replace('[REWRITE]\n\n[/REWRITE]','[REWRITE]\nGỏi cá trích là món dễ gặp ở Phú Quốc. Giá 100.000 đ.\n[/REWRITE]')
  .replace('[REWRITE]\n\n[/REWRITE]','[REWRITE]\nĂn lúc 12:30 là vừa.\n[/REWRITE]');

const parsed=parsePack(pack);
const good=validateAndApply(source,parsed);
assert.equal(good.ok,true);
assert.match(good.data.dishes[0].intro,/dễ gặp/);

const missingLock=structuredClone(parsed);
missingLock[0].rewrite='Món này khá phổ biến.';
assert.equal(validateAndApply(source,missingLock).ok,false);

const changed=structuredClone(source);
changed.dishes[0].intro+=' Đã sửa.';
assert.equal(validateAndApply(changed,parsed).ok,false);

const badDash=structuredClone(parsed);
badDash[1].rewrite='Ăn lúc 12:30 — là vừa.';
assert.equal(validateAndApply(source,badDash).ok,false);

console.log('rewrite queue prototype: ok');
