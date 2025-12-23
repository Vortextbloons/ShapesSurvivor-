# Changelog

All notable changes to Shapes Survivor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Version 0.9.0 - The Ascension Update (In Development)

See [ROADMAP.md](ROADMAP.md) for comprehensive planning details.

#### Planned - Meta Progression
- Essence currency earned from runs
- Persistent unlock tree for characters, items, and stat boosts
- Achievement system
- Statistics tracker (best runs, total kills, playtime)

#### Planned - New Content
- 3 new character archetypes (Elementalist, Engineer, Chronomancer)
- 9 new character-exclusive artifacts
- Boss system with 4 unique bosses
- 6 new enemy types
- 10+ new legendary items
- 10 new synergies

#### Planned - Game Modes
- Endless Mode
- Boss Rush Mode
- Hardcore Mode
- Hyper Speed Mode
- One-Hit Wonder Mode
- Daily Challenge system

#### Planned - Quality of Life
- Mini-map with enemy density
- Floating damage numbers
- End-run build summary
- Quick restart button
- Settings menu (volume, toggles, keybinds)
- Auto-pickup radius stat
- XP magnet effect
- Pause menu
- Save/load system
- Keybind customization

#### Planned - Audio
- Background music system
- Sound effects for combat, level up, items, bosses
- Volume controls

#### Planned - Visual Polish
- Particle effects for status effects
- Screen shake system (with toggle)
- Smoother projectile animations
- Enhanced elite enemy visuals
- Boss entrance animations
- Victory/defeat screen improvements

#### Planned - Technical
- Object pooling for performance
- Improved spatial partitioning
- Render culling
- Better error handling
- Code documentation
- Automated test suite

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
