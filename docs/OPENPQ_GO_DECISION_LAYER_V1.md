# OPEN PHU QUOC - /GO DECISION LAYER V1

Updated: 25/09/2026

## Product role

`/go/` turns existing Open Phu Quoc information into an immediate next-action surface.

It is not:
- a second Weather engine
- a second Transit engine
- a booking engine
- an AI chatbot that invents recommendations

It answers:

> From where I am, with the time I have left, what is still realistically worth doing?

## Architecture

```text
HOME / TODAY / EXPLORE / PLACE DETAIL
                |
                | entry / handoff
                v
             /go/
     user decision context
     - area
     - time available
     - intent
                |
                v
       GO DECISION ENGINE
       core/go-engine.js
        /       |       \
       /        |        \
stable data   live      dated notices
places.json   Weather   operational-notices.json
activities    marine
go-config     adapter
       \        |        /
        \       |       /
         feasibility filter
         - travel screening
         - schedule window
         - minimum visit time
         - weekday closure
         - cancellation
         - marine state
         - weather freshness
                |
                v
       MAX 3 ACTIONABLE RESULTS
       POSSIBLE / CHECK
                |
     +----------+----------+
     |          |          |
 place detail  Weather    Cano/Transit
```

## ADN rules

1. ONE ENTITY -> ONE CANONICAL ID -> MANY SURFACES.
2. `/go/` never duplicates canonical opening hours.
3. `data/go-config.json` stores decision metadata only: minimum useful visit, intent, buffers and soft editorial windows.
4. Live provider parsing stays in `go/live-adapter.js`; the pure engine never fetches.
5. A published schedule is not equal to “open now”.
6. Stale or missing weather cannot become “safe”.
7. Cano SUSPENDED with same-day fresh evidence blocks marine recommendations.
8. Travel time in V1 is zone-range screening only. UI must label it as an estimate.
9. User location is not requested automatically.
10. V1 returns no more than three primary options.

## V1 scope

Inputs:
- Current Phu Quoc time
- User-selected area
- Available time: 2h / half day / full day / evening
- Intent
- Canonical opening hours and duration
- Dated cancellation notices
- Existing JoTrip Weather and marine_ops outputs

Outputs:
- Up to 3 feasible options
- Expected arrival and finish
- Planning travel range
- POSSIBLE or CHECK state
- Explicit warning reasons
- Route back to canonical detail/module

## Homepage integration

Homepage does not embed the engine.

It exposes `/go/` as:
- “Đi ngay” in navigation
- CTA beside “Hôm nay còn kịp gì?”
- Quick context rail entry

This keeps Homepage glanceable and makes `/go/` the dedicated decision workspace.

## Next versions

V1.1:
- route-level travel estimates from verified map anchors
- daylight/sunset constraint
- indoor alternative weighting when weather is WATCH
- tests for all configured entities

V2:
- “Kế hoạch B” generated from the same feasibility engine
- disruption-triggered alternatives
- saved day plan

V3:
- natural-language input as an interface to the deterministic engine
- AI interprets intent; it does not override operational truth
