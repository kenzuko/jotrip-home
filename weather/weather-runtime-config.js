// JoTrip Weather canonical runtime registry.
// Production consumers must read same-origin normalized runtime only.
// Upstream repositories, branches, raw GitHub URLs and legacy mirrors belong to backend sync only.
window.JOTRIP_WEATHER_RUNTIME = Object.freeze({
  version: "JOTRIP_WEATHER_RUNTIME_V1",
  manifest: "/weather/data/weather-runtime/manifest.json",
  cloud: "/weather/data/weather-runtime/cloud.json",
  compact: "/weather/data/weather-runtime/compact.json",
  current: "/weather/data/weather-runtime/current.json",
  forecast: "/weather/data/weather-runtime/forecast.json",
  marine: "/weather/data/weather-runtime/marine.json",
  meta: "/weather/data/weather-runtime/meta.json"
});
