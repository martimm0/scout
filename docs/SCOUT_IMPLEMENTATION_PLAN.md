# Scout: A Pollinator RPG — Implementation Plan

## Purpose

This document converts the Scout MVP game plan into a development-ready implementation roadmap for Codex or another engineering agent.

The goal is to build a complete browser-based, desktop-first MVP where a player can sign in, customize one pollinator, explore a simplified Frick Park map, discover native plants, complete light pollination interactions, unlock journal entries, earn badges, autosave progress, and return later.

## Product Scope

### MVP Definition

The MVP is a complete single-player Frick Park experience, not a throwaway prototype.

The MVP must include:

- Landing page
- Google sign-in
- Offline 10-minute mode
- Starter pollinator selection
- Pollinator customization
- Third-person desktop flight controls
- One seamless simplified Frick Park map
- Native plant discovery system
- Pollination interactions
- Journal system
- Badge system
- Autosave for signed-in users
- Lightweight saved progress model
- Profile/progress summary
- Launch-ready polish pass

### Launch Target

- Platform: Browser
- Device target: Desktop only
- Rendering: WebGL with Three.js / React Three Fiber
- Deployment: Vercel

## Recommended Stack

- Next.js App Router
- React
- TypeScript
- Three.js
- @react-three/fiber
- @react-three/drei
- Zustand
- NextAuth or Firebase Auth for Google sign-in
- Lightweight database layer
- Public asset storage for plant photos, placeholder images, music, and sound effects
- Vercel API routes or server actions for save/load endpoints

## Core Routes

```txt
/              Landing page
/play          Signed-in game experience
/offline       Offline 10-minute game mode
/customize     Pollinator customization
/journal       Journal
/profile       Saved progress and accomplishments
```

## Development Milestones

---

# Milestone 1: Project Foundation

## Goal

Create the technical foundation for the browser-based game.

## Tasks

- Initialize Next.js project with TypeScript.
- Install core dependencies:
  - three
  - @react-three/fiber
  - @react-three/drei
  - zustand
  - auth package selected for Google sign-in
- Create base route structure.
- Add global layout and app shell.
- Add reusable UI primitives for buttons, cards, modals, and page containers.
- Create basic loading state system.
- Create environment variable structure.
- Add initial Vercel-ready configuration.

## Checkpoint Deliverables

- Project runs locally.
- Routes exist and render placeholder pages.
- Shared UI components are available.
- Basic lint/build flow works.

## Acceptance Criteria

- `npm run dev` starts successfully.
- `npm run build` passes.
- User can navigate between placeholder routes.

---

# Milestone 2: Game Scene Foundation

## Goal

Create the initial playable 3D scene.

## Tasks

- Build React Three Fiber canvas wrapper.
- Add basic scene lighting.
- Add sky/background.
- Add ground plane.
- Add placeholder Frick Park terrain blockout.
- Add placeholder environmental objects:
  - trees
  - trail markers
  - creek/ravine shapes
  - meadow objects
- Add camera system.
- Add third-person camera behind the pollinator.
- Add basic debug overlay for position, altitude, and current area.

## Checkpoint Deliverables

- `/play` loads a 3D scene.
- The player can see a placeholder pollinator in the map.
- Camera follows behind the pollinator.

## Acceptance Criteria

- Scene loads without runtime errors.
- Camera remains stable during movement.
- Terrain and environment objects provide a readable play space.

---

# Milestone 3: Desktop Flight Controls

## Goal

Make player movement feel smooth and arcade-like.

## Controls

```txt
WASD or Arrow Keys: movement
Mouse: camera/look
Space: pollination interaction
Shift: speed boost
E/Q or scroll: altitude control
```

## Tasks

- Implement keyboard input manager.
- Add WASD movement.
- Add arrow key movement.
- Add mouse camera/look.
- Add altitude control with E/Q.
- Add altitude control with mouse scroll.
- Add Shift speed boost.
- Add collision or soft boundaries for the map edges.
- Add movement smoothing.
- Add hover state when player is mostly stationary.

## Checkpoint Deliverables

- Pollinator can move around the 3D scene.
- Pollinator can freely change altitude.
- Player can use both WASD and arrow keys.

## Acceptance Criteria

- Controls feel responsive on desktop.
- Player cannot accidentally leave the playable map.
- Altitude visibly affects player position.
- Camera does not clip aggressively through terrain.

---

# Milestone 4: Client Game State

## Goal

Create a clean state layer for gameplay, progress, and session data.

## Tasks

- Create Zustand store.
- Add state slices for:
  - player
  - pollinator
  - map discovery
  - plant discovery
  - pollination
  - journal
  - badges
  - offline mode
  - UI modals
- Add selectors and update actions.
- Add temporary local session state for offline mode.
- Add initial mock data loading.

## Checkpoint Deliverables

- Central game state exists.
- Components can read/write game state.
- State updates are predictable and isolated.

## Acceptance Criteria

- Discovering a mock plant updates state.
- Unlocking a mock badge updates state.
- State can be reset for a new offline run.

---

# Milestone 5: Starter Pollinator System

## Goal

Let players choose a starter pollinator and see it reflected in-game.

## Starter Pollinators

- Bee
- Hoverfly
- Butterfly

## Pollinator Fields

```ts
pollinator: {
  type: "bee" | "hoverfly" | "butterfly";
  name: string;
  bodyColor: string;
  wingColor: string;
  wingStyle: string;
  trailEffect: string;
}
```

## Tasks

- Create starter pollinator data.
- Build starter selection UI.
- Add placeholder 3D model or stylized geometry for each pollinator.
- Add visual differences by type.
- Add basic flight animations:
  - idle
  - flying
  - hovering
  - pollinating
- Connect selected pollinator to game scene.

## Checkpoint Deliverables

- Player can choose Bee, Hoverfly, or Butterfly.
- Selected pollinator appears in the game scene.

## Acceptance Criteria

- Each starter has distinct visuals.
- Selection persists during active session.
- Pollinator animation changes based on movement state.

---

# Milestone 6: Pollinator Customization

## Goal

Allow signed-in players to personalize their saved pollinator.

## Customization Options

- Name
- Body/stripe color
- Wing color
- Wing style
- Trail effect
- Small accessory

## Tasks

- Build `/customize` route.
- Add form controls for customization fields.
- Add preview panel.
- Apply customization to in-game model.
- Add validation for pollinator name.
- Add save action placeholder.
- Gate saved customization behind Google sign-in.

## Checkpoint Deliverables

- Player can customize a pollinator.
- Customization appears in preview and game scene.

## Acceptance Criteria

- Signed-in player customization can be saved.
- Offline player can choose a temporary pollinator but does not save progress.
- Invalid names are handled cleanly.

---

# Milestone 7: Frick Park Map Experience

## Goal

Build one seamless simplified Frick Park-inspired map.

## Map Areas

- Frick Environmental Center starting area
- Woodland trail zone
- Meadow / sunny clearing
- Ravine / creek zone
- Dense tree canopy zone

## Tasks

- Replace rough terrain with a more intentional map layout.
- Add distinct visual identity for each area.
- Add area boundary volumes or trigger zones.
- Add current area detection.
- Add gray/unexplored map reveal system.
- Add map area unlock events.
- Add altitude-relevant plant placement zones.
- Add environmental ambience hooks per area.

## Checkpoint Deliverables

- Map has five readable areas.
- Areas unlock as the player explores.
- Unexplored map regions start gray and become discovered.

## Acceptance Criteria

- Player can fly seamlessly between all map areas.
- Area unlock state updates correctly.
- Map reveal is visible and understandable.

---

# Milestone 8: Native Plant Data Layer

## Goal

Create the plant content system that powers discovery, journal entries, and pollination.

## MVP Content Target

- 12 to 20 native Frick Park / Pittsburgh-area plants
- Real photos from public sources where available
- Placeholder image fallback

## Plant Shape

```ts
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
```

## Tasks

- Create plant data file.
- Add 12 to 20 starter plant records.
- Add fields for discovery and pollination state.
- Add image fallback handling.
- Add photo credit fields if needed.
- Add plant placement config for 3D scene.
- Add validation helper for missing plant data.

## Checkpoint Deliverables

- Plant data is available to the game scene.
- Each plant has complete required fields.

## Acceptance Criteria

- Missing image URLs fall back to placeholder image.
- Plant records can power both 3D map objects and journal entries.

---

# Milestone 9: Plant Discovery System

## Goal

Make discovery the heart of the exploration loop.

## Tasks

- Render plant objects in the map.
- Add distance-based visibility scaling.
- Add plant highlight when player is nearby.
- Add discovery trigger when player approaches plant.
- Add discovery modal or toast.
- Unlock plant journal entry on discovery.
- Track discovered state.
- Prevent repeat discovery spam.

## Checkpoint Deliverables

- Player can find plants from a distance.
- Approaching a plant marks it as discovered.
- Discovery unlocks a journal entry.

## Acceptance Criteria

- Discovered plants remain discovered in session.
- Discovery feedback is clear and positive.
- Plants are visible without breaking the 3D feel.

---

# Milestone 10: Pollination Interaction System

## Goal

Make pollination more than a button press.

## Required Interaction

- Press Space near a discovered plant to start pollination.

## Minigame Variations

- Timed hover
- Repeated taps
- Flower cue matching

## Tasks

- Add pollination eligibility checks.
- Add Space interaction near plants.
- Build shared minigame modal/system.
- Implement timed hover variation.
- Implement repeated taps variation.
- Implement flower cue matching variation.
- Add random failure rate around 20%.
- Add positive failure messages.
- Add success/failure animation hooks.
- Update pollinated state on success.
- Unlock facts and journal entries after interaction.

## Positive Failure Messages

- “Too windy this time.”
- “This flower was already visited.”
- “You missed the pollen window.”
- “Wrong angle. Try hovering closer.”

## Checkpoint Deliverables

- Player can pollinate plants.
- Pollination can succeed or fail.
- Failure remains positive and educational.

## Acceptance Criteria

- Pollination succeeds most of the time.
- Failure rate is approximately 20%.
- Pollinated plants update state correctly.
- Player receives a fun fact or ecology fact after interaction.

---

# Milestone 11: Journal System

## Goal

Create the player’s pollinator record.

## Journal Sections

- Plants
- Pollinators
- Map areas
- Ecology concepts

## Ecology Concept Examples

- Native plants
- Pollination failure
- Bloom windows
- Habitat corridors
- Invasive species
- Seasonal cycles
- Mutualism

## Tasks

- Build `/journal` route.
- Add tabbed journal UI.
- Add locked/unlocked states.
- Add plant entries.
- Add pollinator entries.
- Add map area entries.
- Add ecology concept entries.
- Connect unlocks to discovery, pollination, and area exploration events.
- Add casual adult, fun, slightly Pokédex-like tone.

## Checkpoint Deliverables

- Journal displays locked and unlocked entries.
- Plant discovery unlocks plant entries.
- Ecology concepts unlock through gameplay.

## Acceptance Criteria

- Journal state reflects actual progress.
- Locked entries are intriguing without revealing everything.
- Unlocked entries are readable and polished.

---

# Milestone 12: Badge and Progression System

## Goal

Make progress feel satisfying without competition.

## Badge Categories

- Plants pollinated
- Plants discovered
- Map areas uncovered
- Journal completion
- Successful pollination streaks
- Learning milestones

## Example Badges

- First Flight
- Meadow Scout
- 10 Plants Pollinated
- Frick Park Explorer
- Creekside Visitor
- Native Plant Friend

## Tasks

- Create badge data model.
- Create badge unlock rules.
- Add badge unlock evaluator.
- Add badge unlock UI feedback.
- Add badge display to profile.
- Add progress summary component.
- Ensure no leaderboard exists in MVP.

## Checkpoint Deliverables

- Badges unlock based on gameplay events.
- Player can view earned badges.

## Acceptance Criteria

- Badge unlocks are deterministic.
- Badge feedback does not interrupt gameplay too aggressively.
- Progression feels positive, not competitive.

---

# Milestone 13: Auth and User Profile

## Goal

Allow signed-in players to save and resume progress.

## Tasks

- Implement Google sign-in.
- Add signed-in and signed-out states.
- Add protected behavior for saved mode.
- Create user profile record on first sign-in.
- Build `/profile` route.
- Display saved pollinator.
- Display accomplishments.
- Display progress summary.

## Checkpoint Deliverables

- User can sign in with Google.
- User profile page renders saved data.

## Acceptance Criteria

- Signed-out players can access offline mode.
- Signed-in players can access saved play mode.
- Auth state survives refresh.

---

# Milestone 14: Autosave and Lightweight Data Model

## Goal

Persist signed-in player progress after major events.

## User Progress Shape

```ts
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
```

## Autosave Events

- Plant discovered
- Plant pollinated
- Failed pollination attempt
- Map area unlocked
- Badge earned
- Journal entry unlocked
- Customization updated

## Tasks

- Create database schema.
- Create progress load endpoint.
- Create progress save endpoint.
- Add debounced autosave client.
- Add optimistic state updates.
- Add save error handling.
- Add resume-from-save behavior.
- Add loading and empty states.

## Checkpoint Deliverables

- Signed-in progress saves after major events.
- Reloading the game restores saved progress.

## Acceptance Criteria

- Progress is not lost after page refresh.
- Save errors are handled without crashing the game.
- Offline mode never writes saved progress.

---

# Milestone 15: Offline 10-Minute Mode

## Goal

Make non-auth play meaningful and intentional.

## Framing

“You are a pollinator. Your time is short. Explore, pollinate, and learn as much as you can.”

## Rules

- 10-minute timer
- Full open-world access
- No saved progress
- No account required
- No leaderboard

## End Screen Metrics

- Plants discovered
- Plants pollinated
- Map explored
- Favorite fact found

## Tasks

- Build `/offline` route.
- Add temporary pollinator selection.
- Add 10-minute countdown timer.
- Use session-only game state.
- Add end-run screen.
- Add restart option.
- Add sign-in CTA after run.

## Checkpoint Deliverables

- User can complete a full offline run.
- End screen summarizes the run.

## Acceptance Criteria

- Offline mode does not require auth.
- Offline progress clears after run/reset.
- End screen feels complete, not like an error state.

---

# Milestone 16: Audio and Feedback

## Goal

Add atmosphere and satisfying feedback.

## MVP Audio Target

- 1 music loop
- 6 to 10 sound effects

## Sound Effects

- Discovery
- Pollination start
- Success
- Failure
- Journal unlock
- Badge unlock
- UI click or confirm

## Tasks

- Add audio manager.
- Add volume controls.
- Add music loop.
- Add area ambience hooks.
- Add sound effects to major events.
- Add mute toggle.

## Checkpoint Deliverables

- Game has music and event sound effects.
- Player can control audio.

## Acceptance Criteria

- Audio does not autoplay in a browser-hostile way.
- Volume controls work.
- Sounds reinforce gameplay without becoming annoying.

---

# Milestone 17: Landing, Onboarding, and Tutorial

## Goal

Make the game understandable for first-time players.

## Tasks

- Build final landing page.
- Explain the premise clearly.
- Add mode selection:
  - Sign in with Google
  - Offline 10-minute run
- Add brief controls tutorial.
- Add first-time gameplay hints.
- Add tutorial prompts for:
  - movement
  - altitude
  - plant discovery
  - pollination
  - journal unlocks

## Checkpoint Deliverables

- New player can start without external explanation.
- Controls are easy to find.

## Acceptance Criteria

- Landing page clearly explains Scout.
- Player understands how to move and pollinate.
- Tutorial can be dismissed or completed cleanly.

---

# Milestone 18: Visual Polish

## Goal

Make the MVP feel cute, positive, and shareable.

## Visual Direction

- Cute
- Positive
- 8-bit-adjacent
- Lightweight 3D
- Friendly ecology tone

## Tasks

- Finalize color palette.
- Polish UI components.
- Add consistent typography.
- Improve plant visuals.
- Improve pollinator visuals.
- Improve map readability.
- Add lightweight particles or trail effects.
- Add success and discovery animations.
- Add loading screens.
- Add empty states.

## Checkpoint Deliverables

- Game has a consistent visual identity.
- UI and 3D scene feel connected.

## Acceptance Criteria

- MVP feels charming, not purely technical.
- Important UI is readable.
- Game remains performant on desktop browsers.

---

# Milestone 19: Credits, Accessibility, and Compliance Basics

## Goal

Prepare the MVP for public sharing.

## Tasks

- Add plant/photo credits page.
- Add source fields for public plant photos.
- Add readable text sizing.
- Add volume controls.
- Add reduced motion option.
- Add keyboard-first support for UI flows.
- Add basic error states.
- Add privacy note for Google sign-in and saved progress.

## Checkpoint Deliverables

- Credits page exists.
- Accessibility basics are implemented.

## Acceptance Criteria

- Photos can be attributed.
- Core UI can be used with keyboard and mouse.
- Reduced motion setting affects major nonessential animations.

---

# Milestone 20: QA, Deployment, and Launch Readiness

## Goal

Ship a stable Frick Park MVP.

## Tasks

- Add smoke tests for key routes.
- Test signed-in flow.
- Test offline mode.
- Test autosave and resume.
- Test journal unlocks.
- Test badge unlocks.
- Test pollination success/failure.
- Test browser refresh behavior.
- Test deployment build.
- Deploy to Vercel.
- Add basic analytics.
- Create launch checklist.

## Checkpoint Deliverables

- MVP is deployed.
- Core flows are tested.
- Launch checklist is complete.

## Acceptance Criteria

- Signed-in user can complete the core loop and resume later.
- Offline user can complete a 10-minute run.
- No critical console errors appear during normal play.
- Vercel production deployment works.

---

# Suggested Build Order

Use this order unless technical constraints require adjustment:

1. Project Foundation
2. Game Scene Foundation
3. Desktop Flight Controls
4. Client Game State
5. Starter Pollinator System
6. Pollinator Customization
7. Frick Park Map Experience
8. Native Plant Data Layer
9. Plant Discovery System
10. Pollination Interaction System
11. Journal System
12. Badge and Progression System
13. Auth and User Profile
14. Autosave and Data Model
15. Offline Mode
16. Audio and Feedback
17. Landing, Onboarding, and Tutorial
18. Visual Polish
19. Credits, Accessibility, and Compliance Basics
20. QA, Deployment, and Launch Readiness

## Codex Execution Notes

When using Codex, work milestone by milestone.

For each milestone:

1. Inspect the current codebase.
2. Identify existing files and conventions.
3. Implement only the current milestone scope.
4. Preserve existing comments and formatting where possible.
5. Avoid deleting existing code unless required.
6. Run build or typecheck after implementation.
7. Summarize changed files and remaining issues.

Do not skip ahead to later systems unless the current milestone requires scaffolding for them.

## MVP Completion Definition

The MVP is complete when:

- A signed-in user can choose, customize, and save a pollinator.
- The user can explore a seamless Frick Park-inspired map.
- The user can discover and pollinate native plants.
- The user can unlock journal entries and badges.
- Progress autosaves and resumes correctly.
- Offline users can play a full 10-minute session.
- The game has basic music, sound effects, onboarding, credits, accessibility settings, and launch polish.
- The app is deployed to Vercel and passes core QA.

## Future Multiplayer Guardrail

Do not build multiplayer in the MVP.

Design choices should avoid blocking future multiplayer, but multiplayer systems should wait until after the single-player Frick Park experience is complete.

Future multiplayer may include:

- Other pollinators visible in the world
- Seasonal community pollination events
- Map-specific pollinator unlocks
- New city maps
- Shared ecology goals
- Cooperative habitat restoration events
