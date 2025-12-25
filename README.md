# Shapes Survivor

Shapes Survivor is a data-driven, action-roguelike "bullet heaven" game inspired by the survivor genre. Battle waves of geometric enemies, collect loot, and build powerful synergies to survive as long as possible.

## Features

- **Data-Driven Design**: Enemies, items, and affixes are all defined in JSON, allowing for easy balancing and expansion.
- **Deep Loot System**: Discover weapons and accessories with randomized affixes and rarities.
- **Synergy System**: Combine different effects and status conditions to create devastating combos.
- **Character Progression**: Level up to choose new rewards and upgrade your equipment.
- **Dynamic Combat**: Face off against increasingly difficult waves of enemies with unique behaviors.

## How to Play

- **Movement**: Use WASD or Arrow Keys to move your character.
- **Inventory**: Press **I** to open your character sheet and manage your equipment.
- **Survival**: Defeat enemies to gain experience and level up. Choose your upgrades wisely to survive the onslaught.

## Development

This project is built using vanilla JavaScript and HTML5 Canvas, focusing on a modular and extensible architecture.

---

## Patch Notes

### Version 0.9: The Ascension Update (Planned)
> **Status:** In Development - See [ROADMAP.md](ROADMAP.md) for full details

This major update introduces endgame content and quality-of-life improvements:

**Major Features (Planned):**
- **Three New Character Archetypes**: Elementalist, Engineer, and Chronomancer
- **Boss System**: Unique boss fights every 5 minutes with special mechanics and guaranteed legendary drops
- **Challenge Modes**: Endless, Boss Rush, Hardcore, and Daily Challenges
- **6 New Enemy Types**: Including Necromancers, Shield Bearers, and Mimics
- **10+ New Legendary Items**: Build-defining weapons, armor, and artifacts
- **Audio System**: Full sound effects and background music
- **Enhanced UI**: Mini-map, damage numbers, settings menu, and save/load system
- **New Synergies**: 10 additional build combos to discover
- **Visual Polish**: Particle effects, screen shake, boss animations, and more

**Timeline:** See [ROADMAP.md](ROADMAP.md) for phased release plan

---

### Version 0.8: The Archetype Update
- **Character Archetypes**: Introduced three unique classes with distinct playstyles:
    - **Shadow Stalker**: A high-risk, high-reward assassin focused on critical strikes.
    - **The Colossus**: A massive tank that scales damage with maximum health.
    - **The Hoarder**: A loot specialist that gains power from artifacts and gear.
- **Centralized Buff System**: New `BuffManager` handles complex status effects, stacking logic, and visual HUD indicators.
- **Character-Exclusive Artifacts**: 9 new powerful artifacts (3 per class) with fixed stats and unique special effects.
- **New Rarity Tier**: Added the **Character** rarity (pink) for class-exclusive items.
- **Elite Modifiers**: Elite enemies now spawn with random modifiers like **Firebrand**, **Phase Shifter**, and **Bulwark**, each with unique abilities.
- **Overheal System**: Players can now exceed their maximum HP through specific artifact effects, indicated by a purple health bar.
- **Combat Enhancements**: Added **Splintering** projectiles (chance to split on hit) and class-specific passives.
- **UI Improvements**: Enhanced stats panel showing Regen/s, CDR, and Luck. Improved mobile tooltip positioning.
- **Technical**: Fully data-driven loading system for all game archetypes and modifiers.

### Version 0.7
- Mobile FIxed
### Version 0.65
- New UI system for smoother gameplay experience.
- Tooltips now appear dynamically and can be pinned for easy reference.
- Health, experience, inventory, and stats are displayed more clearly.
- Improved mobile controls with a joystick test page.
- UI interactions are more responsive and intuitive.
### Version 0.1
- The adventure begins! Core gameplay, movement, and combat are in.
- Collect loot, level up, and face waves of geometric foes.
- Try out the first batch of weapons, enemies, and visual effects.

### Version 0.3
- New weapons, armor, and accessories to discover!
- Boss chests now drop even better loot.
- More variety in items and effects—find your favorite combos.
- Improved visuals and a sleeker UI.

### Version 0.4
- Bosses are tougher and smarter—watch out for their minions!
- New item effects and clearer tooltips.
- Artifacts and rare items added for greater build diversity.
- UI and tooltips are easier to read.

### Version 0.5
- Weapons now have unique effects and enhancements.
- More ways to customize your build with new item types.
- Buffs panel added to track your power-ups.
- Try out the new item generator and see what you can find!

### Version 0.6
**New Legendary Items**
- Bloodthirst - A legendary blade that heals you on hit and executes wounded foes
- Fortitude - Massive health boost and damage reduction armor
- Luck's Grin - Increases chances of finding higher-rarity loot
- Void Walker - Weapon that ignores enemy resistances for pure damage
- Infernal Wrath - Legendary fire aura that ignites everything around you
- Frostbite - Heavily slows enemies and deals massive critical damage to chilled targets
- Stormcaller - Lightning chains through packs of enemies
- Tempest - Rapid multi-shot weapon
- Kingsbane - Huge execution damage when foes are low on health
- Grave Needle - High crit chance and deadly critical damage

**New Enemies & Behaviors**
- The Charger - Aggressive enemy that winds up and dashes at you from a distance
- The Spitter - Ranged threat that keeps its distance while firing projectiles
- The Splitter - Large enemy that bursts into multiple fast Swarmers upon death
- Improved enemy AI with distinct movement patterns and strategies

**New Effects & Enhancements**
- Elemental effects now roll on weapons: Ember (Burn), Frost (Slow), Venom (Poison)
- Executioner effect - Deal double damage to enemies at low health
- Critical Momentum enhancement - Gain stacking damage bonuses on critical hits
- Slowed Prey enhancement - Deal bonus damage to slowed enemies

**Major Changes**
- Equipment upgrade system removed - focus is now on finding the best loot
- Cursed items removed from the game
- Rare accessories now have 50% chance for enhancements (Epic+ guaranteed)
- Level Up sidebar restored - see your current gear and artifacts
- Exit button added to Level Up menu to skip rewards and resume immediately

**Performance & Systems**
- Massive performance improvements for high-density enemy waves
- Stat calculation system rebuilt for more accurate power scaling
- Smarter item generation with consistent stats based on item type
- Spatial grid optimization for enemy proximity lookups
- Various UI polish and stability improvements

