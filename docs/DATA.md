# Scout: data design

What the data looks like, and why. For the code around it see
[ARCHITECTURE.md](ARCHITECTURE.md); for what the game is see
[GAMEPLAN.md](GAMEPLAN.md).

## The principle

The data is the game. Terrain, species, badges, accessories and unlocks are all
declarative, and the code is a small amount of machinery that reads them. Adding
a park, a flower, a badge or a hat should be, and is, a data change.

The second principle is that **every fact is sourced**. Not remembered, not
inferred from a name. Every Wikipedia URL is checked to return 200. Every
photograph's author and licence come from the Commons API rather than from
memory, and `scripts/source-photo.mjs` is how: it fetches the credit, REFUSES
any licence outside Public Domain, CC0, CC BY and CC BY-SA before downloading
anything, and writes the file at the width the rest of the set uses. That script
was described here long before it existed in the repository, which meant the
next person to add a species had the choice of doing it by hand from memory,
which is exactly how a wrong attribution gets in.

When a claim cannot be verified it does not ship, however good a line it would
have made.

A test now asserts the other half: no species ships without a photograph, and
every credit carries an author, a usable licence and a Commons file page. Three
species shipped with none at all and nothing noticed, because an entry with no
figure renders perfectly well and reads as a design choice rather than a hole.

The licence gate itself is tested too, in both directions, because it is one
regular expression standing between the project and shipping somebody's
photograph against their terms. It has to refuse the non-commercial and
no-derivatives variants, which begin with the same four characters as the ones
that are fine, and it fails CLOSED: a template id rather than a short name, or
an empty string, is refused rather than guessed at. Dropping the negative
lookahead makes the test say `CC BY-NC 4.0 was accepted`, which is how we know
it is checking anything.

The facts that slip through are the ones nothing checks, and the parks' own
**coordinates** were the clearest example. Frick's were 40.4406, -79.9959 from the
day the weather shipped, which is not Frick Park: it is about eight kilometres west
of it, near downtown. The game claimed in two files to be reading "Frick Park's own
coordinates" and was reading somebody else's sky, and nothing ever looked wrong,
because Pittsburgh's weather is Pittsburgh's weather. A remembered number that is
merely plausible is the hardest kind of wrong to notice, which is why the
coordinates now live in one place, carry their source, and have a test.

## Species

One shape for plants, one for fungi, and they differ only where the biology does.

```ts
type Plant = {
  id: string;                  // kebab-case, unique across plants AND fungi
  commonName: string;
  scientificName: string;
  homes: Home[];               // where it grows. See below.
  bloom: string;               // "June to August"
  window: TimeWindow;          // the hours it is actually open
  hook: string;                // one line, for the card in the world
  fact: string;                // the full story. Two or three sentences.
  pollinatorNote: string;      // why a pollinator cares
  wikipedia: string;           // verified 200
  demanding?: string;          // if set: pass the quiz before you may pollinate
  winter?: string;             // what it looks like bare, IF that can be sourced
  archetype: PlantArchetype;   // which voxel builder draws it
  bloomColor, leafColor: string;
  height: number;              // world units before scale
  count: number;               // how many to scatter
};
```

`Fungus` is the same with `season` instead of `bloom`, `roleNote` instead of
`pollinatorNote`, `edibility`, an optional `glows`, and no `demanding` (nothing
pollinates a mushroom).

### `homes`, not `area`

```ts
type Home = { park: ParkId; area: AreaId };
```

A **list**, because a species can genuinely grow in more than one park.
Goldenrod is goldenrod: it is in the rough at Frick and on Flagstaff Hill at
Schenley, and it is the *same organism*. One id, one journal entry, one
photograph, two addresses. Finding it in either park means you have found it.

This was originally a single `area: AreaId` and the union type named Frick's six
areas, which meant a second park's areas could not be typed at all. `AreaId` is a
bare string now. Area ids are globally unique by construction: they are real
place names, and there is no Panther Hollow in Frick.

### The handful that are demanding

Two flowers in each park refuse to be pollinated until you have passed their
quiz: 2 of 17 in Frick, 2 of 15 in Schenley, 2 of 13 in Highland, so somewhere
between one in eight and one in six.

It began as a flat tenth and has drifted up as species were added without adding
gated ones, which is fine at this size and worth watching: the point is a
handful per park, not a ratio. `pages.spec.ts` holds it between a twentieth and
a fifth rather than to a number, because you cannot gate six tenths of a
milkweed.

They are **hand-picked, not hashed**, because the gate has to mean something.
Every one has a real mechanism a real insect has to learn: milkweed's pollinia
clip onto a foot and a small bee can lose a leg in the slot; Dutchman's breeches
is locked and only a bumblebee queen has the strength and the tongue; columbine
seals its nectar out of reach, so bumblebees chew through the side of the spur
and pollinate nothing; pawpaw is not advertising to bees at all. A naive insect
fails at these.

The `demanding` string is the reason, shown to the player when the button is
inert. The test on the share has already caught two mistakes: a shared species
counted against both its parks, and a whole park shipping at 0%.

`canPollinate(state, plantId, month)` is where both gates live, the quiz and the
bloom, and `startMinigame` consults it rather than trusting the button. The month
is a required argument on purpose: it arrived late, and while it was optional an
omitted month meant "any month", which is precisely the silent yes the function
exists to refuse.

## Time

```ts
type TimeWindow = { from: number; to: number; note: string };
```

Fractional Pittsburgh hours. A window that wraps midnight is written that way
(`{ from: 20, to: 5 }`) and `isActive` handles it, which the overnight fungi need.
`note` is what a locked journal entry says, so a closed flower tells you when to
come back instead of just refusing.

The windows are true to life rather than balanced:

- `EPHEMERAL` (6 to 14): woodland spring ephemerals genuinely close by
  mid-afternoon. Also Ohio spiderwort, whose flower lasts one morning.
- `DAYLIGHT` (7 to 19): most of what flowers. Shut after dark.
- `NIGHT` (19 to 6): the evening primrose, the jimsonweed and the
  night-flowering catchfly, which open as the light goes and are finished by
  morning. This is the window that wraps midnight.
- Fungi have their own: `DAWN`, `DAY`, `NIGHT`, `DUSK`.

**This section used to end by saying that after dark nothing is pollinatable
anywhere and only fungi are out.** That was true for as long as every flower
was a daylight flower, and the night flora made a liar of it: there are three
species you can only work after dark, one per park, and they are the reason the
moths exist. A park with a night flora is a different park after dark rather
than the same park with the lights off.

### The flush: last week's weather, not today's

`Weather.recentRain` is the only part of the sky that is not "right now": ten days
of daily rainfall, oldest first and today last. It is there for the mushrooms.

Fungi fruit **two to ten days after significant rainfall**, not during it. The
mycelium has primordia built and waiting underground and the rain inflates them,
which is why a wood can be bare on the day of a storm and thick with mushrooms the
following weekend. The lag is sourced ([Mass Audubon](https://www.massaudubon.org/news/latest/rainy-days-bring-a-burst-of-mushrooms));
the rainfall **threshold** is not, and the difference is worth keeping straight.
No source puts a millimetre figure on "significant", so `fungusFlush` calls it ten
millimetres across the window to start and forty to top out, and says in the code
that this half is a game judgement.

This is the only mechanic in the game driven by weather that has already gone, so
the field notes have to say so out loud: a player has no way to know that today's
clear sky is the good mushroom day rather than the wet one that made it.

**The flush is additive, and that is load-bearing.** The extras are a second,
disjoint set of mushrooms with a `flushAt` threshold each, laid out at scatter time
and simply not standing in the wood below it. Nothing that exists in a dry spell
can be taken away by the weather. Gating real fungi behind rain would be the season
soft-lock again with a worse trigger: a player can wait out April by playing on,
but cannot make it rain, and "Three Parks, One City" wants every fungus found.
`flush.spec.ts` asserts every fungus is findable dry in all three parks, and that a
flush is a strict superset.

The extras are placed on their own **seed channel**, which is not an implementation
detail: `place` folds the count into its sampling, so asking it for twice as many
spots deals a different hand entirely and moves every mushroom already in the wood.
The base scatter is byte-identical with the flush in place.

### Rare weather moments

`world/weather-moments.ts` is six skies the journal remembers you were out in:
thunder, fog, snow falling, a hard freeze, a real downpour, and the wood flushing.
They live in `seenWeather`, monotonic and unioned through cloud sync like every
other discovery.

Three rules make them worth having, and all three are about restraint.

**Never a roll.** A moment is the real observation. If it has not thundered over
Frick Park while somebody was flying, nobody has the thunderstorm, and no amount
of playing produces it. That is the whole value: it is evidence of a real
afternoon rather than a thing you ground out.

Which is why **a pinned sky earns nothing**. `?weather=storm` is a test hook, the
hooks are documented to grant no progress, and without that guard the entire set
could be minted from the URL bar in a minute. `ScoutScene` takes a `weatherIsReal`
flag for exactly this, and `weather-moments.spec.ts` fails if the guard is removed.

**Nothing is gated behind one.** They earn two badges and fill a page. No species,
park or plant is ever behind a moment, because a player cannot make it rain and the
game must never ask them to.

### Winter identification

In summer the card over a plant tells you what it is, and it should: you cannot
look a flower up if you do not know it is called anything. In winter it stops. The
card says "Winter form", withholds the name, and landing offers you the question
instead.

**The evidence is structural, and that is a sourcing decision rather than a design
one.** The obvious version of this identifies by twig and bud, and it cannot be
built honestly here: Wikipedia is an encyclopedia of the plant rather than a winter
key, and it carries a real winter character for three of these species and nothing
at all for the rest. The USDA profiles that would have it render their content in
JavaScript. Rule 1 says a fact that cannot be sourced does not go in, so the other
twenty are not invented. `Plant.winter` holds the three that are documented
(redbud's zigzag black twigs and hanging pods, pawpaw's two kinds of bud, spicebush
grey and citrus when snapped) and is absent everywhere else.

What the question asks from instead is what the game already knows for every
plant, sourced and already drawn: how it is built, how tall it stands, and the
habitat it stands in. That is also how winter identification actually works.

`standsInWinter` decides who takes part, structurally rather than per species:
woody, or carrying a sourced winter character, or a stalk taller than the bee that
was still flowering in September. It is deliberately conservative and has known
false negatives, milkweed and purple coneflower among them, whose pods and cones
plainly do stand. Leaving one out costs a question. Putting one in that has rotted
away by December would have the game asking about a plant that is not there, which
is the error that matters. The spring ephemerals are excluded and must stay
excluded: trout lily and bloodroot are not dormant in January, they are gone.

The question only appears for a plant you have **already met in leaf**, which
keeps it a second pass rather than a wall for anybody who started playing in
winter. Getting it wrong costs nothing; the stalk stands there all season.

**Everything on the way in has to keep the same secret**, and this is easier to
get wrong than it sounds. The tag withheld the name and the landing card then
announced it in its own title, and again in the not-in-flower note, so pressing
Space handed over the answer before the question had been asked. In winter every
standing plant is out of bloom by definition, so that note is not an edge case, it
renders every single time. A test that checks only the tag passes through all of
it happily.

Reading the entry still names it, and so does taking its quiz, and both stay. The
game does not withhold what it knows; a locked entry that says nothing teaches
nothing, and a single-player game with no leaderboard has nobody to cheat. The
line is between a **leak** and a **lookup**: the landing card naming the plant in
its own title was something the interface did to you, and pressing Read is
something you chose. Only the first is a bug. Next to the question the button says
**Look it up instead**, so at the moment the choice actually arises it is named as
one.

A popover has to be **leavable**. The winter panel has no close button until it
has been answered and `inputSuspended` counts it as a pause, so with no key
handler the only way out of the question was to guess: somebody who opened it
meaning to go and read the entry first was held in a frozen park until they did.
Escape leaves it, the way Escape leaves every other popover here, and leaving
records nothing.

And a popover has to leave **one layer at a time**. The landing card is the only
popover something else can be stacked over: quiz, minigame and winter question
all clear `landedOn` on the way in, but the entry deliberately leaves it set, so
that closing the entry puts you back on the plant you are standing on. Escape
used to break that. The scene and the card each hold a window keydown listener,
both fired on the one keypress, and closing the entry also took off: the player
who chose Look it up instead came back to open air and had to find the plant and
land on it all over again. The card's listener now stands down while the entry is
open on top of it. The trap in testing this is that the store re-renders through the
`useSyncExternalStore` that Zustand subscribes with, which flushes
synchronously, so merely mentioning
`ui.activeEntry` in the effect's dependencies makes the cleanup remove the
listener mid-dispatch and the second handler silently never runs. That masks the
bug rather than fixing it, which is why the guard is the early return and not the
dependency array.

`askingWinterName` is the single definition of "this plant is asking to be named",
and it is a single definition on purpose: the card in the world withholds the name
when it is true and the landing menu offers the question, in two different files.
Written out twice they drift, and the failure is quiet rather than loud, a card
that hides the name with no way to answer it. The frame loop kept its own copy of
"is a popover open" for the same reason and it drifted within weeks.

### Temperature: Celsius stored, Fahrenheit shown

`Weather.temperature` is **Celsius, always**, and every temperature on screen is
Fahrenheit. `toFahrenheit` is called at each point of display and nowhere else:
the home banner's ticker, the field-notes sky line, and the Scout Stats panel.

The split is not a preference, it is a correctness rule, because the number is
read by the game's biology as well as by the player. Foragers stay home below ten
degrees (`data/ambient.ts`), the bee shivers below twelve (the `chill` the model
takes), and the field notes' "too cold for most bees to be out" is the same ten.
Those thresholds are real and they are Celsius. Converting at the source, or
converting the local that a rule also reads, moves the temperature at which bees
stop flying to somewhere around minus twelve, and the effect is silent: nothing
throws, the sentence reads correctly, and the rule simply never fires again. The
field-notes function computes a rounded Celsius local for exactly one purpose now
and says so, because that local used to feed both the sentence and the rule.

`field-notes.spec.ts` asserts both halves of one card together, the sky line in
Fahrenheit and the cold note still appearing, since either alone passes straight
through the bug.

## Season

```ts
type SeasonWindow = { allYear: true } | { from: number; to: number };
```

The months something is out, 1 to 12, and like `TimeWindow` it wraps: the
overwintering fungi are `{ from: 9, to: 5 }`, and `isInSeason` handles the turn of
the year. `allYear` is its own case, because a few fungi genuinely fruit in every
month.

The load-bearing decision is that **the season is not new data**. Every plant
already carries a sourced `bloom` ("June to August") and every fungus a `season`
("Autumn to spring", "Late summer to autumn"). `world/season.ts`'s `seasonWindow`
parses those into a month window rather than asking anyone to hand-author a second
copy that could disagree with the first. It reads month names, bare and modified
season words ("late summer", "early autumn"), and "all year". A string it cannot
read falls back to all-year, and `season.spec.ts` asserts every real string parses
so a new one that does not is caught rather than silently shown every month.

`species-scatter.ts` asks **two** questions, and keeping them apart is load-bearing:

- `isOut(instance, hour, month)` is whether it can be **worked**: open at this hour
  and, for a flower, actually in bloom. The Pollinate button asks this.
- `isFindable(instance, hour, month)` is whether it can be **met**: open at this
  hour, and for a FUNGUS also in season. A plant that is not flowering has not gone
  anywhere, so the discovery loop, the motes and the tag ask this one.

They were one function, and that was a soft-lock. Discovery needed the bloom, so
barely half of Frick's plants existed in July, fewer than the eight Schenley
opens on: a player starting in the wrong month could never progress. `season.spec.ts`
now walks all twelve months and asserts every plant stays findable in each, which is
the check that was missing. A plant out of its month is still drawn, drab and
closed; a fungus out of its season really is gone, because mushrooms rot away.

The suite pins `?month=7`, July, because midsummer is when the most is in bloom at
once.

## Parks

```ts
type Park = {
  id: ParkId;
  label: string;
  blurb: string;
  requires?: { park: ParkId; fraction: number };   // what it costs to unlock

  world: { minX, maxX, minZ, maxZ };
  waterLevel: number;
  ceiling: number;
  start: [number, number, number];

  areas: Area[];                    // partitioned by nearest centre
  valley: {                         // the water corridor. Overrides the uplands.
    area: Area;
    halfWidth: number;
    centreLine: (z: number) => number;
    bankSlopeLimit: number;
  };
  basins?: { area, center, radius }[];   // override even the valley

  height: (x, z) => number;
  landmarks: Record<string, [number, number]>;
  trails: ((t: number) => [number, number])[];

  biomeColor: Record<string, string>;
  biome: Record<string, Biome>;     // what KIND of place each area is
  density: Record<string, number>;  // how thickly planted, 0 to 1
};
```

Four of these fields exist because of a bug, and each is worth understanding
before touching this file.

**`biome`** exists because the scatter used to decide what grows where by
matching the literal string `"fern-hollow"`. Every area of every other park fell
through to the mown-lawn case, so the wildest ravine in the city came out planted
with clover, and Highland grew a lawn on the surface of the city's drinking
water. An area's ecology is a property of the area, not of its name.

**`basins`** exist because Panther Hollow Lake sits *inside* the valley corridor,
so `areaAt` called it "Panther Hollow" and every lake plant placed "at the lake"
was rejected for standing somewhere else. Basins override the valley they sit in.

**`bankSlopeLimit`** exists because the banks differ per park, measurably:
Panther Hollow runs at slope 1.4 to 2.4 where Nine Mile Run runs at 1.0 to 1.3.
Holding Schenley to Frick's number left seven species in the data and nowhere on
the ground.

**`waterLevel` is one plane per park**, and therefore has to be the *lowest*
water there is. Aiming Highland's at Lake Carnegie put it sixty units above the
river flats and drowned the whole floodplain: 17% of the park came out as open
water against 6% in Frick. The reservoirs and Lake Carnegie carry their own water
inside their models, which is the only way to have a lake on top of a hill.

The lesson those four share: a park is not "Frick with different numbers", and
any rule that reads a park's *names* rather than its *properties* will be wrong
the moment there are two.

### The unlock chain

Declared on the park, not in the store: Frick opens Schenley (8 of Frick's
plants), Schenley opens Highland (7 of Schenley's). Those are PINNED COUNTS
rather than fractions of however many plants a park currently has, which is the
whole point: a fraction moves the door every time a species ships, so the day
three night bloomers landed, everybody halfway through Frick would have been
told they now needed nine flowers instead of eight, having done nothing wrong.
The numbers are what the old fractions produced on the day they were pinned, so
nobody's progress moved by a single flower. A fourth park is a data
change.

## The save file

One JSONB row per player in `player_progress`, deliberately tiny: everything is a
boolean keyed by id or a small counter, so the whole thing serialises to a few
hundred bytes and an unknown key simply is not set. There is nothing to migrate
when a plant or badge is added.

```ts
type SavedProgress = {
  pollinator: {...};              // name, species, colours, accessory, trail + its own colour
  discoveredPlants, discoveredFungi, quizPassed: Record<string, boolean>;
  pollinatedPlants, unlockedMapAreas, unlockedParks: Record<string, boolean>;
  unlockedBadges, unlockedJournalEntries, seenPhases: Record<string, boolean>;
  stats: {...};
  tutorialSeen: boolean;
  savedAt: number;
};
```

Not normalised into tables on purpose. A schema of `players`,
`discovered_plants`, `unlocked_badges` would be the textbook answer and would buy
nothing: we never query across players, and we always read and write the whole
document at once.

### A stored save is not a trusted object

It comes back from localStorage, through the cross-device merge, and out of a
`/api/progress` payload the client does not control. Any of those can hand over a
null where an object is declared, or a bee missing most of its fields.

zustand's default merge is **one level deep**, so a persisted
`pollinator: { name: "Half" }` replaced the whole default bee rather than being
filled in by it, and the renderer got a species with no colours. That was already
known and worked around rather than fixed: `resetProgress` in the e2e helpers
carries a comment saying an empty pollinator "used to strip the bee of its
colours and crash the renderer", and its answer was to post a complete one from
the test. The real app still crashed, differently on each page ("Voxel palette is
missing an entry" on anything drawing the model, a `toLowerCase` of undefined on
Customize), and both crashes white-paged the route: the same "world fine, page
white" shape as the removed-park bug.

The store now supplies a `merge` that repairs shapes once, on the way in, rather
than being defended against at every read site. The bee is filled field by field
from `DEFAULT_POLLINATOR`, and a record or array of the wrong shape falls back to
**the value the game starts with**. Unknown IDs **inside** those records are left
alone, because a save naming a species or a park that is gone is a separate thing
the game already survives.

That fallback is "the initial value", not "empty", and the difference is a bug
this made and then had to fix. Two of the records do not start empty:
`unlockedMapAreas` holds the lawn outside the Environmental Center, where the
game begins, and `unlockedParks` holds `{ frick: true }`. Defaulting a missing
one to `{}` meant a save that had simply never written that key came back with
the starting area forgotten, and the journal called it "Somewhere you haven't
been" to somebody standing on it. (Losing `unlockedParks` turned out to be
harmless, because Frick has no `requires` and `parkUnlocked` short-circuits on
that, but it falls back anyway rather than resting on a coincidence in another
file.)

This is the mirror of a fix the cloud path already had. `mergeInto` in
`cloud-sync.ts` spreads the remote bee over the local one rather than replacing
it, and its comment names the same crash: "an empty object is truthy, so a
partial or empty row on the server replaced the whole bee, the palette lost its
colours, and the voxel builder threw". The server route was hardened; the
localStorage route was not, so the same malformed save crashed depending only on
which way it arrived. Both doors are shut now.

The repair is exported as `repairSave(persisted, current)` rather than living
inline in the persist config, so a test can call the real thing. That matters
here: the first attempt to test it drove a page and asserted on localStorage,
which is not rewritten unless something changes state, so it passed against the
bug. Every seeded save in the suite happens to write both records, which is why
nothing caught this in the first place; the test deliberately omits one.

`world/answers.ts` normalises the same records again at its own entry points. That
is not belt and braces: it is a pure module that takes plain values, and a caller
is free to hand it something the store never saw.

`pages.spec.ts` drives Customize, Pocket and the Journal with a save carrying a
half-written bee, a null record, a null array and two ids for things that no
longer exist, and asserts nothing throws and the page still has its heading.

### Merging

Progress is **monotonic**: you never un-discover a plant, so the merge is a union.
A player who played signed out and then signs in keeps both halves.

The union is an **OR, not a spread**, and the distinction is worth keeping. It was
written `{ ...local, ...remote }`, which reads as a union and is not one: it is
"the server wins". Nothing in the game ever writes `false` into these records, so
the two behave identically in practice, which is precisely what makes the bug
invisible. But `/api/progress` stores the JSON it is handed, so a row carrying
`{ trillium: false }` would have un-discovered a trillium somebody had genuinely
found. ORing makes the property this paragraph claims actually true rather than
true by luck.

The **pollinator is not monotonic**. It is a value that gets replaced, so the
remote wins the merge, so a player who lands on the customize page and picks a
butterfly before the resume request comes back would watch the server's older bee
silently overwrite them. The merge compares the bee against what it was when the
request went out: a click is newer than a request already in flight.

## Accounts, the ceiling, and the waitlist

The save file records what an anonymous id has found; it never recorded WHO. That
was fine until the game needed a door policy. `lib/accounts.ts` adds three tables,
lazily like the save file: `accounts` (a row per real sign-in, with a status),
`waitlist` (an email per person turned away), and `admin_settings` (one row, the
account ceiling, starting at 100).

The door is `registerSignIn`, run in the Auth.js `signIn` callback. An existing
account is let back in unless suspended; a new one is admitted only if there is a
seat under the ceiling; everyone past it goes on the waitlist and is redirected to
`/waitlist`. It **fails open**: a database hiccup at the door lets a real player in
rather than locking the game out, because the ceiling is a courtesy rope and not a
security boundary. A suspension bites even on a live session, because the play gate
re-checks it. The admin tool (`/admin`, one email, everyone else gets a 404) reads
the numbers back and can set the ceiling, suspend, delete, and clear the waitlist.
Deleting an account takes its save and its album with it, which is what frees a
seat.

The ceiling is **validated where it is set, not where it is read**, and the reason
is a nasty little failure mode. The read side falls back to a hundred when it
cannot parse what it finds, which sounds safe and is not: a value that failed to
parse on the way in was stored as the string "NaN", and the door policy then
silently reverted to the default, reopening seats an admin had deliberately closed.
The API refuses a ceiling that is not a real number, and it refuses it with a 400
rather than coercing, because `Number(null)` is a perfectly good zero and a
ceiling of zero shuts the door on everybody.

## Photographs

Four sets, by park, each with a `CREDITS.md` and a generated TypeScript record:
`plant-photos.ts`, `fungus-photos.ts`, `schenley-photos.ts`, `highland-photos.ts`.
`photoFor(id)` is the single lookup, so no component knows which folder an image
lives in, and a species shared between parks resolves to the original photograph.

**Attribution is a licence term, not a courtesy.** Most are CC BY or CC BY-SA.
The credits page is generated from the same records the game reads, so a photo
cannot reach the journal without reaching the page, and the test asserts every
photographer appears **by name** rather than counting rows.

The album (photos the player takes) is a separate table, `player_photos`, one row
per photograph, `bytea` rather than base64, served from its own endpoint so the
browser can cache it. It is not in the save file, which is read and written whole
on every autosave: an album in there would ship a megabyte both ways every time
somebody found a flower. Ownership is enforced in the SQL, not filtered after,
because an unguessable UUID is not an access control policy.

## Badges, accessories, trivia

**Badges** (32) are pure predicates over game state. A `ProgressionWatcher`
re-evaluates on change, so adding one to the data file makes it work and no call
site has to know it exists.

**Accessories** (10, six earned) hang off badges by id. Four are free, because a
new player has to be able to make the bee theirs before they have done anything.
Locked ones are shown, greyed, naming the badge: a reward you cannot see is not a
reward, and a player who does not know the lantern exists has no reason to go
looking for the bitter oyster.

**Trivia** is three hand-written questions for every one of the 49 species, 147
in total, answerable from the entry the player just read. `because` is shown
whether they were right or wrong, so it teaches rather than scolds. Wrong options
have to be *plausible*: a question with three silly answers teaches nothing and
insults the player.

The **options are shuffled at display time**, and that is not cosmetic. Hand-written
options come out in the order the writer thought of them, which is the true one
first: 90 of the 147 questions had `answer: 0`, so tapping the top option every
time passed most quizzes in the game. Shuffling in `quiz.tsx` fixes all 147 at once
and cannot drift, so a new question can still be written in whatever order reads
best. It is safe only because no `ask` or `because` line refers to an option by its
position, and `quiz.spec.ts` holds the shuffle to no more than 40% of answers in
any one slot.

## Minigames

Pollinating a flower is a quick game, chosen by the plant's `archetype` so a
species always plays the same way (`MINIGAME_FOR_ARCHETYPE` in `pollination.ts`):
a dome of florets is `memory`, a woody plant is `seeds`, an open flower is
`anagram`. Every game feeds one 0 to 1 score into `resolvePollination`, so the
failure rate lives in exactly one place.

Because they share a resolver, they share a **calibration contract**, and it is
not a style note: a game whose top score cannot be reached in the time would make
its archetype permanently harder to pollinate than the others, invisibly. No play
scores 0, flailing about 0.35, competent about 0.75, and excellent scores 1.0 and
must be genuinely REACHABLE. A test plays each game optimally and asserts it maxes.

The three games this replaced all failed that last line by having ceilings any
awake player hit: everyone scored 1.0, so the resolver's floor became the real
rate and "one visit in five" was quietly a lie. If a new game is ever added, the
`score` in the debug readout (`?debug=1`) and on the `pollination_resolved`
analytics event is how you check it.

### The anagram word list

`anagram` needs to know whether a typed word is real and makeable from the plant's
name. Rather than ship a dictionary, `scripts/build-anagram-words.ts` precomputes,
per plant, every word its name can make, into `data/anagram-words.ts` (generated,
committed).

The dictionary is the **intersection** of ENABLE (real words) and a popularity
list (words people know). Both halves matter, and I got this wrong first: ENABLE
alone made the table 278KB, larger than the dictionary it was avoiding, and it
counted words like HALLAL that no player could produce, so the "can this name
support the game" check lied (it said Heal-All had eleven words; Heal-All has
three). The intersection is 60KB and the check tells the truth.

A plant qualifies at 8 or more makeable words. Below that, `minigameFor(plant)`
(NOT the raw archetype map) falls back to `memory`. This is load-bearing: pawpaw's
name makes only "PAPA", and jewelweed, heal-all and joe-pye-weed are also too thin.
A test asserts every plant resolves to a game that exists and can be won.

## Ambient life

`data/ambient.ts` is the other things alive in the park: `AMBIENT_COHORTS`, a
short list where each cohort is a `kind` (`pollinator`, `bird`, `firefly`), a
`count` in the tens, a colour and size, a height `band`, a drift `speed`, and an
`active(phase, weather)` predicate.

The predicate is the load-bearing field, because it is where the truth lives. A
forager is out by day, above ten degrees, and not in hard rain, exactly like the
flowers it works. A bird is out by day but shelters from a thunderstorm. A firefly
wants a still, dry dusk or night, so wind or rain keeps it down. These are the
same kind of sourced fact the species keep, and they double as atmosphere: the
gating is what makes a cold, wet park genuinely emptier than a fine one.

The `band` means two different things by design. For a pollinator or a firefly it
is height ABOVE the ground the instance is over, because a firefly is a few units
off the grass wherever the grass happens to be. For a bird it is an absolute
altitude, because a bird over the ravine is up in the sky, not fifty units off the
creek. `species` and `note` are a real name and one true line, kept for a field
note the player can read later; nothing renders them yet.

These are not species you collect and they never gate anything, so they carry none
of the `Species` machinery: no photograph, no trivia, no journal entry, no place
in the save file. They are scenery with rules.

## What is out today

`world/field-notes.ts` builds the arrival card, and it is data-shaped even though
it lives in `world/`: `fieldNotesFor(input)` takes a park, a `Daylight`, a
`Weather` and the `discoveredPlants` / `unlockedBadges` records, and returns a
list of `FieldNote` (`{ id, text, tone }`). Every line is derived: the sky from
the weather, the bloom line from `isActive` over each species' window, the count
from the save, and the one soft goal from an unearned badge's own `hint`. It reads
data and writes strings; it never sets a quota and never scolds, which is a
content rule as much as a code one.

## Pocket, and what it will say

`world/answers.ts` is the second module in the `field-notes.ts` shape: pure, no
React and no store, plain values in and one `Answer` (`{ id, text, wikipedia? }`)
out. It backs the ask box and the fact of the day on `/pocket`.

**There is no model behind it and there is not going to be one.** Two reasons.
The first is the principle at the top of this file: an unsourced fact does not
ship, and nothing can stop a language model inventing a milkweed fact that reads
exactly like the four real ones beside it. The second is that the game must never
tell anybody how it was made, and a function that can only emit sentences
assembled from `plants.ts` has no sentence about a framework to emit. That is a
structural prohibition rather than a promise, which is the only kind worth
making.

### How a typed string becomes an answer

1. **The made-of guard.** A word list and a phrase list, checked first. Be honest
   about what it is worth: the vocabulary is closed, so "how was this built"
   already resolves no subject and refuses on its own. The guard earns its lines
   on one case, a question that names a species AND asks a made-of question.
   "Did you use AI to write the milkweed fact" would otherwise resolve milkweed,
   match no intent, fall back to the milkweed fact, and read as a smug dodge.
2. **Normalise.** Lowercase, unaccent, and **join on apostrophes rather than
   splitting**: "dutchman's" split becomes "dutchman", which matches neither the
   common name nor the id `dutchmans-breeches`, so the species was unaskable by
   its own name.
3. **Resolve a subject** against a vocabulary built once at module load from
   every plant, fungus, park, area, concept and pollinator entry. A word is
   worth one over the number of subjects that share it, so "common" and
   "eastern" decide nothing, and saying a whole name outranks any amount of word
   overlap. A tie is answered with a question ("Common Milkweed or Swamp
   Milkweed?") rather than a coin toss.
4. **Gate on the save.** A species you have not found refuses in the **same
   words** as a question it could not parse. "You have not found that yet" would
   be friendlier and would confirm that the species exists, which is the
   discovery the game is built on. Parks, concepts and pollinator entries are
   never gated: the park picker already names all three parks and prints what
   each costs, so refusing "how do I unlock Schenley" would keep a secret that
   is on another page of the same site.

   Whether a park is **open** is derived rather than read off `unlockedParks`,
   mirroring `parkUnlocked` in the store: the flag records the moment it
   happened and the count of found flowers is the truth, so a save written
   before the flag existed is not locked out of a park it has already earned.
   Reading only the flag told somebody "eight flowers in Frick Park opens
   Schenley Park, you have eight" about a park the rest of the game had already
   opened, and counted one park where the picker showed two.

   There is deliberately **no** `inParty` flag on the input, unlike
   `fieldNotesFor`. Every other pool filters party species out because they gate
   things a solo player cannot reach; nothing here gates anything. The question
   is not "can you find this" but "have you met this", and a species met at a
   garden party stays askable afterwards, which is the right answer to "I saw
   that, tell me more".
5. **Classify an intent** from ordered keyword sets: bloom, window, homes,
   edibility, failure, visitors, winter, unlock, connection, progress, self.
   Each composes its sentence from named fields. Where the field is absent it
   refuses instead of guessing, which is why only the four species carrying a
   sourced `winter` line will answer a winter question.
6. **No rule matched?** Strip the stopwords, the intent words and the subject's
   own name, and look at what is left. Nothing left means they asked about the
   thing, and they get its `fact`. Something left ("what colour are milkweed
   leaves") is a question the data cannot answer, and handing back the generic
   fact would be pretending otherwise.

### Three things it had to be corrected about

All three were found by dumping what it actually says and reading it, which is
the same method that caught the six pieces of copy the night shift falsified.
None of them would have failed a test that had been written first, because the
code did exactly what it was written to do.

**The season decides before the hour does.** `isActive` reads only the clock, so
"when is wild geranium open" in July answered "Opens with the sun. It is open
now" about a flower that finished in June, one question after the bloom answer
had said it was out of season. The game contradicting itself in two consecutive
sentences is the night shift bug in miniature. Both the plant and the fungus
window answers check the season first now, and a test drives every plant in the
game at a midday hour so the only thing that can produce an "open now" is the
season being ignored.

**A deadly mushroom is not hedged at.** The caveat after an edibility was one
line for all five, and it contained "though": "Eastern Destroying Angel is
deadly. I am a bee in a game, though, so do not eat anything on my say so."
"Though" signals contrast, so it read as walking the danger back, on the one
surface in this game that says anything at all about eating. It also gave a
choice edible and a deadly amanita identical treatment, flattening the most
important distinction in the data. Toxic and deadly get their own line now.
Worth noting that the rest of the game shows edibility as a colour-coded label
with no words around it at all: being asked directly is a different thing from
reading a card, and this is the only place the game answers the question.

**It does not know what visits a fungus.** `roleNote` is what the fungus does,
so "what visits turkey tail" was answered with a paragraph about lignin, which
is answering a different question well. Fungi do get visitors and the data does
not record which, so that is a gap and it says so. Asked about generally, `fact`
still carries the roleNote.

The ask box's placeholder is held to the same standard as an answer. It read
"When does milkweed bloom?", which is a refusal for anybody who has not met a
milkweed and a request to disambiguate for anybody who has met both: a
placeholder is the first thing a new player reads, and one modelling a question
the box usually cannot answer teaches the wrong thing. It asks about a concept
now, because concepts are never gated and so it works from the first second of a
new save. There is a test that feeds the real placeholder to the real answerer
with an empty save and fails if it comes back refused or ambiguous.

Every refusal is the same line, `REFUSAL`, and nothing is appended to it. That
only works as a design if the boundary is visible, so the page prints what it
knows underneath the box: "It knows 14 flowers, 3 fungi and 2 parks so far."

### The date is spelled by hand

`pittsburghDate()` used to ask `Intl` for `month: "short"` in en-GB, and every
engine agreed on eleven of the twelve months. Node and Chromium spell September
"Sept"; WebKit spells it "Sep". The stats panel renders that string on the
server and again on the client, so in September on Safari the two never
matched, React threw a hydration error, and the dev overlay covered the park.
The suite found it on 1 September and not a day before: it was a deterministic
failure that only exists for one month a year on one engine.

The same string seeds the fact of the day, which meant the same player got a
different fact on a phone and a laptop for that month. The month and weekday
names are a fixed table now, letter for letter what Node produced, so nothing
that already rendered correctly changed. `Intl` still does the part it is
reliable at, which is working out what day it is in Pittsburgh.

**It was two doors, not one.** The admin table's created and last seen columns
used `toLocaleDateString("en-GB", { month: "short" })`, and its rows arrive
server rendered and hydrate on the client, so it had the identical failure on
`/admin`. Nothing in the suite asserted console errors on that page, so it was
found by sweeping the codebase for every place a date is spelled rather than by
a test. It goes through `pittsburghCalendarDate` now, which uses the same table
and additionally pins the zone: `toLocaleDateString` with no zone uses whatever
the machine is set to, and the server's machine is not in Pittsburgh, so the
day itself could have disagreed across midnight as well as the month name.

The first attempt at reproducing it passed against the bug, and the reason is
recorded in the test: with an empty accounts table no date is formatted, so the
page hydrates cleanly whatever the engine does. The test registers a row first.

The rule that falls out: **never let the browser spell a date in anything that
renders on the server.** `season.ts` is the only other `Intl` caller and it asks
only for numbers, which every engine agrees on.

### The fact of the day

`factOfTheDay` indexes a sorted pool of everything unlocked, seeded with
`pittsburghDate()` through the shared `world/hash01.ts`. Nothing is stored. The
alternative was freezing the choice in the save, which means a new field through
`partialize`, the progress payload and the cross-device merge, to buy a
guarantee nobody asked for. The visible consequence is that finding a new flower
can change today's fact, which reads as a reward.

Trivia `because` paragraphs are the first choice of text, because they are the
best prose in the repository and nothing outside a quiz reads them. One gate:
only from a species whose quiz you have already passed, or the fact of the day
would quietly hand you the answer to a question you have not been asked.

Frick needs nothing to unlock, so the pool is never empty for a real save and a
brand new player is told about the park they are standing in.

### Where the area prose lives

`data/areas.ts`. `AREA_BLURB` is twenty four descriptions, one per area across
the three parks, and it is the only prose an `Area` has anywhere: the type in
`world/park.ts` carries an id, a label and a centre point and nothing else. It
sat unexported inside `journal.tsx` until the answerer wanted to say what Fern
Hollow is.

## Species you can only meet in company

Twelve of them, four per park, marked `partyOnly: true` on the record. The data
is otherwise identical to every other species: sourced facts, a licensed
photograph, three hand-written questions. Two candidates were dropped during
sourcing because their articles carry no ecology at all, which is rule 1 doing
its job rather than a gap to fill in later.

**The important part is what they must not change.** Adding species to a game
that counts species is the kind of edit that breaks something quietly and
somewhere else, so `SOLO_PLANTS` and `SOLO_FUNGI` exist and five counters read
them:

| Counter | Why it must stay solo |
| --- | --- |
| `plantsIn` (the park unlock ladder) | Schenley opens at 8 of Frick's plants. Counting the party plants towards that would move a door somebody was walking towards further away, over a feature they may never have opened. The threshold is a pinned number rather than a fraction now, which closes the same hole from the other side. |
| `foundIn` (the same ladder, in `world/answers.ts`) | Pocket will tell you how far off a park is, and it has to give the same number the picker does. |
| `speciesOf` (the per-park badges) | "Every plant in Frick" has to go on meaning what it meant before parties existed. |
| `both-parks` (the completionist badge) | Otherwise it becomes unobtainable without other people. |
| The counts in GAMEPLAN.md | Said as two numbers now, because one would be a lie in both directions. |

**The test is whether the counter GATES something.** Every one of those decides
whether a door opens or a badge is earned. A counter that only tells you a
number is the opposite case and must count the whole game.

So the DISPLAY counters are the exception, and deliberately: "Found 0 / 43"
counts every plant in the game, party species included. Shrinking the
denominator for solo players would read "40 / 37" for anybody who joined a
party, which is worse than the problem it solves. Pocket follows the same rule,
and had to be corrected to: it answers "how many have I found" out of `PLANTS`
and `FUNGI` and counts what it can talk about the same way, because it will
happily discuss a flower you met at a party and saying "3 flowers" while
answering questions about a fourth is a false line in player copy. Answering
"2 of 37" to the question the journal answers "2 / 43" would be the game
disagreeing with itself in two rooms.

What was missing was the reason. A solo completionist stalled at 37 of 43 with
nothing anywhere to say why, hunting a wood that does not contain the other six:
`partyOnly` appeared in the data, in the counters and in the tests, and nowhere
at all in the interface. The journal marks an undiscovered party species "Only
in a garden party" now, which is what the connections layer already did for
exactly this reason. The label goes once you have found it, because how you got
there stops being the useful fact about a species you have met.

`party-species.spec.ts` pins those as NUMBERS rather than asserting the badges
still exist, and a separate test compares the scatter with and without the party
species position by position: adding them must move nothing that was already
there, because the world is deterministic and people learn where things are.

The scatter takes a flag (`scatterSpecies(withParty)`), off by default, so every
solo caller and every existing test keeps the park it already had.

## Usernames

Two to twenty-four characters, no spaces, and unique. `src/lib/username.ts` holds
the rules and both the form and the route import it: the form is a courtesy to
somebody typing, the route is the thing that decides, and two copies of the rules
would eventually disagree.

Letters from any script are allowed, because refusing anything outside A-Z
refuses people. What is excluded is punctuation that reads as something else in
a chat line: `@`, `#`, `/`, angle brackets.

**Uniqueness is settled by the database, not by looking first.** Two people
typing the same name at the same moment both pass a `SELECT` and both proceed;
only a constraint can decide between them. `setUsername` writes and catches the
unique violation, and the index is partial and case-folded:

```sql
CREATE UNIQUE INDEX accounts_username_key
ON accounts (LOWER(username)) WHERE username IS NOT NULL
```

The partial clause is what lets every account that predates usernames sit at
NULL without colliding with the others. `LOWER` is what stops "Bee" and "bee"
being two different people, which would make the distinction a trap rather than
a feature. The case you typed is what gets stored and shown.

**Null is the whole prompting mechanism.** A brand-new account and an account
from before usernames both have no username, which is the same question, so
there is one prompt and no separate "has been asked" flag. A flag would be a
second thing that could disagree with the first.

**Claiming a name never CREATES an account.** It is an `UPDATE`, and no row
means a refusal. `registerSignIn` owns account creation because that is where
the ceiling, the waitlist and the suspension check live; an upsert here meant a
player whose account had just been deleted, still holding a valid JWT, could
post a username to put a row back and walk round all three.

**The prompt is never shown over the park.** It is a full-screen scrim, and one
of those over a 3D scene somebody is flying eats every click and keypress meant
for the game. It did exactly that to the whole test suite before anybody
noticed, because an unnamed signed-in player could no longer press anything on
`/play`.

**The party ticket carries the username, never the Google name.** That is what
this is for: the ticket is what the room puts on chat lines and over bees, so
signing in with Google used to put a person's legal name in a chat window next
to strangers. `username.spec.ts` decodes a real ticket and asserts both halves
of that, and the assertion fails if the route goes back to the session name.

## The admin tool

One address, from `ADMIN_EMAIL`. Everyone else gets a 404 rather than a locked
door: a page that announces itself is a page worth attacking.

Beyond the ceiling and the waitlist it can now edit a player's username, wipe a
save without deleting the account, and read four views of how the game is going.
Every action is re-checked against the gate in the route, because hiding a
control is not the same as refusing an action, and `admin.spec.ts` posts each
one as a non-admin to prove it.

Two rules the tool keeps deliberately:

**The admin cannot suspend or delete themselves.** A locked-out owner has no way
back in. Wiping your own save IS allowed, because it cannot lock anybody out of
anything and is a thing you might genuinely want.

**Nothing here ranks players against each other.** The game has no leaderboard
and a "top players" table would be that leaderboard entered through the back
door. The per-player view answers "is this person stuck"; the aggregate answers
"is this plant findable". Medians rather than means, because one completionist
drags a mean away from anybody's actual afternoon.

Garden party numbers are **totals, never events**. The room stores nothing at
all, and a row per join would be a record of who was in a room with whom and
when, which is exactly what the room refuses to keep. A counter answers "is
anybody using this" and describes nobody.

Sign-ups are bucketed **by the Monday of their week, in UTC throughout**. That
sounds like a detail and is not: the first version read the day and date in local
time and then formatted the result with `toISOString`, which formats in UTC, and
mixing the two got both halves wrong. Every bar was labelled a day late in any
timezone west of Greenwich, so the weeks started on Tuesdays, and two accounts
created either side of midnight in the same week were drawn as two separate weeks.
Whether a week should be a Pittsburgh week or a UTC one is a real question with a
boring answer, since this only decides which bar a sign-up sits in; being
consistent is the part that matters.

And only things that happen **once a session**: joins, co-op pollinations, games
opened. There was a chat counter, and it was wrong in a way worth remembering.
It fired a serverless request for every line anybody typed, which put a
per-message cost back on the one feature whose whole design is that the room
stores nothing and costs nothing. "Is anybody chatting" is already answered by
joins, and a counter that scales with typing rather than with people is not
worth what it costs.

## Connections

`data/connections.ts` holds what the species have to do with each other: milkweed
and its pollinia, the two lobelias splitting their customers between a
hummingbird and a bumblebee, the destroying angel that looks like a puffball
until you slice it. One opens when you have found every species in it.

**Hand-written and sourced, and that is the whole design decision.** It would be
trivial to generate hundreds of these from what the records already share: same
area, same bloom window, same archetype. "These two grow in the same field" is a
coincidence, not an ecological fact, and shipping one dressed as the other is
exactly the prettier lie rule 1 refuses. Every entry carries a Wikipedia link
verified to return 200, and a link that cannot be sourced means the entry does
not ship.

Two of them need a species you can only meet in a garden party, which is allowed;
what is not allowed is failing to say so, since a solo player would otherwise see
a locked entry and think they had missed something in the wood. The flag is
DERIVED from the species rather than typed in beside the entry, so it cannot go
stale when the data changes.

## What your work leaves in the world

Two records in the save put things into the park rather than describing it.

**`seedlings`** is a record per flower you successfully pollinated: species,
park, position, and when. It is keyed by the INSTANCE, so working the same stalk
every afternoon leaves one plant beside it rather than a thicket on one spot.

That keying is not a cap, which is easy to assume and wrong. A seedling is an
ordinary instance, so it can be landed on and worked like anything else, and
working it keys a new record off ITS key: `seed-plant-goldenrod-3` sets
`seed-seed-plant-goldenrod-3`, which sets another. Each generation costs eight
days of growing, so it is slow, and slow is not bounded. So there is a real cap
(`MAX_SEEDLINGS`), oldest dropped first. Refusing to let a seedling set seed
would have been the tidier fix and a lie, because a plant grown from seed sets
seed, and that is precisely how a meadow works. Merged across devices by keeping the EARLIER timestamp, because a
seedling is measured by how long it has been growing and taking the later one
would shrink a week-old plant back to a sprout.

**`marks`** is what the waggle dance leaves. Unlike everything else in the save
it is not monotonic: marks expire after three days and the list is capped at
twelve, newest first. That is deliberate and it is the honest version of the
thing being modelled. A real dance is over in under a minute and its information
is stale by the afternoon, because the flower it points at will have been
stripped. A record that never expired would silt up into a hundred pins over a
park you had finished.

Marks arriving from a garden party go straight into the save and the name of
whoever danced is thrown away. A mark is a note about a place, not a record of
who you were in a room with, and the room keeps nothing about that on purpose.

## Adding things

**A species:** add the record with its `homes`, source a licensed photograph and
add it to the credits table and the photo record, write three trivia questions,
and run the probe that asserts every species a park claims actually exists in the
world. If it is party-only, set `partyOnly: true` and check the four counters
above rather than assuming they do not care. That last one matters: species have twice been left in the data and
nowhere on the ground, which is a journal entry nobody can fill and a badge
nobody can earn.

**A park:** one file in `world/parks/`, entries in `PARKS`, `PROPS_BY_PARK` and
`OBSTACLES_BY_PARK`, an ambience bed per area, journal blurbs, and a `requires`.
The type system catches the three registries. Nothing else needs to change.

**A badge:** one predicate. **An accessory:** text art, a palette entry, an
offset, and an `ACCESSORY_INFO` row naming the badge.

**A minigame:** a component under `components/minigames/` behind the `MinigameProps`
contract, a `MinigameKind` in `pollination.ts`, a `MINIGAME_SPEC` entry, a registry
row, and the archetypes it serves. Then meet the calibration contract above, and
prove it with a test: idle near zero, optimal exactly 1.0.
