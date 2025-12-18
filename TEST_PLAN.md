# Test Plan (Manual) — Vampire Survivor Clone

This project is browser-run and currently has no automated test harness, so this is a repeatable manual regression checklist. Run it after any gameplay/loot/UI change.

## Setup
- Start a simple static server (recommended):
  - VS Code extension: **Live Server** (or any local web server)
  - Open the served page in Chrome/Edge.
- Open DevTools Console.

**Pass criteria for all tests:**
- No uncaught exceptions in the console.
- No “soft-locks” (UI modal open with no way to resume, player stops firing, etc.).

## Smoke Tests (2–3 minutes)
1. **Boot**
   - Load the page.
   - Expect: canvas visible, HP/XP bars visible, player rendered.

2. **Movement**
   - Move with WASD and arrow keys.
   - Expect: smooth movement; player stays within canvas bounds.

3. **Weapon fires**
   - Wait 1–2 seconds.
   - Expect: projectiles spawn and travel toward enemies.

4. **Inventory modal (button + key)**
   - Click `Inventory (I)`.
   - Press `I`.
   - Expect: opens/closes reliably, does not flicker on a single key press.

## Core Gameplay

### A. Pausing / Resuming
1. Open inventory while enemies are on screen.
   - Expect: game pauses (enemies stop moving, player stops attacking).
2. Close inventory.
   - Expect: game resumes normally.
3. Press and hold `I` for ~1 second.
   - Expect: modal does **not** rapidly open/close due to key repeat.

### B. Damage & Death
1. Let enemies collide with the player.
   - Expect: HP decreases.
2. Verify armor damage reduction (if equipped later):
   - Equip an armor item with `damageTakenMult` reduction.
   - Expect: incoming damage is lower than without it.
3. Reach 0 HP.
   - Expect: game over triggers; game state stops.

### C. Level Up Flow
1. Kill enemies until level up modal appears.
   - Expect: modal appears and game pauses.
2. Verify **Current Gear** sidebar.
   - Expect: Weapon/Armor/Accessory slots shown (empty slots display as Empty).
   - Hover: tooltips work for items in the sidebar.
3. Click each of the 3 reward cards across multiple runs.
   - Expect: selection equips item, modal closes, game resumes.
4. Click **Upgrade Equipped** on multiple reward cards.
   - Expect: upgrades one stat on currently equipped gear (same slot/type), modal closes, game resumes.
   - If no equipped item exists in that slot: Upgrade Equipped is disabled.

### D. Loot / Weapon Behavior
This verifies the critical bug fix: non-forced weapons must NOT default to behavior `none`.

1. On level up, choose a **weapon** item (repeat until you see weapons).
2. After equipping, observe attacks for 3–5 seconds.
   - Expect: the weapon continues to attack (projectile or aura). No “silent weapon” where attacks stop.

### E. Tooltips
1. Open inventory.
2. Hover over equipped weapon and non-weapon items.
   - Expect: tooltip shows name/rarity/description.
   - Weapon tooltip: shows base damage/cooldown calculations.

## Edge Cases
1. **Repeated level ups**
   - Level up several times in a row.
   - Expect: modal always shows 3 cards; no blank cards.

2. **Fast toggling inventory**
   - Rapidly tap `I` 10 times.
   - Expect: no console errors; game always returns to playable state.

3. **Legendary effects**
    - If you roll **Phasing** (ignore resistance):
       - Expect: enemy resistance does not reduce damage.
    - If you roll **Bloodthirsty** or **Leeching** (heal on hit):
       - Expect: player heals when attacks hit.
    - If you roll **Scorching / Infernal** (burn):
       - Expect: enemies take periodic orange burn ticks after being hit.
    - If you roll **Venomous / Toxic** (poison):
       - Expect: enemies take periodic green poison ticks after being hit.
    - If you roll **Chilling** (slow):
       - Expect: enemies visibly move slower after being hit.
    - If you roll **Freezing / Glacial** (freeze):
       - Expect: some enemies become briefly unable to move.
    - If you roll **Concussive / Stunning** (stun):
       - Expect: some enemies become briefly unable to move.
    - If you roll **Stormbound / Tempestbound** (chain):
       - Expect: some hits jump damage to a nearby enemy.
    - If you roll **Executioner** (execute):
       - Expect: low-HP enemies take noticeably more damage.
    - If you roll **Shattering** (shatter vs frozen):
       - Expect: frozen enemies take noticeably higher hit damage.

4. **Cursed affixes**
    - Roll a rare+ item with "(Cursed)" in its description.
    - Expect: item name is prefixed with "Cursed" and it has at least one negative modifier (e.g. Max HP down).
    - Expect: item also grants a strong effect upside (e.g. burn/execute/chain).

5. **Orbital weapons**
    - Roll/equip a weapon whose behavior is "Orbits you and strikes nearby foes." (orbital).
    - Expect: orbiting hit objects appear around the player.
    - Expect: orbitals damage enemies on contact and apply on-hit effects.

6. **Synergy nodes (combo bonuses)**
   - Goal: confirm combos activate automatically based on your build.
   - When a synergy becomes active, expect a floating text popup: `Synergy: <Name>`.
   - **Frostbreak**: get both Freeze (freeze chance) and Shatter (shatter vs frozen).
      - Expect: frozen enemies take noticeably higher damage.
   - **Plaguefire**: get both Burn and Poison.
      - Expect: burning/poisoned enemies take a bit more hit damage.
   - **Stormweaver**: get Chain + (Burn or Poison).
      - Expect: chain jumps feel stronger/more consistent.
   - **Relic Convergence**: collect 3+ artifacts.
      - Expect: small but noticeable sustain/crit bump over time.
   - **Cursed Might**: equip any item marked "(Cursed)".
      - Expect: damage increases, but incoming damage increases slightly too.
   - **Orbital Guard**: use an Orbital weapon plus any control (Freeze/Stun/Slow).
      - Expect: slightly better survivability and knockback feel.
   - **Cryo Lock**: get Freeze + Stun.
      - Expect: control uptime feels higher and frozen/stunned targets take extra damage.
   - **Venom Harvest**: get Poison + any leech (heal-on-hit).
      - Expect: sustain increases and poisoned targets take extra damage.
   - **Predator's Mark**: get Crit bonuses + Execute.
      - Expect: more reliable finishing and stronger crit kills.
   - **Overclocked Arsenal**: fast weapon + multi-hit (multi projectile or chain).
      - Expect: slightly faster tempo and better chaining.
   - **Orbital Swarm**: Orbital weapon + 2+ orbitals.
      - Expect: extra orbitals and longer uptime.
   - **Control Matrix**: Slow + (Freeze or Stun).
      - Expect: slowed targets take extra damage.

7. **Effect roll steering (build completion bias)**
   - Get one half of a common combo (e.g. Burn but no Poison).
   - Level up a few times.
   - Expect: effects that complete the combo (e.g. Poison) show up somewhat more often than before, but not guaranteed.

8. **Enemy variety**
    - Play until higher levels (10+).
    - Expect: see different enemy types (faster, tankier, chargers, ranged shooters, splitters).
    - Ranged enemies: expect incoming projectiles that damage the player.

9. **XP Gain**
    - Equip an item that grants `xpGain`.
    - Expect: XP bar fills faster than before; Character Sheet shows increased XP Gain.

## Known Risk Areas (Watch During Testing)
- Weapon `behavior` should be `projectile` or `aura` unless explicitly forced to `none`.
- Orbital weapons should not accumulate infinite orbitals (old orbitals should expire/refresh cleanly).
- Inventory toggling should not misbehave under key repeat.
- Level up selection should never permanently stop the game loop.
