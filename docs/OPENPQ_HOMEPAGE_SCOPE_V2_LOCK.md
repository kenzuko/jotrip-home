# OPEN PHU QUOC - HOMEPAGE RESTRUCTURE & SUPPORTING DATA SCOPE V2

Locked: 20/09/2026

Scope: Homepage layout + missing utility/live/discovery surfaces + supporting operational data.

Do not redesign or refactor specialist routes such as /airport, /weather or /transit. Do not build AI chat, accounts, seasonal recommendation, Memory Map or bulk-process the 150-content backlog in this phase.

Homepage role: Summary + Decision + Navigation + Discovery.

Major regions:
- Search / Hero
- Island Pulse
- Today / Trip Clock
- Today Activity Board
- Near Me / Essentials
- Hot Now
- Discover / Lore / Curiosity
- Explore More

Quick Alerts and Plan B are conditional.

Rules:
- One fact has one main display location.
- Specialist system = PRIMARY.
- Homepage Island Pulse = SUMMARY.
- Trip Clock / Activity Board / Plan B = CONTEXT.
- Volatile data keeps source/freshness fields.
- Missing/stale data is never presented as live/normal.
- Never request GPS on initial load.
- One entity -> one canonical ID -> many surfaces.
- The 150-content knowledge backlog shares the same foundation but is not bulk-rendered on Homepage.
