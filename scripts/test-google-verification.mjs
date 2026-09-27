import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const name="google377c966cd09536e5.html";
const expected="google-site-verification: "+name;
const actual=readFileSync("dist/"+name,"utf8").trim();
assert.equal(actual,expected,"Google Search Console token must be served intact");
console.log("Google Search Console file PASS:",name);
