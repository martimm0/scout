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
| 27 | Schenley Park, and a Park abstraction under the world | ✅ Done |
| 28 | Real Pittsburgh weather | ✅ Done |
| 29 | Highland Park, and the difficult flowers | ✅ Done |
| 30 | Customization: earned accessories, the whole colour wheel, a real preview | ✅ Done |

---

## Customization

**Ten accessories, six of them earned.** Four are free, because a new player has
to be able to make the bee theirs on the first screen and before they have done
anything. The rest hang off badges, each tied to the badge it belongs to rather
than handed out in an arbitrary order: the foxfire lantern for finding the thing
that glows, the flying goggles for having been out at every hour there is, the
bronze crown (the same bronze as the panthers on the bridge) for having seen all
three parks.

Locked ones are SHOWN, greyed, naming the badge that earns them. A reward you
cannot see is not a reward, and a player who does not know the lantern exists has
no reason to go looking for the bitter oyster. The rule is enforced in
`updatePollinator`, not only by disabling the button, which also covers the case
nobody clicks: a save arriving from the cloud wearing something this player never
earned falls back to bare rather than taking the whole update down.

**The whole colour wheel, and a hex box.** The swatches stay, because most people
want a good colour rather than a specific one, but they were the only way to
choose: eight body colours existed and no others. The wheel is the platform's own
picker, which brings an eyedropper, keyboard access and localisation for free.

**A real preview.** The customize page used to show a flat drawing under a line
reading "Fly to see the model", which is a strange thing to tell somebody on the
page whose entire job is looking at their bee. It is the actual model now, and it
is the same component the in-game modal uses. One preview: two would drift.

### Three bugs found building it

- **Customization never reached the account.** The autosave lives in the cloud
  sync hook, which was mounted by the scene and the profile and NOT by the
  customize page. Changes went to the store, and to localStorage, and nowhere
  else: you could recolour your bee, pick up another device, and find the old one.
  The test reads the colour back from the SERVER, because a test against
  localStorage would have passed happily the entire time it was broken.
- **The preview never drew.** `createRoot` was called with `[pollinator]` in the
  effect's deps, so every colour change built a second GL root on the same canvas.
  React's development double invoke was enough to trigger it alone. R3F says
  exactly what it thinks of that in a console warning nobody was reading, and the
  canvas rendered transparent while the browser drew a broken-image icon in the
  corner. No errors. It simply did not draw. The root is created once now and the
  bee is re-rendered into it, which is the same fix the main scene already had.
- **`extend(THREE)` is not boilerplate.** It was called at module scope in the
  scene file, so the preview worked for exactly as long as it lived there and
  broke the moment it moved out: "Color is not part of the THREE namespace",
  thrown into a canvas nobody was watching.

---

---

## Three parks

**Highland Park** inverts both of the others. Frick is a wood with a creek at the
bottom of it. Schenley is a lawn with a hollow torn out of it. In Highland the
water is not down in a ravine, it is UP: two enormous walled reservoirs holding
the city's drinking water, a hundred and fifty feet above the Allegheny. You fly
over the rim of a wall and there is a lake on the other side of it, at the top,
where a lake has no business being. Then the ground falls away north to the river,
and that slope is the wildest ground in the park, with the zoo along the edge.

It has **no valley**, which the Park type wanted, because both of the other parks
are organised around a stream in a ravine. Rather than invent a creek that is not
there, its valley is the Allegheny itself, along the bottom edge of the map.

### The difficult flowers

A tenth of each park's flowers will not let you pollinate them until you have
passed their quiz: Frick 2 of 16, Schenley 2 of 14, Highland 2 of 12. They are
hand-picked rather than hashed, because the gate has to mean something. Every one
has a real mechanism a real insect has to learn: milkweed clips its pollen onto
your foot and a small bee can lose a leg in the slot; Dutchman's breeches is
locked and only a bumblebee queen can force it; columbine seals its nectar out of
reach and bumblebees resort to chewing through the side of the spur, which
pollinates nothing; pawpaw is not advertising to bees at all.

The rule lives in the store, not on the button: `startMinigame` consults
`canPollinate` and refuses whoever calls it. The tag over the flower says so from
the air, and passing the quiz lands you back ON the flower rather than dumping you
in the sky.

### Three bugs found building it, all of which failed silently

- **The discovery loop scaled world height.** It computed the bloom as
  `landingHeight * 0.88`, which only works where the ground is at zero. In the
  creek, where the ground is at -70, it put the bloom of a cardinal flower eight
  units ABOVE the top of the plant, and the discovery radius is nine. Every flower
  in every ravine in every park was harder to find than intended. The meadow
  flowers sit near zero and were fine, which is why nobody noticed.
- **The grass scatter still matched Frick's area names.** `pickKind` had been
  fixed; its sibling `scatterGrass` had not, so every area of every other park
  fell through to a default and grew a lawn. In Highland that put grass on the
  surface of the city's drinking water.
- **`?park=` was a hand-written whitelist** of `frick | schenley`, so the day
  Highland was added the link silently loaded Frick instead. It is checked against
  the park registry now.

The unlock chain is declared on the parks themselves (`requires: { park, fraction }`)
rather than as a growing pile of conditionals in the store: Frick opens Schenley,
Schenley opens Highland, and a fourth park is a data change.

---

---

## The park has Pittsburgh's weather

The park already kept Pittsburgh's clock. It now keeps Pittsburgh's sky.

`/api/weather` pulls the current observation for Frick Park's own coordinates from
Open-Meteo (no key, no bill), on the **server**, cached for ten minutes: one
upstream request serves every player rather than one per browser, the observation
only moves every fifteen minutes anyway, and the game makes no cross-origin call
from the player's machine. If it fails, the park gets a fair day, because a
weather service being down is not a reason for the sky to be missing.

`applyWeather` folds the sky into the light rather than replacing it, so a wet
dawn is still recognisably a dawn: dim, pink and miserable, which is exactly what
a wet dawn is. Cloud eats the **direct** sun and leaves the ambient alone, because
a cloud is a diffuser and dimming both is the classic way to make an overcast
scene look like a broken night scene. Rain greys the world down. Fog closes the
park to a few dozen units, which changes how it PLAYS: you have to fly low and
follow the trails, because you cannot navigate by landmarks you cannot see.

Rain and snow are instanced boxes on a treadmill around the bee: a drop that falls
out of the bottom is put back on the top, and the whole volume wraps to follow the
camera, so the park is never drawing weather where nobody is looking. The drops
are boxes rather than points on purpose. At bee scale a raindrop is not a speck,
it is a falling marble bigger than your head, and scale is the whole story here.

The HUD shows the date, the Pittsburgh time and the real conditions. `?weather=`
pins the sky (clear, cloudy, overcast, fog, rain, storm, snow), because on a fine
day in Pittsburgh there is otherwise no way to look at the rain you just wrote and
no way for a test to check it falls.

The test does not merely assert the label changed. It renders the park in `clear`
and in `storm` and compares the mean brightness of the actual pixels, because "the
weather changed a word in the corner of the HUD" is precisely the failure worth
catching.

---
| 28 | Real Pittsburgh weather | ✅ Done |
| 29 | Highland Park, and the difficult flowers | ✅ Done |
| 30 | Customization: earned accessories, the whole colour wheel, a real preview | ✅ Done |

---

## Customization

**Ten accessories, six of them earned.** Four are free, because a new player has
to be able to make the bee theirs on the first screen and before they have done
anything. The rest hang off badges, each tied to the badge it belongs to rather
than handed out in an arbitrary order: the foxfire lantern for finding the thing
that glows, the flying goggles for having been out at every hour there is, the
bronze crown (the same bronze as the panthers on the bridge) for having seen all
three parks.

Locked ones are SHOWN, greyed, naming the badge that earns them. A reward you
cannot see is not a reward, and a player who does not know the lantern exists has
no reason to go looking for the bitter oyster. The rule is enforced in
`updatePollinator`, not only by disabling the button, which also covers the case
nobody clicks: a save arriving from the cloud wearing something this player never
earned falls back to bare rather than taking the whole update down.

**The whole colour wheel, and a hex box.** The swatches stay, because most people
want a good colour rather than a specific one, but they were the only way to
choose: eight body colours existed and no others. The wheel is the platform's own
picker, which brings an eyedropper, keyboard access and localisation for free.

**A real preview.** The customize page used to show a flat drawing under a line
reading "Fly to see the model", which is a strange thing to tell somebody on the
page whose entire job is looking at their bee. It is the actual model now, and it
is the same component the in-game modal uses. One preview: two would drift.

### Three bugs found building it

- **Customization never reached the account.** The autosave lives in the cloud
  sync hook, which was mounted by the scene and the profile and NOT by the
  customize page. Changes went to the store, and to localStorage, and nowhere
  else: you could recolour your bee, pick up another device, and find the old one.
  The test reads the colour back from the SERVER, because a test against
  localStorage would have passed happily the entire time it was broken.
- **The preview never drew.** `createRoot` was called with `[pollinator]` in the
  effect's deps, so every colour change built a second GL root on the same canvas.
  React's development double invoke was enough to trigger it alone. R3F says
  exactly what it thinks of that in a console warning nobody was reading, and the
  canvas rendered transparent while the browser drew a broken-image icon in the
  corner. No errors. It simply did not draw. The root is created once now and the
  bee is re-rendered into it, which is the same fix the main scene already had.
- **`extend(THREE)` is not boilerplate.** It was called at module scope in the
  scene file, so the preview worked for exactly as long as it lived there and
  broke the moment it moved out: "Color is not part of the THREE namespace",
  thrown into a canvas nobody was watching.

---

---

## Three parks

**Highland Park** inverts both of the others. Frick is a wood with a creek at the
bottom of it. Schenley is a lawn with a hollow torn out of it. In Highland the
water is not down in a ravine, it is UP: two enormous walled reservoirs holding
the city's drinking water, a hundred and fifty feet above the Allegheny. You fly
over the rim of a wall and there is a lake on the other side of it, at the top,
where a lake has no business being. Then the ground falls away north to the river,
and that slope is the wildest ground in the park, with the zoo along the edge.

It has **no valley**, which the Park type wanted, because both of the other parks
are organised around a stream in a ravine. Rather than invent a creek that is not
there, its valley is the Allegheny itself, along the bottom edge of the map.

### The difficult flowers

A tenth of each park's flowers will not let you pollinate them until you have
passed their quiz: Frick 2 of 16, Schenley 2 of 14, Highland 2 of 12. They are
hand-picked rather than hashed, because the gate has to mean something. Every one
has a real mechanism a real insect has to learn: milkweed clips its pollen onto
your foot and a small bee can lose a leg in the slot; Dutchman's breeches is
locked and only a bumblebee queen can force it; columbine seals its nectar out of
reach and bumblebees resort to chewing through the side of the spur, which
pollinates nothing; pawpaw is not advertising to bees at all.

The rule lives in the store, not on the button: `startMinigame` consults
`canPollinate` and refuses whoever calls it. The tag over the flower says so from
the air, and passing the quiz lands you back ON the flower rather than dumping you
in the sky.

### Three bugs found building it, all of which failed silently

- **The discovery loop scaled world height.** It computed the bloom as
  `landingHeight * 0.88`, which only works where the ground is at zero. In the
  creek, where the ground is at -70, it put the bloom of a cardinal flower eight
  units ABOVE the top of the plant, and the discovery radius is nine. Every flower
  in every ravine in every park was harder to find than intended. The meadow
  flowers sit near zero and were fine, which is why nobody noticed.
- **The grass scatter still matched Frick's area names.** `pickKind` had been
  fixed; its sibling `scatterGrass` had not, so every area of every other park
  fell through to a default and grew a lawn. In Highland that put grass on the
  surface of the city's drinking water.
- **`?park=` was a hand-written whitelist** of `frick | schenley`, so the day
  Highland was added the link silently loaded Frick instead. It is checked against
  the park registry now.

The unlock chain is declared on the parks themselves (`requires: { park, fraction }`)
rather than as a growing pile of conditionals in the store: Frick opens Schenley,
Schenley opens Highland, and a fourth park is a data change.

---

---

## The park has Pittsburgh's weather

It already kept Pittsburgh's clock. Now it keeps Pittsburgh's sky: the real
observation for Frick Park's own coordinates, pulled from Open-Meteo (no API key,
no bill), fetched **on the server** and cached for ten minutes so one upstream
request serves every player and no cross-origin call is made from anybody's
machine. The observation itself only moves every fifteen minutes, so a fresher
fetch would be asking the same question twice.

This is not a simulation and not a random roll. If it is raining in Squirrel Hill
it is raining in the game. That is the entire point: Scout is meant to be a way to
nerd out about plants when it is raining outside, and a game that answers "it is
raining outside" with a cloudless summer meadow is quietly telling you it is
somewhere else.

**The weather is folded into the light rather than replacing it.** The hour decides
where the sun is; the weather decides whether you can see it. So a wet dawn is
still recognisably a dawn: dim, pink and miserable, which is what a wet dawn is.

Things that are consequences rather than decoration:

- **Cloud eats the sun and NOT the ambient.** A cloud is a diffuser: it takes the
  light out of the sun and spreads it over the whole sky, which is why an overcast
  day has no shadows in it. Dimming both is the standard way to make an overcast
  scene look like a broken night scene.
- **Fog closes the park down.** Visibility drops to a few dozen units, so you have
  to fly low and follow the trails, because you cannot navigate by landmarks you
  cannot see.
- **Rain and snow follow the bee.** A rain volume the size of Frick Park would be a
  million particles with 999,900 of them falling where nobody is looking. It is a
  box around the player, on a treadmill. The drops are boxes rather than points,
  because at bee scale a raindrop is a falling marble bigger than your head, and
  scale is the story this game has been telling from the first commit.
- **The HUD shows the date, the hour and the conditions**, all Pittsburgh's.

`?weather=rain|snow|storm|fog|overcast|cloudy|clear` pins the sky, the same way
`?hour=` pins the clock. On a fine day in Pittsburgh there is otherwise no way to
look at the rain you just wrote, and no way for a test to check that it falls.

The test does not check that the weather was *computed*. It renders the park clear
and then foggy and measures the frame: fog raises mean brightness from 45 to 81 and
collapses the contrast spread from 40.9 to 28.8. That is the assertion that catches
weather which is calculated perfectly and never reaches the renderer, which is the
failure mode that looks fine in the code and blank on the screen.

---

---

## Two parks

Frick was the only park for the game's whole life, and the code said so: the
world bounds, the height function, the creek, the areas and the landmarks were
module-level constants in `terrain.ts`, and every function in `world/` read them
straight out of file scope. A `Park` is data now, and `terrain.ts` is a facade
over whichever one is active.

**Schenley** is deliberately not Frick with different numbers. Frick is a wood
with a creek at the bottom of it, and it asks you to go down into it. Schenley is
a city park: Phipps Conservatory on the plateau in a hundred thousand panes of
glass, Flagstaff Hill mown bare and open where half of Pittsburgh goes sledding,
the Oval's running track, and then the ground simply falls away into **Panther
Hollow**, a hundred feet deep and as wild as anything in Frick, with Schenley
Drive carried over the top of it on a bridge with four bronze panthers on the
corners. At bee scale each panther is the size of a house. Flying the length of
the hollow underneath the bridge is the best thing in this park.

It is **earned**: Schenley opens when you have found half of Frick's plants, eight
of the sixteen. There are two ways in, a picker in the journal and a warp from
inside the park itself, because a park you have earned should be somewhere you can
simply go.

**Species: mostly new, some shared.** Ten plants and four fungi that are Schenley's
alone, and six species that genuinely grow in both. A shared species keeps ONE id,
ONE journal entry and ONE photograph, and carries a list of `homes` rather than a
single area, because goldenrod is goldenrod: it has two addresses, not two
identities, and finding it in one park means you have found it.

### Three bugs this shape would have caused, all of which would have failed silently

- **The collision caches** were module singletons guarded by `if (grid) return;`,
  so the first park to load won for the entire page session. Crossing to Schenley
  would have given you Schenley's terrain with Frick's oaks still solid in the air
  around you: no crash, no error, just a park full of invisible trees. They are
  keyed by park id now. A cache you invalidate is a cache somebody forgets to
  invalidate; a cache you key cannot be wrong.
- **The scatter decided what grows where by matching the string `"fern-hollow"`.**
  Every Schenley area would have fallen through to the mown-lawn case and the
  wildest ravine in the city would have come out planted with clover and acorns.
  An area's ecology is a property of the area, not of its name.
- **Panther Hollow Lake sits inside the valley corridor**, so `areaAt` called it
  "Panther Hollow" and every lake plant placed "at the lake" was rejected for
  standing somewhere else. That is precisely the bug that once left Frick's four
  creekside plants nowhere in the world at all. Parks can now declare **basins**
  that override the valley they sit in, and the same probe that caught it the
  first time caught it again: it asks each park whether every species it claims
  actually exists in the world, and it is run on every change.

Also measured rather than guessed: Panther Hollow's banks run at slope 1.4 to 2.4
where Nine Mile Run's run at 1.0 to 1.3, so the bank slope limit is a property of
the valley. Holding Schenley to Frick's number left seven species in the data and
nowhere on the ground.

---

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

They live **in the player's account**, as a row each in `player_photos`, and are
served from `/api/photos/[id]` so the browser can cache them like any other
image.

There was a version of this that kept them in localStorage, on the reasoning that
the save file is a few hundred bytes of booleans and a photograph is fifty
kilobytes, so the two do not belong together. That reasoning was right about the
*save file* and wrong about the *database*. The save file is one JSONB row read
and written whole on every autosave, so an album in there would be shipped both
ways every time somebody found a flower. The fix for that is a second table, not
a second service. A capped album is under a megabyte, Postgres stores a megabyte
without noticing, and `bytea` is TOASTed out of line automatically, which is
precisely the case it exists for. Blob storage earns its keep on big files, CDN
delivery, and millions of objects, and none of those are true here.

Decisions worth keeping:

- **`bytea`, not base64 text.** Base64 is a third larger and we would pay it on
  every row, forever, for nothing. The bytes cross the wire as hex and come back
  as base64 via `decode()` / `encode()`, because the serverless driver talks HTTP
  and its round-tripping of binary parameters is not worth betting an album on.
- **Its own endpoint, not inlined into JSON.** A URL can be cached. An image
  pasted into a JSON payload is re-downloaded every time the journal is opened.
- **Listing the album does not select the image column.** Otherwise the captions
  drag a megabyte of JPEG through the database behind them.
- **The cap is fifty, and it is a wall rather than a conveyor.** A full album
  *refuses* the photograph and says so. It used to keep the newest twelve and
  drop the oldest off the end, which looks friendlier and is worse: the shutter
  clicks, the flash fires, and a picture somebody flew across the park for is
  deleted without anyone being told. Silent data loss dressed up as a feature.
  Now the player is told, and chooses what goes, having first had the chance to
  download it. Every photograph carries a **Download** link, named after the
  moment it was taken rather than after a UUID, because a photograph you can only
  look at inside somebody else's website is not really yours.
- **The cap is enforced in the INSERT itself**, not by reading the count and then
  writing. Two tabs, or two quick presses of P, would both read forty-nine and
  both insert. A `WHERE (SELECT count(*) ...) < 50` on the insert means the
  database decides, once, and the loser writes nothing.
- **A refusal never falls back to localStorage.** That would route around the cap
  we just enforced and file the photograph somewhere the player will never look
  for it.
- **Ownership is in the SQL**, not a filter after the fact. An id is an
  unguessable UUID, but "unguessable" is not an access control policy: somebody
  else's photograph is a 404 even to somebody holding its id, and there is a test
  that signs in as a second player to prove it.
- **The upload is validated.** It must be a JPEG data URL, under 400KB, and it
  must actually start with the JPEG magic number, because this row is handed back
  out later with an `image/jpeg` header on it.

The local fallback is not a convenience, it is a correctness requirement: on a
fresh clone with an empty `.env` there is no account to own an album and no
database to put it in, so the photographs sit in localStorage and the journal
says so plainly rather than implying they are safe somewhere they are not.

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
