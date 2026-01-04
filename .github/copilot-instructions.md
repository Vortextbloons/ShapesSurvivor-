# Copilot Instructions for Shapes Survivor

## Project Overview

Shapes Survivor is a data-driven, action-roguelike "bullet heaven" game inspired by the survivor genre. It's built using vanilla JavaScript and HTML5 Canvas with a focus on modular, extensible architecture.

## Technology Stack

- **Vanilla JavaScript** (ES6+): No frameworks, no build system
- **HTML5 Canvas**: For all game rendering
- **JSON**: Data definitions for enemies, items, affixes, and game balance
- **Static HTML/CSS**: UI and styling

## Project Structure

```
/
├── index.html              # Main HTML entry point with script loading order
├── style.css               # Global styles
├── src/
│   ├── core/               # Core game engine, input, dev mode
│   ├── entities/           # Game entities (player, enemy, projectile, pickups)
│   ├── items/              # Item generation system and constants
│   ├── effects/            # Status effects and effect utilities
│   ├── rendering/          # Visual effects and rendering utilities
│   ├── ui/                 # UI manager and UI components
│   └── utils/              # Data loader, stat calculator, random utilities
└── data/
    ├── archetypes/         # Item archetypes (weapon, armor, accessory, artifact)
    ├── gameplay/           # Enemies, affixes, enhancements, legendary items, weapon effects
    └── visuals/            # Projectile styles, visual effects
```

## Architecture Principles

### 1. Data-Driven Design
- **All game content is defined in JSON files** in the `/data` directory
- Enemies, items, affixes, and effects are loaded from JSON at runtime
- Balance changes should be made in JSON files, not in code
- JSON files use specific schemas - follow existing patterns when adding new data

### 2. Modular Code Organization
- Code is organized by functionality (entities, items, effects, ui)
- Each module should have a clear, single responsibility
- Global objects (like `Game`, `UIManager`, `LootSystem`) are used for cross-cutting concerns
- No module bundler - scripts are loaded in order via `<script>` tags in `index.html`

### 3. Performance-Critical Code
- The game uses spatial grid optimization (`SpatialGrid`) for enemy proximity lookups
- Fixed timestep for game logic (60 FPS)
- Object pooling for particles and effects
- Use `compactInPlace` for array cleanup instead of filter/map to reduce GC pressure

## Code Conventions

### Naming Conventions
- **Classes**: PascalCase (e.g., `Player`, `Enemy`, `UIManager`)
- **Functions**: camelCase (e.g., `recalculateStats`, `applyDamage`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DESIGN_WIDTH`, `STACK_DOT_DEFAULT_DURATION`)
- **Private class methods**: Prefix with `_` (e.g., `_initTooltipInteractivity`)
- **Global objects**: Capitalized (e.g., `Game`, `LootSystem`, `StatusEffects`)

### File Organization
- Each entity class should be in its own file
- Utility functions should be grouped by purpose
- Constants should be defined at the top of files or in dedicated constant files

### Comments
- Use comments sparingly - code should be self-documenting
- Add comments for complex algorithms or non-obvious behavior
- Use JSDoc-style comments for public APIs when helpful

### JavaScript Style
- Use `const` by default, `let` when reassignment is needed
- Prefer early returns over nested conditionals
- Use object destructuring when accessing multiple properties
- Use template literals for string interpolation
- No semicolons required (but be consistent in a file if they're present)

## Item System

### Item Structure
Items have the following key properties:
- `id`: Unique identifier
- `name`: Display name
- `type`: One of `weapon`, `armor`, `accessory`, `artifact`
- `behavior`: For weapons - `projectile`, `aura`, or `orbital`
- `icon`: Emoji icon for display
- `description`: User-facing description
- `modifiers`: Array of stat modifiers with operation type (add/multiply)
- `specialEffect`: Optional object with special effect data

### Stat Modifiers
Modifiers use a layered system:
- **Layer 0**: Base stats
- **Layer 1**: Item adds (default for most item modifiers)
- **Layer 2**: Item multipliers
- **Layer 3**: Buffs and temporary effects

Modifier format:
```javascript
{
  "stat": "baseDamage",
  "value": 50,
  "operation": "add", // or "multiply"
  "layer": 1
}
```

### Rarity System
Rarities (in order): `common`, `uncommon`, `rare`, `epic`, `legendary`
- Rarity affects stat budgets and affix counts
- Legendary items are unique named items with special effects
- Use `Rarity` constants from `rarity-system.js`

## Game Systems

### Combat System
- Player attacks automatically based on weapon cooldown
- Weapons can be projectile-based, aura-based, or orbital
- Status effects include: burn, poison, slow, freeze, stun
- Critical hits use `critChance` and `critDamageMultBase`

### Loot System
- Items are generated procedurally based on archetypes
- Affixes add randomized stat bonuses
- Enhancements add special effects to accessories
- Weapon effects add elemental or special behaviors

### Stat Calculation
- Stats are calculated using the `StatCalculator.Stat` class
- Supports layered modifiers with add and multiply operations
- Player stats are recalculated when equipment changes
- Use `recalculateStats()` to refresh all player stats

## UI Guidelines

### Modal System
- Modals pause the game when open
- Use existing modal structure for consistency
- Tooltips should work on both mouse hover and touch
- Mobile-first: ensure all interactions work on touch devices

### HUD Elements
- Health bar and XP bar are in the top-left HUD
- Buffs panel shows active status effects
- Run info (time/kills) is displayed at top-center
- Mobile controls include virtual joystick and inventory button

## Testing

### Manual Testing Process
- **No automated test framework** - all testing is manual
- Follow the checklist in `TEST_PLAN.md` for regression testing
- Test on both desktop and mobile (use DevTools device emulation)
- Always check the console for errors during testing
- Test specific scenarios when making changes to game systems

### Running the Game
1. Serve the directory with a static web server (e.g., VS Code Live Server)
2. Open `index.html` in a browser
3. Check the console for any errors on load

### Dev Mode
- Press **F1** to toggle dev mode on/off
- Dev mode hotkeys (only active when dev mode is enabled):
  - **F2**: Grant XP to level up
  - **F3**: Force level-up choice screen
  - **F4**: Heal to full
  - **F5**: Toggle god mode (invincibility)
  - **F6**: Kill all enemies on screen
  - **F7**: Grant a random legendary item
  - **F8**: Toggle pause spawns
  - **F9**: Toggle performance HUD
  - **F10**: Open dev gear granting modal (customized item creation)
- Use dev mode to test specific item combinations and scenarios

## Performance Considerations

### Critical Performance Areas
- Enemy spawning and AI (use spatial grid for lookups)
- Projectile updates (use object pooling)
- Particle effects (limit max particles, use compact arrays)
- Stat recalculation (only recalculate when equipment changes)

### Performance Best Practices
- Avoid creating new objects in the game loop
- Use `compactInPlace` for removing dead entities
- Cache DOM element references in `UIManager._els`
- Batch UI updates (see `_nextBarsUpdateAt` throttling pattern)

## Common Pitfalls to Avoid

1. **Don't set weapon behavior to "none"** unless intentional (e.g., armor/accessories)
2. **Don't modify player stats directly** - use the modifier/layer system
3. **Don't create infinite loops** in status effect chains
4. **Don't break the script loading order** in `index.html`
5. **Don't add external dependencies** - keep it vanilla JS
6. **Don't remove or modify working tests** in TEST_PLAN.md without reason

## When Making Changes

### Adding New Items
1. Add archetype definition to appropriate JSON file in `/data/archetypes/`
2. If legendary, add to `/data/gameplay/legendary-items.json`
3. Follow existing stat budget patterns for the rarity level
4. Test item generation and stat calculation
5. Update TEST_PLAN.md if adding new test scenarios

### Adding New Effects
1. Add effect data to `/data/gameplay/` (enhancements, weapon-effects, or affixes)
2. Implement effect logic in appropriate system (StatusEffects, EffectUtils)
3. Update tooltip generation if needed
4. Test effect interactions with existing effects

### Modifying Game Balance
1. Prefer JSON changes over code changes
2. Test changes across multiple runs and difficulty levels
3. Consider impact on synergies and combos
4. Document major balance changes in patch notes format

### UI Changes
1. Maintain mobile-first responsive design
2. Test on touch devices (or emulation)
3. Ensure accessibility (ARIA labels, keyboard navigation)
4. Match existing visual style and component patterns

## Security Considerations

- No user input is persisted or sent to a server
- All game data is client-side only
- No external API calls or third-party scripts
- Sanitize any user-facing text that might contain HTML

## Key Files to Reference

- `src/core/game-engine.js` - Main game loop and state management
- `src/items/generation-core.js` - Item generation and loot system
- `src/utils/stat-calculator.js` - Stat calculation with layered modifiers
- `src/entities/player/player.js` - Player class and stat recalculation
- `src/ui/ui-manager.js` - All UI rendering and interactions
- `TEST_PLAN.md` - Manual testing checklist

## Helpful Commands

Since this is a vanilla JS project with no build system:
- **No npm/package manager** - just serve the files statically
- **No linting configured** - follow the conventions in existing code
- **No automated tests** - use TEST_PLAN.md for manual testing
- **Recommended server**: VS Code Live Server extension or `python -m http.server`
