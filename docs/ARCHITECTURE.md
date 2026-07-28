# Scout: architecture

How the thing is put together, and why it is put together that way. For what the
game IS, see [GAMEPLAN.md](GAMEPLAN.md). For how the data is shaped, see
[DATA.md](DATA.md).

## Stack

- **Next.js (App Router), React, TypeScript.** No Tailwind: CSS Modules, and a
  small set of design tokens in `globals.css`.
- **three.js + React Three Fiber + drei.** The scene uses R3F's *imperative*
  root (`createRoot` / `configure` / `render`) rather than `<Canvas>`, because
  the game needs to own its own sizing and lifecycle.
- **Zustand** for game state, with `persist` to localStorage.
- **Auth.js v5** with Google, JWT sessions.
- **Neon Postgres** via `@vercel/postgres`.
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

### 2. Species are specs, not subclasses

Bee, hoverfly and butterfly are three `SpeciesSpec` data objects feeding **one**
shared model component and **one** animation rig. There is no per-species
branching anywhere in the render path. A hoverfly is different because its spec
says two wings and halteres, not because a component checks `if (type ===
"hoverfly")`.

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

`?month=` earns its place the same way `?hour=` did. The suite flies in **July**,
when the most is in bloom at once, except the minigame tests, which pick a month
per game: Frick's shrubs and trees play `seeds` and flower in spring, while its
spikes and umbels play `memory` and flower in summer, so no single month has all
three games available.

One more thing the suite cannot pin: `/offline` takes no query params at all, so it
draws whatever Pittsburgh is really doing. Any assertion about its pixels has to
clear a flat fill rather than a sunny afternoon, or it passes all day and fails at
sunset.

## Deployment

Vercel. Analytics and Speed Insights are first-party, cookieless, and therefore
need no consent banner.

**Do not run `vercel env pull` over `.env.local`.** Vercel marks integration
secrets as write-only, so the pull returns every key with an empty value and
silently wipes working credentials. There is a warning comment at the top of the
file.
