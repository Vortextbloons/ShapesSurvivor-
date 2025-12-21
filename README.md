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

### Version 0.1
- Initial release of the core game engine.
- Basic player movement and combat mechanics.
- Implementation of the data-driven loot and affix system.
- Added basic enemy types and wave spawning.
- Level-up system with reward selection.
- Inventory and equipment management.
- Visual effects and status effect framework.
### Version 0.3 
feat: Enhance item generation and archetype systems

- Updated NameGenerator to allow for custom archetype nouns in generated names.
- Introduced new properties (family and tags) for weapon archetypes to improve categorization and behavior.
- Implemented family-based weighting in weapon archetype selection to favor specific types during item generation.
- Added support for armor and accessory archetypes in item generation, including stat pools and modifiers.
- Created BossChest class for automatic loot generation upon player proximity, biased towards higher rarity items.
- Developed accessory and armor archetype definitions with stat pools for enhanced item diversity.
- Enhanced visual effects for aura effects with customizable colors.
- Improved CSS styles for UI elements, including synergy panels and responsive design adjustments.
- Added README documentation for project overview and patch notes.
### Version 0.4
feat: Update item generation and effects system

- Increased maxHp penalty for "Cursed" affix from -18 to -69.
- Adjusted boss AI minion spawn settings: cooldown increased from 210 to 250, minion count reduced from 5 to 4.
- Replaced stat-pools.js reference with artifact-archetypes.js in index.html.
- Enhanced game engine to support special effects from items, including new flags for various effects.
- Added rendering for affixes and effects in item tooltips.
- Implemented new effect description utility in effect-utils.js.
- Introduced knockback resistance for bosses in enemy.js.
- Updated player.js to account for affix families and tags.
- Removed redundant stat pool functions and consolidated archetype picking logic.
- Deleted obsolete affix-pools.js file.
- Refactored item generation logic to utilize new fillStatsFromPool function.
- Enhanced item-utils.js to support artifact archetypes.
- Loaded new unified affix pool in data-loader.js.
- Improved tooltip styling in style.css for better readability.
- Added artifact archetypes with stat pools for new item types.
### vERSION 0.5 
feat: Enhance item generation with new weapon effects and enhancements

- Removed effect affixes from data loader and added new methods to load weapon effects and enhancements.
- Introduced new JSON files for weapon effects and enhancements with various attributes and effects.
- Updated CSS to include styles for a new buffs panel.
- Created a new HTML page for item generation testing, including controls for item type and rarity filtering.
- Implemented JavaScript logic for generating items and calculating average stats by rarity.
