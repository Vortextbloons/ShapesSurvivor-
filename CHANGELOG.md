# Changelog

All notable changes to Shapes Survivor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.8] - Synergy Update

### Added

#### Synergy System
- **New Synergy System**: Items now synergize to create powerful combo effects
  - **Arcane Overload**: 5+ cooldown reduction items grants instant cooldowns on critical hits
  - **Fortress**: 3+ armor items creates a regenerating shield when out of combat
  - **Speed Demon**: High move speed leaves a damaging trail
  - **Glass Cannon**: Below 50% max HP, damage scales with missing health
  - **Vampire Lord**: Combining lifesteal, crit, and execute effects grants max HP on kills
- Synergy activation displays floating text notification
- Synergy effects persist while requirements are met

#### New Stats
- **Pickup Radius**: New stat that increases item collection range
- **Magnet Strength**: New stat for attracting pickups towards player

### Technical
- Added `synergies.json` data file with synergy definitions
- Added synergy checking to player stat recalculation
- Updated data loader to support synergy definitions

## [0.9.2] - Balance Update

### Changed
- **Engineer Turrets**: Massively buffed turret effectiveness
  - Stat inheritance increased from 50% to 100% (turrets now inherit full player stats)
  - Item pickup turret spawn chance increased from 15% to 100% (guaranteed spawn)
  - Turret duration increased from 10 seconds to 30 seconds
- **Crit Chance Improvements**: Enhanced critical strike viability
  - Precision affix crit chance multiplier increased from 25-35% to 50-70%
  - All 14 legendary items with crit chance buffed by 2-2.5x
    - Grave Needle: 50% → 100% (guaranteed crits!)
    - Frostbite: 40% → 80%
    - Kingsbane: 30% → 60%
    - And 11 other legendary items improved

## [0.9.0] - The Ascension Update

### Added

#### New Character Archetypes
- **The Elementalist**: Master of elemental forces with status effect bonuses
  - Status effects last 50% longer and deal 25% more damage
  - Applying 3 different status effects triggers Elemental Overload explosion
  - Exclusive artifacts: Primal Core, Confluence Orb, Elemental Mastery
- **The Engineer**: Tactical turret deployer
  - Can deploy up to 3 turrets that inherit 50% of player stats
  - 15% chance to spawn temporary turret on item pickup
  - Exclusive artifacts: Overclocked Core, Repair Drone, Weapons Cache
- **The Chronomancer**: Time-bending mage
  - All cooldowns reduced by 25%
  - 5% chance per hit to trigger Time Dilation (slow all enemies for 3 seconds)
  - Can reverse time once per run
  - Exclusive artifacts: Temporal Anchor, Paradox Engine, Eternity Loop

#### New Enemy Types (6)
- **Necromancer**: Ranged enemy that revives nearby dead enemies
- **Teleporter**: Randomly teleports near player
- **Summoner**: Spawns weaker minions periodically
- **Mimic**: Disguised as loot drop, ambushes when approached
- **Phase Walker**: Phases through walls and ignores collision

#### New Legendary Items (10+)
- **Black Hole Cannon**: Projectiles create gravity wells that pull enemies before exploding
- **Phoenix Blade**: Resurrect once per run on death with full HP, applies burning
- **Singularity**: Orbiting projectiles that grow stronger over time
- **Void Plate**: Teleport to random location when hit (5s cooldown)
- **Titan's Mantle**: Grow in size and power as HP increases
- **Time Sphere**: Slow down time for 5s every 30s with damage bonus
- **Greed's Gambit**: Double item drops but lose HP per pickup
- **Curse of Thorns**: Reflect 200% damage taken to attackers
- **Philosopher's Stone**: Convert excess HP (overheal) into bonus damage
- **Ouroboros Ring**: Gain stacking buff every minute (+5% all stats per stack)

#### Meta Progression System (Foundation)
- Essence currency calculation system
- Achievement tracking infrastructure
- Statistics persistence (best runs, total kills, playtime)
- LocalStorage integration for persistence

#### Boss System (Data)
- 4 unique bosses defined (The Prism, Void Titan, Swarm Mother, Corrupted Core)
- Multi-phase boss mechanics
- Boss-specific abilities and attack patterns

### Changed
- Updated version to 0.9.0
- Enemy spawn table updated to include new enemy types

---

## [Unreleased]

### Planned Features
See [ROADMAP.md](ROADMAP.md) for comprehensive planning details.

---

## [Released]

## [0.8.5] - 2024-12-XX

### Changed
- Current stable version
- Bug fixes and minor improvements

## [0.8.0] - The Archetype Update

### Added
- **Character Archetypes**: 3 unique classes (Shadow Stalker, The Colossus, The Hoarder)
- **Centralized Buff System**: New BuffManager for complex status effects
- **Character-Exclusive Artifacts**: 9 new artifacts (3 per class)
- **Character Rarity Tier**: Pink rarity for class-exclusive items
- **Elite Modifiers**: Random modifiers for elite enemies (Firebrand, Phase Shifter, Bulwark)
- **Overheal System**: Ability to exceed max HP with purple health bar
- **Splintering Projectiles**: Chance for projectiles to split on hit
- **Class-Specific Passives**: Unique mechanics for each archetype

### Changed
- Enhanced stats panel showing Regen/s, CDR, and Luck
- Improved mobile tooltip positioning
- Fully data-driven loading system for archetypes and modifiers

## [0.7.0] - Mobile Fix

### Fixed
- Mobile compatibility issues resolved

## [0.65.0] - UI Overhaul

### Added
- New UI system for smoother gameplay
- Dynamic tooltips with pin functionality
- Improved mobile controls with joystick
- Enhanced mobile controls test page

### Changed
- Clearer display of health, XP, inventory, and stats
- More responsive UI interactions

## [0.6.0] - Legendary Items & Enemy Variety

### Added

#### New Legendary Items
- **Bloodthirst**: Legendary blade with heal-on-hit and execute
- **Fortitude**: Massive health boost and damage reduction
- **Luck's Grin**: Increased rarity find chance
- **Void Walker**: Ignores enemy resistances
- **Infernal Wrath**: Fire aura that ignites nearby enemies
- **Frostbite**: Heavy slow with critical damage to chilled targets
- **Stormcaller**: Lightning chains through enemy packs
- **Tempest**: Rapid multi-shot weapon
- **Kingsbane**: Huge execution damage at low health
- **Grave Needle**: High crit chance and critical damage

#### New Enemies & Behaviors
- **The Charger**: Aggressive dash attack from distance
- **The Spitter**: Ranged enemy with projectile attacks
- **The Splitter**: Bursts into multiple Swarmers on death
- Improved enemy AI with distinct movement patterns

#### New Effects & Enhancements
- Elemental effects: Ember (Burn), Frost (Slow), Venom (Poison)
- Executioner effect: Double damage to low-health enemies
- Critical Momentum: Stacking damage on crits
- Slowed Prey: Bonus damage to slowed enemies

### Changed
- Rare accessories: 50% chance for enhancements (Epic+ guaranteed)
- Level Up sidebar restored with current gear display

### Removed
- Equipment upgrade system
- Cursed items

### Performance
- Massive improvements for high-density enemy waves
- Rebuilt stat calculation system
- Smarter item generation
- Spatial grid optimization for proximity lookups

## [0.5.0] - Weapon Effects

### Added
- Unique weapon effects and enhancements
- New item types for build customization
- Buffs panel to track power-ups
- Item generator test page

## [0.4.0] - Artifacts & Tooltips

### Added
- Artifacts and rare items for build diversity
- Clearer tooltips

### Changed
- Bosses are tougher with minion spawning
- New item effects
- Improved UI readability

## [0.3.0] - Loot Expansion

### Added
- New weapons, armor, and accessories
- Boss chests with better loot drops
- More item variety and effects

### Changed
- Improved visuals and UI polish

## [0.1.0] - Initial Release

### Added
- Core gameplay, movement, and combat systems
- Loot collection and leveling
- Wave-based enemy spawning
- First batch of weapons and enemies
- Basic visual effects
- Initial UI and controls

---

## Version History Summary

- **0.9.x** (Planned): The Ascension Update - Meta progression, bosses, new modes
- **0.8.x** (Current): The Archetype Update - Character classes and exclusive items
- **0.7.x**: Mobile compatibility fixes
- **0.6.x**: Legendary items and enemy variety
- **0.5.x**: Weapon effects and enhancements
- **0.4.x**: Artifacts and improved bosses
- **0.3.x**: Loot expansion
- **0.1.x**: Initial release

[Unreleased]: https://github.com/Vortextbloons/ShapesSurvivor-/compare/v0.8.5...HEAD
[0.8.5]: https://github.com/Vortextbloons/ShapesSurvivor-/releases/tag/v0.8.5
[0.8.0]: https://github.com/Vortextbloons/ShapesSurvivor-/releases/tag/v0.8.0
