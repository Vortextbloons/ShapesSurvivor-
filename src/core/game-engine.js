const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const Game = {
    state: 'mainmenu',
    lastTime: 0,
    _loopBound: null,
    player: null,
    enemies: [],
    projectiles: [],
    pickups: [],
    floatingTexts: [],
    particles: [],
    effects: [],
    spawnTimer: 0,
    elapsedFrames: 0,
    bgGrid: null,

    stats: {
        kills: 0,
        bossesKilled: 0,
        elitesKilled: 0,
        startFrame: 0,
        best: {
            bestTimeSec: 0,
            bestKills: 0,
            bestLevel: 0
        },
        loadBest() {
            try {
                const t = Number(localStorage.getItem('ss_best_time_sec') || 0);
                const k = Number(localStorage.getItem('ss_best_kills') || 0);
                const l = Number(localStorage.getItem('ss_best_level') || 0);
                this.best.bestTimeSec = Number.isFinite(t) ? t : 0;
                this.best.bestKills = Number.isFinite(k) ? k : 0;
                this.best.bestLevel = Number.isFinite(l) ? l : 0;
            } catch {
                // ignore
            }
        },
        saveBest() {
            try {
                localStorage.setItem('ss_best_time_sec', String(this.best.bestTimeSec || 0));
                localStorage.setItem('ss_best_kills', String(this.best.bestKills || 0));
                localStorage.setItem('ss_best_level', String(this.best.bestLevel || 0));
            } catch {
                // ignore
            }
        },
        resetRun() {
            this.kills = 0;
            this.bossesKilled = 0;
            this.elitesKilled = 0;
            this.startFrame = 0;
        },
        onEnemyKilled(enemy) {
            this.kills += 1;
            if (enemy?.isBoss) this.bossesKilled += 1;
            if (enemy?.isElite) this.elitesKilled += 1;
        }
    },

    bossActive: false,
    bossEnemy: null,
    bossQueuedLevel: null,
    lastBossId: null,

    async init() {
        // Load all game data from JSON files first
        try {
            await DataLoader.loadAll();
        } catch (error) {
            console.error('Failed to initialize game:', error);
            alert('Failed to load game data. Check console for details.');
            return;
        }

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        this.createBgGrid();
        Input.init();

        this.stats.loadBest();
        this.ui.initScreens();

        this.showMainMenu();
        this.ui.updateBars();
        this.ui.updateSynergyPanel();

        // Render one frame so the canvas isn't blank behind menus.
        this.renderBackdrop();
        if (!this._loopBound) this._loopBound = this.loop.bind(this);
        requestAnimationFrame(this._loopBound);
        return;
    },

    renderBackdrop() {
        const ptrn = ctx.createPattern(this.bgGrid, 'repeat');
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = ptrn;
        ctx.save();
        const px = this.player?.x || 0;
        const py = this.player?.y || 0;
        ctx.translate(-px % 100, -py % 100);
        ctx.fillRect(px % 100, py % 100, canvas.width, canvas.height);
        ctx.restore();
    },

    resetRunState() {
        this.enemies = [];
        this.projectiles = [];
        this.pickups = [];
        this.floatingTexts = [];
        this.particles = [];
        this.effects = [];
        this.spawnTimer = 0;
        this.elapsedFrames = 0;
        this.bossActive = false;
        this.bossEnemy = null;
        this.bossQueuedLevel = null;
        this.lastBossId = null;
        this.stats.resetRun();
    },

    startNewRun() {
        this.resetRunState();
        this.player = new Player();
        const starter = LootSystem.generateStarterWeapon
            ? LootSystem.generateStarterWeapon()
            : LootSystem.generateItem({ forceType: ItemType.WEAPON, forceRarity: Rarity.COMMON, forceBehavior: BehaviorType.PROJECTILE });
        this.player.equip(starter);

        // Close any lingering modals from prior run.
        document.getElementById('inventory-modal')?.classList.remove('active');
        document.getElementById('levelup-modal')?.classList.remove('active');
        document.getElementById('accessory-replace-modal')?.classList.remove('active');
        this.ui.hideTooltip();

        this.hideMainMenu();
        this.hideEndScreen();

        this.state = 'playing';
        this.lastTime = performance.now();
        // No requestAnimationFrame here: the main loop is always running.
    },

    showMainMenu() {
        this.state = 'mainmenu';
        document.getElementById('main-menu-modal')?.classList.add('active');
        document.getElementById('end-screen-modal')?.classList.remove('active');
    },
    hideMainMenu() {
        document.getElementById('main-menu-modal')?.classList.remove('active');
    },
    showEndScreen(summary) {
        const modal = document.getElementById('end-screen-modal');
        const statsEl = document.getElementById('end-screen-stats');
        if (statsEl) statsEl.innerHTML = summary || '';
        modal?.classList.add('active');
    },
    hideEndScreen() {
        document.getElementById('end-screen-modal')?.classList.remove('active');
    },

    createBgGrid() {
        this.bgGrid = document.createElement('canvas');
        this.bgGrid.width = 100; this.bgGrid.height = 100;
        const bctx = this.bgGrid.getContext('2d');
        bctx.strokeStyle = '#222'; bctx.lineWidth = 1;
        bctx.beginPath(); bctx.moveTo(0,0); bctx.lineTo(100,0); bctx.moveTo(0,0); bctx.lineTo(0,100); bctx.stroke();
    },

    toggleInventory() {
        const modal = document.getElementById('inventory-modal');
        if (this.state === 'playing') {
            this.state = 'paused';
            this.ui.updateInventory();
            modal.classList.add('active');
        } else if (this.state === 'paused') {
            this.state = 'playing';
            modal.classList.remove('active');
            this.lastTime = performance.now();
            // No requestAnimationFrame here: the main loop is always running.
        }
    },

    triggerLevelUp() {
        const items = (LootSystem.generateRewardChoices ? LootSystem.generateRewardChoices(this.player, 3) : Array.from({ length: 3 }, () => LootSystem.generateItem()));
        this.openRewardModal({
            title: 'Choose Your Reward',
            items
        });
    },

    openRewardModal({ title, items }) {
        this.state = 'levelup';
        const modal = document.getElementById('levelup-modal');
        const header = modal?.querySelector('h2');
        if (header) header.textContent = title || 'Choose Your Reward';

        const container = document.getElementById('card-container');
        container.innerHTML = '';

        // Populate current-gear sidebar for better upgrade decisions.
        this.ui.updateUpgradeSidebar();

        const resume = () => {
            document.getElementById('levelup-modal').classList.remove('active');
            this.state = 'playing';
            this.lastTime = performance.now();

            // Spawn queued boss immediately after resuming (e.g., after picking reward).
            this.trySpawnBossIfQueued();
            // No requestAnimationFrame here: the main loop is always running.
        };

        (items || []).forEach((item) => {
            const card = document.createElement('div');
            card.className = `item-card card-${item.rarity.id}`;
            if (item.isCursed) card.classList.add('cursed');

            let statsHtml = item.modifiers.map(m => {
                let cssClass = m.source === 'special' ? 'mod-special' : 'mod-positive';
                let valStr = LootSystem.formatStat(m.stat, m.value);
                return `<span class="mod-line ${cssClass}">${valStr} ${m.name || m.stat}</span>`;
            }).join('');

            const headerColor = item.isCursed ? '#9c27b0' : item.rarity.color;
            const badge = item.isCursed ? '<span class="cursed-badge">Cursed</span>' : '';
            const offerLabel = item.offerRole ? ` • ${item.offerRole}${item.offerFamily ? ` (${item.offerFamily})` : ''}` : '';

            card.innerHTML = `
                <h3 style="color:${headerColor}">${item.name}${badge}</h3>
                <span class="rarity-tag" style="color:${headerColor}">${item.rarity.name} ${item.type}${offerLabel}</span>
                <p>${item.description}</p>
                <div class="mod-list">${statsHtml}</div>
                <div class="card-actions">
                    <button class="btn-small btn-small-primary" data-action="take">Take</button>
                    <button class="btn-small" data-action="upgrade">Upgrade Equipped</button>
                </div>
            `;

            // Hover tooltip for clarity (includes synergy impact).
            card.addEventListener('mouseenter', (e) => this.ui.showTooltip(e, item, item.type === ItemType.WEAPON));
            card.addEventListener('mouseleave', () => this.ui.hideTooltip());
            card.addEventListener('mousemove', (e) => this.ui.moveTooltip(e));

            const takeBtn = card.querySelector('[data-action="take"]');
            const upgradeBtn = card.querySelector('[data-action="upgrade"]');

            const equippedSlot = ItemUtils.getSlotForType(item.type, this.player);
            const equippedItem = equippedSlot ? this.player.equipment[equippedSlot] : null;

            const canUpgrade = !!equippedItem && item.type !== ItemType.ARTIFACT;
            if (!canUpgrade) {
                upgradeBtn.disabled = true;
                upgradeBtn.title = item.type === ItemType.ARTIFACT ? 'Artifacts can\'t be upgraded this way.' : 'No equipped item in this slot.';
            }

            const take = () => {
                this.player.equip(item, { onAfterEquip: resume });
            };

            const upgrade = () => {
                if (!canUpgrade) return;
                const ok = this.player.upgradeEquippedOneStatForType(item.type, item.rarity);
                if (ok) resume();
            };

            takeBtn.onclick = (e) => { e.stopPropagation(); take(); };
            upgradeBtn.onclick = (e) => { e.stopPropagation(); upgrade(); };
            card.onclick = () => take();
            container.appendChild(card);
        });

        document.getElementById('levelup-modal').classList.add('active');
    },

    onPlayerLevelUp(newLevel) {
        if (!newLevel || newLevel < 1) return;
        if (newLevel % 5 !== 0) return;
        // Queue boss; spawn after the reward modal closes.
        this.bossQueuedLevel = newLevel;
    },

    trySpawnBossIfQueued() {
        if (this.bossActive) return;
        if (!this.bossQueuedLevel) return;
        this.spawnBossRandom(this.bossQueuedLevel);
        this.bossQueuedLevel = null;
    },

    spawnBossRandom(level) {
        const bosses = ['boss_hex_hydra', 'boss_broodmother', 'boss_stone_colossus'];
        let pick = bosses[Math.floor(Math.random() * bosses.length)];
        if (bosses.length > 1 && pick === this.lastBossId) {
            pick = bosses[(bosses.indexOf(pick) + 1) % bosses.length];
        }
        this.lastBossId = pick;

        // Spawn near the top edge, roughly centered.
        const x = canvas.width * (0.35 + Math.random() * 0.3);
        const y = -40;
        const boss = new Enemy(pick, { x, y, boss: true });
        this.enemies.push(boss);
        this.bossActive = true;
        this.bossEnemy = boss;
    },

    onBossDefeated(bossEnemy) {
        if (this.bossEnemy === bossEnemy) {
            this.bossEnemy = null;
        }
        this.bossActive = false;

        if (bossEnemy && bossEnemy.x !== undefined) {
            this.spawnBossChest(bossEnemy.x, bossEnemy.y);
        }
    },

    spawnBossChest(x, y) {
        if (typeof BossChest !== 'function') return;
        this.pickups.push(new BossChest(x, y));
    },

    over() {
        this.state = 'gameover';

        // Ensure in-run modals are closed.
        document.getElementById('inventory-modal')?.classList.remove('active');
        document.getElementById('levelup-modal')?.classList.remove('active');
        document.getElementById('accessory-replace-modal')?.classList.remove('active');

        const timeSec = Math.max(0, Math.floor((this.elapsedFrames || 0) / 60));
        const mins = Math.floor(timeSec / 60);
        const secs = timeSec % 60;
        const lvl = this.player?.level || 1;

        // Update best stats.
        if (timeSec > (this.stats.best.bestTimeSec || 0)) this.stats.best.bestTimeSec = timeSec;
        if ((this.stats.kills || 0) > (this.stats.best.bestKills || 0)) this.stats.best.bestKills = this.stats.kills;
        if (lvl > (this.stats.best.bestLevel || 0)) this.stats.best.bestLevel = lvl;
        this.stats.saveBest();

        const best = this.stats.best;
        const bestMin = Math.floor((best.bestTimeSec || 0) / 60);
        const bestSec = (best.bestTimeSec || 0) % 60;

        const synergies = (this.player?.activeSynergyNames || []).slice(0, 6);
        const syText = synergies.length ? synergies.map(s => `<div class="stat-row"><span>Synergy</span><span class="stat-val">${s}</span></div>`).join('') : '<div class="levelup-sidebar-muted" style="text-align:center; margin-top: 6px;">No synergies active</div>';

        const summary = `
            <div id="stats-panel" style="margin-top: 0;">
                <div class="stat-row"><span>Time</span><span class="stat-val">${mins}:${String(secs).padStart(2, '0')}</span></div>
                <div class="stat-row"><span>Kills</span><span class="stat-val">${this.stats.kills || 0}</span></div>
                <div class="stat-row"><span>Bosses</span><span class="stat-val">${this.stats.bossesKilled || 0}</span></div>
                <div class="stat-row"><span>Elites</span><span class="stat-val">${this.stats.elitesKilled || 0}</span></div>
                <div class="stat-row"><span>Level</span><span class="stat-val">${lvl}</span></div>
                <div class="stat-row"><span>Artifacts</span><span class="stat-val">${this.player?.artifacts?.length || 0}</span></div>
                <div class="stat-row"><span>Best Time</span><span class="stat-val">${bestMin}:${String(bestSec).padStart(2, '0')}</span></div>
                <div class="stat-row"><span>Best Kills</span><span class="stat-val">${best.bestKills || 0}</span></div>
                <div class="stat-row"><span>Best Level</span><span class="stat-val">${best.bestLevel || 0}</span></div>
            </div>
            <div class="section-header" style="margin-top: 14px;">Active Synergies</div>
            <div style="width:100%;">${syText}</div>
        `;

        this.showEndScreen(summary);
    },

    loop(timestamp) {
        if (this.state !== 'playing') {
            // Keep menu screens responsive without advancing simulation.
            this.renderBackdrop();
            requestAnimationFrame(this._loopBound || (this._loopBound = this.loop.bind(this)));
            return;
        }
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.elapsedFrames++;

        this.renderBackdrop();

        this.player.update();

        // Spawn queued boss as soon as we're in active play.
        this.trySpawnBossIfQueued();

        this.spawnTimer++;
        const levelRate = 50 - Math.min(40, this.player.level);
        const timeRate = Math.floor(Math.min(18, this.elapsedFrames / 1800)); // ramps over ~30s chunks
        // Higher late-game pressure: allow denser spawns.
        const minSpawnRate = (this.player.level >= 15 || this.elapsedFrames >= 60 * 60 * 6) ? 5 : 7;
        const spawnRate = Math.max(minSpawnRate, levelRate - timeRate);
        const pauseSpawns = window.DevMode?.enabled && window.DevMode?.cheats?.pauseSpawns;
        if (!pauseSpawns && !this.bossActive && this.spawnTimer > spawnRate) {
            this.enemies.push(EnemyFactory.spawn(this.player.level));
            this.spawnTimer = 0;
        }

        [this.enemies, this.projectiles, this.pickups, this.effects, this.floatingTexts, this.particles].forEach(arr => arr.forEach(e => e.update()));

        this.enemies = this.enemies.filter(e => !e.dead);
        this.projectiles = this.projectiles.filter(p => !p.dead);
        this.pickups = this.pickups.filter(p => !p.dead);
        this.effects = this.effects.filter(e => e.life > 0);
        this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);
        this.particles = this.particles.filter(p => p.life > 0);

        this.player.draw();
        [this.pickups, this.enemies, this.projectiles, this.effects, this.particles, this.floatingTexts].forEach(arr => arr.forEach(e => e.draw()));
        this.ui.updateBars();

        this.drawBossHealthBar();

        requestAnimationFrame(this._loopBound || (this._loopBound = this.loop.bind(this)));
    },

    drawBossHealthBar() {
        const b = this.bossEnemy;
        if (!this.bossActive || !b || b.dead) return;

        const w = Math.min(canvas.width - 40, 520);
        const x = (canvas.width - w) / 2;
        const y = 14;

        const hpPct = Math.max(0, Math.min(1, (b.hp || 0) / Math.max(1, b.maxHp || 1)));

        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - 6, y - 10, w + 12, 34);

        ctx.fillStyle = '#3b3b3b';
        ctx.fillRect(x, y, w, 14);
        ctx.fillStyle = '#d12b2b';
        ctx.fillRect(x, y, w * hpPct, 14);

        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        const name = b.archetype?.name || 'Boss';
        ctx.fillText(name, canvas.width / 2, y - 2);

        ctx.restore();
    },

    ui: {
        initScreens() {
            const startBtn = document.getElementById('main-menu-start-btn');
            const retryBtn = document.getElementById('end-screen-retry-btn');
            const menuBtn = document.getElementById('end-screen-menu-btn');

            if (startBtn) startBtn.onclick = () => Game.startNewRun();
            if (retryBtn) retryBtn.onclick = () => Game.startNewRun();
            if (menuBtn) menuBtn.onclick = () => Game.showMainMenu();
        },

        updateBars() {
            const p = Game.player;
            const hpFill = document.getElementById('hp-fill');
            const xpFill = document.getElementById('xp-fill');
            const hpText = document.getElementById('hp-text');
            const xpText = document.getElementById('xp-text');
            const lvlEl = document.getElementById('lvl-display');

            if (!p) {
                if (hpFill) hpFill.style.width = '0%';
                if (xpFill) xpFill.style.width = '0%';
                if (hpText) hpText.textContent = '0/0';
                if (xpText) xpText.textContent = '0/0';
                if (lvlEl) lvlEl.textContent = '1';
                return;
            }

            const hpPct = Math.max(0, Math.min(1, (p.hp || 0) / Math.max(1, p.stats.maxHp || 1)));
            const xpPct = Math.max(0, Math.min(1, (p.xp || 0) / Math.max(1, p.nextLevelXp || 1)));
            if (hpFill) hpFill.style.width = `${(hpPct * 100).toFixed(2)}%`;
            if (xpFill) xpFill.style.width = `${(xpPct * 100).toFixed(2)}%`;
            if (hpText) hpText.textContent = `${Math.ceil(p.hp || 0)}/${Math.ceil(p.stats.maxHp || 0)}`;
            if (xpText) xpText.textContent = `${Math.floor(p.xp || 0)}/${Math.floor(p.nextLevelXp || 0)}`;
            if (lvlEl) lvlEl.textContent = String(p.level || 1);

            this.updateSynergyPanel();
        },

        buildSynergyCtx(player, extraItem = null) {
            const weapon = player?.equipment?.weapon || null;
            const items = [...Object.values(player?.equipment || {}).filter(i => i), ...(player?.artifacts || [])];
            const cursedCountBase = items.filter(i => i && i.isCursed).length;
            const artifactCountBase = (player?.artifacts || []).length;

            const weaponModSum = (stat, def = 0) => {
                if (!weapon) return def;
                const mods = (weapon.modifiers || []).filter(m => m && m.stat === stat);
                if (!mods.length) return def;
                return mods.reduce((acc, curr) => (curr.operation === 'add' ? acc + (curr.value || 0) : acc), 0);
            };

            const weaponProjectileCountBase = Math.max(1, Math.floor(weaponModSum('projectileCount', 1)));
            const weaponCooldownBase = Math.max(5, weaponModSum('cooldown', 60));

            // Effect tags from current build.
            const fx = player?.effects || {};
            const flags = {
                hasBurn: (fx.burnOnHitPctTotal || 0) > 0,
                hasPoison: (fx.poisonOnHitPctTotal || 0) > 0,
                hasFreeze: (fx.freezeOnHitChance || 0) > 0,
                hasStun: (fx.stunOnHitChance || 0) > 0,
                hasSlow: (fx.slowOnHitMult || 0) > 0,
                hasChain: (fx.chainJumps || 0) > 0,
                hasShatter: (fx.shatterVsFrozenMult || 0) > 0,
                hasLeech: (fx.healOnHitPct || 0) > 0 || (fx.healOnHitFlat || 0) > 0,
                hasExecute: (fx.executeBelowPct || 0) > 0,
                isOrbitalWeapon: weapon && weapon.behavior === BehaviorType.ORBITAL
            };

            // Apply prospective item contribution (for tooltips).
            let cursedCount = cursedCountBase;
            let artifactCount = artifactCountBase;
            let weaponProjectileCount = weaponProjectileCountBase;
            let weaponCooldown = weaponCooldownBase;
            const tmpPlayer = player;

            if (extraItem) {
                if (extraItem.isCursed) cursedCount += 1;
                if (extraItem.type === ItemType.ARTIFACT) artifactCount += 1;

                const mods = extraItem.modifiers || [];
                const hasStat = (stat) => mods.some(m => m && m.stat === stat && (m.value || 0) !== 0);
                if (hasStat('burnOnHitPctTotal')) flags.hasBurn = true;
                if (hasStat('poisonOnHitPctTotal')) flags.hasPoison = true;
                if (hasStat('freezeOnHitChance')) flags.hasFreeze = true;
                if (hasStat('stunOnHitChance')) flags.hasStun = true;
                if (hasStat('slowOnHitMult')) flags.hasSlow = true;
                if (hasStat('chainJumps')) flags.hasChain = true;
                if (hasStat('shatterVsFrozenMult')) flags.hasShatter = true;
                if (hasStat('healOnHitPct') || hasStat('healOnHitFlat')) flags.hasLeech = true;
                if (hasStat('executeBelowPct')) flags.hasExecute = true;

                // If hovering a weapon, use its own weapon stats for certain synergies.
                if (extraItem.type === ItemType.WEAPON) {
                    const pm = (stat, def = 0) => {
                        const ms = (mods || []).filter(m => m && m.stat === stat);
                        if (!ms.length) return def;
                        return ms.reduce((acc, curr) => (curr.operation === 'add' ? acc + (curr.value || 0) : acc), 0);
                    };
                    weaponProjectileCount = Math.max(1, Math.floor(pm('projectileCount', 1)));
                    weaponCooldown = Math.max(5, pm('cooldown', 60));
                    flags.isOrbitalWeapon = extraItem.behavior === BehaviorType.ORBITAL;
                }

                // Crit chance bonus synergies depend on player effects.
                // If the item adds critChanceBonus as an effect modifier, count it.
                const critBonusMod = mods.filter(m => m && m.stat === 'critChanceBonus').reduce((a, m) => a + (m.value || 0), 0);
                if (critBonusMod) {
                    tmpPlayer.effects = tmpPlayer.effects || {};
                    tmpPlayer.effects.critChanceBonus = (tmpPlayer.effects.critChanceBonus || 0) + critBonusMod;
                }
            }

            return {
                player: tmpPlayer,
                weapon: extraItem && extraItem.type === ItemType.WEAPON ? extraItem : weapon,
                cursedCount,
                artifactCount,
                weaponProjectileCount,
                weaponCooldown,
                flags
            };
        },

        updateSynergyPanel() {
            const p = Game.player;
            const listEl = document.getElementById('synergy-list');
            if (!listEl) return;

            if (!p) {
                listEl.innerHTML = '<div class="levelup-sidebar-muted">Start a run to see synergies.</div>';
                return;
            }

            const ctx = this.buildSynergyCtx(p);
            const defs = (SynergyRegistry?.list || []).slice();

            const rows = [];
            // Active synergies first.
            for (const def of defs) {
                const res = SynergyRegistry.evaluate(def, ctx);
                if (!res.active) continue;
                rows.push({ def, res, cls: 'active' });
            }

            // Then near-complete: missing <= 1.
            const pending = [];
            for (const def of defs) {
                const res = SynergyRegistry.evaluate(def, ctx);
                if (res.active) continue;
                if ((res.missing || []).length <= 1) pending.push({ def, res, cls: 'pending' });
            }
            pending.slice(0, 3).forEach(x => rows.push(x));

            if (!rows.length) {
                listEl.innerHTML = '<div class="levelup-sidebar-muted">No synergies yet. Mix effects to activate them.</div>';
                return;
            }

            listEl.innerHTML = '';
            rows.forEach(({ def, res, cls }) => {
                const div = document.createElement('div');
                div.className = `synergy-item ${cls}`;
                const need = res.active ? '' : `<div class="synergy-need">${res.summary}</div>`;
                div.innerHTML = `<div class="synergy-name">${def.name}</div>${need}`;
                div.addEventListener('mouseenter', (e) => this.showSynergyTooltip(e, def, res));
                div.addEventListener('mouseleave', () => this.hideTooltip());
                div.addEventListener('mousemove', (e) => this.moveTooltip(e));
                listEl.appendChild(div);
            });
        },

        showSynergyTooltip(e, def, res) {
            const tt = document.getElementById('tooltip');
            if (!tt || !def) return;

            const titleColor = (res && res.active) ? '#7dd3fc' : '#ffffff';
            let content = `<h4 style="color:${titleColor}">✨ ${def.name}</h4>`;
            content += `<div class="tt-header-meta">Synergy</div>`;
            if (def.description) content += `<div style="color:#aaa; font-size:11px; margin-bottom:12px; line-height:1.3;">${def.description}</div>`;

            const ctx = this.buildSynergyCtx(Game.player);
            const evalRes = SynergyRegistry.evaluate(def, ctx);

            content += `<div class="tt-section">`;
            content += `<div class="tt-section-title">Requirements</div>`;
            if (evalRes.missing && evalRes.missing.length) {
                content += `<div class="tt-row"><span class="tt-label">Status</span><span class="tt-value" style="color:#ffb74d;">Not active</span></div>`;
                evalRes.missing.forEach(m => {
                    content += `<div class="tt-row"><span class="tt-label">Need</span><span class="tt-value" style="color:#ffb74d;">${m}</span></div>`;
                });
            } else {
                content += `<div class="tt-row"><span class="tt-label">Status</span><span class="tt-value">Active</span></div>`;
            }
            content += `</div>`;

            tt.innerHTML = content;
            tt.style.display = 'block';
            this.moveTooltip(e);
        },
        updateInventory() {
            const eq = Game.player.equipment;
            const slots = { 'slot-weapon': eq.weapon, 'slot-armor': eq.armor, 'slot-accessory1': eq.accessory1, 'slot-accessory2': eq.accessory2 };
            
            for (const [id, item] of Object.entries(slots)) {
                const el = document.getElementById(id).querySelector('.slot-content');
                const slotDiv = document.getElementById(id);
                const newSlot = slotDiv.cloneNode(true); 
                slotDiv.parentNode.replaceChild(newSlot, slotDiv);
                
                const currentSlot = document.getElementById(id);
                const currentContent = currentSlot.querySelector('.slot-content');

                if (item) {
                    currentContent.innerHTML = `<div style="color:${item.rarity.color}; font-weight:bold; text-align:center;">${item.name}</div><div style="font-size:10px; color:#aaa; text-align:center;">${item.rarity.name}</div>`;
                    currentSlot.classList.add('filled');
                    if (item.isCursed) currentSlot.classList.add('cursed');
                    else currentSlot.classList.remove('cursed');
                    currentSlot.style.borderColor = item.rarity.color;
                    
                    currentSlot.addEventListener('mouseenter', (e) => this.showTooltip(e, item, id === 'slot-weapon'));
                    currentSlot.addEventListener('mouseleave', () => this.hideTooltip());
                    currentSlot.addEventListener('mousemove', (e) => this.moveTooltip(e));
                } else {
                    currentContent.innerHTML = '<span style="color:#555">Empty</span>';
                    currentSlot.classList.remove('filled');
                    currentSlot.style.borderColor = '#555';
                }
            }

            const grid = document.getElementById('artifact-container');
            grid.innerHTML = '';
            Game.player.artifacts.forEach(art => {
                const div = document.createElement('div');
                div.className = 'artifact-slot';
                if (art.isCursed) div.classList.add('cursed');
                div.innerHTML = `<span class="artifact-icon">${art.icon || '💎'}</span>`;
                div.style.borderColor = art.rarity.color;
                
                div.addEventListener('mouseenter', (e) => this.showTooltip(e, art, false));
                div.addEventListener('mouseleave', () => this.hideTooltip());
                div.addEventListener('mousemove', (e) => this.moveTooltip(e));
                
                grid.appendChild(div);
            });

            this.updateStatsPanel();
        },
        updateStatsPanel() {
            const s = Game.player.stats;
            const p = document.getElementById('stats-panel');
            const xpBonusPct = Math.round(Math.max(0, (s.xpGain || 1) - 1) * 100);
            const critChance = (Game.player.getEffectiveCritChance ? Game.player.getEffectiveCritChance() : 0);

            const fam = Game?.player?.build?.dominantFamily || '—';
            const commit = Math.max(0, Math.min(10, Number(Game?.player?.build?.commitment || 0)));
            const tagCounts = Game?.player?.build?.tagCounts || {};
            const hidden = new Set(['projectile', 'aura', 'orbital']);
            const ranked = Object.entries(tagCounts)
                .filter(([, n]) => (Number(n) || 0) > 0)
                .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
            let topTags = ranked.filter(([t]) => !hidden.has(t)).slice(0, 3).map(([t]) => t);
            if (!topTags.length) topTags = ranked.slice(0, 3).map(([t]) => t);
            const tagText = topTags.length ? topTags.join(', ') : '—';

            p.innerHTML = `
                <div class="stat-row"><span>Max HP</span><span class="stat-val">${Math.round(s.maxHp)}</span></div>
                <div class="stat-row"><span>Damage</span><span class="stat-val">x${s.damage.toFixed(2)}</span></div>
                <div class="stat-row"><span>Speed</span><span class="stat-val">${s.moveSpeed.toFixed(1)}</span></div>
                <div class="stat-row"><span>Crit %</span><span class="stat-val">${Math.round(critChance*100)}%</span></div>
                <div class="stat-row"><span>Regen</span><span class="stat-val">${s.regen.toFixed(2)}/f</span></div>
                <div class="stat-row"><span>AOE</span><span class="stat-val">+${Math.round(s.areaOfEffect)}</span></div>
                <div class="stat-row"><span>XP Gain</span><span class="stat-val">+${xpBonusPct}%</span></div>
                <div class="stat-row"><span>Build</span><span class="stat-val">${fam}</span></div>
                <div class="stat-row"><span>Commitment</span><span class="stat-val">${commit}/10</span></div>
                <div class="stat-row"><span>Top Tags</span><span class="stat-val">${tagText}</span></div>
            `;
        },

        updateUpgradeSidebar() {
            const list = document.getElementById('upgrade-inventory-items');
            const art = document.getElementById('upgrade-artifact-summary');
            if (!list || !art) return;

            // Build summary (dominant family + commitment).
            const panel = list.parentElement;
            if (panel) {
                let buildEl = document.getElementById('upgrade-build-summary');
                if (!buildEl) {
                    buildEl = document.createElement('div');
                    buildEl.id = 'upgrade-build-summary';
                    buildEl.className = 'levelup-sidebar-muted';
                    buildEl.style.marginBottom = '10px';
                    panel.insertBefore(buildEl, list);
                }

                const fam = Game?.player?.build?.dominantFamily || '—';
                const commit = Math.max(0, Math.min(10, Number(Game?.player?.build?.commitment || 0)));
                const tagCounts = Game?.player?.build?.tagCounts || {};
                const hidden = new Set(['projectile', 'aura', 'orbital']);

                const ranked = Object.entries(tagCounts)
                    .filter(([, n]) => (Number(n) || 0) > 0)
                    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));

                let topTags = ranked
                    .filter(([t]) => !hidden.has(t))
                    .slice(0, 3)
                    .map(([t]) => t);

                // Fallback: if everything is generic, still show something.
                if (!topTags.length) {
                    topTags = ranked.slice(0, 3).map(([t]) => t);
                }

                const tagText = topTags.length ? ` • Tags: ${topTags.join(', ')}` : '';
                buildEl.textContent = `Build: ${fam} • Commitment: ${commit}/10${tagText}`;
            }

            list.innerHTML = '';

            const eq = Game.player.equipment;
            const rows = [
                { label: 'Weapon', item: eq.weapon, isWeapon: true },
                { label: 'Armor', item: eq.armor, isWeapon: false },
                { label: 'Accessory 1', item: eq.accessory1, isWeapon: false },
                { label: 'Accessory 2', item: eq.accessory2, isWeapon: false }
            ];

            rows.forEach(r => {
                const div = document.createElement('div');
                div.className = 'upgrade-gear-item';
                if (r.item) {
                    if (r.item.isCursed) div.classList.add('cursed');
                    const color = r.item.isCursed ? '#9c27b0' : r.item.rarity.color;
                    const badge = r.item.isCursed ? '<span class="cursed-badge">Cursed</span>' : '';
                    div.style.borderColor = color;
                    div.innerHTML = `
                        <div style="font-size:11px; color:#aaa;">${r.label}</div>
                        <div style="color:${color}; font-weight:700;">${r.item.name}${badge}</div>
                        <div style="font-size:11px; color:#bbb;">${r.item.rarity.name}</div>
                    `;
                    div.addEventListener('mouseenter', (e) => this.showTooltip(e, r.item, r.isWeapon));
                    div.addEventListener('mouseleave', () => this.hideTooltip());
                    div.addEventListener('mousemove', (e) => this.moveTooltip(e));
                } else {
                    div.style.borderColor = '#444';
                    div.innerHTML = `
                        <div style="font-size:11px; color:#aaa;">${r.label}</div>
                        <div style="color:#666;">Empty</div>
                    `;
                }
                list.appendChild(div);
            });

            const count = Game.player.artifacts.length;
            art.textContent = `${count} collected`;
        },

        promptAccessoryReplace(newItem, onPickSlot, onCancel) {
            const modal = document.getElementById('accessory-replace-modal');
            const summary = document.getElementById('accessory-replace-summary');
            const btnA1 = document.getElementById('replace-accessory1-btn');
            const btnA2 = document.getElementById('replace-accessory2-btn');
            const btnCancel = document.getElementById('replace-accessory-cancel-btn');

            if (!modal || !summary || !btnA1 || !btnA2 || !btnCancel) {
                // Fail-safe: if modal isn't present, just replace accessory1.
                if (typeof onPickSlot === 'function') onPickSlot('accessory1');
                return;
            }

            const eq = Game?.player?.equipment || {};
            const a1Name = eq.accessory1?.name || 'Empty';
            const a2Name = eq.accessory2?.name || 'Empty';
            const color = newItem?.rarity?.color || 'white';

            summary.innerHTML = `Take <span style="color:${color}; font-weight:bold;">${newItem?.name || 'Accessory'}</span><br/>Replace: <b>${a1Name}</b> or <b>${a2Name}</b>?`;

            const cleanup = () => {
                btnA1.onclick = null;
                btnA2.onclick = null;
                btnCancel.onclick = null;
                modal.classList.remove('active');
            };

            btnA1.onclick = () => { cleanup(); if (typeof onPickSlot === 'function') onPickSlot('accessory1'); };
            btnA2.onclick = () => { cleanup(); if (typeof onPickSlot === 'function') onPickSlot('accessory2'); };
            btnCancel.onclick = () => { cleanup(); if (typeof onCancel === 'function') onCancel(); };

            modal.classList.add('active');
        },
        showTooltip(e, item, isWeapon) {
            const tt = document.getElementById('tooltip');
            
            // Header
            const headerColor = item.isCursed ? '#9c27b0' : item.rarity.color;
            const headerClass = item.isCursed ? 'tt-cursed-header' : '';
            const icon = item.isCursed ? '💀' : '⚔️';
            const badge = item.isCursed ? '<span class="cursed-badge">Cursed</span>' : '';

            let content = `<h4 style="color:${headerColor}" class="${headerClass}">${icon} ${item.name}${badge}</h4>`;
            content += `<div class="tt-header-meta">${item.rarity.name} ${item.type}</div>`;
            content += `<div style="color:#aaa; font-size:11px; margin-bottom:12px; line-height:1.3;">${item.description}</div>`;

            // Synergy clarity (tooltip requirement): show what this item would help activate.
            if (typeof SynergyRegistry !== 'undefined' && Game.player) {
                const baseCtx = this.buildSynergyCtx(Game.player);
                const nextCtx = this.buildSynergyCtx(Game.player, item);
                const completes = [];
                const advances = [];
                for (const def of (SynergyRegistry.list || [])) {
                    const before = SynergyRegistry.evaluate(def, baseCtx);
                    const after = SynergyRegistry.evaluate(def, nextCtx);
                    if (!before.active && after.active) completes.push(def.name);
                    else if (!before.active && !after.active) {
                        const bm = (before.missing || []).length;
                        const am = (after.missing || []).length;
                        if (am < bm) advances.push(def.name);
                    }
                }

                if (completes.length || advances.length) {
                    content += `<div class="tt-section">`;
                    content += `<div class="tt-section-title">Synergy Impact</div>`;
                    if (completes.length) {
                        content += `<div class="tt-row"><span class="tt-label">Completes</span><span class="tt-value">${completes.slice(0, 3).join(', ')}</span></div>`;
                    }
                    if (advances.length) {
                        content += `<div class="tt-row"><span class="tt-label">Helps</span><span class="tt-value">${advances.slice(0, 3).join(', ')}</span></div>`;
                    }
                    content += `</div>`;
                }
            }

            if (isWeapon) {
                const p = Game.player;
                const getBaseMod = (s) => item.modifiers.filter(m=>m.stat===s).reduce((a,c)=>a+c.value, 0);
                
                // Core combat stats
                const baseDmg = getBaseMod('baseDamage') || 5;
                const finalDmg = baseDmg * p.stats.damage;
                const baseCd = getBaseMod('cooldown') || 60;
                const finalCd = Math.max(5, baseCd * p.stats.cooldownMult);
                const proj = Math.floor(getBaseMod('projectileCount') || 1);
                
                // Crit stats (new!)
                const baseCritChance = getBaseMod('critChance') || 0;
                const effectCritBonus = (p.effects.critChanceBonus || 0);
                const effectiveCritChance = baseCritChance + effectCritBonus;
                const baseCritDmgMult = getBaseMod('critDamageMultBase') || 2;
                const overCrit = Math.max(0, effectiveCritChance - 1);
                const effectiveCritDmgMult = baseCritDmgMult * (1 + overCrit);
                
                // Secondary stats
                const pierce = Math.floor(getBaseMod('pierce') || 0);
                const knockback = getBaseMod('knockback') || 0;
                const aoe = getBaseMod('areaOfEffect') || 0;
                const projSpeed = getBaseMod('projSpeed') || 8;
                
                // CORE COMBAT STATS SECTION (2-column grid)
                content += `<div class="tt-section">`;
                content += `<div class="tt-section-title">⚡ Core Stats</div>`;
                content += `<div class="tt-grid">`;
                
                content += `<div class="tt-grid-item">`;
                content += `<div class="tt-row"><span class="tt-label">Damage</span></div>`;
                content += `<div class="tt-row"><span style="font-size:13px; font-weight:700; color:#81c784;">${baseDmg.toFixed(1)}</span> <span style="color:#666; font-size:10px;">base</span></div>`;
                content += `<div class="tt-calc">→ ${finalDmg.toFixed(1)} effective</div>`;
                content += `</div>`;
                
                content += `<div class="tt-grid-item">`;
                content += `<div class="tt-row"><span class="tt-label">Cooldown</span></div>`;
                content += `<div class="tt-row"><span style="font-size:13px; font-weight:700; color:#81c784;">${baseCd}f</span> <span style="color:#666; font-size:10px;">base</span></div>`;
                content += `<div class="tt-calc">→ ${finalCd.toFixed(1)}f effective</div>`;
                content += `</div>`;
                
                if (proj > 1) {
                    content += `<div class="tt-grid-item">`;
                    content += `<div class="tt-row"><span class="tt-label">Projectiles</span></div>`;
                    content += `<div class="tt-row"><span style="font-size:13px; font-weight:700; color:#81c784;">${proj}</span> <span style="color:#666; font-size:10px;">per shot</span></div>`;
                    content += `</div>`;
                }
                
                content += `</div></div>`; // end grid & core section
                
                // CRIT SECTION (NEW!)
                content += `<div class="tt-section tt-grid-item highlight">`;
                content += `<div class="tt-section-title" style="color:#ff6b9d;">✨ Critical Strike</div>`;
                content += `<div class="tt-row"><span class="tt-label">Crit Chance</span> <span class="tt-value crit-chance">${(effectiveCritChance * 100).toFixed(1)}%</span></div>`;
                if (overCrit > 0) {
                    content += `<div class="tt-calc" style="color:#ff6b9d;">⬆ Over-crit active! +${(overCrit * 100).toFixed(1)}%</div>`;
                }
                content += `<div class="tt-row"><span class="tt-label">Crit Damage</span> <span class="tt-value crit-damage">x${effectiveCritDmgMult.toFixed(2)}</span></div>`;
                if (overCrit > 0) {
                    content += `<div class="tt-calc" style="color:#ffa500;">Base: x${baseCritDmgMult.toFixed(2)} → Scaled by over-crit</div>`;
                }
                content += `</div>`; // end crit section
                
                // SECONDARY STATS SECTION
                if (pierce > 0 || knockback > 0 || aoe > 0 || projSpeed !== 8) {
                    content += `<div class="tt-section">`;
                    content += `<div class="tt-section-title">⚙️ Modifiers</div>`;
                    if (pierce > 0) content += `<div class="tt-row"><span class="tt-label">Pierce</span> <span class="tt-value">${pierce}</span></div>`;
                    if (knockback > 0) content += `<div class="tt-row"><span class="tt-label">Knockback</span> <span class="tt-value defensive">${knockback.toFixed(1)}</span></div>`;
                    if (aoe > 0) content += `<div class="tt-row"><span class="tt-label">Area Effect</span> <span class="tt-value">${aoe.toFixed(0)}</span></div>`;
                    if (projSpeed !== 8) content += `<div class="tt-row"><span class="tt-label">Projectile Speed</span> <span class="tt-value">${projSpeed.toFixed(1)}</span></div>`;
                    content += `</div>`; // end secondary section
                }

                // CURSE SECTION (FOR WEAPONS)
                const curseMods = item.modifiers.filter(m => m.source === 'curse');
                if (curseMods.length > 0) {
                    content += `<div class="tt-section" style="border-bottom-color: rgba(156, 39, 176, 0.3);">`;
                    content += `<div class="tt-section-title" style="color:#9c27b0;">💀 Curse Afflictions</div>`;
                    curseMods.forEach(m => {
                        let val = LootSystem.formatStat(m.stat, m.value);
                        content += `<div class="tt-row"><span class="tt-label">${m.name || m.stat}</span> <span class="tt-value" style="color:#ff5252">${val}</span></div>`;
                    });
                    content += `</div>`;
                }
                
            } else {
                // NON-WEAPON ITEMS
                content += `<div class="tt-section">`;
                item.modifiers.forEach((m, idx) => {
                    let val = LootSystem.formatStat(m.stat, m.value);
                    const isBonus = m.stat.includes('Bonus') || m.source === 'special';
                    const isCurse = m.source === 'curse';
                    const valColor = isCurse ? '#ff5252' : (isBonus ? '#ff6b9d' : '#81c784');
                    content += `<div class="tt-row"><span class="tt-label">${m.name || m.stat}</span> <span class="tt-value" style="color:${valColor}">${val}</span></div>`;
                });
                content += `</div>`;
            }

            tt.innerHTML = content;
            tt.style.display = 'block';
            this.moveTooltip(e);
        },
        hideTooltip() {
            document.getElementById('tooltip').style.display = 'none';
        },
        moveTooltip(e) {
            const tt = document.getElementById('tooltip');
            tt.style.left = e.pageX + 15 + 'px';
            tt.style.top = e.pageY + 15 + 'px';
        }
    }
};
