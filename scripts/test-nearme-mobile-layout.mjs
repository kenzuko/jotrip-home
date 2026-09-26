import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync(new URL("../nearme/index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../nearme/nearme.css",import.meta.url),"utf8");
const js=readFileSync(new URL("../nearme/nearme.js",import.meta.url),"utf8");
const workflow=readFileSync(new URL("../.github/workflows/v3-validation.yml",import.meta.url),"utf8");

assert.match(html,/<button id="toggleNearMap"[^>]*aria-controls="nearMap"[^>]*>Xem bản đồ<\/button>/);
assert.match(css,/\.results-head\{order:2\}[\s\S]*\.results\{order:3\}[\s\S]*\.map-shell\{order:4\}/);
assert.match(css,/\.map-shell\.mobile-map-collapsed\{display:none\}/);
assert.match(js,/if\(isMobileViewport\(\)&&!mapOpenMobile\)return/);
assert.match(js,/if\(mapOpenMobile\)initMap\(\)/);
assert.match(js,/openMobileMap\(\{scroll:false\}\)/);
assert.match(workflow,/node scripts\/test-nearme-mobile-layout\.mjs/);
console.log("Near Me mobile results-first and lazy-map contracts passed.");
