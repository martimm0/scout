# Scout: A Pollinator RPG — Implementation Plan

## Purpose

This document is the development roadmap for the Scout MVP. It is kept in sync with the code: every milestone carries a status, and where the build has deliberately diverged from the original plan, the divergence is recorded rather than quietly ignored.

The goal is a complete browser-based, desktop-first MVP where a player can sign in, customize a pollinator, explore a Frick Park map, discover native plants, complete light pollination interactions, unlock journal entries, earn badges, autosave progress, and return later.

**Status: all 18 milestones implemented and verified.**

Auth and autosave now run against a real Google OAuth client and a real Neon Postgres database. Verified: the sign-in redirect reaches Google with the correct client id and PKCE; a session is recognised; a save round-trips through Postgres intact; the server stamps `savedAt` rather than trusting the client; an anonymous POST is refused; and a stale write from an old tab is rejected instead of clobbering newer progress.

The one link never exercised by a machine is a human typing a Google password. Everything after the callback is covered.

**The app still runs with an empty `.env`.** No credentials, no database, no problem: it falls back to local mode, progress lives in localStorage, and sign-in is hidden rather than shown-and-broken.

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
| 13 | Auth and User Profile | ✅ Done |
| 14 | Autosave and Data Model | ✅ Done |
| 15 | Offline 10-Minute Mode | ✅ Done |
| 16 | Audio and Feedback | ✅ Done |
| 17 | Landing, Onboarding, and Tutorial | ✅ Done |
| 18 | Visual Polish | ✅ Done |
| 19 | Credits, Accessibility, and Compliance | ✅ Done |
| 20 | QA, Deployment, and Launch Readiness | ✅ Done |

### After launch

| Milestone | Status |
|---|---|
| 21 | Fungi | ✅ Done |
| 22 | Solid park (collision) | ✅ Done |
| 23 | Landing, and trivia | ✅ Done |
| 24 | The park keeps Pittsburgh time | ✅ Done |
| 25 | The saved game is behind a sign-in | ✅ Done |
| 26 | Photographs | ✅ Done |

---

## The park is alive on a clock

`world/daylight.ts` is the park's own clock, and it runs on **Pittsburgh time regardless of where the player is**. If it is dusk in Squirrel Hill it is dusk in the game, whether you are in Tokyo or Toronto. You are visiting a specific real place, not running a simulation on your own schedule.

The whole look of the park is a blend between a night look and a day look on one number, `brightness`, which ramps across roughly ninety minutes of twilight at each end. Sun position, key-light colour and intensity, ambient, hemisphere, fog colour and density, and the sky's turbidity and rayleigh all come off it, so nothing ever snaps from noon to midnight at the stroke of a boundary. The key light is **always above the horizon**: in daylight it is the sun on its arc, after dark it is the moon. A key light under the floor lights the park from below, which is to say it does not light it at all, and for one build that was exactly what night was: a black screen.

**What you can find changes with the hour.** Every plant and every fungus carries a `TimeWindow`.

- The **spring ephemerals** (trout lily, trillium, mayapple, Virginia bluebell, wild geranium) open with the sun and shut by mid-afternoon, because that is what they really do.
- Everything else that flowers is open through the day and **shut after dark**.
- The **fungi keep their own hours**, and the jack-o'-lantern is out at night, glowing, which is also what it really does.

So after dark there is nothing to pollinate anywhere in the park, and the only things out are fungi. That is not a mechanic bolted on to force replay; it is the truth about the place, and it happens to make the park worth visiting twice.

A shut flower is still *drawn*, dimmed and inert, and its card tells you when to come back. A fungus that is not fruiting is genuinely gone. Badges follow: **Night Shift**, **Dawn Chorus**, **All Hours** (every one of the six phases), **Something Glowing** (find the jack-o'-lantern lit).

`?hour=13.5` pins the clock. It is not a player-facing feature: it exists so the e2e suite can find an open flower at three in the morning.

## The saved game is behind a sign-in

The park keeps a record of you, and a record has to belong to somebody. `/play`,
`/journal` and `/profile` ask for a Google account, and pressing **Fly** on the
landing page without one lands you on a page that explains why rather than a
redirect that does not.

**The ten-minute run is not behind it.** It saves nothing by design, so there is
nothing to own and nobody to ask, and it is the way in for a player who will not
hand over a Google account to look at some flowers. The gate says so, and links
straight to it.

The gate does not exist when auth is not configured. On a fresh clone with an
empty `.env` there is no sign-in to offer, and gating the game behind one would
simply make it unplayable, which is the opposite of what local mode is for.

The e2e suite signs in for real: it mints the same JWT session cookie Auth.js
would have issued after a Google round-trip, so the tests exercise the actual
signed-in path. There is deliberately **no dev-only bypass in the app**, because
a dev-only bypass is a dev-only bypass right up until the day it ships.

## Photographs

**P**, or the button on the HUD, and whatever is on screen is kept. Each one
remembers where you were and what the park's clock said, so an album is a record
of a day rather than a pile of pictures.

They live in their own localStorage key and **not** in the save file. The save
file is a few hundred bytes of booleans that goes to Postgres as a single JSONB
row on every autosave; a photograph is fifty kilobytes. Putting them together
would mean posting the whole album back to the server every time you found a
flower. So the album stays on the device, the journal says so plainly, and the
last twelve are kept with the oldest falling off the end rather than the write
throwing `QuotaExceededError` halfway through and corrupting the key.

This works at all only because the GL context is created with
`preserveDrawingBuffer: true`. Without it the drawing buffer is discarded after
each frame and `toDataURL` hands back a blank rectangle, so the test does not
merely assert that an image is *present*: it decodes the JPEG and measures the
spread of its pixels. A blank frame passes "the image is there" and fails that.

## The park is solid

`world/collision.ts`. You could fly straight through an eighty-unit oak, which looked broken the moment anybody noticed it.

Two rules keep it from being miserable. **Only big things collide** — trees, boulders, logs, buildings, the bridge. Grass, clover, ferns and leaf litter stay pass-through, because at insect scale a lawn is a thicket and colliding with every blade would make flying near the ground unbearable. And **push out, do not stop**: the bee is nudged to the surface of whatever it hit, and only the velocity going *into* the surface is killed. Whatever was running along it survives, so you slide around a trunk instead of sticking to it.

The colliders are derived from the same scatter that draws the trees, so they cannot drift out of sync with what you can see.

Turning the park solid immediately surfaced a bug that had been invisible for as long as walls were suggestions: **the player spawned inside the Environmental Center.** The spawn is now on open lawn, clear of every collider, pointed down two hundred units of open ground.

## Landing, and trivia

Space no longer pollinates. Space **lands** you, and then you choose.

- **Pollinate it** — the minigame, for flowers only.
- **Take the quiz** — three hand-authored questions, drawn from the same facts the entry shows you. Two out of three passes; every answer explains itself whether you got it right or wrong.
- **Read the entry**, or **take off**.

A fungus offers everything except pollination, and says so plainly: *nothing pollinates a mushroom. It is not a plant, it has no flower, and it wants nothing from you.*

`data/trivia.ts` carries three questions for each of the twenty-four species, written by hand rather than generated, because a generated question about a trout lily is a question about a template.

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

Landmarks are hand-placed, not scattered: the Blue Slide, the stone gatehouse, the Environmental Center, the bowling green and its clubhouse, the clay tennis courts, the **Fern Hollow Bridge** (which fell into the ravine in January 2022 and was rebuilt inside a year — the most Pittsburgh object in Pittsburgh), stone steps down the ravine wall, the swings, a trail shelter, a storm culvert discharging into the creek, benches, trail posts, and stepping stones.

**The trail network is carved into the terrain** — Tranquil, Riverview, Falls Ravine, Homewood. The paths are bare packed dirt, nothing grows on them, and from the air they are what you navigate by. Frick Park is really a trail network with a wood around it.

**The ground tells you where you are before you look up.** Deep woods get mushrooms, leaf litter and fallen branches. The creek margin gets cattails and **Japanese knotweed** — the invasive that is eating the ravine, which you cannot pollinate, which is the lesson. The mown lawns get clover and acorns. Slag outcrops break the surface in the valley, because millions of tons of it are still down there under everything.

### Three pollinators, and they are not palette swaps

The bee, the hoverfly and the butterfly are all built and all playable. Each is a separate spec file (`models/bee.ts`, `models/hoverfly.ts`, `models/butterfly.ts`) feeding one shared voxel pipeline and one shared animation rig — there is no per-species branching anywhere in the model component.

They are modelled on what actually distinguishes the animals:

- **Hoverfly** — a fly, not a bee. Enormous red eyes that meet over the crown. **Two** wings, not four: the hind pair shrank into halteres, the little gyroscopic knobs that are *why* it can hang dead still in the air, and they are modelled. Bare shell instead of fuzz, stubby antennae, long flat abdomen.
- **Butterfly** — mostly wings. Two huge patterned pairs with dark veins and a rim of white spots, a thread of a body, and clubbed antennae (the club is the one feature separating a butterfly from a moth). Its wings are opaque and carry their own pattern, so the "wing colour" control is hidden for it — tinting them would smear the pattern into stained glass.

**And they fly differently.** Measured in the browser, not asserted:

| | distance in 3s | turn rate | top speed |
|---|---|---|---|
| Hoverfly | 83 | 161°/s | 29.1 |
| Bee | 73 | 114°/s | 21.3 |
| Butterfly | 58 | 82°/s | 16.3 |

The hoverfly darts and stops dead; the butterfly floats and drifts on after you let go. Choosing a species is a real choice, not a costume change.

Flying one is also how you unlock its journal entry.

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
- Auth.js v5 (`next-auth@beta`) for Google sign-in — v4 predates the App Router and React 19
- Neon Postgres via `@vercel/postgres`. One table, one JSONB row per player, created on first use — there is no migration step
- Public asset storage for plant photos, music, and sound effects

## Core routes

```txt
/              Landing page          built
/play          Game experience       built
/customize     Pollinator            built
/offline       Offline 10-minute     built
/journal       Journal               built
/profile       Saved progress        built
/credits       Photo attribution     built
/api/auth/*    Google sign-in        built
/api/progress  Save and load         built
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
- **Space** — land on the nearby plant or fungus. From there you choose: pollinate it, or take its quiz.
- **R** — read its full entry
- **P** — take a photograph, kept in your journal
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

## The three-starter bug: fixed properly

The picker once offered a hoverfly and a butterfly while the scene rendered a bee whatever you chose. For a while it was restricted to the bee alone, which was honest but thin. Now all three are offered *and all three are real* — different models, different flight.

The rule that came out of it is worth keeping: **never offer a choice the game cannot honour.** The e2e suite now selects each species and flies it, so a picker option that crashes the scene fails the build.

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

`/journal` has seven tabs — Plants, Fungi, Photos, Pollinators, Map areas, Ecology, Badges — plus a progress summary (plants found, pollinated, areas, fungi found, quizzes passed, badges, the share of visits that took, best streak).

Locked entries show a **hint**, not a row of question marks. A locked entry that says nothing teaches nothing and tempts nobody; one that says *"there's a darker wood than the one you know"* sends somebody flying.

Seven ecology concepts, unlocked by playing rather than by reading: mutualism, pollination failure, native plants, bloom windows, habitat corridors, invasive species, seasonal cycles.

---

# Milestone 12: Badge and Progression System

**Status: ✅ Done**

Twenty-one badges in `data/badges.ts`, each a pure predicate over game state. A `ProgressionWatcher` subscribes to the store and re-evaluates everything on change, so adding a badge to the data file makes it work — no call site has to know it exists.

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

**Status: ✅ Done**

## Tests

**38 Playwright tests across Chromium, Firefox and WebKit**, plus one deliberately skipped (see below). Run with `npm run test:e2e`.

They assert the things that actually broke in this project, not a wish-list:

- dragging the mouse right turns you **right** (it shipped mirrored once)
- Space opens a **minigame**, and does not silently succeed
- a pollination attempt always **resolves** and never hangs
- the plant entry **fits without a scrollbar**
- the picker never again offers a hoverfly it cannot render
- flying somewhere new **unlocks** the area
- every locked journal entry is a **hint**, not a row of question marks
- every photo on the credits page carries a **licence link**

Plant-finding in the tests is deterministic: the scatter is a pure function, so the suite *imports it* and flies to a known flower rather than wandering hopefully. An earlier version wandered, and failed a third of the time for reasons that had nothing to do with the game.

## Cross-browser

Running the suite in WebKit found a real bug on its first outing: **mouse-look did not work in Safari at all.** WebKit only populates `movementX`/`movementY` while the pointer is *locked*, and reports 0 otherwise — so hover-to-look, which is how the game is played, did nothing. The delta is now derived from `clientX`/`clientY` when unlocked, which works in every engine.

One test is skipped in WebKit by design: Safari leaves links out of the tab order unless the user enables Full Keyboard Access, so asserting that Tab reaches the skip link there would be testing a macOS default rather than our markup. The link's existence and target are still asserted in all three.

## Analytics

**Vercel Analytics and Speed Insights.** First-party, cookieless, no third-party script — and therefore no consent banner, which is the right amount of tracking for a game about bees.

Beyond page views and Web Vitals, the gameplay funnel is instrumented (`lib/analytics.ts`): tutorial completed, plant discovered, area entered, pollination attempted, **pollination resolved (with success/failure)**, badge earned, pollinator customized, offline run finished with what it yielded.

That failure event is the one that matters. This game is built on the claim that failing to pollinate is interesting rather than annoying. If a failed attempt turns out to be where people leave, the twenty percent is wrong or the copy isn't doing its job — and that is a thing worth being able to find out.

Nothing identifies anybody: no user id, no session stitching, and analytics is wrapped so that it can never break the game if it's blocked or down.

## Deployment

Live at **https://scout412.vercel.app** — Vercel, deployed from `main`, with Neon Postgres attached and Google sign-in configured against the production callback.
