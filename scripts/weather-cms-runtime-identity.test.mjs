import assert from "node:assert/strict";
import {verifyCMSWeatherRuntimeIdentity as check} from "./weather-cms-runtime-identity.mjs";
const manifest={
 schema_version:"weather-runtime-manifest-v1",status:"READY",
 policy:{frontend_source:"SAME_ORIGIN_CANONICAL_ONLY"},
 source_times:{cloud_sampled_time:"2026-09-30T11:20:20Z",forecast_run_time:"2026-09-30T00:00:00+00:00",
 marine_sampled_time:"2026-09-30T09:00:00Z"}
};
const cloud={sampled_time:"2026-09-30T11:20:20+00:00",spatial:{frames:[{}]}};
const compact={sampled_time:"2026-09-30T11:20:20Z"};
const forecast={run_time:"2026-09-30T00:00:00Z",spatial:{frames:[{}]}};
const marine={wave:{sampled_time:"2026-09-30T09:00:00+00:00",cells:[{}]}};
const meta={source_cycles:{ECMWF:"2026-09-30T00:00:00+00:00"}};
const data={manifest,cloud,compact,forecast,marine,meta};
assert.equal(check(data).status,"PACKAGED_RUNTIME_COHERENT");
assert.equal(check({...data,compact:{...compact,sampled_time:"2026-09-30T11:40:20Z"}}).status,"PACKAGED_RUNTIME_COHERENT");
for(const [name,payload] of [
 ["false fresh manifest",{manifest:{...manifest,source_times:{...manifest.source_times,cloud_sampled_time:"2026-09-30T11:40:20Z"}}}],
 ["forecast-cycle mismatch",{forecast:{...forecast,run_time:"2026-09-29T18:00:00Z"}}],
 ["marine not from manifest",{marine:{wave:{...marine.wave,sampled_time:"2026-09-30T06:00:00Z"}}}],
 ["compact older than map",{compact:{sampled_time:"2026-09-30T10:50:20Z"}}],
 ["mixed forecast meta",{meta:{source_cycles:{ECMWF:"2026-09-29T18:00:00Z"}}}],
 ["missing weather frame",{cloud:{...cloud,spatial:{frames:[]}}}],
 ["bad timezone",{manifest:{...manifest,source_times:{...manifest.source_times,cloud_sampled_time:"2026-09-30T11:20:20"}}}],
 ["external authority",{manifest:{...manifest,policy:{frontend_source:"EXTERNAL"}}}]
]){
 assert.throws(()=>check({...data,...payload}),undefined,name);
}
console.log("PASS CMS Weather packaged manifest/source identity (timezone, marine, satellite, ECMWF)");
