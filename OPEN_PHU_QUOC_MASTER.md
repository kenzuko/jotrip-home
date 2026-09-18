# OPEN PHU QUOC - MASTER V1

Locked: 18/09/2026

## Positioning

Open Phu Quoc is a free public-information platform for Phu Quoc.

It is not a tour marketplace, resort brochure or generic destination portal.

Core principle:

> Utility first. Editorial second.

The product should feel useful within seconds, while still carrying a real sense of place.

## Visual direction

### Quiet localism

Target mix:

- 80% clean digital utility
- 20% local material and editorial character

The interface must remain readable, fast and practical.

Local identity appears in deliberate places rather than as decoration everywhere.

## Brand

Master concept: B - Modern Minimal

Core symbol:

- local fishing-boat eye
- open eye / seeing / knowing / guiding
- Melo pearl as the eye centre
- no island silhouette inside the eye
- no generic palm-tree, mountain or tourism icon system

Primary palette:

- Sea Ink - #123D3B
- Melo Orange - #D85B3F
- Pearl Ivory - #F2EBDD
- supporting paper - #F8F4EB
- Mother-of-Pearl Mint is supporting only, not a primary logo colour

Logo should remain flat.

Avoid gradients in the master mark.

Mother-of-pearl is a material language, not a rainbow graphic effect.

## Local material language

Use sparingly:

- fishing-boat eyes
- sea-worn boat paint
- wood
- paper
- mother-of-pearl
- Melo pearl orange
- fishing and coastal working-life references

Do not turn the product into heritage decoration or scrapbook styling.

## Homepage priority

1. Universal search
2. Phu Quoc Today
3. Airport / Weather & Sea / Ferry / Transport shortcuts
4. Getting Around
5. Explore Phu Quoc
6. Open Guide
7. Local Notes
8. Data / sources / verification

## Product tone

Warm, local, useful, informed.

Slightly premium, but never luxury-first.

Avoid:

- resort language
- sales-heavy CTAs
- decorative overload
- generic international travel-portal styling
- excessive shadows / glass / gradients
- local motifs that compete with live information

## Content principle

Local authenticity should come primarily from real information, real stories and verified local knowledge.

Visual decoration is secondary.

Operational or changing information should support:

- source
- last verified
- freshness
- status

## Responsive principle

Mobile-first.

A visitor should understand the useful state of the island in a few seconds on a phone.

Desktop may become more editorial, but must preserve the same priority order.

## Current prototype

Branch:

feat/openphuquoc-home-v1

PR:

#1 - Open Phu Quoc Home V1 - quiet localism

Operational values in the prototype are demonstration UI only until live sources are connected.


## Product constraint added 18/09/2026

Open Phu Quoc is a free island super-app, not a marketing landing page.

Homepage must behave like an app home:
- persistent access to core utilities
- universal search
- live island status
- weather & sea
- airport
- ferry
- bus / shuttle / route planning
- places
- events
- emergency / useful information
- guide

Photography is used to create desire and orientation, but must not push tools below the fold or turn the product into a campaign page.

Core visual/product sequence:
1. See the island
2. Open the tool needed
3. Understand current conditions
4. Decide what to do
5. Continue exploring

Mobile navigation should feel like a product shell, with Home / Live / Search / Move / More.


## Homepage hierarchy update - 18/09/2026

Homepage is a hybrid utility + editorial home, not a full dashboard.

Locked hierarchy:
1. Photo-first hero
2. Compact Live Island Status snapshot
3. Phu Quoc Today - hot information that affects travel or is worth reading now
4. Today & Tonight - shows, events, opening hours, closures, changes, operating status
5. Getting Around
6. Explore Phu Quoc
7. From the Island - local stories
8. Read Phu Quoc Fast - short practical explainers
9. Footer / full tool access

Live Island Status is intentionally compact and should show only high-value glanceable signals such as:
- weather
- marine / canoe operation
- wave height / sea state
- sunset
- optionally a critical island-wide operational signal if materially useful

Detailed weather, airport, ferry, transport and other operational data belong inside their dedicated tools, not repeated on homepage.

Homepage content feed should prioritize:
- travel-impacting hot news
- event/show schedules
- attraction opening hours
- operating / closed / changed status
- temporary disruptions
- useful local notes
- timely trip ideas

Avoid duplicative quick-access grids. Search + primary navigation + compact tool access are enough.


## App architecture lock - 18/09/2026

Open Phu Quoc keeps one coherent public-facing ADN across homepage and child pages.

### Specialist apps
Existing specialist tools remain available and independent:
- Weather Lab: weather.openphuquoc.com
- Airport Live: airport.openphuquoc.com

They are not the primary public UX for ordinary travellers. They remain power-user / operations views and may later be redirected or retained as advanced modes.

### Open Phu Quoc child pages
Open Phu Quoc consumes the same normalized source layers as the specialist apps, but presents them with the Open Phu Quoc visual system and traveller-first information architecture.

Initial child pages:
- /weather/
- /airport/

Rule:
- reuse trusted source/data pipelines
- do not reuse the specialist UI wholesale
- preserve source class and freshness labels
- do not relabel model/estimated data as actual
- expose a link to the specialist tool for advanced users

### Data layer
Source registry:
- /data/sources.json

Homepage contract:
- /data/home-contract.json

Decision layer:
- /core/today-engine.js

The homepage should ultimately consume the contract instead of hard-coded values. Individual source adapters may evolve without redesigning the homepage.

### Navigation
Primary navigation remains need-based, not dataset-based.
Deep source layers and specialist metrics stay inside their modules.
