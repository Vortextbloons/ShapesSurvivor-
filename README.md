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

### Version 0.9.8: The Soul & Status Overhaul
- **Character Rework: The Wraith**:
    - The Archer has been reborn as the **Wraith**, a master of souls.
    - **Soul Siphon**: Kills now spawn seeking Soul Projectiles that provide massive chain reaction potential.
    - **Exclusive Artifacts**: 
        - **Lantern of Lost Souls**: Spawns souls in trios.
        - **Reaping Scythe**: Souls pierce enemies and grant 5x XP.
        - **Mortuary Plate**: Grants overheal up to 2x Max HP and permanent health on soul kills.
- **New Status Effects**:
    - **Bleed**: A new stackable damage-over-time effect that ignores resistances.
    - **Detonation**: Hits apply charges that accumulate damage and explode after a short delay.
- **New Legendary Gear**:
    - **Solar Flare**: A devastating legendary beam weapon that releases explosive projectiles on enemy death.
    - **Temporal Detonator**: A legendary artifact that applies Detonation charges to all attacks.
    - **Aegis of the Immortal**: Reworked to grant temporary immortality after taking cumulative damage.
- **Difficulty & Balance Adjustments**:
    - **Elite Spawns**: Significant increase to Elite spawn rates on Hard (+50%) and Nightmare (+100%).
    - **AoE Scaling**: Most secondary effects like Chain Lightning, Maelstrom, and Shatter now correctly scale with your Area of Effect stat.
    - **Scholar's Loop**: Now grants a massive XP bonus when defeating Elites (10% of level).
    - **Luck's Grin**: Now grants an "Affix Floor," guaranteeing more modifiers on looted gear.
- **System Improvements**:
    - **Static Charge**: Refined movement tracking and discharge logic.
    - **Thorns Mastery**: Significant buff to base damage and AoE radius.
    - **Beam Customization**: Beam weapons now support custom core, glow, and beam colors.
    - **Homing Logic**: Optimized projectile homing for Soul Projectiles and other seeking effects.

### Version 0.9.7.5: The Beam & Difficulty Refinement Update
- **New Weapon Type: Beams**:
    - Introduced the **Lightning Rod**, a new weapon featuring persistent beam behavior.
    - Full engine support implemented for active beam management and rendering.
- **Difficulty-Specific Performance Tracking**:
    - High scores (Best Time, Kills, Level) are now tracked and saved individually for each difficulty setting.
    - Game Over screen now displays your performance relative to your best run for the selected difficulty.
- **Massive Weapon Rebalance**:
    - **Knockback Pass**: Standardized and generally reduced knockback across almost all weapons to improve combat flow and grouping.
    - **Scepter & Unstable Scepter**: Significant buffs to base damage and cooldown reductions.
    - **Aura Weapons (Lantern, Censer, Totem)**: Major damage increases across the board to improve clear speeds.
    - **Dagger**: Slight nerfs to crit stats and projectile count for better alignment with other uncommon weapons.
    - **Alchemical Flask**: Now available as an **Uncommon** drop (was Rare) with refined AoE and cooldowns.
- **Entity & Enemy Scaling**:
    - **XP Rewards**: Increased XP from most standard enemies to smooth out early-to-mid game progression.
    - **Spitters**: Reduced projectile speed and increased cooldown.
    - **Bosses**: Rebalanced to be more lethal but less "bullet spongy" (Increased damage multiplier, decreased HP scaling).
- **Legendary Item Updates**:
    - **Star Crown**: Massive buff! Now triples the effectiveness of Essence boosts and provides additional XP and Crit stats.
    - **Volcano**: Increased base damage and significantly buffed burn tick damage.
    - **Calamity Ring**: Refined crit scaling behavior.
- **Affix & Enhancement Tuning**:
    - **Crit Damage**: Standardized crit damage affixes and expanded availability to Armor types.
    - **Pool Weights**: Adjusted weights for several enhancements to improve gear variety.

### Version 0.9.7: The Boss & Balance Update
- **Boss Warning System**:
    - Beware: A new warning indicator "⚠ CLEAR REMAINING ENEMIES ⚠" now appears when a boss is ready to enter the fray.
    - Bosses now wait until you've cleared the current wave before spawning, ensuring a fair (but deadly) 1v1 encounter.
- **New Artifact: Phoenix Talons**:
    - Discovered a new Epic Artifact! The **Phoenix Talons** grant innate Burn on Hit and the power to defy death once per run.
- **Affix Overhaul & Balance**:
    - **Echoing**: Massive buff to activation chance (25% -> 50%).
    - **Leaching & Shocking**: Expanded availability to more gear types, including Armor.
    - **Stat Buffs**: Significant buffs to *Haste*, *Power*, and *Precision* affixes to keep them competitive with later-game gear.
- **System Refinements**:
    - **Status Caps**: Introduced hard caps for status effect duration and intensity (e.g., maximum slow, maximum damage taken) to ensure game stability.
    - **Improved Tooltips**: Stat breakdowns now include even more detailed information about hidden attributes like projectile count and pierce.
    - **Visual Polish**: Integrated a new screen shake system for impactful critical hits and explosions.

### Version 0.9.6: The Foundation & Persistence Update
- **Persistent High Scores**: 
    - Your greatest feats are now immortalized! The new **Save System** tracks and persists your Best Time, Kills, and Level across sessions.
- **Under-the-Hood Refactor**:
    - **Entity System**: Standardized all combatants under a unified `Entity` class, leading to more consistent health and status effect behavior.
    - **UI Decoupling**: Migrated hud and inventory logic into dedicated managers (`HUDManager`, `InventoryUI`), paving the way for more complex future interfaces.
- **Dynamic Loot Generation**:
    - Migrated weapons to a more flexible **Weapon Pool** system. This allows for better rarity-gated drops and more varied weapon combinations.
- **Performance Improvements**:
    - Introduced **Particle Pooling**, significantly reducing memory pressure and frame drops during intense combat with many effects.

### Version 0.9.5: The Ascendant Crit & Elemental Update
- **Crit Tier System**:
    - Critical strikes have evolved! Scaling Critical Chance beyond 100% now unlocks higher **Crit Tiers** (up to Tier 5), each granting massive damage multipliers.
    - Look for tier indicators (★) and new color-coded damage numbers in combat.
- **New Enhancement: Critical Ascension**:
    - Grants a chance for your critical hits to "ascend" to the next tier, even beyond your current stats.
- **New Character: Archon**:
    - A master of status effects who gains power for every unique ailment applied to an enemy.
    - Includes exclusive artifacts like the **Chaos Prism** and **Prismatic Core**.
- **Character Reworks & Renaming**:
    - The Elementalist is now the **Archon**, with balanced elemental scaling.
    - The Harvester has been renamed to the **Wraith**.
    - The Engineer is now **Automata**, featuring improved turret scaling.
    - The Colossus has been reborn as the **Behemoth**, with even greater vitality.
    - The Hoarder is now the **Plunderer**, with improved item find mechanics.
- **Affix Tokens & Customization**:
    - Use the new **Transmuter** trait to gain **Affix Tokens** on level up. Use these tokens in the inventory to add new random attributes to your gear.
- **Boss Strengthening**:
    - Beware: Bosses now grow stronger the longer the fight lasts, gaining speed and power over time.
- **Balance & Polish**:
    - **Starting Traits**: Substantially buffed the *All Rounder* trait and refined *Echoing Strikes* ricochet logic.
    - **Loot Drops**: Normalized drop rates for Artifacts across the run.
    - **UI Improvements**: Better character stat breakdowns, improved inventory sorting, and refined tooltips.

### Version 0.9.0: The Traits & Difficulty Update
- **Starting Trait System**:
    - Players now choose a unique **Starting Trait** at the beginning of each run, providing powerful build-defining modifiers.
    - **Echoing Strikes**: Hits have a chance to strike twice or projectiles to ricochet.
    - **All Rounder**: Solid boosts to damage, health, and speed.
    - **Merchant's Affinity**: Level up and get the chance to refresh your reward choices.
    - **Blood Pact**: High lifesteal; at full health, gain permanent Max HP instead.
- **Difficulty Selection**:
    - Introduced four difficulty tiers: **Easy**, **Normal**, **Hard**, and **Nightmare**.
    - Higher difficulties increase enemy strength and speed while reducing spawn intervals.
- **Legendary Loot Drop**:
    - A massive haul of **Legendary Gear** added! Discover legendary Armor, Accessories, and Artifacts with unique game-changing effects.
- **Balance & Adjustments**:
    - **Movement**: All characters have received a base movement speed increase.
    - **Combat**: Enemies move slightly slower but deal significantly more damage on contact.
    - **Sustain**: Greatly improved "Life on Kill" attributes across all gear types.
    - **System**: Centralized difficulty scaling and improved character selection flow.

### Version 0.8.10
- **New Weapon Archetypes**:
    - **Orbiting Blades**: High-speed rotating blades that shred nearby enemies.
    - **Spirit Orbs**: Multiple ethereal orbs that circle the player, providing consistent protection.
- **New Artifacts & Effects**:
    - **Shadow Cloak**: Grants temporary invulnerability upon taking damage (with a cooldown).
    - **Soul Reaper**: Harvesting souls now grants a stacking damage buff and restores health on kill.
- **New Affixes**:
    - **Expansion**: A new multiplicative Area of Effect modifier available on Artifacts, Accessories, and Armor.
- **Balance Adjustments**:
    - **Characters**: Plunderer's Rarity Find increased (1.25% -> 10%). The Juggernaut's base HP adjusted (120 -> 100).
    - **Orbital Mechanics**: Orbit distance is now a dedicated stat. Orbital speed now scales with Cooldown (one full rotation per cooldown cycle).
    - **Crit Rebalance**: Reduced base Critical Damage Multipliers across most weapons while slightly increasing base Critical Chance for better consistency.
    - **Area of Effect**: Migrated many flat AoE bonuses to multiplicative percentages (Layer 2) for better late-game scaling.
    - **Enemies**: Regenerator HP regen quadrupled. Bulwark HP multiplier increased. Swift movement speed increased.
    - **Enhancements**: Overdrive now triggers after 30 hits (was 50).
- **UI & Quality of Life**:
    - **Detailed Stat Breakdowns**: Hovering over stats in the character panel now shows a color-coded breakdown of Base, Additive, Multiplicative, and Buff layers.
    - **Sacrifice System**: Added a "Consume Essence" button to reward modals to skip rewards for alternative benefits.
    - **Buff Tracking**: Centralized buff display system; conditional buffs like *Berserker Rage* and *Last Stand* now appear in the HUD.
- **Technical**:
    - **Centralized Constants**: Moved combat timings and color palettes to `GameConstants`.
    - **Buff System Refactor**: Migrated legacy conditional logic into a centralized `BuffManager`.

### Version 0.8.5: The Automation & Status Overhaul
- **New Character: Automata**:
    - **Twin Sentries**: Automatically deploys two rotating turrets that inherit 50% of Automata's stats and all weapon effects.
    - **Exclusive Artifacts**: Overclock Module (Speed), Tesla Coil (Stun/Chain), and Nanobot Swarm (Lifesteal).
- **Status Effect System Refactor**:
    - **Standardized Registry**: Status effects now use a centralized application system for better consistency.
    - **Slow Stacking**: Reaching 3 stacks of Slow on an enemy now triggers a **Freeze** effect for 5 seconds.
    - **New Statuses**: Added Shock (Damage Taken), Fear (Fleeing), and Vulnerability (Resistance Reduction).
- **Balance Changes**:
    - **Health Scaling**: `maxHp` bonuses on Accessories and Artifacts converted to multipliers (Layer 2) for better late-game scaling.
    - **Weapon Effects**: Ember burn damage (5% -> 15%), Venom poison damage (1.25% -> 5%), Maelstrom pull strength/range increased.
    - **Enhancements**: Slowed Prey damage bonus (25% -> 40%), Vampiric Aura healing (1 -> 5) and range increased.
    - **Rarity Shifts**: Glass Soul and Chaos Embrace moved from Legendary to Epic rarity.

### Version 0.8: The Archetype Update
- **Character Archetypes**: Introduced three unique classes with distinct playstyles:
    - **Shadow Stalker**: A high-risk, high-reward assassin focused on critical strikes.
    - **Behemoth**: A massive tank that scales damage with maximum health.
    - **Plunderer**: A loot specialist that gains power from artifacts and gear.
- **Centralized Buff System**: New `BuffManager` handles complex status effects, stacking logic, and visual HUD indicators.
- **Character-Exclusive Artifacts**: 9 new powerful artifacts (3 per class) with fixed stats and unique special effects.
- **New Rarity Tier**: Added the **Character** rarity (pink) for class-exclusive items.
- **Elite Modifiers**: Elite enemies now spawn with random modifiers like **Firebrand**, **Phase Shifter**, and **Bulwark**, each with unique abilities.
- **Overheal System**: Players can now exceed their maximum HP through specific artifact effects, indicated by a purple health bar.
- **Combat Enhancements**: Added **Splintering** projectiles (chance to split on hit) and class-specific passives.
- **UI Improvements**: Enhanced stats panel showing Regen/s, CDR, and Luck. Improved mobile tooltip positioning.
- **Technical**: Fully data-driven loading system for all game archetypes and modifiers.

### Version 0.7
- Mobile Fixed

### Version 0.65
- New UI system for smoother gameplay experience.
- Tooltips now appear dynamically and can be pinned for easy reference.
- Health, experience, inventory, and stats are displayed more clearly.
- Improved mobile controls with a joystick test page.
- UI interactions are more responsive and intuitive.

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

### Version 0.5
- Weapons now have unique effects and enhancements.
- More ways to customize your build with new item types.
- Buffs panel added to track your power-ups.
- Try out the new item generator and see what you can find!

### Version 0.4
- Bosses are tougher and smarter—watch out for their minions!
- New item effects and clearer tooltips.
- Artifacts and rare items added for greater build diversity.
- UI and tooltips are easier to read.

### Version 0.3
- New weapons, armor, and accessories to discover!
- Boss chests now drop even better loot.
- More variety in items and effects—find your favorite combos.
- Improved visuals and a sleeker UI.

### Version 0.1
- The adventure begins! Core gameplay, movement, and combat are in.
- Collect loot, level up, and face waves of geometric foes.
- Try out the first batch of weapons, enemies, and visual effects.


