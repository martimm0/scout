# Scout: A Pollinator RPG — Implementation Plan

## Purpose

This document is the development roadmap for the Scout MVP. It is kept in sync with the code: every milestone carries a status, and where the build has deliberately diverged from the original plan, the divergence is recorded rather than quietly ignored.

The goal is a complete browser-based, desktop-first MVP where a player can sign in, customize a pollinator, explore a Frick Park map, discover native plants, complete light pollination interactions, unlock journal entries, earn badges, autosave progress, and return later.

**Status: 14 of 18 milestones complete.** Everything except auth (13), server autosave (14), compliance (19) and QA/deployment (20), which were explicitly deferred.

---

## Status at a glance

| # | Milestone | Status |
|---|---|---|
| 1 | Project Foundation | ✅ Done |
| 2 | Game Scene Foundation | ✅ Done |
| 3 | Desktop Flight Controls | ✅ Done |
| 4 | Client Game State | ✅ Done |
| 5 | — | ⛔ Removed (folded into 6) |
| 6 | Pollinator System | ✅ Done |
| 7 | Frick Park Map Experience | ✅ Done (rescoped) |
| 8 | Native Plant Data Layer | ✅ Done |
| 9 | Plant Discovery System | ✅ Done |
| 10 | Pollination Interaction System | ✅ Done |
| 11 | Journal System | ✅ Done |
| 12 | Badge and Progression System | ✅ Done |
| 13 | Auth and User Profile | ⏸ Deferred |
| 14 | Autosave (server) | ⏸ Deferred — progress persists to localStorage |
| 15 | Offline 10-Minute Mode | ✅ Done |
| 16 | Audio and Feedback | ✅ Done |
| 17 | Landing, Onboarding, and Tutorial | ✅ Done |
| 18 | Visual Polish | ✅ Done |
| 19 | Credits, Accessibility, and Compliance | ⏸ Deferred |
| 20 | QA, Deployment, and Launch Readiness | ⏸ Deferred |

---

## Direction changes since the original plan

These were deliberate calls made during the build. The original plan no longer describes the game; this section does.

### The world is at insect scale

The bee is roughly bee-sized — under one world unit — and everything else grew around it. Grass blades tower overhead, oaks and hemlocks run 60–90 units, a flower stalk is 15–25 units tall, an acorn is a boulder and a fallen log is a tunnel. The world is 700×520 units.

This is the core of the game's appeal: a park you could walk across in twenty minutes is a continent to an insect, and it can hide things from you. It is what makes the map worth flying back into.

### The map is cut around real Frick Park landmarks

The original plan specified five generic zones (Woodland Trail, Meadow, Ravine/Creek, Dense Canopy). Those have been replaced by six areas named for things that actually exist in the park:

- **Frick Environmental Center** — the starting area, on the lawn by the Beechwood Boulevard gates
- **Blue Slide Playground** — the most recognisable object in the park
- **Lawn Bowling Green** — the only one in Pittsburgh
- **Nine Mile Run** — the creek at the bottom of the valley
- **Falls Ravine** — steep hemlock slopes
- **Fern Hollow** — deep shade under a closed canopy

Landmarks are hand-placed, not scattered: the Blue Slide, the stone gatehouse, the Environmental Center building, the bowling green and its clubhouse, the clay tennis courts, benches, trail posts, and stepping stones across the creek.

### One pollinator for the MVP

The MVP ships the bee only. The hoverfly and butterfly are deferred.

### Models are data, not code

Everything visual is authored as a compact spec and compiled to merged geometry. The bee is layered ASCII text art (`models/bee.ts`); trees, flora and landmarks are box lists. Editing the bee means editing text art, not tweaking transforms.

---

## Launch target

- Platform: Browser
- Device target: Desktop only
- Rendering: WebGL via Three.js / React Three Fiber
- Deployment: Vercel

## Stack

- Next.js App Router, React, TypeScript
- three, @react-three/fiber, @react-three/drei
- Zustand
- NextAuth for Google sign-in *(installed; not yet wired)*
- Lightweight database layer *(not yet chosen)*
- Public asset storage for plant photos, music, and sound effects

## Core routes

```txt
/              Landing page          built
/play          Game experience       built
/customize     Pollinator            built
/offline       Offline 10-minute     built
/journal       Journal               built
/profile       Saved progress        placeholder (Milestone 13, deferred)
```

---

# Milestone 1: Project Foundation

**Status: ✅ Done**

Next.js App Router project, TypeScript, routes scaffolded, shared UI primitives, lint and typecheck scripts.

---

# Milestone 2: Game Scene Foundation

**Status: ✅ Done**

React Three Fiber scene, lighting, sky, terrain, third-person camera.

---

# Milestone 3: Desktop Flight Controls

**Status: ✅ Done**

## Controls as built

- **Mouse** — look. The bee's nose follows the view, and that is also the direction it flies.
- **Up / Down or W / S** — fly forward and back
- **Left / Right or A / D** — turn
- **E / Q or scroll** — altitude
- **Shift** — boost
- **Space** — pollinate a nearby plant
- **R** — read a plant's full entry
- **F** — the bee turns around and looks at you
- **G** — the bee turns around and does a waggle dance
- **Esc** — release the mouse cursor

## Notes

One yaw drives the camera, the bee's facing, and its flight direction. An earlier version split flight heading from camera look; that is a two-stick idea and it makes the bee fly one way while facing another. What you are looking at *is* forward.

Input is keyed off `event.code` (physical keys), and all held keys are released on window blur — without that, alt-tabbing mid-turn strands a key down forever and the bee turns for the rest of the session.

---

# Milestone 4: Client Game State

**Status: ✅ Done**

Zustand store with the full progress shape: player flight state, pollinator, and boolean records for discovered plants, pollinated plants, unlocked areas, badges, and journal entries. Discovery and pollination cascade into journal unlocks.

Progress now persists to `localStorage` — plants, areas, badges, journal, settings and stats. Server-side autosave is Milestone 14 and remains deferred, but a journal that empties itself on every reload isn't worth building.

---

# ⛔ Milestone 5: Starter Pollinator System — REMOVED

**Folded into Milestone 6.**

With the MVP committed to a single species, "choose your starter" is a menu with one option. It does not earn its own milestone. The picker UI and `starter-pollinators.ts` remain in the codebase and now live under Milestone 6.

---

# Milestone 6: Pollinator System

**Status: ✅ Done**

`/customize` is a real form: name (validated — non-empty, ≤20 chars, letters/numbers/spaces/hyphens), body colour, wing colour, wing style (round / long / stubby), accessory (none / cap / flower / scarf), accent colour, and trail. Everything applies to the voxel model, which compiles wings and accessories from the same text-art pipeline as the rest of the bee.

Saving writes to the store, which persists locally.

## The three-starter bug: fixed

The picker used to offer Scout (bee), Zip (hoverfly) and Marigold (butterfly) while the scene rendered `BeeModel` unconditionally — pick either of the other two and you flew a bee in their colours. The species picker is now bee-only, and says so plainly:

> The bee is the only pollinator in the park so far. The hoverfly and the butterfly are coming — they aren't offered here because they aren't built yet, and a chooser that hands you a bee whatever you pick is just lying to you.

---

# Milestone 7: Frick Park Map Experience

**Status: ✅ Done (rescoped)**

## Done

- Deterministic heightfield: rolling terrain, a meandering Nine Mile Run, a carved valley with flanking ridges, and flattened plateaus for the lawn, the bowling green and the playground shelf
- Six areas, named for real park features, with area detection and unlock events
- Hand-placed landmarks: the Blue Slide, the gatehouse, the Environmental Center, the bowling green, the clay courts, benches, trail posts, stepping stones
- Instanced foliage by biome: hemlock, oak, fern, shrub, fallen logs, stumps, snags, acorns, creek stones — and a grass field of thousands of blades, which is what actually sells the scale
- Flight floor follows the terrain, so you can dive into the ravine and skim the creek

## ⛔ Removed from this milestone

**The gray/unexplored map reveal.** It contradicts the direction the game took. There is no map screen to grey out, and navigation is now driven by pollen motes and real landmarks you can see and steer toward. A fog-of-war overlay would be a second, competing wayfinding system fighting the first.

**Environmental ambience hooks.** Not removed — moved to Milestone 16, where the rest of the audio lives.

---

# Milestone 8: Native Plant Data Layer

**Status: ✅ Done**

16 native species in `data/plants.ts`, each with common and scientific name, home area, bloom window, a one-line hook, a full fact, a pollinator note, and a **verified** Wikipedia link (every URL was checked to return 200 — a dead "learn more" is worse than none).

Real photographs live in `public/images/plants/`, downloaded rather than hotlinked, all public-domain or CC-licensed, with attribution rendered in the UI and recorded in `public/images/plants/CREDITS.md`. Eleven carry an attribution obligation; the credit is a licence term, not a nicety.

---

# Milestone 9: Plant Discovery System

**Status: ✅ Done**

- Proximity detection against the nearest plant instance, measured to the **bloom**, not the base
- Undiscovered plants carry a bobbing pollen mote — without it you cannot pick a flower out of the undergrowth from flight height
- A small card anchored in the world **over the plant itself**, with the name, the hook, and two ways forward
- The full entry (`R`) opens a properly-sized dialogue with the photograph, bloom window, fact, pollinator note, attribution, and the Wikipedia link

---

# Milestone 10: Pollination Interaction System

**Status: ✅ Done**

Space no longer just succeeds. It opens one of three minigames, chosen by the plant's shape so a species always plays the same way and you learn its rhythm:

- **hover** — settle inside a drifting ring and hold still (daisies, woodland flowers)
- **taps** — work the florets one at a time (spikes, shrubs)
- **cue** — press the arrow the open flower points to (umbels, flowering trees)

All three fold into a single 0–1 performance score and one resolver, so the failure rate lives in exactly one place (`data/pollination.ts`). Base failure is 20%. Playing well cuts it to a floor of 6%; playing badly raises it to a ceiling of 42%. Neither reaches certainty — a bee at the top of its game still gets rained on, and nobody ever gets stuck.

Failure is warm and factual, never a buzzer:

> "Too windy this time. The pollen blew right off you."
> "This flower was already visited — its pollen is spent."
> "The anthers hadn't opened yet. Come back when the sun's higher."

And a failed attempt teaches something: it unlocks the **Pollination Failure** journal entry, which explains that most flower visits come to nothing and that this is the arithmetic the whole system runs on.

Success shows the plant's fun fact, puts pollen baskets on the bee's hind legs, and plays a rising arpeggio.

---

# Milestone 11: Journal System

**Status: ✅ Done**

`/journal` has five tabs — Plants, Pollinators, Map areas, Ecology, Badges — plus a progress summary (plants found, pollinated, areas, badges, the share of visits that took, best streak).

Locked entries show a **hint**, not a row of question marks. A locked entry that says nothing teaches nothing and tempts nobody; one that says *"there's a darker wood than the one you know"* sends somebody flying.

Seven ecology concepts, unlocked by playing rather than by reading: mutualism, pollination failure, native plants, bloom windows, habitat corridors, invasive species, seasonal cycles.

---

# Milestone 12: Badge and Progression System

**Status: ✅ Done**

Thirteen badges in `data/badges.ts`, each a pure predicate over game state. A `ProgressionWatcher` subscribes to the store and re-evaluates everything on change, so adding a badge to the data file makes it work — no call site has to know it exists.

Earned badges announce themselves one at a time in a brief toast, never blocking play.

**No leaderboard, and there never will be.** Nothing is scored against another player and nothing is timed. Several badges reward simply being curious, and one — *Persistent* — rewards failing and carrying on anyway.

---

# Milestone 13: Auth and User Profile

**Status: ❌ Not started**

`next-auth` is installed but **not imported anywhere**. There are no API routes and no database.

## Tasks

- Google sign-in
- Signed-in and signed-out states
- Create a user profile record on first sign-in
- Build the `/profile` route: saved pollinator, accomplishments, progress summary

## Acceptance criteria

- Signed-out players can access offline mode
- Signed-in players can access saved play mode
- Auth state survives refresh

---

# Milestone 14: Autosave and Lightweight Data Model

**Status: ❌ Not started**

Progress is currently **lost on reload** — only the pollinator persists, to `localStorage`.

## Tasks

- Choose and wire the database layer
- Save/load API routes
- Autosave on the major events: plant discovered, plant pollinated, area unlocked, badge earned, journal entry unlocked, pollinator customized, session end
- Resume from saved state on return

The progress model is deliberately lightweight — boolean records keyed by id, which the client store already uses. It should serialize almost directly.

---

# Milestone 15: Offline 10-Minute Mode

**Status: ✅ Done**

`/offline` opens on the framing, not on a menu:

> **You are a pollinator.** Your time is short. Ten minutes, no account, nothing saved. Explore Frick Park, pollinate what you can, and learn as much as you're able before the light goes.
>
> *This is not a trial version. It's a whole season, compressed.*

The clock runs off the wall clock, not a frame counter, so a stutter or a background tab can't buy extra time. The end-of-run summary counts what you found, pollinated and learned — and reads it back honestly:

- 0 pollinated → *"Not a single flower took. That happens — most visits come to nothing, and a bee just flies to the next one."*
- 1 → *"One flower will set seed because of you. That is not nothing. That is the entire mechanism."*

---

# Milestone 16: Audio and Feedback

**Status: ✅ Done**

**Synthesized in the browser — no audio files at all.** Everything is oscillators and envelopes through the Web Audio API (`audio/sound.ts`): no assets to license, nothing to download, a chiptune character that matches the voxel art for free, and the whole soundtrack costs a few kilobytes of code.

- Seven effects: tap, discover, pollination success, pollination failure, badge, UI, wing
- A slow pentatonic music loop — pentatonic because it cannot land on a wrong note, so a short loop never turns grating
- Per-area ambience: a pair of detuned drones whose pitch and texture shift with where you are, low and close under the canopy, brighter out on the green
- Volume slider and an on/off toggle in the HUD

**Audio starts off.** Browsers block sound before a user gesture anyway, and a game that makes noise the instant it loads is a game people mute permanently. The tutorial's last step offers "Fly, with sound" or "Fly in silence" — a real gesture, at the only moment it's welcome.

---

# Milestone 17: Landing, Onboarding, and Tutorial

**Status: ✅ Done**

The landing page used to advertise the build status — "Next.js App Router", "Route placeholders" — which is a thing nobody has ever wanted to read. It now opens with **"You are a bee."** and sells the park.

First-flight is four steps, shown once and skippable. It teaches the two things nobody guesses: that the mouse *steers* rather than merely looks, and that failing to pollinate is normal rather than a mistake. Everything else the player can find out by flying.

---

# Milestone 18: Visual Polish

**Status: ✅ Done**

- The 8-bit-adjacent voxel direction, applied throughout: bee, flora, trees, landmarks
- Faceted low-poly terrain, coloured by biome, slope and depth
- Every overlay in the game's own honey-and-cream palette rather than generic system chrome — plant entry, world card, minigame, badge toast, tutorial
- A loading veil while the world generates. It builds terrain, scatters thousands of props and compiles all the geometry before its first frame; without this the player stares at a blank canvas and assumes it's broken
- `prefers-reduced-motion` respected across every animated overlay

---

# Milestone 19: Credits, Accessibility, and Compliance

**Status: ❌ Not started**

## Tasks

- A credits page — **the plant photo attributions are a licence obligation, not a courtesy.** `public/images/plants/CREDITS.md` already holds the data; it needs a route.
- Readable text sizes, volume control, reduced-motion support *(the plant entry and world card already respect `prefers-reduced-motion`; nothing else does)*
- Keyboard navigability outside the game canvas

---

# Milestone 20: QA, Deployment, and Launch Readiness

**Status: ❌ Not started**

Playwright is installed as a dev dependency. **No tests exist.**

## Tasks

- End-to-end tests for the core loop: fly, find, pollinate, read, unlock
- Cross-browser check on desktop
- Performance pass — the world is large and the draw-call budget matters
- Deploy to Vercel
- Analytics
- A real bug-testing pass

---

## Working notes for whoever picks this up

Work milestone by milestone. For each one: inspect the current code, identify existing conventions, implement only the current scope, run `npm run typecheck` and `npm run lint`, and — this one matters — **actually run the game and drive the thing you changed.** Several of the worst bugs in this project's history typechecked cleanly and looked fine in a screenshot taken from the one angle where they happened to work.

Do not skip ahead to later systems unless the current milestone requires scaffolding for them.
