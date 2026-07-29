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
memory. When a claim cannot be verified it does not ship, however good a line it
would have made.

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

### The 10% that are demanding

A tenth of each park's flowers refuse to be pollinated until you have passed
their quiz: 2 of 16 in Frick, 2 of 14 in Schenley, 2 of 12 in Highland.

They are **hand-picked, not hashed**, because the gate has to mean something.
Every one has a real mechanism a real insect has to learn: milkweed's pollinia
clip onto a foot and a small bee can lose a leg in the slot; Dutchman's breeches
is locked and only a bumblebee queen has the strength and the tongue; columbine
seals its nectar out of reach, so bumblebees chew through the side of the spur
and pollinate nothing; pawpaw is not advertising to bees at all. A naive insect
fails at these.

The `demanding` string is the reason, shown to the player when the button is
inert. A test asserts the share per park stays near a tenth, and it has already
caught two mistakes: a shared species counted against both its parks, and a whole
park shipping at 0%.

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
- `DAYLIGHT` (7 to 19): everything else that flowers. Shut after dark.
- Fungi have their own: `DAWN`, `DAY`, `NIGHT`, `DUSK`.

The consequence is the point: after dark **nothing is pollinatable anywhere**,
and only fungi are out.

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

`isOut(instance, hour, month)` in `species-scatter.ts` is the single question the
discovery loop, the tag, the field and the field notes all ask: open at this hour
AND in season this month. A plant out of its month is drawn as a drab closed stalk
(it is still there, it is just not flowering); a fungus out of its season is gone.
The suite pins `?month=7`, July, because half the flora is out of season at any
month and midsummer is when the most is in bloom at once.

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

Declared on the park, not in the store: Frick opens Schenley (half of Frick's
plants), Schenley opens Highland (half of Schenley's). A fourth park is a data
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

### Merging

Progress is **monotonic**: you never un-discover a plant, so the merge is a union
and it does not matter who wins. A player who played signed out and then signs in
keeps both halves.

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

## Adding things

**A species:** add the record with its `homes`, source a licensed photograph and
add it to the credits table and the photo record, write three trivia questions,
and run the probe that asserts every species a park claims actually exists in the
world. That last one matters: species have twice been left in the data and
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
