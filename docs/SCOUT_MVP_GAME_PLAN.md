# Core Concept

Scout is a browser-based, desktop-first, WebGL/Three.js RPG where the player becomes a cute local pollinator exploring a simplified version of Frick Park in Pittsburgh.

The gameplay reference is:

Pokémon, but instead of catching creatures, you pollinate and catalog local plants.

Frick Park is a strong first map because it is Pittsburgh’s largest municipal park and has wooded slopes, valley floors, ridges, ravines, creeks, and native habitat, which gives the game natural variety without needing a huge first world.

MVP Definition

The MVP is not just a prototype.

The MVP is a complete single-player Frick Park experience where a signed-in player can customize one pollinator, explore the map, discover native plants, pollinate them, learn ecology facts, fill a journal, earn badges, autosave progress, and return later.
# Player Experience
MVP Player Experience:

Start flow:

Landing page
Choose mode:
Sign in with Google
Offline 10-minute run
If signed in:
Choose starter pollinator
Customize pollinator
Enter Frick Park map
If offline:
Choose temporary pollinator
Start timed run
No saved progress
# Starter Pollinators
# Starter Pollinators

For Frick Park MVP:

Bee
Hoverfly
Butterfly

Each starter should have:

Name
Body/stripe color
Wing color
Wing style
Small accessory or trail effect

Future maps can have different local starter options.
# Core Game Loop
Core Gameplay Loop:

Fly through Frick Park
Reveal gray/unexplored map areas
Spot plants from a distance
Approach plant
Trigger pollination
Complete light interaction:
spacebar tapping
hover timing
flower cue matching
Pollination succeeds or fails
Learn a fun fact
Unlock journal entry
Fly to the next plant

Pollination should fail around 2 out of 10 attempts. Failure should stay positive and educational:

“Too windy this time.”
“This flower was already visited.”
“You missed the pollen window.”
“Wrong angle. Try hovering closer.”
# Map Design
# Map Design

First map: One seamless, simplified Frick Park area.

Use real geography as inspiration, but simplify it for gameplay.

Core areas (revised — see SCOUT_IMPLEMENTATION_PLAN.md, "Direction changes"):

Frick Environmental Center — the starting area, on the lawn by the Beechwood gates
Blue Slide Playground — the most recognisable object in the park
Lawn Bowling Green — the only one in Pittsburgh
Nine Mile Run — the creek at the bottom of the valley
Falls Ravine — steep hemlock slopes
Fern Hollow — deep shade under a closed canopy

The map is cut around things that are actually in Frick Park rather than around generic biomes,
and it is built at INSECT SCALE: the bee is bee-sized and everything else grew around it. Grass
towers overhead, an oak is a hill, a flower stalk is something you fly up. A park you could walk
across in twenty minutes is a continent, and that is what makes it worth exploring twice.

The gray/unexplored reveal was dropped. Navigation is by pollen motes and by landmarks you can
see and steer toward; a fog-of-war overlay would be a second wayfinding system fighting the first.
# Camera & Controls
# Camera & Controls

Camera
Third-person
behind the pollinator.

Movement

Smooth arcade flight:

WASD or Arrow Keys: movement
Mouse: camera/look
Space: pollination interaction
Shift: speed boost
E/Q or scroll: altitude control

Altitude matters because plants appear at different heights.
# Plant Discovery
Plant Discovery System

Each plant has:

Name
Type
Bloom season
Lifespan
Pollinator relationship
Fun fact
Ecology fact
Real photo
Placeholder image fallback
Discovered: true/false
Pollinated: true/false

Plant size should scale based on distance, so players can spot flowers from far away without breaking the 3D feel.
# Journal System
# Journal System

The journal is the player’s “pollinator record.”

Sections:

Plants
Pollinators
Map areas
Ecology concepts

Example ecology concepts:

Native plants
Pollination failure
Bloom windows
Habitat corridors
Invasive species
Seasonal cycles
Mutualism

Tone should be casual adult, fun, and slightly Pokédex-like.
# Badges & Progression
# Badges & Progression

Avoid competition for MVP.

Badges should reward:

Plants pollinated
Plants discovered
Map areas uncovered
Journal completion
Successful pollination streaks
Learning milestones

Examples:

First Flight
Meadow Scout
10 Plants Pollinated
Frick Park Explorer
Creekside Visitor
Native Plant Friend
# Offline Mode
Offline mode

Offline mode should feel intentional, not like a lesser version.

Framing

“You are a pollinator. Your time is short. Explore, pollinate, and learn as much as you can.”

Rules
10-minute timer
Full open-world access
No saved progress
No account required
End screen shows:
plants discovered
plants pollinated
map explored
favorite fact found

No leaderboard.
# Autosave & Data Model
Autosave & Data

Signed-in mode should autosave after major events:

plant discovered
plant pollinated
map area unlocked
badge earned
journal entry unlocked
customization updated

Keep data lightweight.

User progress shape

userProgress = {
userId: string,
pollinator: {
type: "bee" | "hoverfly" | "butterfly",
name: string,
bodyColor: string,
wingColor: string,
wingStyle: string,
trailEffect: string
},
discoveredPlants: {
[plantId: string]: boolean
},
pollinatedPlants: {
[plantId: string]: boolean
},
unlockedMapAreas: {
[areaId: string]: boolean
},
unlockedBadges: {
[badgeId: string]: boolean
},
unlockedJournalEntries: {
[entryId: string]: boolean
}
}

# Technical Architecture
# Technical Architecture

Stack
Next.js
Vercel
Three.js / React Three Fiber
Google sign-in
Lightweight database
Public asset storage for images/audio
Autosave API routes

Routes
/ landing page
/play game
/customize pollinator customization
/journal journal
/profile saved progress
/offline offline mode

Game libraries

Use:
three
@react-three/fiber
@react-three/drei
zustand for client game state
next-auth or Firebase Auth for Google sign-in
simple database layer for saved progress
# MVP Content Plan
MVP content target

Start small:

1 pollinator for the MVP (the bee; hoverfly and butterfly deferred)
16 plants — done
6 map areas — done
10 to 15 badges
20 to 30 journal entries
1 music loop
6 to 10 sound effects

Content fields per plant:

plant = {
id: "common-milkweed",
name: "Common Milkweed",
scientificName: "",
bloomSeason: "",
lifespan: "",
habitat: "",
pollinatorNotes: "",
funFact: "",
ecologyFact: "",
imageUrl: "",
placeholderImageUrl: "",
mapArea: "meadow"
}

# Roadmap
## MVP Roadmap
## Phase 1: Foundation Build
**Goal: establish the playable technical base.**
Next.js project setup
Three.js / React Three Fiber game scene
Desktop keyboard controls
WASD movement
arrow key movement
mouse camera/look
altitude controls
Third-person pollinator camera
Basic Frick Park terrain blockout
Basic lighting, sky, ground, and environmental objects
Initial sound/music system
Game state management with Zustand
## Phase 2: Pollinator System
**Goal: make the player character feel personal and fun.**
Starter pollinator selection:
bee — the only species modelled for the MVP
hoverfly — deferred
butterfly — deferred

NOTE: the picker currently offers all three, but the scene renders the bee regardless of the
choice. Restrict the picker to the bee, or mark the other two "coming soon".
Google sign-in required for saved pollinator
Pollinator naming
Customization options:
body/stripe color
wing color
wing style
trail effect
small accessory
Saved customization
Basic flight animations
Idle, flying, hovering, and pollinating states

## Phase 3: Frick Park Map Experience
**Goal: make the first map feel like a real explorable place.**
One seamless simplified Frick Park map
Real geography-inspired layout
Key map zones:
Environmental Center starting area
meadow / sunny clearing
woodland trail
creek / ravine
canopy edge
Gray/unexplored map reveal system
Map area unlocks
Distance-based plant visibility
Altitude-relevant plant placement
Environmental ambience per area
## Phase 4: Native Plant Discovery System
**Goal: make plant discovery the heart of the game.**
12 to 20 native Frick Park / Pittsburgh-area plants
Each plant has:
common name
scientific name
bloom season
lifespan
habitat
pollinator relationship
fun fact
ecology fact
real photo
placeholder fallback
Plant discovery state
Plant pollination state
Fact modal after interaction
Realistic photo popup
Journal entry unlocks

## Phase 5: Pollination Gameplay
**Goal: make pollination more than a button press.**
Spacebar interaction
Light minigame variations:
timed hover
repeated taps
flower cue matching
Random pollination failure rate around 20%
Positive failure explanations
Success animation
Failure animation
Sound effects for:
discovery
pollination start
success
failure
journal unlock
badge unlock
## Phase 6: Journal, Badges, and Progression
**Goal: make progress feel satisfying without competition.**
Journal sections:
plants
pollinators
map areas
ecology concepts
Badge system
Badge categories:
plants discovered
plants pollinated
map explored
journal completion
ecology learning
Progress summary screen
Profile page with saved pollinator and accomplishments
No leaderboard

## Phase 7: Auth, Autosave, and Lightweight Data
**Goal: make the game persistent but scalable.**
Google sign-in
Saved user profile
Autosave after:
plant discovery
successful pollination
failed pollination attempt
map area unlock
badge unlock
journal entry unlock
customization update
Lightweight boolean-based progress model
API routes for saving and loading progress
Basic error handling if save fails
Resume game from saved state
## Phase 8: Offline Mode
**Goal: make non-auth play meaningful.**
Offline mode route
10-minute timer
Temporary pollinator selection
No saved progress
Full map exploration
Full plant discovery during session
End-run summary:
plants discovered
plants pollinated
map explored
favorite fact found
Emotional framing around the short life of a pollinator

## Phase 9: Polish and Launch Readiness
**Goal: make the MVP feel complete enough to share.**
Final UI pass
Cute 8-bit-adjacent visual treatment
Music loop
Ambient sound layers
Responsive loading screens
Basic onboarding/tutorial
Plant/photo credits page
Accessibility basics:
readable text
volume controls
reduced motion option
Vercel deployment
Basic analytics
Bug testing
Launch-ready Frick Park MVP

# Future Multiplayer Stuff
Future multiplayer path

Do not build multiplayer first, but design toward it.

Later:

players can see other pollinators flying around
seasonal community pollination events
map-specific pollinator unlocks
new city maps
shared ecology goals
cooperative habitat restoration events

The long-term version becomes a massive online pollinator world. The MVP is the first charming, focused, Pittsburgh-based proof of that vision.