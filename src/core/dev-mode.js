// Dev mode + cheat hotkeys for testing.
// Off by default. Toggle with F1.

(function () {
    const DevMode = {
        allow: false,
        enabled: false,
        cheats: {
            godMode: false,
            pauseSpawns: false
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

            if (!this.enabled) {
                // Keep cheats off if dev mode is not enabled.
                this.cheats.godMode = false;
                this.cheats.pauseSpawns = false;
            }

            this.syncUi();
        },

        syncUi() {
            const body = document.body;
            if (body) {
                body.classList.toggle('dev-mode', !!this.enabled);
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
                localStorage.setItem('devCheat_godMode', '0');
                localStorage.setItem('devCheat_pauseSpawns', '0');
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
                default:
                    break;
            }
        }
    };

    DevMode.init();
    window.DevMode = DevMode;
})();
