# Scout: architecture

How the thing is put together, and why it is put together that way. For what the
game IS, see [GAMEPLAN.md](GAMEPLAN.md). For how the data is shaped, see
[DATA.md](DATA.md).

## Stack

- **Next.js (App Router), React, TypeScript.** No Tailwind: CSS Modules, and a
  small set of design tokens in `globals.css`. Scoping is per file, which is
  worth remembering when hunting dead rules: `styles.stage` appears in four
  stylesheets and means something different in each, so a class is only unused if
  it is unused in **the files that import its own sheet**. Grepping the whole tree
  gives false negatives and hides the dead ones; grepping a single importer misses
  that some sheets have several. Rules reached through `styles[variant]`, as the
  Button's do, look dead to any grep and are not.
- **three.js + React Three Fiber + drei.** The scene uses R3F's *imperative*
  root (`createRoot` / `configure` / `render`) rather than `<Canvas>`, because
  the game needs to own its own sizing and lifecycle.
- **Zustand** for game state, with `persist` to localStorage.
- **Auth.js v5** with Google, JWT sessions.
- **Neon Postgres** via `@vercel/postgres`.
- **Cloudflare Workers + Durable Objects** for garden parties, via
  [`partyserver`](https://github.com/cloudflare/partyserver). This is the one
  piece that does not run on Vercel: a room needs a socket that outlives a
  request, and a serverless function does not have one. `wrangler dev --local`
  in development, a deployed Worker in production.

  It was written against PartyKit's hosted platform first, and that platform is
  full: `partykit.dev` has hit Cloudflare's limit of 10,000 custom domains per
  zone, so no new project can be deployed to it. The port cost very little,
  because everything that matters was already in pure modules (the board
  rules, the quip state machine, the table transitions, the protocol) and only
  the shell of `party/garden.ts` had to change.
- **Web Audio**, synthesized. No audio files.
- **Playwright** across Chromium, Firefox and WebKit, plus `phone` and `tablet`
  projects with `hasTouch` for the touch controls. Those two are Chromium only,
  because the GL flags that make the canvas render headless are Chromium's: they
  prove the controls, not iOS Safari, which still wants a real device.

Everything runs on a fresh clone with an empty `.env`. With no Google client and
no database the game is fully playable in "local mode": progress lives in
localStorage, sign-in is hidden, and nothing on screen promises a feature that is
not there. That is a hard requirement, not a nicety, and it is why every
integration is behind a `configured` boolean rather than an assumption.

## The shape

```
src/
  app/                      routes and API
    api/
      auth/[...nextauth]/   Auth.js
      progress/             the save file (GET, POST)
      photos/, photos/[id]/ the album
      weather/             the real Pittsburgh sky, cached
    play/ journal/ customize/ profile/ about/ credits/ offline/
  components/ui/            Button, Card, Modal, the generic furniture
  features/
    auth/components/        sign-in, the gate
    game/
      audio/                sound.ts: music, ambience, effects
      components/           the scene, the HUD, every overlay, the touch pad
      data/                 plants, fungi, trivia, badges, photos, accessories
      hooks/                use-media-query (is this touch), use-fullscreen
      models/               voxel builders: bee, flora, fungi, landmarks
      state/                game-store, cloud-sync, photo-store, progression,
                            virtual-input (the touch bridge)
      world/                terrain, scatter, collision, daylight, season, weather
        parks/              one file per park, plus props and obstacles
  lib/                      auth, env, accounts, progress, photos, analytics
```

## The load-bearing ideas

### 1. Models are data, not code

Nothing in this game is a 3D asset. Every model is authored as **layered ASCII
text art** and compiled to merged geometry with colour and ambient occlusion
baked into vertex colours.

```ts
head: {
  palette: { B: "body", D: "dark", E: "eye" },
  layers: [
    [".DDDD.",
     "DDDDDD",
     "DEEDEE",   // big eyes, set wide: this is where the cuteness lives
     ".DDDD."],
  ],
}
```

Editing the bee means editing a picture, not tweaking forty `position={[0.32,
0.16, -0.08]}` triples. `buildVoxelGeometry` handles the fine work (the bee, the
accessories); `buildBoxGeometry` handles the chunky work (trees, landmarks).

The pipeline is **axis-aligned on purpose**. `Box` has no rotation. When the
reservoir wanted a ring, it got a stair-stepped circle of axis-aligned segments
rather than a rotation parameter threaded through every model in the game. In a
park built out of cubes, a stair-stepped circle is the honest answer.

Because the colour is baked into the mesh, **the season is the wood turning, not a
light**. `Terrain` and `Foliage` (`frick-park.tsx`) mix the geometry's vertex
colours toward a seasonal target (`seasonLook`) once when the month rolls over:
gold and rust in October, bare grey-brown and snow-white in January, fresh green
in spring. The scatter placements never change, only the colour, so it is a cheap
pass over the colour attribute rather than a rebuild of the world.

That rebuild-on-the-month is why the look is sampled at the month's **middle**
(`lookForMonth`) rather than its first day. One sample has to stand for the whole
month, and the seasonal curves are ramps and bumps: the snow bump is zero at both
of its ends, so sampling the first of the month left December with no snow on the
ground for all thirty-one days of it. The winter index also has to be stitched
across the turn of the year, because December is month 12 and January is month 1,
and getting that a month out sent the index straight over the point where the snow
peaks. Between the two, the game rendered snow in January and nowhere else, and
nothing about it threw or looked obviously wrong. `season.spec.ts` asserts the
shape of the curve and that every winter month has white ground.

### 2. Species are specs, not subclasses

Bee, hoverfly, butterfly and moth are four `SpeciesSpec` data objects feeding
**one** shared model component and **one** animation rig. There is no
per-species branching anywhere in the render path. A hoverfly is different
because its spec says two wings and halteres, not because a component checks
`if (type === "hoverfly")`.

The moth was the test of that claim, which had been sitting in this file
untested since there were three. It cost one spec file and four one-line
additions (the two type unions, the registry, the starter list) and nothing in
the model component, the flight loop or the customize screen had to learn it
exists. The two tests that cover the picker used to name three species by hand,
so they went on passing when a fourth arrived and would have gone on passing had
it been broken; they read `SPECIES_LIST` now.

### 3. A park is data, and `terrain.ts` is a facade

This is the biggest structural idea in the codebase, and it was retrofitted.

For most of the project's life there was one park, and it showed: world bounds,
the height function, the creek, the areas and the landmarks all sat as module
constants in `terrain.ts`, and every function in `world/` read them out of file
scope. Nothing took a park as an argument because there was only ever one.

Now a `Park` is a data object (`world/park.ts`) and each park is one file
(`world/parks/frick.ts`, `schenley.ts`, `highland.ts`). `terrain.ts` keeps the
names it always had (`terrainHeight`, `areaAt`, `creekX`) and reads whichever
park is active, so the frame loop, the scatter and the collision grid never had
to learn about parks.

**Adding a park is a data change.** A park declares its own bounds, height
function, areas, valley, basins, landmarks, trails, biome colours, densities, and
what it costs to unlock.

### 4. Caches are keyed by park, never invalidated

The collision cylinders, the obstacle boxes and the spatial grid are all keyed by
park id in a `Map`.

This is not fussiness. They used to be module singletons guarded by `if (grid)
return;`, which meant the **first park to load won for the whole page session**:
cross from Frick to Schenley and you would get Schenley's terrain with Frick's
oaks still solid in the air around you. No crash, no error, just a park full of
invisible trees.

A cache you invalidate is a cache somebody forgets to invalidate. A cache you key
cannot be wrong.

### 5. Rules live in the store, not on the button

A disabled button is a suggestion. Every rule that matters is enforced in the
state layer, where it cannot be routed around:

- `canPollinate` is what `startMinigame` consults. A demanding flower refuses
  whoever calls it.
- `accessoryUnlocked` is what `updatePollinator` consults. It also catches the
  case nobody clicks: a save arriving from the cloud wearing something this
  player never earned falls back to bare.
- `parkUnlocked` gates travel, and is OR'd with a derived check so a save file
  written before the field existed still honours a park the player earned months
  ago.

### 6. The scene is an imperative R3F root

`game-scene.tsx` creates the GL root by hand. Two rules come with that, and both
were learned the hard way:

- **Create the root once.** Anything that changes (the hour, the weather, the
  bee) is *re-rendered into* the existing root. Putting a value in the effect's
  dependency array rebuilds the whole WebGL context on every change, and R3F
  warns "createRoot should only be called once" into a console nobody reads while
  the canvas renders transparent.
- **Survive the dev double-invoke.** `reactStrictMode` is on, so in development
  React mounts, tears down and remounts every effect once. A synchronous
  `root.unmount()` in the cleanup disposes the context the immediate remount then
  reuses, so `createRoot` runs a second time on the same canvas, the context is
  lost, and the park is replaced by the shell's flat background for the rest of
  the session. A hard page load never showed it (the root is created once and
  never torn down), which is exactly why it hid: it only bit a CLIENT-side mount
  of the scene, the offline run reached by clicking Begin and /play reached by an
  in-app link. The fix is to DEFER the teardown to the next tick and reuse the
  existing root if a remount arrives first, so the double-invoke collapses back to
  one live root. The offline test asserts the canvas actually draws the park
  rather than the flat fill, because the old test watched the HUD and passed
  straight through a blank scene.
- **Never touch `canvas.width/height`.** three owns the drawing buffer and sizes
  it as CSS size times pixel ratio. Forcing it to CSS size leaves the GL viewport
  at twice the buffer, so you render the bottom-left quadrant blown up 2x, on
  retina displays only.
- **The canvas must not be able to size the box that measures it.** A root sizes
  its buffer from its container, and three writes an inline width and height onto
  the canvas on every `setSize`. If the canvas is in normal flow, that inline
  height *becomes* the container's height, the ResizeObserver sees it grow, and
  the two feed each other. The in-game pollinator preview grew a few pixels a
  frame, and because every resize reallocates and clears the drawing buffer,
  nothing it drew ever reached the screen: a blank rectangle, no errors, no
  warnings, a live GL context and a scene with a bee in it. So the preview's
  canvas is `position: absolute` and its container carries a positioning context
  and a real height of its own. The regression test in `pages.spec.ts` reads the
  canvas back and watches the box for a second, because every softer check
  ("is the canvas visible") passed throughout.
- **`extend(THREE)` is not boilerplate.** R3F only knows the classes it has been
  handed. Any file that renders `<color>` or `<ambientLight>` into its own root
  must extend, or it throws into a canvas nobody is watching.

### 7. A popover owns the keyboard

The scene listens for keys on `window` and `preventDefault`s every one it uses,
which is most of the alphabet including both common vowels. So while any popover
is open (`inputSuspended` in `game-scene.tsx`), the scene takes its hands off the
keyboard entirely, and the popover, including a text input, gets the keys. Without
this you could not type anywhere in the game, and two keys had their own copies of
the bug: P photographed the dialog you were reading, and G made the bee dance
behind it. Escape is handled before the gate, because it is how popovers close.

### 8. The minigame shell

`pollination-minigame.tsx` is a shell that owns the frame (scrim, panel, name,
clock, timer, resolve, outcome) and nothing about how any game is played. Each
game is a component under `minigames/` behind one contract (`minigames/types.ts`),
registered in `minigames/index.ts`. It was one component holding all three games'
state at once.

Three details of the contract each avoid a bug: it passes a `duration` number, not
a `performance.now()` deadline (recovering a duration from a deadline is an impure
read during render); `reportScore` writes a ref, not state (or the shell
re-renders the board at 60fps); and `finish` guards on a synchronous ref, because
a game ending early can race the clock in one frame and double-count the attempt.

### 9. The world is deterministic

No `Math.random` anywhere in world generation. Scatter, terrain and placement are
all seeded hash noise, so the park is laid out identically every visit and a
player can learn where things are and come back to them.

This is also what lets the e2e suite *import the scatter* and fly to a known
plant, instead of flying a random spiral and hoping.

### 10. The HUD keeps its own light

The park is always lit: the 3D scene has its own day and night and pays no
attention to the site's light/dark toggle. So the HUD that floats over it stays a
**light island** whatever the page theme is, by pinning the light-mode design
tokens as locals on the scene's `.shell`. Everything inside then resolves to light
values, and the Scout Stats and Controls panels read as dark ink on white even in
dark mode.

Without this the panels inherited the page's dark tokens and drew pale text on
their own pale surfaces: light-on-light, unreadable, over a scene that was bright
regardless. A panel that sits over the game answers to the game, not to the
chrome around it.

### 11. Touch is a second pair of hands on the same loop

The game is played by keyboard and mouse on a desktop and by two thumbs on a
phone, and there is exactly one flight loop underneath both.

The obstacle is idea 6: the scene renders into its OWN imperative root, so
`ScoutScene` and the HUD around it are in **separate React roots** and context does
not cross between them. The flight refs (`keysRef`, `yawRef`, `pitchRef`) are
private to the scene, and the on-screen sticks have to live in the outer DOM.

So the bridge is a module singleton, `state/virtual-input.ts`, in the same spirit
as `setActivePark` / `activePark`. Zustand would have been the wrong tool and the
reason is idea 8's: these are per-frame values, and a per-frame value in state
re-renders its subscribers sixty times a second.

Two properties make it cheap:

- **Every field is a rate, not a delta.** A stick is held, and the loop already
  multiplies by `delta` itself, so `turn` and `throttle` are literally the same
  `-1..1` the arrow keys produce through `axis()`, only continuous. The loop
  needed five `||` and `+` reads, no new machinery.
- **Zeroes are invisible.** With no pad mounted every field stays at its zero and
  every one of those reads folds back to exactly the keyboard's answer, which is
  what let touch be added without the desktop game changing at all.

`(pointer: coarse)` decides whether the pad is mounted, asked of the pointer rather
than the viewport, so a narrow desktop window does not sprout thumbsticks and a
large tablet does. And because a touch control never sends a release when it is
unmounted or covered, `resetVirtualInput()` runs whenever a popover takes over:
the touch twin of the loop clearing `keysRef` on blur. The preview modal is in that
pause list now: it was not before, because it does not capture the keyboard, but a
THUMB held on the throttle when it opened never let go.

## The frame loop

`ScoutScene` in `game-scene.tsx`. Per frame, in order:

1. Read held keys, derive yaw from mouse and arrows (one yaw: the bee's nose, the
   camera and the flight direction are the same thing).
2. The Blue Slide check. Fly into the box at the top of Frick's slide and the
   frame loop stops integrating flight and instead runs the bee down a scripted
   line (`world/slide-ride.ts`), which reads the slide's OWN position and rotation
   off the prop the scene renders, so the ride cannot drift from the model. It
   owns the bee's position and heading until the run-out, then hands back with a
   shove and a celebrate gesture. Collision is skipped: the ride is the one time
   the bee is meant to be inside a landmark.
3. Otherwise integrate velocity, clamp to world bounds and to the terrain.
4. `resolveCollision` pushes out of anything solid. Only the velocity going
   *into* a surface is killed; whatever runs along it survives, so you slide
   around a trunk rather than sticking to it.
5. Discovery: nearest active species within `DISCOVERY_RADIUS`, measured to the
   bloom, in 3D.
6. Camera follow, area detection, ambience, debug readout.

Two cosmetic systems hang off the bee's position rather than the loop. The
**trail** (`pollinator-trail.tsx`) is a particle pool built the same way as the
weather: a fixed ring of motes dropped into WORLD space at the bee and left
behind, which is what makes it a trail rather than a cloud pinned to her. Its
colour is the player's, kept apart from the accent. The **gestures** (`greet`,
`dance`, `celebrate`) live in a ref the model reads, off the render path; a
successful pollination bumps a session cue that fires `celebrate` once the panel
that was covering the bee has closed, so the dance happens where it can be seen.

**Ambient life** (`ambient-life.tsx`) is a third system of the same shape, and it
is a sibling of the bee, not a child: it reads nothing back from the player,
because ambience does not chase you. Each cohort (foragers, birds, fireflies from
`data/ambient.ts`) is one `InstancedMesh` with a fixed pool mutated in place in
`useFrame`, and its homes are seeded from `hash` so the same bees are over the
same meadow every visit. Which cohorts exist at all is decided by the cohort's own
`active(phase, weather)` predicate, so the set is rebuilt only when the hour or
the sky crosses a boundary, never per frame. The whole thing follows rule 9: no
`Math.random`, so the park is populated identically every visit and a test can
assert what is out at a given hour.

### Field notes are a pure module

`world/field-notes.ts` is the "what is out today" card, and it is deliberately a
pure function with no React and no store: it takes a park, a `Daylight`, a
`Weather` and the two records it needs off the save, and returns plain notes. That
is why the same words can serve the HUD panel (`field-notes.tsx`) and, later, the
picker, without drifting, and why a test can pin the hour and the sky and read the
copy back. It is the same discipline as `daylight.ts` and `weather.ts`: the logic
lives in a module that can be reasoned about, and the component only draws it.

## Testing

The suite drives a real browser, because **every serious bug in this project's
history typechecked cleanly**. A partial list of what only surfaced when
something actually flew the bee: the mirrored steering, the retina quadrant crop,
the invisible terrain (backface-culled by triangle winding), Safari's dead mouse
look, grass growing on a reservoir, and a preview that rendered nothing at all.

The rule that follows: **assert the thing, not the proxy for it.**

- "The canvas is visible" was true the entire time the preview drew nothing. The
  test reads the pixels back.
- "The label says Rain" would pass if weather changed nothing but a word. The
  test renders the park clear and stormy and compares mean brightness.
- "The music has no drone" cannot be read off a source file. The test taps the
  master output and measures the spectrum.

Test hooks are query params on `/play`, and they exist because the real world is
not reproducible: `?hour=13` pins the clock (half the flowers are shut at night),
`?month=7` pins the calendar (half the flora is out of season in any given month,
and nothing at all is in bloom in January), `?weather=rain` pins the sky (there is
no rain in Pittsburgh today), `?park=schenley` pins the park, `?debug=1` shows the
readout. None of them grant progress.

Two of the weather presets pin something you cannot see by looking up. `?weather=
flush` is a clear afternoon with a soaking five days behind it, and `?weather=dry`
is the same clear afternoon after a dry fortnight. They exist because the fungus
flush is the one thing in the game that is not about the current sky at all: both
presets look identical out of the window, and one of them fills the wood with
mushrooms. There is no other way to drive that from a test.

`?busy=on` and `?busy=off` pin who is on the flowers. Which of them have another
insect working them is a function of the wall clock, so without the pin a test
would have to wait for the meadow to come round to the flower it is standing on,
and would be asserting against a moving target by the time it got there.

`?month=` earns its place the same way `?hour=` did. The suite flies in **July**,
when the most is in bloom at once, except the minigame tests, which pick a month
per game: Frick's shrubs and trees play `seeds` and flower in spring, while its
spikes and umbels play `memory` and flower in summer, so no single month has all
three games available.

One more thing the suite cannot pin: `/offline` takes no query params at all, so it
draws whatever Pittsburgh is really doing. Any assertion about its pixels has to
clear a flat fill rather than a sunny afternoon, or it passes all day and fails at
sunset.

### `setActivePark` is module state in the TEST process too

The world module is a facade over whichever park is active, and `setActivePark`
moves it. That is true inside the browser AND inside the Playwright process,
where helpers like `nearestPlantToSpawn` read it to work out where to fly.

So a test that moves the park and does not move it back hands the wrong park to
every test after it in the same worker. Those tests then compute one park's
coordinates and fly to them inside another, land on nothing, and fail in ways
that look like anything except the actual cause: a dance that records nothing, a
pollination that never takes, "six visits and not one of them took". It hides
completely when you run one test by name, because that skips whatever did the
moving.

Every file that moves the park now ends each test with
`test.afterEach(() => setActivePark("frick"))`. Four of the six were missing it,
two of those long-standing. It is worth knowing how badly this reads from the
outside: it produced a hundred failures in one project and looked exactly like a
loaded machine, and a run genuinely starved at the same time made that story fit
well enough to survive a first look.

### Telling a regression from a tired machine

A full run is three projects of about 250 tests each, and on a loaded machine
some of them fail for reasons that have nothing to do with the code. The
difference is worth stating, because getting it wrong has cost this project both
ways: a whole afternoon chasing a hundred phantom failures, and separately a
real bug nearly waved through as noise.

**A regression fails in every project, reproduces on its own, and fails the same
way twice.** The copy change that broke the field notes card failed in Chromium,
Firefox and WebKit, at the same assertion, every time.

**A tired machine fails one test per run, a different one each time, and passes
in isolation in twenty seconds.** WebKit in particular hangs on `page.goto` into
`/play` under sustained load: the navigation never completes, the whole test
budget goes with it, and the same test is fine on its own in half a minute. It
has done this twice in different tests.

So the first question about a failure is not what it says, it is whether it says
it again. Runtime is the cheap tell: a full project is about twenty-six minutes,
and a run that has taken two hours is reporting on the machine rather than on
the code.

### The suite has a real account in a real database

Tests mint session cookies directly, which is the right way to reach the signed-in
paths and means the app cannot tell an invented player from anybody else. That is
the point, and it has two consequences worth stating.

The first is that **a test needing an account has to create one**, through
`registerAccount` in `e2e/helpers.ts`, which calls the same `registerSignIn` the
Auth.js callback calls. A signed-in cookie alone leaves no `accounts` row, and
since claiming a username is UPDATE-only it answers 403 rather than creating one.
Two admin tests were passing without this, on a row an older upserting version had
left behind months earlier; a fresh database would have failed both, and it would
have looked like the deploy's fault.

The second is that **invented players are real rows**, so `e2e/global-teardown.ts`
removes them at the end of a run. It matches on `@example.com`, which RFC 2606
reserves so it can never belong to a real person, so it cannot reach a player's
account however the suite is run. This mattered more once the admin tool existed:
"Accounts: 10 of 100" is a number somebody acts on, and eight of those ten were
Ada, Bo and other people who do not exist, each holding a seat against the ceiling.

`playwright.config.ts` loads `.env.local` into the test process before any spec is
imported. Modules under `src/lib` decide **once, at import time**, whether there is
a database, so without this it came down to import order: `admin.spec.ts` pulls in
`src/lib/env` at the top of the file, which fixed the answer at "no database" before
any helper could set `POSTGRES_URL`, and every account those helpers tried to create
was silently discarded.

### The park changes, and the save is why

Three of the newer systems put things in the world that no scatter produced, and
they share one rule: the world is built from pure data PLUS the player's save,
and the save half is subscribed rather than read once.

- **`world/seedlings.ts`.** A flower that takes sets seed, and the seedling is
  emitted as an ordinary `SpeciesInstance`. That is the whole trick: it needs no
  branch in the field, the discovery sweep, the landing code or the tag, because
  it IS a plant of a species that already exists. It refuses to build for a park
  that is not the active one, because `terrainHeight` is a facade over whichever
  park is loaded and would otherwise plant Schenley's seedlings at Frick's ground
  heights, silently.
- **`world/foragers.ts`.** Who is on which flower, as a pure function of the
  instance key and the wall clock. Deterministic like the scatter, and for the
  same reason. It carries half of an arithmetic contract with
  `data/pollination.ts`, which derives its own failure rate from this one so the
  documented one visit in five stays true.
- **`world/marks.ts`.** Patches somebody danced about. The only part of the save
  that is not monotonic: marks expire after three days, because a dance is about
  where the forage is now.

The scatter is memoised once at mount and these are not, which is exactly the
difference: nothing a player does changes the scatter, and changing the world is
the entire point of these.

**Everything here reads the park you are FLYING, from `activePark()`, never
`currentPark`.** Writers and readers both, which took two passes to get right:
fixing the writers left the renderers filtering by the save's park, so a garden
party drew none of your seedlings and none of the marks anybody danced. They are not the same thing and assuming they were was a real
bug. The scene builds `partyPark ?? forcedPark ?? storedPark` and points the
world module at that, but `currentPark` in the save is only ever written by
`enterPark`: join a party at Highland with a save that says Frick and every seed
you set was filed under Frick at Highland's coordinates, to surface in the wrong
park in a nonsense spot or vanish into the waterline check, silently. The store
now takes the park from the world rather than accepting it from a caller, so
there is no longer a parameter two call sites can each get wrong, and the two
components that draw this state read `activePark()` directly. They may read it
rather than subscribe because `R3FViewport` is keyed on the derived park, so the
whole tree remounts when it changes.

The seedling record also has a real cap, and the cap has to survive a sync. The
first version of the cloud merge spread one save over the other and returned it,
so two devices each sitting at the limit came back with twice the limit: syncing
was itself the way around the bound. `mergeSeedlings` owns both the tie-break
and the trim, so there is one set of rules rather than two that can disagree.

### A save is allowed to be older than the code

Species, parks and badges are data, so any of them can be removed, and a save
written before that removal still names the thing. `/api/progress` also stores
whatever JSON it is handed, so a bad value is not only a hand-edited
localStorage away.

Every read of saved data against a registry therefore has to survive a miss, and
three of them did not:

- **A seedling naming a species that is gone** is skipped rather than crashing
  the scatter. This one was written that way from the start and is the reason
  the other two were found.
- **A mark naming a park that is gone** used to reach `PARKS[id].label`, and the
  marks tab is a LIST: one stale row took the whole journal page down rather
  than rendering one odd line.
- **A save naming a park that is gone** used to do the same on `/play`.
  `setActivePark` has always fallen back to Frick, so the terrain built
  perfectly and then the loading title threw. The world was fine and the page
  was white.

The last two now read the world back rather than the save, which is the same
move the seedlings and the marks already make for the park they record against:
whatever is actually under you is what should be named on screen. Both have a
test that seeds a save naming a park that does not exist and asserts nothing
throws.

### The park unlock is a pinned number, not a fraction

`requires` used to say `fraction: 0.5` and the threshold was computed against
however many plants that park currently had. That makes the door move every time
a species ships: the day three plants landed in Frick, every player halfway
through it would have been told they now needed nine flowers instead of eight,
having done nothing wrong.

It is a count now (Frick 8, Schenley 7), pinned to exactly what the fractions
produced on the day it changed, so nobody's progress moved by a single flower.
Adding content is free from here.

## Garden parties

Three standing rooms, one per park, up to ten players in each. Nobody creates
one: a party you have to arrange is a party that never happens, and a lobby full
of abandoned rooms is worse than no lobby.

**The room server is a relay and a referee, never a database.** It holds who is
here, where they are flying, and nothing else, and it never touches storage.
That is one decision serving three purposes at once. Chat that is promised to
vanish has actually vanished, rather than living on in a log. There is nothing
to moderate a backlog of. And a Durable Object that never writes stays inside
the free tier by construction rather than by watching a dashboard.

### Two gates, neither trusting the other

The browser cannot read its own session cookie: it is httpOnly, and the party
server is a different host anyway. So `/api/party/ticket` mints a five-minute
JWT signed with the same `AUTH_SECRET`, and the room verifies it on the far
side. `/parties` also refuses to render without a session, but **that page is
the courtesy, not the enforcement.** The socket is the enforcement, and
`party.spec.ts` proves it by opening one with no ticket at all.

The five minutes is why the client hands partysocket a **function** rather than a
ticket. It calls that function on every connection attempt, so a fixed value meant
every reconnect after the first five minutes presented an expired pass and was
refused forever, against a server that was perfectly healthy, with a page reload
the only way back. From the console it looks exactly like a broken server.

Fetching per attempt then raises the opposite question: when to stop asking. A 401
or 403 is a settled fact (signed out in another tab, or an account deleted
mid-session) and asking again in four seconds gets the same answer, so the client
gives up and says so. Anything else, including a network failure or a 500 from a
deploy mid-flight, is a bad moment rather than a verdict and is worth retrying.
Getting this wrong is not a broken feature but a quiet one: a tab left open all
afternoon, spending a Worker request and a serverless invocation per attempt, on a
free tier, to be told no every time.

`onBeforeRequest` guards the room NAME, in the lobby, before the room object is
addressed. Without it `GET /parties/garden/<anything>` answered 200 and brought a
Durable Object into being for whatever name was asked for, so an unauthenticated
stranger with a for-loop could mint unbounded rooms on the account. There are
exactly three parties and the names are a closed set.

### A party does not require the park to be unlocked

Highland is earned by learning Frick when you are playing alone. Being invited
somewhere is not the same as earning it, and a friend saying "come to Highland"
should not be answered with a locked door. What you find there counts toward
your own save, which is what makes the invitation worth accepting.

### One seat per account

Not per socket. A second tab replaces the first rather than taking a second
chair, and the older socket is hung up on: a tab that keeps its connection after
being replaced is a bee standing in the park that never moves again, holding a
seat nobody can use. The seat map is keyed by account, which is what actually
provides the guarantee, and the test bites when that keying changes.

The cap is ten because the voices are a full mesh, and a mesh is the right shape
at ten and the wrong shape at fifty. The eleventh is **told** `full` and then
closed: a silent refusal is indistinguishable from a flaky network, and the
client would sit reconnecting into a wall forever.

### Presence: poses are not React state

Every player broadcasts a pose on the frame loop's existing 0.15s tick, about
seven a second, and the other clients ease between them. Sixty a second would be
nine times the traffic for a smoothness nobody can see, and on a free tier the
traffic is the bill.

They arrive in a plain `Map` that the frame loop reads directly, never through
`setState`: nine players at seven updates a second is sixty-odd renders a second
of a HUD that draws none of it. Same reason the rest of the scene keeps
per-frame values in refs.

**The first pose is a placement, not a movement.** A `join` carries no position,
so between somebody arriving and their first update there is a bee with nowhere
to be. Easing from the group's default put them at the world origin and flew
them 240 units across Frick to where they really were, every time anybody
joined. Now the bee is not drawn at all until a pose arrives. Briefly absent is
honest; somewhere they are not is not.

### Chat forgets, and the server never knew

Messages are relayed and dropped. Nothing is stored server-side, so a latecomer
is sent no history, and `party.spec.ts` proves that from a fresh socket, which is
the only vantage point that can tell "kept no history" apart from "kept it and
did not send it". The sixty-second expiry is then a client tick over `seenAt`.

**Typing must not fly the bee.** Every letter of "wasd" steers and the scene
listens on window. The input stops its own events from reaching the window, and
`keyboardIsTaken()` covers what that cannot: holding a key, clicking into the
chat, and having the release swallowed so the bee flies on forever. That
function is the single definition, because the same question is asked in five
places and `|| chatFocused` at each of the five is exactly the drift that lost
`pollinatorPreviewOpen` once already.

The controls panel defaults to collapsed in a party. It is a tall column in the
same corner the chat needs, and in company the conversation is the more useful
thing to have there. A starting position, not a rule: open it and it stays open.

### Proximity voice is a mesh, and nobody offers blind

Voices go browser to browser over WebRTC. The party socket carries offers,
answers and ICE and nothing else, so no conversation passes through Cloudflare
at all: a privacy property and a free-tier property in one decision. A full mesh
is the right shape at ten and the wrong shape at fifty, which is another thing
the seat cap is buying.

Distance is a plain `GainNode`, not a `PannerNode`. The camera sits behind the
bee, so head-relative stereo would put a voice hard left of a listener facing the
other way; the only thing worth saying is who is close enough to talk to. Full
volume inside 12 units, silent past 70, squared in between because loudness is
not linear in distance. Gains are ramped rather than assigned, or flying past
somebody clicks.

**Nobody offers to a peer who has not said their microphone is on.** This is the
subtle one. Offering blind delivers the offer to a client that has not registered
an RTC handler yet, so it is dropped, and the glare tie-break then stops the
other side from ever offering back: whoever unmuted **second** was connected to
nobody. Silence is exactly what working voice chat looks like, so nothing about
it seemed wrong. So unmuting announces to the room, an announcement is
acknowledged, and only then does the lower id offer.

Both unmute orders are tested, and only one of them was ever broken. The suite
runs Chromium with a fake microphone (`--use-fake-device-for-media-stream`) so
the whole path is real: offer, answer, ICE, and a live inbound audio track. The
assertion is the track, not the offer, because signalling that completes and
carries no audio is the failure you cannot hear in a test.

### The party games are hosted as tables

The room holds a LIST of tables rather than "the current game", because several
at once is the point: two people can play Leaf Turn in the corner while five
others write Field Notes.

**The room referees every move.** A board each browser works out for itself is a
board two browsers can disagree about, and the first disagreement is
unrecoverable because neither side is wrong by its own reckoning. Every rules
function returns null for an illegal move, so the server's handler is "apply it,
and if nothing comes back, nothing happened": a malformed move from a broken
client and a cheat from a clever one take exactly the same path. The board greys
out what it cannot play using the SAME functions, because two implementations of
"is this legal" would eventually disagree and the one the player sees would be
the wrong one.

Tables are never stored, like everything else here. **What makes that safe is
the pose stream**: every player broadcasts about seven times a second for as long
as their tab is open, so an occupied room is never idle and never evicted, and a
room only hibernates once it is empty. That does mean presence traffic is
load-bearing for the games. If poses ever stop while somebody is still
connected, a Field Notes round would quietly vanish during its own writing phase.

Field Notes gets one alarm for the whole room, set to the earliest deadline any
table has. One rather than one per table, because a Durable Object gets one and
because a timer per table is a timer per table to leak. The board games have no
clock at all: a turn timer on a friendly game of noughts and crosses would invent
a pressure nobody asked for.

**You leave a table by standing up, not by winning.** Filtering finished games
out of "the table you are at" meant the board vanished the instant somebody won
and the panel snapped back to the lobby, so the one thing you were waiting to see
went by in a single frame.

### Working one flower together

Two or more bees landed on the same stalk play one board. Keyed by the scatter
INSTANCE, not the species: two players on two different black-eyed susans forty
units apart are doing two different things, and joining them would be baffling.

Finds are opaque tokens whose meaning is the game's own business, a matched
floret or a word made. The room keeps the set and passes it around without
knowing what any of it means, which is what lets a game pick its own currency
without the protocol learning about it.

**One roll, not one each.** Drawn when the session opens and used by everybody,
so two people who did the same work on the same flower are told the same thing
about it. Per-player rolls would also quietly change the failure rate the whole
game is built on: "at least one of us managed it" is a different number from
"one visit in five comes to nothing".

**The seeds game is deliberately not co-operative.** Memory and anagram are
shared-progress games where a floret matched by anybody is matched, so
co-operating changes nothing about what they mean. Seeds is a dodge: its score
is what survives the hits, and pooling that makes a careful player's outcome
depend on a stranger's reflexes, which is rule 3's punishment-for-failure in
another coat. A tree is worked alone even in company, and an honest asymmetry
beats inventing a co-operative dodge the game does not otherwise have.

The party picker carries URL params through to `/play`, so `?debug=1&hour=12`
survives joining. Without it a party is the one place in the game the test hooks
cannot reach, which is also the one place hardest to reach by hand.

### The head-count is CORS-open

Deliberately, and safely: the only thing behind it is how many bees are in a
public park. It has to be, because the lobby polls it from the browser and the
party server is a different origin. This was missed first time round and failed
silently, because the picker swallows a dead party server rather than putting a
red box on a page whose other job is to show you three parks. Node-side tests
passed the whole time; only driving a real browser found it.

## Pocket and the camera

`/pocket` is the surface that does not need the park: a fact of the day, a box
you can type questions into, and an AR viewfinder that stands your pollinator in
the room you are in.

### The gate that is not a gate

It is the only page that reads the session itself instead of calling
`requireSignIn()`, because that helper is all or nothing and this page has a real
signed-out mode. `src/app/pocket/page.tsx` does `await auth()` and hands
`signedIn` down as a prop, alongside `authConfigured` from env, the same way
`/profile` does. Signed out you get the camera, the default bee and the badge,
and no dead sign-in button in local mode. It is deliberately absent from the
gated-route loop in `pages.spec.ts`, and there is a test that says so out loud so
the absence reads as a decision rather than an oversight.

### Camera passthrough, not WebXR

WebXR AR does not exist in iOS Safari, and an AR feature that does not work on an
iPhone is not an AR feature. So: `getUserMedia({ video: { facingMode: { ideal:
"environment" } } })` into a plain `<video>`, a transparent WebGL canvas over it,
and the two flattened into one JPEG on the shutter.

`ideal` rather than `exact`, so a laptop with no environment-facing camera falls
back to the one it has instead of throwing.

**The video is an HTML element, not a `THREE.VideoTexture`.** The browser
composites video natively for free, so a mid-range phone spends its GPU on the
bee rather than uploading thirty texture frames a second; the capture wants the
raw frame anyway and `drawImage` takes it at full intrinsic resolution rather
than at whatever the GL viewport happens to be. The cost is that the two layers
can be a frame apart in the photo, which does not matter for something hovering
in place.

### The second GL root

`ar-camera.tsx` repeats the root lifecycle from `pollinator-preview.tsx` rather
than sharing it. Read that file first: `extend(THREE)` at module scope, create
the root ONCE with an empty dependency array, push prop changes in with a second
`root.render`, defer the teardown past React's development double invoke, and
never touch `canvas.width` / `canvas.height`. All four are load-bearing and all
four are repeated here.

What differs is that this one passes `gl: { alpha: true }` and draws **no**
`<color attach="background">`, so the camera shows through. Extracting a shared
`useR3FRoot` would save forty lines and put the working Customize page at risk to
do it. Worth doing if a third surface appears, not for the second.

The canvas is `position: absolute; inset: 0` for the same reason as the preview,
and the stage supplies the height. That height is `aspect-ratio: 3 / 4` rather
than a `vh` figure: a viewport-relative height is zero in any context where the
viewport has not been laid out, and a zero-height box means three configures a
zero drawing buffer and the viewfinder is an invisible nothing with no error
attached. A ratio cannot be zero while the box has a width.

### The badge is in the scene, not on the photo

Signed out, the game's name and tagline hang under the character as a plane with
a `CanvasTexture` on it, parented into the same group, so it moves and scales
with the bee and appears in the photo because the scene appears in the photo.
Drawing it on at capture time would mean it followed nothing, and the player
would not see it until after the shutter. `meshBasicMaterial`, not lambert: a
label that dims with the scene lighting is a label somebody cannot read.

Both lines are copy that already ships. There is no text mesh library here and
drei's `Html` renders DOM outside the canvas, so it would be absent from exactly
the thing it needs to be in.

`roundRect` is feature-detected and falls back to a square corner. It is Safari
16.4 and up, and the texture is built inside a `useMemo` during render, so on an
older iPhone a throw there did not cost a rounded corner, it took down the whole
camera view on the one device passthrough exists to support. There is a test
that deletes the method and checks the badge still reaches the photograph.

### The composite

The video is `object-fit: cover`, so what is on screen is a **crop** of the
intrinsic frame, and reproducing that crop is the whole job. A camera that does
not give you the picture you framed is not a camera. The source rectangle is
computed from the video's intrinsic aspect against the box aspect, then the video
is drawn, then the GL canvas over it, then `toDataURL("image/jpeg", 0.85)` at
1080 wide.

1080 at 0.85, not the album's 720 at 0.72. Those numbers exist because
`/api/photos` posts to Postgres under a 400kB ceiling. **The AR photo never
touches the server**, for anybody, so that ceiling does not apply and somebody is
going to look at this one full screen. It leaves through the share sheet first
(the only reliable route to an iPhone camera roll) and a blob-URL download
second, with the image on screen either way so no path is a dead end.

**Copy that is true on one device and false on another is still false copy**,
and this surface has produced three of them, so it is worth stating as a rule
rather than as three fixes.

- Press and hold is a touch gesture, so the hint under a photo is gated on
  `useCoarsePointer()`. A laptop is told where the file went instead.
- Pinch needs two touches, so "drag to turn it, pinch to change its size" is
  gated the same way. A mouse cannot pinch however hard it tries.
- The refused-camera line said "your phone's settings", which is advice about a
  device that is not in the room when the refusal happens on a laptop. It says
  "your browser's settings" now, which is true everywhere.

The gesture hint is tested in both directions in one test, branching on
`matchMedia("(pointer: coarse)")`, so neither half can rot unseen: the desktop
projects assert the sentence does NOT offer pinch and the touch projects assert
it does.

### Giving the camera back

Tracks are stopped on unmount and on `visibilitychange` to hidden. iOS can kill a
backgrounded track outright while the video element keeps showing its last frame,
which looks exactly like a working camera pointed at a photograph, so
`track.onended` drops the state back to a button rather than leaving that in
place.

**Stopping on unmount is not enough on its own**, and this is the subtle one.
`getUserMedia` is a promise, and the thing it waits on is a permission prompt,
which is seconds rather than milliseconds the first time somebody visits. Leave
the page inside that window and the ordering is: teardown runs, finds
`stream.current` still null, stops nothing; then the promise resolves into a
component that no longer exists and hands it a live camera nothing holds a
reference to. The indicator light stays on until the tab is closed. So there is
an `alive` ref, set false by the teardown and checked after the await, and a
stream that arrives late is stopped immediately instead of stored. The ref is set
true in the effect body rather than only at declaration, because React's
development double invoke mounts, tears down and mounts again on one instance.

`pocket-ar.spec.ts` drives it by wrapping `getUserMedia` in a delay that stands
in for the prompt, clicking the button, navigating away client side before it
resolves, and then reading `readyState` off the tracks that were handed out.
Client-side navigation on purpose: `window` survives it, so the tracks are still
inspectable afterwards. Without the guard they read `live`.

### Two GL roots on one page

Signed in, Pocket mounts the preview's root and the camera's root at once. That
is fine (browsers allow around sixteen contexts) but it doubles the exposure to
the teardown bug this repository already has a history with, so there is a test
that drives client-side navigation away from Pocket and back four times and then
checks three things: the canvases are still there, they are still **drawing**,
and contexts are not accumulating.

The last one is worth stating precisely, because the obvious assertion is wrong.
Contexts being lost is not a leak: R3F's unmount calls `forceContextLoss`, so one
lost per teardown is the cleanup working, and asserting `lost === 0` fails on
healthy code. A leak looks like `created` climbing while `lost` stays put, until
the browser silently drops the oldest one. So the assertion is
`created - lost === the number of canvases on screen`.

### Testing a camera on a machine that has none

Chromium already carried `--use-fake-device-for-media-stream` and
`--use-fake-ui-for-media-stream` for the party microphone, and the same pair
gives a fake camera. They were added to the `phone` and `tablet` projects, whose
`testMatch` was widened to take the AR spec. Firefox gets the equivalent through
`firefoxUserPrefs`. **WebKit headless has neither and is skipped by name**, with
the reason in the skip message, because a silently empty test is worse than an
absent one.

The refusal paths cannot be reached while the fake-UI flag grants everything, so
they are driven by stubbing `getUserMedia` to reject with a real `NotAllowedError`
through `addInitScript`.

What is asserted is the photograph, not that a button was clickable. The
signed-out shot proves the WebGL layer reaches the file, because the badge is in
that layer and nothing else in a fake camera feed is dark. The signed-in shot
proves the camera reaches the file, because with the badge gone the GL layer is
transparent across that band and only the video underneath can make it bright.
Measured at 0.29 and 0.00 against thresholds of 0.08 and 0.03. And the output is
1080 by 1440 against a 3:4 stage, which is the tripwire for getting the crop
wrong.

## Deployment

Vercel for the game, and one Cloudflare Worker for the room server:

```
npx wrangler deploy
npx wrangler secret put AUTH_SECRET     # the SAME secret the app signs with
```

`NEXT_PUBLIC_PARTYKIT_HOST` tells the browser where that Worker is. It is baked
in at build time, so it belongs on the Vercel project rather than on the Worker
or the test process, and deliberately NOT in `.env.local`: local development
should talk to `wrangler dev`, not to production.

`AUTH_SECRET` must match on both sides. It is the only thing making a ticket
mean anything, and a mismatch does not fail loudly: the app keeps minting
passes and the room keeps refusing them, so parties simply never open.

### The primary domain, and the one variable that pins it

The game is served from **scout-game.3sb.io**.

Nothing in the code knows that. No URL is hardcoded anywhere, the manifest's
`start_url` is relative, and Auth.js infers its own base URL from the request
host on Vercel. Pointing a new domain at the project is genuinely a DNS change
and nothing else.

With one exception, and it is the one that bites. If `AUTH_URL` is set in the
Vercel environment it overrides that inference, and it overrides it everywhere:
every callback Auth.js advertises, and the address it sends you back to after
Google. A domain whose `AUTH_URL` still names the previous one loads perfectly,
plays perfectly, and quietly deposits anybody who signs in back on the old
address. `/api/auth/providers` is where to look; it prints the callback URL it
believes in.

So `AUTH_URL` either names the primary domain or is absent, and absent is the
better answer: unset, Auth.js follows whatever host the request arrived on, which
is right for the primary domain, for a second domain, and for every preview
deployment without any of them being listed anywhere.

Each domain that people actually sign in from has to be registered with Google
as an authorised redirect URI (`https://<domain>/api/auth/callback/google`).
That one does fail loudly, with `redirect_uri_mismatch`.

### Two TypeScript projects

`party/tsconfig.json` exists because `@cloudflare/workers-types` redefines
globals the app also has. Referencing them from one file leaked into the whole
program: the app's own `Response.json()` started resolving to the Workers
signature and an unrelated file stopped compiling. Two runtimes, two configs,
and `npm run typecheck` runs both.

Everything else under `party/` is plain TypeScript with no runtime globals, so
the protocol and the game rules compile under both and are shared by the app,
the tests and the Worker. That sharing is the point: the client cannot disagree
with the server about what a legal move is.

### A close is not a delivery

One real behavioural difference between the two runtimes, and it cost a bug.
One-seat-per-account worked by closing the replaced tab's socket. On workerd a
hibernatable socket goes to CLOSING and the far end never hears the handshake
finish, so a replaced tab sat there believing it was still in the party.

Relying on a transport state was the wrong instinct anyway. The room now sends
`refused: "replaced"` and closes afterwards; being told is the guarantee and the
close is a courtesy on top of it.

Analytics and Speed Insights are first-party, cookieless, and therefore
need no consent banner.

**Do not run `vercel env pull` over `.env.local`.** Vercel marks integration
secrets as write-only, so the pull returns every key with an empty value and
silently wipes working credentials. There is a warning comment at the top of the
file.
