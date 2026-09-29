import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {onRequest} from "../functions/api/ops/traffic-summary.js";

if(!globalThis.crypto)globalThis.crypto=webcrypto;

const sqlite=new DatabaseSync(":memory:");
const db={
  prepare(sql){
    const statement=sqlite.prepare(sql);
    return {
      args:[],
      bind(...values){this.args=values;return this},
      async run(){return statement.run(...this.args)},
      async first(){return statement.get(...this.args)||null},
      async all(){return {results:statement.all(...this.args)}}
    };
  }
};

const secret="0123456789abcdef0123456789abcdef";
const endpoint="https://openphuquoc.com/api/ops/traffic-summary?period=7d";

assert.equal((await onRequest({
  request:new Request(endpoint),
  env:{CMS_DB:db}
})).status,503);

assert.equal((await onRequest({
  request:new Request(endpoint,{headers:{authorization:"Bearer wrong-secret-value"}}),
  env:{CMS_DB:db,OPS_ANALYTICS_BRIDGE_SECRET:secret}
})).status,401);

assert.equal((await onRequest({
  request:new Request(endpoint,{method:"POST",headers:{authorization:"Bearer "+secret}}),
  env:{CMS_DB:db,OPS_ANALYTICS_BRIDGE_SECRET:secret}
})).status,405);

const response=await onRequest({
  request:new Request(endpoint,{headers:{authorization:"Bearer "+secret}}),
  env:{CMS_DB:db,OPS_ANALYTICS_BRIDGE_SECRET:secret}
});
assert.equal(response.status,200);
const body=await response.json();
assert.equal(body.ready,true);
assert.equal(body.total_page_views,0);
assert.ok(Array.isArray(body.pageGroups));
assert.equal(response.headers.get("cache-control"),"private, no-store");

sqlite.close();
console.log("OPS ANALYTICS BRIDGE PASS: missing secret fails closed, bearer auth enforced, aggregate report remains private");
