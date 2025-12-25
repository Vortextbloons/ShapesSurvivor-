// Dev mode + cheat hotkeys for testing.
// Off by default. Toggle with F1.

(function () {
    const DevMode = {
        allow: false,
        enabled: false,
        _gearUiInit: false,
        _gearWasPlaying: false,
        cheats: {
            godMode: false,
            pauseSpawns: false,
            perfHud: false
        },

        init() {
            const params = new URLSearchParams(window.location.search);
            const isLocal = (location.protocol === 'file:') || (location.hostname === 'localhost') || (location.hostname === '127.0.0.1');

            // "allow" controls whether dev mode can be toggled on this host.
            // We default to allowed for local/file usage.
            const persistedAllow = localStorage.getItem('devModeAllow') === '1';
            this.allow = isLocal || persistedAllow || params.get('dev') === '1';

            if (params.get('dev') === '1') {
                localStorage.setItem('devModeAllow', '1');
                this.allow = true;
            }

            // Restore enabled state only if allowed.
            const persistedEnabled = localStorage.getItem('devModeEnabled') === '1';
            this.enabled = this.allow && persistedEnabled;

            // Restore cheat toggles.
            this.cheats.godMode = localStorage.getItem('devCheat_godMode') === '1';
            this.cheats.pauseSpawns = localStorage.getItem('devCheat_pauseSpawns') === '1';
            this.cheats.perfHud = localStorage.getItem('devCheat_perfHud') === '1';

            if (!this.enabled) {
                // Keep cheats off if dev mode is not enabled.
                this.cheats.godMode = false;
                this.cheats.pauseSpawns = false;
                this.cheats.perfHud = false;
            }

            this.syncUi();
        },

        syncUi() {
            const body = document.body;
            if (body) {
                body.classList.toggle('dev-mode', !!this.enabled);
                body.classList.toggle('dev-perf', !!this.enabled && !!this.cheats.perfHud);
            }

            const el = document.getElementById('dev-mode-indicator');
            if (!el) return;

            if (!this.enabled) {
                el.textContent = '';
                return;
            }

            const tags = [];
            if (this.cheats.godMode) tags.push('GOD');
            if (this.cheats.pauseSpawns) tags.push('NO-SPAWN');
            if (this.cheats.perfHud) tags.push('PERF');
            const suffix = tags.length ? ` [${tags.join(' | ')}]` : '';
            el.textContent = `DEV MODE (F1)${suffix}`;
        },

        toast(message) {
            try {
                if (typeof Game !== 'undefined' && Game?.player && typeof FloatingText !== 'undefined') {
                    Game.floatingTexts.push(new FloatingText(message, Game.player.x, Game.player.y - 26, '#7dd3fc', true));
                    return;
                }
            } catch {
                // fall through
            }
            console.info(`[DevMode] ${message}`);
        },

        setEnabled(on) {
            if (!this.allow) {
                this.toast('Dev mode not allowed (use ?dev=1)');
                return;
            }

            this.enabled = !!on;
            localStorage.setItem('devModeEnabled', this.enabled ? '1' : '0');

            if (!this.enabled) {
                // When turning off dev mode, also disable cheats.
                this.cheats.godMode = false;
                this.cheats.pauseSpawns = false;
                this.cheats.perfHud = false;
                localStorage.setItem('devCheat_godMode', '0');
                localStorage.setItem('devCheat_pauseSpawns', '0');
                localStorage.setItem('devCheat_perfHud', '0');
            }

            this.syncUi();

            this.toast(this.enabled ? 'DEV MODE: ON' : 'DEV MODE: OFF');
        },

        toggleEnabled() {
            // If not allowed yet, allow it once on local builds.
            if (!this.allow) {
                localStorage.setItem('devModeAllow', '1');
                this.allow = true;
            }
            this.setEnabled(!this.enabled);
        },

        toggleCheat(key, label) {
            this.cheats[key] = !this.cheats[key];
            localStorage.setItem(`devCheat_${key}`, this.cheats[key] ? '1' : '0');
            this.syncUi();
            this.toast(`${label}: ${this.cheats[key] ? 'ON' : 'OFF'}`);
        },

        handleKeyDown(e) {
            if (!e || e.repeat) return;

            // Close dev modal on escape.
            if (e.code === 'Escape' && this.isGearModalOpen()) {
                e.preventDefault();
                this.closeGearModal();
                return;
            }

            // F1 toggles dev mode.
            if (e.code === 'F1') {
                e.preventDefault();
                this.toggleEnabled();
                return;
            }

            if (!this.enabled) return;

            // Cheats (only active when dev mode is enabled)
            switch (e.code) {
                case 'F2': { // Level up (XP)
                    e.preventDefault();
                    if (typeof Game !== 'undefined' && Game?.player?.gainXp) {
                        Game.player.gainXp(Game.player.nextLevelXp);
                        this.toast('Cheat: +1 level');
                    }
                    break;
                }
                case 'F3': { // Force level-up choice screen
                    e.preventDefault();
                    if (typeof Game !== 'undefined' && typeof Game.triggerLevelUp === 'function') {
                        Game.triggerLevelUp();
                        this.toast('Cheat: level-up screen');
                    }
                    break;
                }
                case 'F4': { // Heal to full
                    e.preventDefault();
                    if (typeof Game !== 'undefined' && Game?.player?.heal) {
                        Game.player.heal(Game.player.stats?.maxHp || 999999);
                        this.toast('Cheat: heal full');
                    }
                    break;
                }
                case 'F5': { // God mode
                    e.preventDefault();
                    this.toggleCheat('godMode', 'God Mode');
                    break;
                }
                case 'F6': { // Kill all enemies (awards XP, may trigger on-death spawns)
                    e.preventDefault();
                    if (typeof Game !== 'undefined' && Array.isArray(Game.enemies)) {
                        const snapshot = [...Game.enemies];
                        snapshot.forEach(en => {
                            if (!en || en.dead) return;
                            if (typeof en.die === 'function') en.die(Game.player);
                            else en.dead = true;
                        });
                        this.toast('Cheat: clear enemies');
                    }
                    break;
                }
                case 'F7': { // Give a random legendary item
                    e.preventDefault();
                    if (typeof LootSystem !== 'undefined' && typeof LootSystem.generateItem === 'function' && typeof Game !== 'undefined' && Game?.player?.equip) {
                        const item = LootSystem.generateItem({ forceRarity: Rarity.LEGENDARY });
                        Game.player.equip(item);
                        this.toast(`Cheat: legendary -> ${item?.name || 'item'}`);
                    }
                    break;
                }
                case 'F8': { // Pause spawns
                    e.preventDefault();
                    this.toggleCheat('pauseSpawns', 'Pause Spawns');
                    break;
                }
                case 'F9': { // Perf HUD
                    e.preventDefault();
                    this.toggleCheat('perfHud', 'Perf HUD');
                    break;
                }
                case 'F10': { // Dev: Grant custom gear
                    e.preventDefault();
                    this.toggleGearModal();
                    break;
                }
                default:
                    break;
            }
        }
        ,

        isGearModalOpen() {
            return !!document.getElementById('dev-gear-modal')?.classList.contains('active');
        },

        ensureGearUi() {
            if (this._gearUiInit) return;
            this._gearUiInit = true;

            const modal = document.getElementById('dev-gear-modal');
            if (!modal) return;

            const typeSel = document.getElementById('dev-gear-type');
            const raritySel = document.getElementById('dev-gear-rarity');
            const archetypeSel = document.getElementById('dev-gear-archetype');
            const legendarySel = document.getElementById('dev-gear-legendary');
            const weaponEffectSel = document.getElementById('dev-gear-weapon-effect');
            const enhancementSel = document.getElementById('dev-gear-enhancement');
            const grantBtn = document.getElementById('dev-gear-grant-btn');
            const closeBtn = document.getElementById('dev-gear-close-btn');

            if (!typeSel || !raritySel || !archetypeSel || !legendarySel || !weaponEffectSel || !enhancementSel || !grantBtn || !closeBtn) return;

            closeBtn.addEventListener('click', () => this.closeGearModal());
            grantBtn.addEventListener('click', () => this.grantCustomGearFromUi());

            // Rebuild dependent selects when inputs change.
            typeSel.addEventListener('change', () => this.refreshGearModalOptions({ keepAffixes: true }));
            raritySel.addEventListener('change', () => this.refreshGearModalOptions({ keepAffixes: true }));
            weaponEffectSel.addEventListener('change', () => this.refreshGearModalOptions({ keepAffixes: true }));
            enhancementSel.addEventListener('change', () => this.refreshGearModalOptions({ keepAffixes: true }));
        },

        toggleGearModal() {
            if (this.isGearModalOpen()) this.closeGearModal();
            else this.openGearModal();
        },

        openGearModal() {
            this.ensureGearUi();

            const modal = document.getElementById('dev-gear-modal');
            if (!modal) {
                this.toast('Dev gear UI missing (dev-gear-modal)');
                return;
            }

            if (typeof Game === 'undefined' || !Game?.player) {
                this.toast('Start a run before granting gear');
                return;
            }

            // Pause the game while selecting gear.
            this._gearWasPlaying = (Game.state === 'playing');
            if (this._gearWasPlaying) {
                Game.state = 'paused';
            }

            this.refreshGearModalOptions({ keepAffixes: false });
            modal.classList.add('active');
        },

        closeGearModal() {
            const modal = document.getElementById('dev-gear-modal');
            modal?.classList.remove('active');

            if (typeof Game !== 'undefined' && Game && this._gearWasPlaying && Game.state === 'paused') {
                Game.state = 'playing';
                Game.lastTime = performance.now();
            }
            this._gearWasPlaying = false;
        },

        _setSelectOptions(selectEl, options, selectedValue) {
            if (!selectEl) return;
            selectEl.innerHTML = '';
            (options || []).forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                selectEl.appendChild(o);
            });
            if (selectedValue !== undefined && selectedValue !== null) {
                selectEl.value = selectedValue;
            }
        },

        _getSelectedType() {
            const el = document.getElementById('dev-gear-type');
            return el?.value || ItemType.WEAPON;
        },

        _getSelectedRarityId() {
            const el = document.getElementById('dev-gear-rarity');
            return el?.value || 'common';
        },

        _rarityFromId(id) {
            const rid = String(id || '').toLowerCase();
            const map = {
                common: Rarity.COMMON,
                uncommon: Rarity.UNCOMMON,
                rare: Rarity.RARE,
                epic: Rarity.EPIC,
                legendary: Rarity.LEGENDARY
            };
            return map[rid] || Rarity.COMMON;
        },

        _getArchetypePoolForType(type) {
            if (type === ItemType.WEAPON) return window.WeaponArchetypes || {};
            if (type === ItemType.ARMOR) return window.ArmorArchetypes || {};
            if (type === ItemType.ACCESSORY) return window.AccessoryArchetypes || {};
            if (type === ItemType.ARTIFACT) return window.ArtifactArchetypes || {};
            return {};
        },

        refreshGearModalOptions({ keepAffixes } = {}) {
            const typeSel = document.getElementById('dev-gear-type');
            const raritySel = document.getElementById('dev-gear-rarity');
            const archetypeSel = document.getElementById('dev-gear-archetype');
            const legendarySel = document.getElementById('dev-gear-legendary');
            const weaponEffectSel = document.getElementById('dev-gear-weapon-effect');
            const enhancementSel = document.getElementById('dev-gear-enhancement');
            const archetypeField = document.getElementById('dev-gear-archetype-field');
            const legendaryField = document.getElementById('dev-gear-legendary-field');
            const weaponEffectField = document.getElementById('dev-gear-weapon-effect-field');
            const enhancementField = document.getElementById('dev-gear-enhancement-field');

            if (!typeSel || !raritySel || !archetypeSel || !legendarySel || !weaponEffectSel || !enhancementSel) return;

            const prevType = typeSel.value;
            const prevRarity = raritySel.value;
            const prevArchetype = archetypeSel.value;
            const prevLegendary = legendarySel.value;
            const prevWeaponEffect = weaponEffectSel.value;
            const prevEnhancement = enhancementSel.value;

            this._setSelectOptions(typeSel, [
                { value: ItemType.WEAPON, label: 'Weapon' },
                { value: ItemType.ARMOR, label: 'Armor' },
                { value: ItemType.ACCESSORY, label: 'Accessory' },
                { value: ItemType.ARTIFACT, label: 'Artifact' }
            ], prevType || ItemType.WEAPON);

            this._setSelectOptions(raritySel, [
                { value: 'common', label: 'Common' },
                { value: 'uncommon', label: 'Uncommon' },
                { value: 'rare', label: 'Rare' },
                { value: 'epic', label: 'Epic' },
                { value: 'legendary', label: 'Legendary' }
            ], prevRarity || 'common');

            const type = this._getSelectedType();
            const rarityId = this._getSelectedRarityId();
            const rarity = this._rarityFromId(rarityId);

            const isLegendary = rarityId === 'legendary';
            if (archetypeField) archetypeField.style.display = isLegendary ? 'none' : '';
            if (legendaryField) legendaryField.style.display = isLegendary ? '' : 'none';

            // Show extra selectors based on type.
            if (weaponEffectField) weaponEffectField.style.display = (type === ItemType.WEAPON) ? '' : 'none';
            if (enhancementField) enhancementField.style.display = (type === ItemType.ACCESSORY) ? '' : 'none';

            // Populate weapon effects (eligible by rarity).
            if (type === ItemType.WEAPON) {
                const pool = (typeof window !== 'undefined' && Array.isArray(window.WeaponEffectPool)) ? window.WeaponEffectPool : [];
                const eligible = (pool || []).filter(e => {
                    const min = e?.minRarity || 'common';
                    return (typeof rarityAtLeast !== 'function') ? true : rarityAtLeast(rarity, min);
                });
                eligible.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));

                const opts = [{ value: '', label: '(None / Random)' }].concat(
                    eligible.map(e => ({ value: e.id || e.name, label: e.name || (e.id || 'effect') }))
                );
                this._setSelectOptions(weaponEffectSel, opts, prevWeaponEffect || '');
            } else {
                this._setSelectOptions(weaponEffectSel, [{ value: '', label: '(N/A)' }], '');
            }

            // Populate enhancements (eligible by rarity).
            if (type === ItemType.ACCESSORY) {
                const pool = (typeof window !== 'undefined' && Array.isArray(window.EnhancementPool)) ? window.EnhancementPool : [];
                const eligible = (pool || []).filter(e => {
                    const min = e?.minRarity || 'common';
                    return (typeof rarityAtLeast !== 'function') ? true : rarityAtLeast(rarity, min);
                });
                eligible.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));

                const opts = [{ value: '', label: '(None / Random)' }].concat(
                    eligible.map(e => ({ value: e.id || e.name, label: e.name || (e.id || 'enhancement') }))
                );
                this._setSelectOptions(enhancementSel, opts, prevEnhancement || '');
            } else {
                this._setSelectOptions(enhancementSel, [{ value: '', label: '(N/A)' }], '');
            }

            if (isLegendary) {
                const all = (typeof LootSystem !== 'undefined' && LootSystem?.LegendaryTemplates)
                    ? Object.values(LootSystem.LegendaryTemplates)
                    : [];
                const filtered = all.filter(t => t?.id && (!type || t.type === type));
                const opts = (filtered.length ? filtered : all)
                    .filter(t => t?.id)
                    .map(t => ({ value: t.id, label: t.name || t.id }));

                // If no templates (e.g. not loaded yet), keep a placeholder.
                if (!opts.length) {
                    opts.push({ value: '', label: '(No legendary templates loaded)' });
                }

                this._setSelectOptions(legendarySel, opts, prevLegendary || opts[0]?.value);
            } else {
                const pool = this._getArchetypePoolForType(type);
                const keys = Object.keys(pool || {});
                const opts = [{ value: '', label: '(Random)' }].concat(
                    keys.map(id => {
                        const noun = pool?.[id]?.noun;
                        const name = noun ? `${id} (${noun})` : id;
                        return { value: id, label: name };
                    })
                );
                this._setSelectOptions(archetypeSel, opts, prevArchetype || '');
            }

            this._refreshAffixList({ keepChecked: !!keepAffixes });
        },

        _refreshAffixList({ keepChecked } = {}) {
            const listEl = document.getElementById('dev-gear-affix-list');
            if (!listEl) return;

            const prevChecked = new Set();
            if (keepChecked) {
                listEl.querySelectorAll('input[type="checkbox"][data-affix-id]')
                    .forEach(cb => { if (cb.checked) prevChecked.add(cb.getAttribute('data-affix-id')); });
            }

            listEl.innerHTML = '';

            const type = this._getSelectedType();
            const rarity = this._rarityFromId(this._getSelectedRarityId());
            const pool = (typeof window !== 'undefined' && Array.isArray(window.AffixPool)) ? window.AffixPool : [];

            const eligible = (pool || []).filter(a => {
                if (!a) return false;
                const min = a.minRarity || 'common';
                if (typeof rarityAtLeast === 'function' && !rarityAtLeast(rarity, min)) return false;
                const types = Array.isArray(a.types) ? a.types : [];
                if (types.length && !types.includes(type)) return false;
                return true;
            });

            // Stable order for scanning.
            eligible.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

            if (!eligible.length) {
                const empty = document.createElement('div');
                empty.className = 'levelup-sidebar-muted';
                empty.style.width = '100%';
                empty.style.textAlign = 'center';
                empty.textContent = '(No eligible affixes for this type/rarity)';
                listEl.appendChild(empty);
                return;
            }

            eligible.forEach(a => {
                const id = a.id || a.name;
                if (!id) return;

                const row = document.createElement('label');
                row.className = 'dev-gear-affix-row';

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.setAttribute('data-affix-id', id);
                cb.checked = prevChecked.has(String(id));

                const name = document.createElement('span');
                name.className = 'dev-gear-affix-name';
                name.textContent = a.name || String(id);

                const meta = document.createElement('span');
                meta.className = 'dev-gear-affix-meta';
                meta.textContent = String(a.minRarity || 'common');

                row.appendChild(cb);
                row.appendChild(name);
                row.appendChild(meta);
                listEl.appendChild(row);
            });
        },

        _getSelectedAffixIds() {
            const listEl = document.getElementById('dev-gear-affix-list');
            if (!listEl) return [];
            const out = [];
            listEl.querySelectorAll('input[type="checkbox"][data-affix-id]')
                .forEach(cb => {
                    if (!cb.checked) return;
                    const id = cb.getAttribute('data-affix-id');
                    if (id) out.push(id);
                });
            return out;
        },

        _applyAffixesToExistingItem(item, affixIds) {
            const pool = (typeof window !== 'undefined' && Array.isArray(window.AffixPool)) ? window.AffixPool : [];
            if (!item || !pool.length || !Array.isArray(affixIds) || !affixIds.length) return;

            if (!Array.isArray(item.modifiers)) item.modifiers = [];
            if (!Array.isArray(item.affixes)) item.affixes = [];

            const used = new Set(item.affixes.map(a => a?.id || a?.name).filter(Boolean));
            let added = 0;

            for (const rawId of affixIds) {
                const id = String(rawId || '').trim();
                if (!id || used.has(id)) continue;
                const chosen = pool.find(a => (a.id || a.name) === id) || pool.find(a => String(a.name || '') === id);
                if (!chosen) continue;
                used.add(id);

                const mods = (typeof affixToModifiers === 'function') ? affixToModifiers(chosen) : [];
                if (mods.length) item.modifiers.push(...mods);

                item.affixes.push({
                    id: chosen.id || chosen.name,
                    name: chosen.name,
                    modifiers: mods.map(m => ({
                        stat: m.stat,
                        value: m.value,
                        operation: m.operation,
                        name: m.name
                    }))
                });

                if (added < 2 && chosen.name) {
                    item.name = `${chosen.name} ${item.name}`;
                }
                added++;
            }
        },

        _applyWeaponEffectToExistingItem(item, effectId, rarity) {
            const id = String(effectId || '').trim();
            if (!id) return;
            const pool = (typeof window !== 'undefined' && Array.isArray(window.WeaponEffectPool)) ? window.WeaponEffectPool : [];
            if (!pool.length) return;

            const chosen = pool.find(e => (e.id || e.name) === id) || pool.find(e => String(e.name || '') === id);
            if (!chosen) return;
            const min = chosen.minRarity || 'common';
            if (typeof rarityAtLeast === 'function' && rarity && !rarityAtLeast(rarity, min)) return;

            item.specialEffect = {
                id: chosen.id || chosen.name,
                name: chosen.name,
                description: chosen.description || '',
                effects: chosen.effects || null
            };
        },

        _applyEnhancementToExistingItem(item, enhancementId, rarity) {
            const id = String(enhancementId || '').trim();
            if (!id) return;
            const pool = (typeof window !== 'undefined' && Array.isArray(window.EnhancementPool)) ? window.EnhancementPool : [];
            if (!pool.length) return;

            const chosen = pool.find(e => (e.id || e.name) === id) || pool.find(e => String(e.name || '') === id);
            if (!chosen) return;
            const min = chosen.minRarity || 'common';
            if (typeof rarityAtLeast === 'function' && rarity && !rarityAtLeast(rarity, min)) return;

            item.enhancement = {
                id: chosen.id || chosen.name,
                name: chosen.name,
                description: chosen.description || '',
                kind: chosen.kind || null,
                effects: chosen.effects || null,
                config: chosen.config || null
            };
        },

        grantCustomGearFromUi() {
            if (typeof Game === 'undefined' || !Game?.player?.equip) {
                this.toast('No active player to equip');
                return;
            }
            if (typeof LootSystem === 'undefined' || typeof LootSystem.generateItem !== 'function') {
                this.toast('LootSystem not ready');
                return;
            }

            const type = this._getSelectedType();
            const rarityId = this._getSelectedRarityId();
            const rarity = this._rarityFromId(rarityId);

            const archetypeId = document.getElementById('dev-gear-archetype')?.value || '';
            const legendaryId = document.getElementById('dev-gear-legendary')?.value || '';
            const weaponEffectId = document.getElementById('dev-gear-weapon-effect')?.value || '';
            const enhancementId = document.getElementById('dev-gear-enhancement')?.value || '';
            const affixIds = this._getSelectedAffixIds();

            try {
                let item = null;

                if (rarityId === 'legendary') {
                    const id = legendaryId;
                    if (!id) {
                        this.toast('Pick a legendary first');
                        return;
                    }
                    item = (typeof LootSystem.generateLegendary === 'function')
                        ? LootSystem.generateLegendary(id)
                        : LootSystem.generateItem({ forceLegendaryId: id });

                    // Allow adding additional affixes for testing (no rarity scaling on templates).
                    if (affixIds.length) this._applyAffixesToExistingItem(item, affixIds);

                    // Dev override: attach weapon effect / enhancement for template items.
                    if (item?.type === ItemType.WEAPON && weaponEffectId) this._applyWeaponEffectToExistingItem(item, weaponEffectId, rarity);
                    if (item?.type === ItemType.ACCESSORY && enhancementId) this._applyEnhancementToExistingItem(item, enhancementId, rarity);
                } else {
                    const opts = {
                        forceType: type,
                        forceRarity: rarity,
                        forceArchetypeId: archetypeId || null,
                        forceAffixIds: affixIds,
                        forceWeaponEffectId: weaponEffectId || null,
                        forceEnhancementId: enhancementId || null
                    };
                    item = LootSystem.generateItem(opts);
                }

                if (!item) {
                    this.toast('Failed to generate item');
                    return;
                }

                Game.player.equip(item);
                this.toast(`Cheat: granted -> ${item?.name || 'item'}`);
            } catch (err) {
                console.error(err);
                this.toast('Failed to grant item (see console)');
            }
        },

        // Mobile: long-press on version text to toggle dev mode
        initMobileToggle() {
            const versionEl = document.getElementById('main-menu-version');
            if (!versionEl) return;

            let pressTimer = null;
            const LONG_PRESS_DURATION = 1500; // 1.5 seconds

            const startPress = (e) => {
                // Prevent text selection on long press
                e.preventDefault();
                
                pressTimer = setTimeout(() => {
                    pressTimer = null;
                    this.toggleEnabled();
                    // Visual feedback: brief pulse using CSS class
                    versionEl.classList.add('dev-toggle-pulse');
                    setTimeout(() => {
                        versionEl.classList.remove('dev-toggle-pulse');
                    }, 150);
                }, LONG_PRESS_DURATION);
            };

            const cancelPress = () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            // Touch events for mobile
            versionEl.addEventListener('touchstart', startPress, { passive: false });
            versionEl.addEventListener('touchend', cancelPress);
            versionEl.addEventListener('touchcancel', cancelPress);
            versionEl.addEventListener('touchmove', cancelPress);

            // Mouse events for desktop testing (long click)
            versionEl.addEventListener('mousedown', startPress);
            versionEl.addEventListener('mouseup', cancelPress);
            versionEl.addEventListener('mouseleave', cancelPress);
        }
    };

    DevMode.init();
    
    // Initialize mobile toggle after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => DevMode.initMobileToggle());
    } else {
        DevMode.initMobileToggle();
    }
    
    window.DevMode = DevMode;
})();
