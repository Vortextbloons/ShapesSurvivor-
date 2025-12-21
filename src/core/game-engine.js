const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

function compactInPlace(arr, keepFn) {
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (keepFn(v)) arr[w++] = v;
    }
    arr.length = w;
}

function fmtMs(v) {
    const n = Number(v) || 0;
    return n.toFixed(2);
}

const Game = {
    state: 'mainmenu',
    lastTime: 0,
    _loopBound: null,
    _resizeBound: null,
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
    _bgPattern: null,

    // Fixed timestep configuration (60 FPS logic updates)
    _fixedDt: 1000 / 60,       // Target ~16.67ms per logic update
    _accumulator: 0,           // Accumulated time for fixed updates
    _maxAccumulator: 1000 / 15, // Cap to prevent spiral of death (~4 updates max)

    // Spatial index for enemies.
    _enemyGrid: new SpatialGrid(120),
    _perf: new PerformanceMonitor('dev-perf-overlay'),

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

        if (!this._resizeBound) {
            this._resizeBound = () => {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                this.createBgGrid();
            };
            window.addEventListener('resize', this._resizeBound);
        }

        Input.init();

        this.stats.loadBest();
        if (!this.ui) {
            this.ui = (typeof UIManager === 'function') ? new UIManager() : null;
        }
        this.ui?.init?.();

        this.showMainMenu();
        this.ui.updateBars();

        // Render one frame so the canvas isn't blank behind menus.
        this.renderBackdrop();
        if (!this._loopBound) this._loopBound = this.loop.bind(this);
        requestAnimationFrame(this._loopBound);
        return;
    },

    renderBackdrop() {
        if (!this._bgPattern && this.bgGrid) {
            this._bgPattern = ctx.createPattern(this.bgGrid, 'repeat');
        }
        const ptrn = this._bgPattern;
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
        this._accumulator = 0;  // Reset fixed timestep accumulator
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

        // Cache the repeating pattern once (recreated on resize / grid rebuild).
        this._bgPattern = ctx.createPattern(this.bgGrid, 'repeat');
    },

    forEachEnemyNear(x, y, r, fn) {
        return this._enemyGrid.forEachNear(x, y, r, fn);
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
            this._accumulator = 0;  // Reset accumulator to prevent burst of updates
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
        const resume = () => {
            document.getElementById('levelup-modal')?.classList.remove('active');
            this.state = 'playing';
            this.lastTime = performance.now();
            this._accumulator = 0;  // Reset accumulator to prevent burst of updates

            // Spawn queued boss immediately after resuming (e.g., after picking reward).
            this.trySpawnBossIfQueued();
        };

        this.ui?.showRewardModal?.({
            title,
            items,
            onTake: (item) => this.player.equip(item, { onAfterEquip: resume }),
            onExit: resume
        });
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

    // Fixed timestep update - runs at consistent 60 FPS regardless of display refresh rate
    fixedUpdate() {
        this.elapsedFrames++;

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

        // Update entities (freeze lengths to avoid updating newly-spawned objects the same frame).
        let n = 0;
        n = this.enemies.length;
        for (let i = 0; i < n; i++) this.enemies[i]?.update?.();

        // Build enemy spatial index for fast projectile collision checks.
        this._enemyGrid.build(this.enemies);

        n = this.projectiles.length;
        for (let i = 0; i < n; i++) this.projectiles[i]?.update?.();
        n = this.pickups.length;
        for (let i = 0; i < n; i++) this.pickups[i]?.update?.();
        n = this.effects.length;
        for (let i = 0; i < n; i++) this.effects[i]?.update?.();
        n = this.floatingTexts.length;
        for (let i = 0; i < n; i++) this.floatingTexts[i]?.update?.();
        n = this.particles.length;
        for (let i = 0; i < n; i++) this.particles[i]?.update?.();

        // In-place compaction to avoid per-frame allocations.
        compactInPlace(this.enemies, (e) => !!e && !e.dead);
        compactInPlace(this.projectiles, (p) => !!p && !p.dead);
        compactInPlace(this.pickups, (p) => !!p && !p.dead);
        compactInPlace(this.effects, (e) => !!e && (e.life === undefined || e.life > 0));
        compactInPlace(this.floatingTexts, (t) => !!t && (t.life === undefined || t.life > 0));
        compactInPlace(this.particles, (p) => !!p && (p.life === undefined || p.life > 0));
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

        const perfOn = !!(window.DevMode?.enabled && window.DevMode?.cheats?.perfHud);
        const perf = this._perf;

        let t0 = perfOn ? performance.now() : 0;

        this.renderBackdrop();
        if (perfOn) t0 = perf.record('backdropMs', t0);

        // Fixed timestep: accumulate time and run fixed updates
        this._accumulator += dt;
        // Cap accumulator to prevent spiral of death on slow frames
        if (this._accumulator > this._maxAccumulator) {
            this._accumulator = this._maxAccumulator;
        }

        // Run fixed updates at consistent rate
        let updateCount = 0;
        while (this._accumulator >= this._fixedDt) {
            this.fixedUpdate();
            this._accumulator -= this._fixedDt;
            updateCount++;
        }

        if (perfOn) t0 = perf.record('updateMs', t0);

        // Draw (always runs at display refresh rate for smooth visuals)
        let n = 0;
        this.player.draw();
        n = this.pickups.length;
        for (let i = 0; i < n; i++) this.pickups[i]?.draw?.();
        n = this.enemies.length;
        for (let i = 0; i < n; i++) this.enemies[i]?.draw?.();
        n = this.projectiles.length;
        for (let i = 0; i < n; i++) this.projectiles[i]?.draw?.();
        n = this.effects.length;
        for (let i = 0; i < n; i++) this.effects[i]?.draw?.();
        n = this.particles.length;
        for (let i = 0; i < n; i++) this.particles[i]?.draw?.();
        n = this.floatingTexts.length;
        for (let i = 0; i < n; i++) this.floatingTexts[i]?.draw?.();

        if (perfOn) t0 = perf.record('drawMs', t0);

        this.ui.updateBars(timestamp);
        if (perfOn) t0 = perf.record('uiMs', t0);

        this.drawBossHealthBar();

        perf.update(dt, {
            e: this.enemies.length,
            pr: this.projectiles.length,
            pk: this.pickups.length,
            fx: this.effects.length,
            pt: this.particles.length,
            tx: this.floatingTexts.length
        });

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

    ui: null
};
