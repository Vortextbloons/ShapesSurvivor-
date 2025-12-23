# Contributing to Shapes Survivor

Thank you for your interest in contributing to Shapes Survivor! This document provides guidelines and information for contributors working on the 0.9 update and beyond.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Version 0.9 Development Priorities](#version-09-development-priorities)
- [Coding Standards](#coding-standards)
- [Adding New Content](#adding-new-content)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)

---

## Development Setup

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge, or Safari)
- A local web server (VS Code Live Server extension recommended)
- Text editor or IDE (VS Code recommended)
- Git for version control

### Getting Started
1. Clone the repository
2. Open the project in your editor
3. Start a local web server (e.g., VS Code Live Server)
4. Open `index.html` in your browser
5. Check the browser console for any errors

### Development Tools
- **Browser DevTools**: Essential for debugging
- **Live Server**: Auto-reload on file changes
- **Git**: Version control and collaboration

---

## Project Structure

```
ShapesSurvivor-/
├── index.html              # Main HTML entry point
├── style.css              # All styles
├── README.md              # Project overview
├── ROADMAP.md            # Version 0.9 planning
├── CHANGELOG.md          # Version history
├── CONTRIBUTING.md       # This file
├── TEST_PLAN.md          # Manual testing checklist
│
├── data/                 # All game data (JSON)
│   ├── archetypes/      # Character & item archetypes
│   ├── gameplay/        # Enemies, items, effects, buffs
│   └── visuals/         # Visual configurations
│
└── src/                  # JavaScript source code
    ├── core/            # Game engine, constants, input
    ├── entities/        # Player, enemies, projectiles
    ├── effects/         # Buffs, status effects
    ├── items/           # Item generation & types
    ├── rendering/       # Visual effects
    ├── ui/             # UI management
    └── utils/          # Helper utilities
```

---

## Version 0.9 Development Priorities

See [ROADMAP.md](ROADMAP.md) for comprehensive details. Key priorities:

### Phase 1: Foundation (High Priority)
1. **Meta Progression System**
   - Create `src/progression/meta-progression.js`
   - Add `data/progression/unlocks.json`
   - Implement localStorage persistence
   - Create UI for unlock tree

2. **Save/Load System**
   - Mid-run save capability
   - Auto-save on close
   - Save game state to localStorage
   - Load game restoration

3. **Settings Menu**
   - Volume controls
   - Toggle options (screen shake, damage numbers)
   - Keybind customization
   - Graphics options

### Phase 2: Content (Medium Priority)
4. **Character Archetypes**
   - Elementalist implementation
   - Engineer with turret system
   - Chronomancer with time mechanics

5. **Boss System**
   - Boss entity class
   - Boss data definitions
   - Boss UI (health bar, warnings)
   - Special mechanics

6. **New Enemies & Items**
   - 6 new enemy types
   - 10+ legendary items
   - Balance testing

### Phase 3: Polish (Lower Priority)
7. **Quality of Life**
   - Mini-map
   - Damage numbers
   - Quick restart

8. **Audio System**
   - Sound effect infrastructure
   - Music system
   - Volume controls

---

## Coding Standards

### General Guidelines
- Use **vanilla JavaScript** (ES6+)
- No external frameworks or libraries
- Keep files modular and focused
- Comment complex logic
- Follow existing code style

### JavaScript Style
```javascript
// Use camelCase for variables and functions
const playerHealth = 100;
function calculateDamage(base, multiplier) { }

// Use PascalCase for classes
class EnemyManager { }

// Use UPPER_CASE for constants
const MAX_ENEMIES = 500;

// Prefer const over let, avoid var
const config = { ... };
let mutableValue = 0;

// Use arrow functions for callbacks
enemies.forEach(enemy => enemy.update());

// Add JSDoc comments for complex functions
/**
 * Calculates final damage after all modifiers
 * @param {number} baseDamage - Base damage value
 * @param {Object} stats - Player stats object
 * @returns {number} Final damage value
 */
function calculateFinalDamage(baseDamage, stats) { }
```

### File Organization
- One major class/system per file
- Group related functionality
- Keep data files in `data/` directory
- Keep source code in `src/` directory

### Naming Conventions
- **Files**: kebab-case (e.g., `meta-progression.js`)
- **Classes**: PascalCase (e.g., `MetaProgression`)
- **Functions**: camelCase (e.g., `unlockArchetype`)
- **Constants**: UPPER_CASE (e.g., `MAX_LEVEL`)
- **Private methods**: prefix with underscore (e.g., `_calculateInternal`)

---

## Adding New Content

### Adding a New Character Archetype

1. **Add to character archetypes JSON** (`data/archetypes/character-archetypes.json`)
```json
{
  "your_archetype_id": {
    "id": "your_archetype_id",
    "name": "Your Archetype Name",
    "description": "Description of playstyle and mechanics",
    "color": "#hexcolor",
    "baseStats": { /* stats */ },
    "passives": { /* passive abilities */ },
    "exclusiveArtifacts": ["artifact_1", "artifact_2", "artifact_3"]
  }
}
```

2. **Add exclusive artifacts** (`data/archetypes/character-artifacts.json`)

3. **Implement passives** in `src/entities/player/player.js`

4. **Test thoroughly** with manual test plan

### Adding a New Enemy Type

1. **Add to enemies JSON** (`data/gameplay/enemies.json`)
```json
{
  "enemy_id": {
    "id": "enemy_id",
    "name": "Enemy Name",
    "color": "#hexcolor",
    "radius": 12,
    "speed": [min, max],
    "hpBase": 100,
    "hpPerLevel": 10,
    "contactDamage": 1.0,
    "xp": 15,
    "resistance": [0.05, 0.15]
  }
}
```

2. **Implement special behaviors** in `src/entities/enemy/enemy.js`

3. **Add visual distinctions** if needed

4. **Balance test** against other enemies

### Adding a New Legendary Item

1. **Add to legendary items JSON** (`data/gameplay/legendary-items.json`)
```json
{
  "item_id": {
    "id": "item_id",
    "name": "Item Name",
    "type": "weapon|armor|accessory|artifact",
    "rarity": "legendary",
    "description": "What the item does",
    "baseStat": { /* primary stat */ },
    "effects": [ /* special effects */ ]
  }
}
```

2. **Implement special effect logic** in relevant entity files

3. **Add tooltips** and visual indicators

4. **Test interactions** with other items and synergies

### Adding a New Synergy

1. **Define synergy conditions** and effects

2. **Add to synergy detection** in `src/effects/effect-utils.js`

3. **Create visual popup** for synergy activation

4. **Document in patch notes**

---

## Testing

### Manual Testing
- Follow [TEST_PLAN.md](TEST_PLAN.md) checklist
- Test on desktop and mobile (DevTools)
- Check all console output for errors
- Verify performance with many enemies

### Test-Driven Features
When adding new features:
1. Open DevTools console
2. Test feature in isolation
3. Test interactions with existing systems
4. Check for memory leaks (long runs)
5. Verify save/load persistence

### Performance Testing
- Monitor FPS in DevTools
- Test with 200+ enemies on screen
- Check memory usage over time
- Profile rendering performance

### Browser Compatibility
Test on:
- Chrome/Edge (primary)
- Firefox
- Safari (if available)
- Mobile browsers (Chrome, Safari)

---

## Submitting Changes

### Before Submitting
1. **Test your changes** thoroughly
2. **Follow code style** guidelines
3. **Update documentation** if needed
4. **Check console** for errors
5. **Run manual tests** from TEST_PLAN.md

### Commit Messages
Use clear, descriptive commit messages:
```
Add meta progression unlock tree

- Create MetaProgression class
- Add unlock tree UI
- Implement Essence currency
- Add localStorage persistence
```

### Pull Request Guidelines
1. **Title**: Clear summary of changes
2. **Description**: 
   - What changed
   - Why it changed
   - How to test it
3. **Testing**: Describe testing performed
4. **Screenshots**: For UI changes
5. **Breaking Changes**: Note any breaking changes

### Code Review
- Be open to feedback
- Respond to comments promptly
- Make requested changes
- Keep discussions professional

---

## Development Workflow for 0.9

### Typical Feature Development
1. Check ROADMAP.md for priorities
2. Create feature branch
3. Implement feature incrementally
4. Test frequently
5. Update documentation
6. Submit pull request
7. Address review feedback
8. Merge when approved

### Parallel Development
Multiple features can be developed simultaneously:
- Meta progression (foundation)
- Boss system (content)
- Audio system (polish)

Coordinate with other contributors to avoid conflicts.

---

## Getting Help

### Resources
- **ROADMAP.md**: Feature planning and priorities
- **TEST_PLAN.md**: Testing procedures
- **README.md**: Project overview
- **Code Comments**: Inline documentation

### Questions
- Check existing code for patterns
- Review similar features
- Ask in pull request comments
- Reference browser DevTools

---

## Code of Conduct

### Be Respectful
- Respect other contributors
- Be open to feedback
- Help others learn
- Keep discussions constructive

### Be Professional
- Write clean, readable code
- Document complex logic
- Test your changes
- Follow project standards

---

## License

By contributing to Shapes Survivor, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Shapes Survivor! 🎮
