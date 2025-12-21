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
                let valStr = LootSystem.formatStat(m.stat, m.value, m.operation);
                return `<span class="mod-line ${cssClass}">${valStr} ${m.name || m.stat}</span>`;
            }).join('');

            const headerColor = item.isCursed ? '#9c27b0' : item.rarity.color;
            const badge = item.isCursed ? '<span class="cursed-badge">Cursed</span>' : '';
            const offerLabel = '';

            card.innerHTML = `
                <h3 style="color:${headerColor}">${item.name}${badge}</h3>
                <span class="rarity-tag" style="color:${headerColor}">${item.rarity.name} ${item.type}</span>
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
            const buffsPanel = document.getElementById('buffs-panel');

            if (!p) {
                if (hpFill) hpFill.style.width = '0%';
                if (xpFill) xpFill.style.width = '0%';
                if (hpText) hpText.textContent = '0/0';
                if (xpText) xpText.textContent = '0/0';
                if (lvlEl) lvlEl.textContent = '1';
                if (buffsPanel) buffsPanel.innerHTML = '<div class="buff-empty">None</div>';
                return;
            }

            const hpPct = Math.max(0, Math.min(1, (p.hp || 0) / Math.max(1, p.stats.maxHp || 1)));
            const xpPct = Math.max(0, Math.min(1, (p.xp || 0) / Math.max(1, p.nextLevelXp || 1)));
            if (hpFill) hpFill.style.width = `${(hpPct * 100).toFixed(2)}%`;
            if (xpFill) xpFill.style.width = `${(xpPct * 100).toFixed(2)}%`;
            if (hpText) hpText.textContent = `${Math.ceil(p.hp || 0)}/${Math.ceil(p.stats.maxHp || 0)}`;
            if (xpText) xpText.textContent = `${Math.floor(p.xp || 0)}/${Math.floor(p.nextLevelXp || 0)}`;
            if (lvlEl) lvlEl.textContent = String(p.level || 1);

            if (buffsPanel) {
                const buffs = (p.getActiveBuffs ? p.getActiveBuffs() : []) || [];
                if (!buffs.length) {
                    buffsPanel.innerHTML = '<div class="buff-empty">None</div>';
                } else {
                    buffsPanel.innerHTML = buffs.map(b => {
                        const secs = Math.max(0, (b.time || 0) / 60);
                        const timeText = `${secs.toFixed(1)}s`;
                        const stacksText = (b.stacks && b.stacks > 1) ? `x${b.stacks}` : '';
                        return `
                            <div class="buff-row">
                                <span class="buff-name">${b.name}</span>
                                <span class="buff-meta">${stacksText} ${timeText}</span>
                            </div>
                        `;
                    }).join('');
                }
            }

            // No synergies.
        },

        updateInventory() {
            const p = Game.player;
            if (!p) return;

            const eq = p.equipment || {};
            const slots = [
                { id: 'slot-weapon', item: eq.weapon, isWeapon: true },
                { id: 'slot-armor', item: eq.armor, isWeapon: false },
                { id: 'slot-accessory1', item: eq.accessory1, isWeapon: false },
                { id: 'slot-accessory2', item: eq.accessory2, isWeapon: false }
            ];

            slots.forEach(({ id, item, isWeapon }) => {
                const slotEl = document.getElementById(id);
                if (!slotEl) return;
                const contentEl = slotEl.querySelector('.slot-content');
                if (!contentEl) return;

                // Clear any prior listeners by replacing handlers.
                slotEl.onmouseenter = null;
                slotEl.onmouseleave = null;
                slotEl.onmousemove = null;

                if (item) {
                    const color = item.isCursed ? '#9c27b0' : (item.rarity?.color || '#fff');
                    const badge = item.isCursed ? '<span class="cursed-badge">Cursed</span>' : '';
                    contentEl.innerHTML = `<span style="color:${color}; font-weight:800;">${item.name}</span>${badge}<br/><span style="font-size:11px; color:#aaa;">${item.rarity?.name || ''}</span>`;
                    slotEl.classList.add('filled');
                    slotEl.style.borderColor = color;

                    slotEl.onmouseenter = (e) => this.showTooltip(e, item, isWeapon);
                    slotEl.onmouseleave = () => this.hideTooltip();
                    slotEl.onmousemove = (e) => this.moveTooltip(e);
                } else {
                    contentEl.innerHTML = '<span style="color:#555">Empty</span>';
                    slotEl.classList.remove('filled');
                    slotEl.style.borderColor = '#555';
                }
            });

            const grid = document.getElementById('artifact-container');
            if (grid) {
                grid.innerHTML = '';
                (p.artifacts || []).forEach(art => {
                    const div = document.createElement('div');
                    div.className = 'artifact-slot';
                    if (art.isCursed) div.classList.add('cursed');
                    div.innerHTML = `<span class="artifact-icon">${art.icon || '💎'}</span>`;
                    div.style.borderColor = art.rarity?.color || '#fff';

                    div.addEventListener('mouseenter', (e) => this.showTooltip(e, art, false));
                    div.addEventListener('mouseleave', () => this.hideTooltip());
                    div.addEventListener('mousemove', (e) => this.moveTooltip(e));

                    grid.appendChild(div);
                });
            }

            this.updateStatsPanel();
        },
        updateStatsPanel() {
            const s = Game.player.stats;
            const p = document.getElementById('stats-panel');
            const xpBonusPct = Math.round(Math.max(0, (s.xpGain || 1) - 1) * 100);
            const critChance = (Game.player.getEffectiveCritChance ? Game.player.getEffectiveCritChance() : 0);

            p.innerHTML = `
                <div class="stat-row"><span>Max HP</span><span class="stat-val">${Math.round(s.maxHp)}</span></div>
                <div class="stat-row"><span>Damage</span><span class="stat-val">x${s.damage.toFixed(2)}</span></div>
                <div class="stat-row"><span>Speed</span><span class="stat-val">${s.moveSpeed.toFixed(1)}</span></div>
                <div class="stat-row"><span>Crit %</span><span class="stat-val">${Math.round(critChance*100)}%</span></div>
                <div class="stat-row"><span>Regen</span><span class="stat-val">${s.regen.toFixed(2)}/f</span></div>
                <div class="stat-row"><span>AOE</span><span class="stat-val">+${Math.round(s.areaOfEffect)}</span></div>
                <div class="stat-row"><span>XP Gain</span><span class="stat-val">+${xpBonusPct}%</span></div>
            `;
        },

        updateUpgradeSidebar() {
            const list = document.getElementById('upgrade-inventory-items');
            const art = document.getElementById('upgrade-artifact-summary');
            if (!list || !art) return;

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

            const renderAffixesSection = () => {
                const affixes = Array.isArray(item.affixes) ? item.affixes : [];
                if (!affixes.length) return '';

                let html = `<div class="tt-section">`;
                html += `<div class="tt-section-title" style="color:#ffb74d;">🧷 Affixes</div>`;

                affixes.forEach(a => {
                    html += `<div class="tt-row"><span class="tt-label" style="color:#ffb74d; font-weight:800;">${a.name}</span><span class="tt-value" style="color:#888; font-weight:600;">Affix</span></div>`;

                    const mods = Array.isArray(a.modifiers) ? a.modifiers : [];
                    mods.forEach(m => {
                        const v = Number(m.value) || 0;
                        const val = LootSystem.formatStat(m.stat, v, m.operation);
                        const color = v < 0 ? '#ff5252' : '#81c784';
                        html += `<div class="tt-row"><span class="tt-label">${m.name || m.stat}</span> <span class="tt-value" style="color:${color}">${val}</span></div>`;
                    });

                });

                html += `</div>`;
                return html;
            };

            const renderEffectsSection = () => {
                const parts = [];

                // Weapon effects
                if (item?.type === ItemType.WEAPON && item?.specialEffect) {
                    const fx = item.specialEffect;
                    let html = `<div class="tt-section">`;
                    html += `<div class="tt-section-title" style="color:#ff6b9d;">✨ Effect</div>`;
                    html += `<div class="tt-row"><span class="tt-label" style="color:#ff6b9d; font-weight:800;">${fx.name || 'Effect'}</span><span class="tt-value" style="color:#888; font-weight:600;">Weapon</span></div>`;
                    if (fx.description) {
                        html += `<div class="tt-calc" style="color:#bbb; font-style:normal; font-size:10px;">${fx.description}</div>`;
                    }
                    if (fx.effects && typeof EffectUtils !== 'undefined' && EffectUtils.describeEffect) {
                        const lines = EffectUtils.describeEffect(fx.effects);
                        (lines || []).forEach(l => {
                            html += `<div class="tt-row"><span class="tt-label">${l}</span></div>`;
                        });
                    }
                    html += `</div>`;
                    parts.push(html);
                }

                // Accessory enhancements
                if (item?.type === ItemType.ACCESSORY && item?.enhancement) {
                    const enh = item.enhancement;
                    let html = `<div class="tt-section">`;
                    html += `<div class="tt-section-title" style="color:#64b5f6;">🧿 Enhancement</div>`;
                    html += `<div class="tt-row"><span class="tt-label" style="color:#64b5f6; font-weight:800;">${enh.name || 'Enhancement'}</span><span class="tt-value" style="color:#888; font-weight:600;">Accessory</span></div>`;
                    if (enh.description) {
                        html += `<div class="tt-calc" style="color:#bbb; font-style:normal; font-size:10px;">${enh.description}</div>`;
                    }
                    if (enh.effects && typeof EffectUtils !== 'undefined' && EffectUtils.describeEffect) {
                        const lines = EffectUtils.describeEffect(enh.effects);
                        (lines || []).forEach(l => {
                            html += `<div class="tt-row"><span class="tt-label">${l}</span></div>`;
                        });
                    }
                    html += `</div>`;
                    parts.push(html);
                }

                return parts.join('');
            };
            
            // Header
            const headerColor = item.isCursed ? '#9c27b0' : item.rarity.color;
            const headerClass = item.isCursed ? 'tt-cursed-header' : '';
            const icon = item.isCursed ? '💀' : '⚔️';
            const badge = item.isCursed ? '<span class="cursed-badge">Cursed</span>' : '';

            let content = `<h4 style="color:${headerColor}" class="${headerClass}">${icon} ${item.name}${badge}</h4>`;
            content += `<div class="tt-header-meta">${item.rarity.name} ${item.type}</div>`;
            content += `<div style="color:#aaa; font-size:11px; margin-bottom:12px; line-height:1.3;">${item.description}</div>`;

            // No synergies.

            if (isWeapon) {
                const p = Game.player;
                const getBaseMod = (s) => item.modifiers.filter(m=>m.stat===s).reduce((a,c)=>a+c.value, 0);
                const getEff = (s, def) => (p.getEffectiveItemStat ? p.getEffectiveItemStat(item, s, def) : (getBaseMod(s) || def));
                
                // Core combat stats
                const baseDmg = getEff('baseDamage', 5);
                const finalDmg = baseDmg * p.stats.damage;
                const baseCd = getEff('cooldown', 60);
                const finalCd = Math.max(5, baseCd * p.stats.cooldownMult);
                const proj = Math.floor(getEff('projectileCount', 1));
                
                // Crit stats (new!)
                const baseCritChance = (p.getEffectiveItemStat ? p.getEffectiveItemStat(item, 'critChance', 0) : (getBaseMod('critChance') || 0));
                const effectiveCritChance = (p.getEffectiveCritChance ? p.getEffectiveCritChance(item) : baseCritChance);
                const baseCritDmgMult = (p.getBaseCritDamageMult ? p.getBaseCritDamageMult(item) : (getBaseMod('critDamageMultBase') || 2));
                const overCrit = Math.max(0, effectiveCritChance - 1);
                const overCritEffective = overCrit / (1 + overCrit);
                const effectiveCritDmgMult = baseCritDmgMult * (1 + overCritEffective);
                
                // Secondary stats
                const pierce = Math.floor(getEff('pierce', 0));
                const knockback = getEff('knockback', 0);
                const aoe = getEff('areaOfEffect', 0);
                const projSpeed = getEff('projSpeed', 8);
                
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

                // AFFIXES + EFFECTS (clearly separated from base stats)
                content += renderAffixesSection();
                content += renderEffectsSection();

                // CURSE SECTION (FOR WEAPONS)
                const curseMods = item.modifiers.filter(m => m.source === 'curse');
                if (curseMods.length > 0) {
                    content += `<div class="tt-section" style="border-bottom-color: rgba(156, 39, 176, 0.3);">`;
                    content += `<div class="tt-section-title" style="color:#9c27b0;">💀 Curse Afflictions</div>`;
                    curseMods.forEach(m => {
                        let val = LootSystem.formatStat(m.stat, m.value, m.operation);
                        content += `<div class="tt-row"><span class="tt-label">${m.name || m.stat}</span> <span class="tt-value" style="color:#ff5252">${val}</span></div>`;
                    });
                    content += `</div>`;
                }
                
            } else {
                // NON-WEAPON ITEMS
                const baseMods = (item.modifiers || []).filter(m => m && m.source === 'base');
                if (baseMods.length) {
                    content += `<div class="tt-section">`;
                    content += `<div class="tt-section-title">Stats</div>`;
                    baseMods.forEach(m => {
                        const v = Number(m.value) || 0;
                        const val = LootSystem.formatStat(m.stat, v, m.operation);
                        const color = v < 0 ? '#ff5252' : '#81c784';
                        content += `<div class="tt-row"><span class="tt-label">${m.name || m.stat}</span> <span class="tt-value" style="color:${color}">${val}</span></div>`;
                    });
                    content += `</div>`;
                }

                content += renderAffixesSection();
                content += renderEffectsSection();

                const curseMods = (item.modifiers || []).filter(m => m && m.source === 'curse');
                if (curseMods.length > 0) {
                    content += `<div class="tt-section" style="border-bottom-color: rgba(156, 39, 176, 0.3);">`;
                    content += `<div class="tt-section-title" style="color:#9c27b0;">💀 Curse Afflictions</div>`;
                    curseMods.forEach(m => {
                        const v = Number(m.value) || 0;
                        const val = LootSystem.formatStat(m.stat, v, m.operation);
                        content += `<div class="tt-row"><span class="tt-label">${m.name || m.stat}</span> <span class="tt-value" style="color:#ff5252">${val}</span></div>`;
                    });
                    content += `</div>`;
                }
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
            if (!tt) return;

            // Calculate desired position
            let x = e.pageX + 15;
            let y = e.pageY + 15;

            // Get tooltip dimensions (must be visible first to measure)
            const rect = tt.getBoundingClientRect();
            const ttWidth = rect.width || 260;
            const ttHeight = rect.height;

            // Get viewport dimensions
            const vw = window.innerWidth || document.documentElement.clientWidth;
            const vh = window.innerHeight || document.documentElement.clientHeight;
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

            // Clamp to viewport with padding
            const pad = 10;
            const maxX = scrollX + vw - ttWidth - pad;
            const maxY = scrollY + vh - ttHeight - pad;

            x = Math.max(scrollX + pad, Math.min(x, maxX));
            y = Math.max(scrollY + pad, Math.min(y, maxY));

            tt.style.left = x + 'px';
            tt.style.top = y + 'px';
        }
    }
};
