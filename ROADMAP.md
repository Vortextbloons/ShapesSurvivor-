# Shapes Survivor - Version 0.9 Roadmap

## Overview
Version 0.9 represents a major content and systems expansion, focusing on endgame progression, build diversity, and quality-of-life improvements. This update bridges the gap to version 1.0 by adding the final core systems needed for a complete roguelike experience.

## Theme: **The Ascension Update**

---

## Major Features

### 1. Meta Progression System
**Status: Planned**

Introduce persistent upgrades that carry between runs:
- **Essence System**: Collect "Essence" from runs (scales with time survived and kills)
- **Unlock Tree**: Spend Essence to unlock:
  - New starting weapons/items
  - Permanent stat boosts (5-10% incremental bonuses)
  - New character archetypes
  - New game modes
- **Achievement System**: Track milestones (survive 20 minutes, kill 1000 enemies, etc.)
- **Statistics Tracker**: Record best runs, total playtime, lifetime kills

**Files to modify:**
- Create `src/progression/meta-progression.js`
- Update `src/core/game-engine.js` to track Essence
- Add `data/progression/unlocks.json`
- Add localStorage persistence
- Add new UI panel for Meta Progression

---

### 2. Additional Character Archetypes
**Status: Planned**

Expand character roster from 3 to 6 classes:

**New Characters:**
- **The Elementalist**: Focuses on elemental status effects (Burn, Freeze, Poison)
  - Passive: Status effects last 50% longer and deal 25% more damage
  - Passive: Applying 3 different status effects to same enemy triggers explosion
  - Lower base damage, higher status effect chance

- **The Engineer**: Deploys automated turrets and gadgets
  - Passive: Can deploy up to 3 turrets that auto-fire at enemies
  - Passive: Picking up items has chance to spawn temporary turret
  - Turrets inherit 50% of player stats

- **The Chronomancer**: Manipulates time and cooldowns
  - Passive: All cooldowns reduced by 25%
  - Passive: Chance to trigger "time dilation" - slow all enemies for 3 seconds
  - Special ability: Reverse time once per run (restore to 10 seconds ago)

**Files to modify:**
- Add to `data/archetypes/character-archetypes.json`
- Create 9 new exclusive artifacts (3 per class) in `data/archetypes/character-artifacts.json`
- Update `src/entities/player/player.js` for new passives
- Add turret system in new file `src/entities/deployables/turret.js`

---

### 3. Boss System
**Status: Planned**

Add unique boss encounters every 5 minutes:

**Boss Features:**
- Unique mechanics and attack patterns
- Multiple phases with different behaviors
- Guaranteed legendary/character item drops
- Screen-shake and dramatic visual effects
- Boss health bar at top of screen

**Initial Bosses:**
- **The Prism** (5 min): Geometric shape that splits into smaller versions
- **Void Titan** (10 min): Massive slow enemy with area denial attacks
- **The Swarm Mother** (15 min): Spawns waves of minions
- **Corrupted Core** (20 min): Multi-phase fight with shield mechanics

**Files to modify:**
- Create `src/entities/boss/boss.js`
- Add `data/gameplay/bosses.json`
- Update `src/core/game-engine.js` for boss spawn timing
- Add boss UI elements to `src/ui/ui-manager.js`

---

### 4. Challenge Modes
**Status: Planned**

Unlock alternate game modes through Meta Progression:

- **Endless Mode**: No boss spawns, pure survival for high scores
- **Boss Rush**: Fight bosses back-to-back with limited healing
- **Hardcore Mode**: Permadeath with extra rewards
- **Hyper Speed**: 2x game speed, 2x rewards
- **One-Hit Wonder**: Start with max stats but die in one hit

**Daily Challenge:** Pre-seeded run with modifiers, compete on leaderboard

**Files to modify:**
- Add `src/modes/game-modes.js`
- Update main menu with mode selection
- Add challenge modifiers to game engine

---

### 5. Expanded Enemy Roster
**Status: Planned**

Add 6 new enemy types for variety:

- **The Necromancer**: Ranged enemy that revives nearby dead enemies
- **Shield Bearer**: Has frontal shield that blocks projectiles
- **Teleporter**: Randomly teleports near player
- **Summoner**: Spawns weaker minions periodically
- **Mimic**: Disguised as loot drop, attacks when approached
- **Void Walker**: Phases through walls and ignores collision

**Files to modify:**
- Add to `data/gameplay/enemies.json`
- Update `src/entities/enemy/enemy.js` for new behaviors

---

### 6. New Legendary Items (10+)
**Status: Planned**

Expand legendary pool with build-defining items:

**Weapons:**
- **Black Hole Cannon**: Projectiles pull enemies together before exploding
- **Phoenix Blade**: Resurrect once per run on death with full HP
- **Singularity**: Creates orbit of projectiles that grow stronger over time

**Armor:**
- **Void Plate**: Teleport to random location when hit (5s cooldown)
- **Titan's Mantle**: Grow in size and power as HP increases

**Accessories:**
- **Time Sphere**: Slow down time for 5s every 30s
- **Greed's Gambit**: Double item drops but lose HP per pickup
- **Curse of Thorns**: Reflect 200% damage taken to attackers

**Artifacts:**
- **Philosopher's Stone**: Convert excess HP to damage
- **Ouroboros Ring**: Gain stacking buff each minute survived

**Files to modify:**
- Add to `data/gameplay/legendary-items.json`
- Implement special effects in relevant entity files

---

### 7. Quality of Life Improvements
**Status: Planned**

**UI/UX:**
- Mini-map showing enemy density
- Damage numbers floating from enemies
- Build summary at end of run (items, synergies, key stats)
- Quick restart button (no menu navigation needed)
- Settings menu: volume, screen shake toggle, damage number toggle

**Gameplay:**
- Auto-pickup radius increase item/stat
- Magnet effect that pulls XP gems to player
- Pause menu with options
- Save/Load system for mid-run saves
- Keybind customization

**Files to modify:**
- Add `src/ui/mini-map.js`
- Add `src/ui/damage-numbers.js`
- Add `src/ui/settings-menu.js`
- Update `src/core/game-engine.js` for save/load
- Add settings to localStorage

---

### 8. Audio System
**Status: Planned**

Add sound effects and music:

- Background music (menu theme, gameplay themes)
- Sound effects for:
  - Attacks/impacts
  - Level up
  - Item pickup
  - Boss warnings
  - Death/victory
- Volume controls in settings menu

**Files to modify:**
- Create `src/audio/audio-manager.js`
- Add `data/audio/` directory with sound file references
- Integrate with game events

---

### 9. Synergy System Expansion
**Status: Planned**

Add 10 new synergies to encourage diverse builds:

- **Arcane Overload**: Having 5+ cooldown reduction items grants instant cooldowns on crit
- **Fortress**: 3+ armor items creates shield that regenerates out of combat
- **Speed Demon**: High move speed + dash item = leave damaging trail
- **Glass Cannon**: Low HP + high damage = exponential damage scaling
- **Vampire Lord**: Leech + Crit + Execute = gain max HP on kills

**Files to modify:**
- Update synergy detection in `src/effects/effect-utils.js`
- Add new synergy definitions to relevant data files

---

### 10. Visual Polish
**Status: Planned**

- Particle effects for status applications
- Screen shake for impacts (with toggle)
- Smoother animations for projectiles
- Better elite enemy visual distinction (glowing auras)
- Boss entrance animations
- Victory/defeat screen improvements

**Files to modify:**
- Update `src/rendering/visual-effects.js`
- Add particle system to `src/rendering/particle-system.js`
- Enhance boss/elite rendering

---

## Technical Improvements

### Performance Optimizations
- Object pooling for projectiles and enemies
- Spatial partitioning improvements for collision detection
- Render culling for off-screen entities
- Memory leak fixes and profiling

### Code Quality
- Better error handling and logging
- Code documentation improvements
- Refactor large files into smaller modules
- Type checking with JSDoc comments

### Testing
- Automated test suite for core systems
- Performance benchmarking
- Cross-browser compatibility testing

---

## Release Timeline

### Phase 1: Foundation (Weeks 1-2)
- Meta progression system
- Save/load system
- Settings menu
- Audio infrastructure

### Phase 2: Content (Weeks 3-4)
- 3 new character archetypes
- Boss system with 4 bosses
- 6 new enemy types
- 10 new legendary items

### Phase 3: Modes & Polish (Weeks 5-6)
- Challenge modes
- New synergies
- Visual effects and polish
- Mini-map and QoL features

### Phase 4: Testing & Balance (Week 7)
- Bug fixes
- Balance tuning
- Performance optimization
- Final testing

---

## Version 1.0 Outlook

Version 0.9 sets the foundation for 1.0, which will include:
- Multiplayer co-op mode
- Workshop/mod support
- Full campaign mode with story
- Leaderboards and competitive modes
- Mobile app release
- Final balance pass and feature-complete status

---

## Community Feedback

We welcome feedback on this roadmap! Priorities may shift based on:
- Player suggestions
- Technical feasibility
- Testing results
- Development time constraints

**Last Updated:** December 23, 2024
**Target Release:** Q1 2025
