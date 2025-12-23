# Version 0.9 Development Guide

**Quick Start Guide for Contributors**

## What is Version 0.9?

Version 0.9 "The Ascension Update" is a major expansion that adds:
- Meta progression (persistent unlocks between runs)
- Boss fights with unique mechanics
- 3 new character classes
- Challenge game modes
- Audio system
- Quality of life improvements

See [ROADMAP.md](ROADMAP.md) for complete details.

---

## Getting Started on 0.9 Features

### Already Done ✅

The following foundation work is complete:

1. **Planning Documents**
   - `ROADMAP.md` - Complete feature roadmap
   - `CHANGELOG.md` - Version history
   - `CONTRIBUTING.md` - Development guidelines

2. **Version Update**
   - Version bumped to `0.9.0-dev` in `src/core/constants.js`
   - README updated with 0.9 preview

3. **Stub Implementations**
   - `src/progression/meta-progression.js` - Meta progression class
   - `src/entities/boss/boss.js` - Boss entity class
   - Directory structure created for new features

4. **Data Files**
   - `data/progression/achievements.json` - Achievement definitions
   - `data/progression/unlocks.json` - Unlock tree data
   - `data/gameplay/bosses.json` - Boss configurations

### Ready to Implement 🚀

Choose a feature to work on from the priority list:

#### Phase 1: Foundation (High Priority)

**1. Complete Meta Progression System**
- File: `src/progression/meta-progression.js` (stub exists)
- TODO:
  - [ ] Load unlock data from `data/progression/unlocks.json`
  - [ ] Implement unlock tree logic and prerequisites
  - [ ] Create UI panel for unlocks (new file: `src/ui/components/meta-ui.js`)
  - [ ] Integrate with game engine to award Essence
  - [ ] Test localStorage persistence
  - [ ] Add achievement checking logic

**2. Settings Menu**
- Create: `src/ui/components/settings-menu.js`
- TODO:
  - [ ] Create settings UI modal
  - [ ] Add volume controls (prepare for audio)
  - [ ] Add toggles (screen shake, damage numbers, etc.)
  - [ ] Add keybind customization
  - [ ] Save settings to localStorage
  - [ ] Load settings on game start

**3. Save/Load System**
- Create: `src/core/save-manager.js`
- TODO:
  - [ ] Save full game state to localStorage
  - [ ] Load and restore game state
  - [ ] Auto-save on game close
  - [ ] Continue run option in main menu
  - [ ] Handle save versioning

#### Phase 2: Content (Medium Priority)

**4. Complete Boss System**
- File: `src/entities/boss/boss.js` (stub exists)
- Data: `data/gameplay/bosses.json` (complete)
- TODO:
  - [ ] Implement boss abilities
  - [ ] Add phase transition effects
  - [ ] Integrate with game engine spawn timing
  - [ ] Add boss health bar UI
  - [ ] Implement boss loot drops
  - [ ] Add screen shake and effects
  - [ ] Test all 4 bosses

**5. New Character Archetypes**
- Update: `data/archetypes/character-archetypes.json`
- Update: `data/archetypes/character-artifacts.json`
- TODO:
  - [ ] Add Elementalist data and implement passives
  - [ ] Add Engineer data and create turret system
  - [ ] Add Chronomancer data and implement time mechanics
  - [ ] Create 9 new exclusive artifacts (3 per class)
  - [ ] Add character selection UI updates
  - [ ] Test each class thoroughly

**6. New Enemies**
- Update: `data/gameplay/enemies.json`
- Update: `src/entities/enemy/enemy.js`
- Add 6 new enemy types:
  - [ ] Necromancer (revives dead enemies)
  - [ ] Shield Bearer (frontal shield)
  - [ ] Teleporter (random teleports)
  - [ ] Summoner (spawns minions)
  - [ ] Mimic (disguised as loot)
  - [ ] Void Walker (phases through walls)

**7. New Legendary Items**
- Update: `data/gameplay/legendary-items.json`
- Add 10+ new items with unique effects
- Test interactions with existing systems

#### Phase 3: Modes & Polish (Lower Priority)

**8. Game Modes**
- Create: `src/modes/game-modes.js`
- TODO:
  - [ ] Endless Mode
  - [ ] Boss Rush Mode
  - [ ] Hardcore Mode
  - [ ] Hyper Speed Mode
  - [ ] One-Hit Wonder Mode
  - [ ] Daily Challenge system
  - [ ] Mode selection UI

**9. Quality of Life**
- Create: `src/ui/mini-map.js`
- Create: `src/ui/damage-numbers.js`
- Create: `src/rendering/particle-system.js`
- TODO:
  - [ ] Mini-map with enemy density
  - [ ] Floating damage numbers
  - [ ] Build summary at end of run
  - [ ] Quick restart button
  - [ ] Auto-pickup radius stat
  - [ ] XP magnet effect

**10. Audio System**
- Create: `src/audio/audio-manager.js`
- Create: `data/audio/` directory
- TODO:
  - [ ] Audio manager class
  - [ ] Background music system
  - [ ] Sound effects for combat/UI
  - [ ] Volume controls (integrate with settings)
  - [ ] Audio file management

---

## Development Workflow

### Before Starting Work
1. Read [CONTRIBUTING.md](CONTRIBUTING.md)
2. Choose a feature from the list above
3. Check if related data files exist
4. Review existing code patterns

### While Developing
1. Make small, incremental changes
2. Test frequently in browser
3. Check browser console for errors
4. Follow existing code style
5. Add JSDoc comments for complex functions

### Before Submitting
1. Test your feature thoroughly
2. Run through relevant parts of [TEST_PLAN.md](TEST_PLAN.md)
3. Update documentation if needed
4. Check that no console errors appear
5. Commit with clear message

---

## File Structure Reference

```
New in 0.9:

src/
  progression/
    meta-progression.js          ✅ Stub ready
  modes/
    game-modes.js                📝 To create
  entities/
    boss/
      boss.js                    ✅ Stub ready
    deployables/
      turret.js                  📝 To create (for Engineer)
  audio/
    audio-manager.js             📝 To create
  ui/
    components/
      meta-ui.js                 📝 To create
      settings-menu.js           📝 To create
    mini-map.js                  📝 To create
    damage-numbers.js            📝 To create
  rendering/
    particle-system.js           📝 To create
  core/
    save-manager.js              📝 To create

data/
  progression/
    achievements.json            ✅ Complete
    unlocks.json                 ✅ Complete
  gameplay/
    bosses.json                  ✅ Complete
```

---

## Testing Your Changes

### Quick Browser Test
1. Start local server (Live Server in VS Code)
2. Open browser DevTools (F12)
3. Load the game
4. Test your feature
5. Check console for errors

### Integration Testing
- Test how your feature works with existing systems
- Verify no performance degradation
- Check mobile compatibility if UI changes

### Manual Test Plan
- Follow [TEST_PLAN.md](TEST_PLAN.md) for comprehensive testing
- Focus on sections related to your changes

---

## Common Tasks

### Adding a New UI Modal
1. Create HTML structure in `index.html`
2. Add styles to `style.css`
3. Create show/hide functions in `src/ui/ui-manager.js`
4. Hook up event listeners
5. Test open/close and escape key

### Adding a New Data-Driven Feature
1. Create JSON file in appropriate `data/` directory
2. Load in `src/utils/data-loader.js`
3. Use data in relevant entity/system
4. Test with different configurations

### Adding a New Stat
1. Add to relevant archetype/item JSON
2. Update `src/utils/stat-calculator.js`
3. Apply in appropriate entity (player, enemy, projectile)
4. Update tooltip display in `src/ui/ui-manager.js`

---

## Need Help?

1. Check existing code for patterns
2. Review [CONTRIBUTING.md](CONTRIBUTING.md)
3. Look at similar features already implemented
4. Read inline code comments
5. Check browser DevTools for errors

---

## Release Timeline

See [ROADMAP.md](ROADMAP.md) for detailed timeline.

**Summary:**
- **Phase 1** (Weeks 1-2): Foundation systems
- **Phase 2** (Weeks 3-4): Content additions
- **Phase 3** (Weeks 5-6): Modes and polish
- **Phase 4** (Week 7): Testing and balance

**Target Release:** Q1 2025

---

Good luck and happy coding! 🎮✨
