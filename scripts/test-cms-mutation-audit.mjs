import assert from "node:assert/strict";
import {
  createCmsMutationAudit,formatCmsMutationAudit,cmsMutationCommitTrailers
} from "../functions/_shared/cms-mutation-core.js";

const base="a".repeat(40),before="b".repeat(40),after="c".repeat(40),commit="d".repeat(40);
const audit=createCmsMutationAudit({
  operation:"direct-save",
  actor:"kenzuko",
  role:"admin",
  baseMainSha:base,
  paths:["data/content.json","data/content.json"],
  beforeFileShas:{"data/content.json":before,"bad.txt":"not-a-sha"},
  afterFileShas:{"data/content.json":after},
  changedFields:["sections.0.body","sections.0.body"],
  recordId:"story-one",
  mutationCommitSha:commit,
  resultMainSha:commit,
  accessToken:"must-never-be-copied"
});

assert.equal(audit.schema,"openpq-cms-mutation-v1");
assert.equal(audit.operation,"direct-save");
assert.equal(audit.actor,"kenzuko");
assert.equal(audit.role,"admin");
assert.equal(audit.base_main_sha,base);
assert.deepEqual(audit.paths,["data/content.json"]);
assert.deepEqual(audit.before_file_shas,{"data/content.json":before});
assert.deepEqual(audit.after_file_shas,{"data/content.json":after});
assert.deepEqual(audit.changed_fields,["sections.0.body"]);
assert.equal(audit.record_id,"story-one");
assert.equal(audit.mutation_commit_sha,commit);
assert.equal(audit.result_main_sha,commit);
assert.equal("accessToken" in audit,false);

const markdown=formatCmsMutationAudit(audit);
assert.match(markdown,/CMS mutation metadata/);
assert.match(markdown,/openpq-cms-mutation-v1/);
assert.match(markdown,/data\/content\.json/);
assert.doesNotMatch(markdown,/must-never-be-copied/);

const trailers=cmsMutationCommitTrailers(audit);
assert.match(trailers,/OpenPQ-CMS-Mutation: v1/);
assert.match(trailers,/CMS-Operation: direct-save/);
assert.match(trailers,/CMS-Base-Main-SHA: a{40}/);
assert.match(trailers,/CMS-Before-File-SHAs: data\/content\.json=b{40}/);
assert.match(trailers,/CMS-After-File-SHAs: data\/content\.json=c{40}/);
assert.doesNotMatch(trailers,/must-never-be-copied/);

console.log("CMS mutation audit contract PASS: normalized metadata, markdown and commit trailers.");
