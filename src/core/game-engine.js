const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 720;

const clamp01 = (v) => (window.MathUtils?.clamp01 ? MathUtils.clamp01(v) : Math.max(0, Math.min(1, v)));
const fmtMs = v => (Number(v) || 0).toFixed(2);

function compactInPlace(arr, keepFn) {
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
        if (keepFn(arr[i])) arr[w++] = arr[i];
    }
    arr.length = w;
}

window.Game = {
    state: 'mainmenu',
    VIEW_WIDTH: DESIGN_WIDTH,
    VIEW_HEIGHT: DESIGN_HEIGHT,
    pixelRatio: 1,
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
    particlePool: null,
    screenShake: null,
    spawnTimer: 0,
    elapsedFrames: 0,
    bgGrid: null,
    _bgPattern: null,
    effectBudget: 420,
    renderMargin: 180,

    // Camera system for following player
    camera: { x: 0, y: 0 },
    world: { 
        width: window.GameConstants?.WORLD_WIDTH || 25600, 
        height: window.GameConstants?.WORLD_HEIGHT || 14400 
    },

    // Fixed timestep configuration (60 FPS logic updates)
    _fixedDt: 1000 / 60,       // Target ~16.67ms per logic update
    _accumulator: 0,           // Accumulated time for fixed updates
    _maxAccumulator: 1000 / 15, // Cap at ~66.67ms to prevent spiral of death (max ~4 updates per frame)

    // Spatial index for enemies.
    _enemyGrid: new SpatialGrid(120),
    _perf: new PerformanceMonitor('dev-perf-overlay'),

    stats: {
        kills: 0,
        bossesKilled: 0,
        elitesKilled: 0,
        startFrame: 0,
        get best() { 
            const diff = Game?.selectedDifficulty || 'normal';
            return window.SaveSystem ? window.SaveSystem.getBest(diff) : {};
        },
        loadBest() {
            if (window.SaveSystem) window.SaveSystem.load();
        },
        saveBest(difficulty) {
            if (window.SaveSystem) window.SaveSystem.save(null, difficulty);
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
    selectedCharacter: null,
    selectedDifficulty: 'normal',
    selectedTrait: null,

    async init() {
        // Load all game data from JSON files first
        try {
            await DataLoader.loadAll();
        } catch (error) {
            console.error('Failed to initialize game:', error);
            alert('Failed to load game data. Check console for details.');
            return;
        }

        this._applyDisplayScale();
        this.createBgGrid();

        if (!this._resizeBound) {
            this._resizeBound = () => {
                this._applyDisplayScale();
                this.createBgGrid();
            };
            window.addEventListener('resize', this._resizeBound);
        }

        Input.init();

        try { window.AudioManager?.init?.(); } catch { /* audio optional */ }
        try { window.AudioManager?.startMusic?.('menu'); } catch { /* ignore */ }

        this.stats.loadBest();
        if (!this.ui) {
            this.ui = (typeof UIManager === 'function') ? new UIManager() : null;
        }
        this.ui?.init?.();
        
        this.setupCharacterSelection();
        this.setupDifficultySelection();

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
        ctx.setTransform(this.pixelRatio || 1, 0, 0, this.pixelRatio || 1, 0, 0);
        ctx.clearRect(0, 0, this.VIEW_WIDTH, this.VIEW_HEIGHT);
        const wash = ctx.createLinearGradient(0, 0, this.VIEW_WIDTH, this.VIEW_HEIGHT);
        wash.addColorStop(0, '#071018');
        wash.addColorStop(0.52, '#08111a');
        wash.addColorStop(1, '#05080e');
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, this.VIEW_WIDTH, this.VIEW_HEIGHT);
        if (!ptrn) return;
        ctx.globalAlpha = 0.76;
        ctx.fillStyle = ptrn;
        ctx.save();
        const camX = this.camera?.x || 0;
        const camY = this.camera?.y || 0;
        ctx.translate(-camX % 100, -camY % 100);
        ctx.fillRect(camX % 100, camY % 100, this.VIEW_WIDTH, this.VIEW_HEIGHT);
        ctx.restore();
        ctx.globalAlpha = 1;
    },

    resetRunState() {
        this.enemies = [];
        this.projectiles = [];
        this.pickups = [];
        this.floatingTexts = [];
        this.particles = [];
        this.effects = [];
        
        // Initialize pooled systems
        if (!this.particlePool) {
            const poolSize = window.EffectsConfig?.particles?.poolSize || 500;
            this.particlePool = new ParticlePool(poolSize);
        } else {
            this.particlePool.clear();
        }
        
        if (!this.screenShake) {
            this.screenShake = new ScreenShakeManager();
        } else {
            this.screenShake.reset();
        }
        this.spawnTimer = 0;
        this.elapsedFrames = 0;
        this._accumulator = 0;  // Reset fixed timestep accumulator
        this.bossActive = false;
        this.bossEnemy = null;
        this.bossQueuedLevel = null;
        this.bossQueueFrames = 0;
        this.lastBossId = null;
        this.stats.resetRun();
    },

    startGame() {
        this.startNewRun();
    },

    startNewRun(traitId = null) {
        this.resetRunState();
        
        // Use selected character or default to shadow_stalker
        const classId = this.selectedCharacter || 'shadow_stalker';
        this.player = new Player(classId, traitId || this.selectedTrait);

        // Starter weapon (template-driven when available)
        let starter = null;
        const tplId = window.SaveSystem?.getSelectedStarterWeaponTemplateId?.();
        const tplPool = Array.isArray(window.StarterWeaponTemplates) ? window.StarterWeaponTemplates : [];
        const tpl = tplId ? tplPool.find(t => String(t?.id) === String(tplId)) : null;
        if (tpl && LootSystem.applyStarterTemplate) {
            starter = LootSystem.applyStarterTemplate(tpl);
        }
        if (!starter) {
            starter = LootSystem.generateStarterWeapon
                ? LootSystem.generateStarterWeapon()
                : LootSystem.generateItem({ forceType: ItemType.WEAPON, forceRarity: Rarity.COMMON, forceBehavior: BehaviorType.PROJECTILE });
        }
        this.player.equip(starter);

        // Close any lingering modals from prior run.
        document.getElementById('inventory-modal')?.classList.remove('active');
        document.getElementById('levelup-modal')?.classList.remove('active');
        document.getElementById('accessory-replace-modal')?.classList.remove('active');
        this.ui.hideTooltip();

        this.hideMainMenu();
        this.hideEndScreen();

        this.state = 'playing';
        this.ui?.setScreenContext?.('playing', 'Run deployed. Survive the swarm.');
        this.lastTime = performance.now();
        // No requestAnimationFrame here: the main loop is always running.
        try { window.AudioManager?.unlock?.(); } catch { /* ignore */ }
        try { window.AudioManager?.gameStart?.(); } catch { /* ignore */ }
        try { window.AudioManager?.startMusic?.('playing'); } catch { /* ignore */ }
    },

    showMainMenu() {
        this.state = 'mainmenu';
        try { window.AudioManager?.startMusic?.('menu'); } catch { /* ignore */ }
        this.ui?.setScreenContext?.('menu', 'Main menu. Choose a survivor and enter the rift.');
        document.body?.classList?.add('state-mainmenu');
        this.ui?.showModal?.('main-menu-modal') || document.getElementById('main-menu-modal')?.classList.add('active');
        document.getElementById('essence-vault-modal')?.classList.remove('active');
        document.getElementById('starter-weapons-modal')?.classList.remove('active');
        document.getElementById('end-screen-modal')?.classList.remove('active');
        document.getElementById('character-select-modal')?.classList.remove('active');
        document.getElementById('trait-select-modal')?.classList.remove('active');
        document.getElementById('levelup-modal')?.classList.remove('active');
        document.getElementById('inventory-modal')?.classList.remove('active');
        
        // Update essence display
        const essenceValueEl = document.getElementById('main-menu-essence-value');
        if (essenceValueEl && window.SaveSystem) {
            essenceValueEl.textContent = window.SaveSystem.getEssence();
        }
        
        const startBtn = document.getElementById('main-menu-start-btn');
        if (startBtn) {
            startBtn.onclick = () => this.showCharacterSelect();
        }

        const vaultBtn = document.getElementById('main-menu-essence-vault-btn');
        if (vaultBtn) {
            vaultBtn.onclick = () => this.showEssenceVault();
        }

        const resetBtn = document.getElementById('main-menu-reset-btn');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm('Are you sure you want to delete all saved data? This cannot be undone.')) {
                    try {
                        if (window.SaveSystem) window.SaveSystem.clear();
                        else {
                            // Fallback: only clear this game's keys, never the whole storage.
                            Object.keys(localStorage)
                                .filter(k => k.startsWith('ss_') || k.startsWith('devMode') || k.startsWith('devCheat_'))
                                .forEach(k => localStorage.removeItem(k));
                        }
                        localStorage.removeItem('ss_low_quality');
                    } catch { /* ignore */ }
                    location.reload();
                }
            };
        }
    },

    showEssenceVault() {
        this.state = 'essencevault';
        this.ui?.setScreenContext?.('vault', 'Essence Vault. Spend your earned essence on permanent starters.');
        document.body?.classList?.add('state-mainmenu');
        document.getElementById('main-menu-modal')?.classList.remove('active');
        document.getElementById('starter-weapons-modal')?.classList.remove('active');
        this.ui?.showModal?.('essence-vault-modal') || document.getElementById('essence-vault-modal')?.classList.add('active');

        const essenceEl = document.getElementById('essence-vault-essence-value');
        if (essenceEl && window.SaveSystem) {
            essenceEl.textContent = window.SaveSystem.getEssence();
        }

        const openStartersBtn = document.getElementById('essence-vault-starter-weapons-btn');
        if (openStartersBtn) {
            openStartersBtn.onclick = () => this.showStarterWeapons();
        }

        const backBtn = document.getElementById('essence-vault-back-btn');
        if (backBtn) {
            backBtn.onclick = () => this.hideEssenceVault();
        }
    },

    hideEssenceVault() {
        document.getElementById('essence-vault-modal')?.classList.remove('active');
        this.showMainMenu();
    },

    _getStarterWeaponTemplatePool() {
        return Array.isArray(window.StarterWeaponTemplates) ? window.StarterWeaponTemplates : [];
    },

    showStarterWeapons() {
        // Main menu sub-screen
        this.state = 'starterweapons';
        this.ui?.setScreenContext?.('starter-weapons', 'Starter weapons. Choose the signal you want to carry into the next run.');
        document.body?.classList?.add('state-mainmenu');

        document.getElementById('main-menu-modal')?.classList.remove('active');
        document.getElementById('essence-vault-modal')?.classList.remove('active');
        this.ui?.setScreenContext?.('starter-weapons');

        const templates = this._getStarterWeaponTemplatePool();
        const essence = window.SaveSystem ? window.SaveSystem.getEssence() : 0;
        const owned = window.SaveSystem?.getOwnedStarterWeaponTemplateIds?.() || [];
        const selected = window.SaveSystem?.getSelectedStarterWeaponTemplateId?.() || '';

        this.ui?.showStarterWeaponsMenu?.(templates, essence, {
            ownedTemplateIds: owned,
            selectedTemplateId: selected,
            onPurchase: (templateId) => this.purchaseStarterWeapon(templateId),
            onSelect: (templateId) => this.selectStarterWeapon(templateId),
            onBack: () => this.hideStarterWeapons()
        });
    },

    hideStarterWeapons() {
        this.ui?.hideStarterWeaponsMenu?.();
        this.showEssenceVault();
    },

    purchaseStarterWeapon(templateId) {
        const id = String(templateId || '');
        if (!id) return;

        // If already owned, treat as selection.
        if (window.SaveSystem?.isStarterWeaponTemplateOwned?.(id)) {
            this.selectStarterWeapon(id);
            return;
        }

        const templates = this._getStarterWeaponTemplatePool();
        const tpl = templates.find(t => String(t?.id) === id);
        if (!tpl) return;

        const cost = Math.max(0, Number(tpl.essenceCost) || 0);
        if (cost > 0) {
            const ok = window.SaveSystem?.spendEssence?.(cost);
            if (!ok) {
                const msgEl = document.getElementById('starter-weapons-message');
                if (msgEl) msgEl.textContent = 'Not enough Essence.';
                return;
            }
        }

        window.SaveSystem?.unlockStarterWeaponTemplate?.(id);
        window.SaveSystem?.setSelectedStarterWeaponTemplateId?.(id);

        // Update main menu essence display immediately
        const essenceValueEl = document.getElementById('main-menu-essence-value');
        if (essenceValueEl && window.SaveSystem) {
            essenceValueEl.textContent = window.SaveSystem.getEssence();
        }

        const vaultEssenceEl = document.getElementById('essence-vault-essence-value');
        if (vaultEssenceEl && window.SaveSystem) {
            vaultEssenceEl.textContent = window.SaveSystem.getEssence();
        }

        // Close modal on successful purchase
        this.hideStarterWeapons();
    },

    selectStarterWeapon(templateId) {
        const id = String(templateId || '');
        if (!id) return;
        const ok = window.SaveSystem?.setSelectedStarterWeaponTemplateId?.(id);
        if (!ok) return;

        // Close modal after selecting to keep UX simple
        this.hideStarterWeapons();
    },
    
    setupCharacterSelection() {
        const backBtn = document.getElementById('character-select-back-btn');
        if (backBtn) {
            backBtn.onclick = () => {
                this.hideCharacterSelect();
                this.showMainMenu();
            };
        }
        
        const traitBackBtn = document.getElementById('trait-select-back-btn');
        if (traitBackBtn) {
            traitBackBtn.onclick = () => {
                this.hideTraitSelect();
                this.showCharacterSelect();
            };
        }
    },

    setupDifficultySelection() {
        const select = document.getElementById('difficulty-select');
        const desc = document.getElementById('difficulty-desc');
        if (select) {
            select.value = this.selectedDifficulty || 'normal';
            select.onchange = (e) => {
                this.setDifficulty(e.target.value);
                if (desc && window.GameConstants?.DIFFICULTY_SETTINGS) {
                    const setting = window.GameConstants.DIFFICULTY_SETTINGS[e.target.value];
                    if (setting) desc.textContent = setting.description;
                }
            };
        }
    },

    setDifficulty(diffId) {
        if (window.GameConstants?.DIFFICULTY_SETTINGS?.[diffId]) {
            this.selectedDifficulty = diffId;
        }
    },
    
    showCharacterSelect() {
        this.state = 'characterselect';
        this.ui?.setScreenContext?.('character-select', 'Character selection. Choose your combat identity.');
        document.getElementById('main-menu-modal')?.classList.remove('active');
        this.ui?.showModal?.('character-select-modal') || document.getElementById('character-select-modal')?.classList.add('active');
        this.renderCharacterSelection();
    },
    
    hideCharacterSelect() {
        document.getElementById('character-select-modal')?.classList.remove('active');
    },
    
    renderCharacterSelection() {
        const container = document.getElementById('character-select-container');
        if (!container || !window.CharacterArchetypes) return;
        
        container.innerHTML = '';
        const characters = Object.values(window.CharacterArchetypes);
        
        characters.forEach(char => {
            const card = document.createElement('div');
            card.className = 'character-card';
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `Select ${char.name}`);
            card.style.setProperty('--choice-color', char.color || '#8ff6eb');
            if (this.selectedCharacter === char.id) {
                card.classList.add('character-card-selected');
                card.setAttribute('aria-pressed', 'true');
            }
            
            const icon = document.createElement('div');
            icon.className = 'character-icon';
            icon.style.setProperty('--choice-color', char.color || '#8ff6eb');
            const iconGlyph = document.createElement('span');
            iconGlyph.textContent = char.name.charAt(0);
            icon.appendChild(iconGlyph);
            
            const name = document.createElement('div');
            name.className = 'character-name';
            name.textContent = char.name;
            
            const desc = document.createElement('div');
            desc.className = 'character-description';
            desc.textContent = char.description;
            
            const stats = document.createElement('div');
            stats.className = 'character-stats';
            
            const hp = char.baseStats?.maxHp || 80;
            const speed = char.baseStats?.moveSpeed || 3;
            const damage = char.baseStats?.damage || 1;
            const luck = char.baseStats?.rarityFind || 0;
            
            stats.innerHTML = `
                <div class="character-stat">
                    <div class="character-stat-label">Health</div>
                    <div class="character-stat-value">${hp}</div>
                </div>
                <div class="character-stat">
                    <div class="character-stat-label">Damage</div>
                    <div class="character-stat-value">${(damage * 100).toFixed(0)}%</div>
                </div>
                <div class="character-stat">
                    <div class="character-stat-label">Speed</div>
                    <div class="character-stat-value">${speed.toFixed(1)}</div>
                </div>
                <div class="character-stat">
                    <div class="character-stat-label">Luck</div>
                    <div class="character-stat-value">${(luck * 100).toFixed(2)}%</div>
                </div>
            `;
            
            card.appendChild(icon);
            card.appendChild(name);
            card.appendChild(desc);
            card.appendChild(stats);
            
            card.onclick = () => {
                this.selectedCharacter = char.id;
                this.hideCharacterSelect();
                this.showTraitSelect();
            };
            card.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    card.click();
                }
            };
            
            container.appendChild(card);
        });
    },
    
    hideMainMenu() {
        document.body?.classList?.remove('state-mainmenu');
        document.getElementById('main-menu-modal')?.classList.remove('active');
    },
    
    showTraitSelect() {
        this.state = 'traitselect';
        this.ui?.setScreenContext?.('trait-select', 'Trait selection. Choose a build-defining starting signal.');
        document.getElementById('character-select-modal')?.classList.remove('active');
        this.ui?.showModal?.('trait-select-modal') || document.getElementById('trait-select-modal')?.classList.add('active');
        this.renderTraitSelection();
    },
    
    hideTraitSelect() {
        document.getElementById('trait-select-modal')?.classList.remove('active');
    },
    
    renderTraitSelection() {
        const container = document.getElementById('trait-select-container');
        if (!container || !window.TraitDefinitions) return;
        
        container.innerHTML = '';
        const traits = Object.values(window.TraitDefinitions);
        
        traits.forEach(trait => {
            const card = document.createElement('div');
            card.className = 'character-card';
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `Select ${trait.name}`);
            card.style.setProperty('--choice-color', '#a88bff');
            if (this.selectedTrait === trait.id) {
                card.classList.add('character-card-selected');
                card.setAttribute('aria-pressed', 'true');
            }
            
            const icon = document.createElement('div');
            icon.className = 'character-icon';
            icon.style.setProperty('--choice-color', '#a88bff');
            const iconGlyph = document.createElement('span');
            iconGlyph.textContent = String(trait.name || 'Signal').charAt(0).toUpperCase();
            icon.appendChild(iconGlyph);
            
            const name = document.createElement('div');
            name.className = 'character-name';
            name.textContent = trait.name;
            
            const desc = document.createElement('div');
            desc.className = 'character-description';
            desc.textContent = trait.description;
            
            card.appendChild(icon);
            card.appendChild(name);
            card.appendChild(desc);
            
            card.onclick = () => {
                this.selectedTrait = trait.id;
                this.hideTraitSelect();
                this.startNewRun(trait.id);
            };
            card.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    card.click();
                }
            };
            
            container.appendChild(card);
        });
    },
    showEndScreen(summary) {
        this.ui?.setScreenContext?.('gameover', 'Run concluded. Review your signal and deploy again when ready.');
        const modal = document.getElementById('end-screen-modal');
        const statsEl = document.getElementById('end-screen-stats');
        if (statsEl) statsEl.innerHTML = summary || '';
        this.ui?.showModal?.('end-screen-modal', 'gameover') || modal?.classList.add('active');
    },
    hideEndScreen() {
        document.getElementById('end-screen-modal')?.classList.remove('active');
    },

    createBgGrid() {
        this.bgGrid = document.createElement('canvas');
        this.bgGrid.width = 100; this.bgGrid.height = 100;
        const bctx = this.bgGrid.getContext('2d');
        bctx.strokeStyle = 'rgba(143, 246, 235, 0.055)'; bctx.lineWidth = 1;
        bctx.beginPath(); bctx.moveTo(0,0); bctx.lineTo(100,0); bctx.moveTo(0,0); bctx.lineTo(0,100); bctx.stroke();
        bctx.strokeStyle = 'rgba(143, 246, 235, 0.09)';
        bctx.beginPath();
        bctx.moveTo(0, 0); bctx.lineTo(100, 100);
        bctx.stroke();
        bctx.fillStyle = 'rgba(143, 246, 235, 0.16)';
        bctx.fillRect(0, 0, 2, 2);

        // Cache the repeating pattern once (recreated on resize / grid rebuild).
        this._bgPattern = ctx.createPattern(this.bgGrid, 'repeat');
    },

    _applyDisplayScale() {
        const vw = window.innerWidth || DESIGN_WIDTH;
        const vh = window.innerHeight || DESIGN_HEIGHT;
        const scale = Math.min(vw / DESIGN_WIDTH, vh / DESIGN_HEIGHT);
        const touchDevice = !!window.matchMedia?.('(pointer: coarse)')?.matches ||
            ('ontouchstart' in window) ||
            Number(navigator.maxTouchPoints || 0) > 0;
        document.body?.classList.toggle('touch-device', touchDevice);
        const displayW = Math.max(320, Math.round(DESIGN_WIDTH * scale));
        const displayH = Math.max(180, Math.round(DESIGN_HEIGHT * scale));
        const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
        this.pixelRatio = dpr;
        if (canvas.width !== Math.round(DESIGN_WIDTH * dpr) || canvas.height !== Math.round(DESIGN_HEIGHT * dpr)) {
            canvas.width = Math.round(DESIGN_WIDTH * dpr);
            canvas.height = Math.round(DESIGN_HEIGHT * dpr);
        }
        canvas.style.aspectRatio = `${DESIGN_WIDTH} / ${DESIGN_HEIGHT}`;
        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    forEachEnemyNear(x, y, r, fn) {
        return this._enemyGrid.forEachNear(x, y, r, fn);
    },

    isVisible(entity, margin = this.renderMargin) {
        if (!entity) return false;
        const x = Number(entity.x);
        const y = Number(entity.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        return x >= this.camera.x - margin &&
            x <= this.camera.x + this.VIEW_WIDTH + margin &&
            y >= this.camera.y - margin &&
            y <= this.camera.y + this.VIEW_HEIGHT + margin;
    },

    findNearestEnemy(x, y, range = Infinity, opts = {}) {
        const enemies = this.enemies || [];
        const excludeSet = opts.excludeSet;
        const predicate = opts.predicate;

        let nearest = null;
        let bestD2 = Number.isFinite(range) ? (range * range) : Infinity;

        const visit = (enemy) => {
            if (!enemy || enemy.dead) return true;
            if (excludeSet && excludeSet.has(enemy)) return true;
            if (predicate && !predicate(enemy)) return true;

            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
                bestD2 = d2;
                nearest = enemy;
            }
            return true;
        };

        // Prefer spatial grid when range is finite.
        if (Number.isFinite(range) && this._enemyGrid?.forEachNear) {
            this._enemyGrid.forEachNear(x, y, range, visit);
            return nearest;
        }

        // Fallback: use public helper if present.
        if (Number.isFinite(range) && typeof this.forEachEnemyNear === 'function') {
            this.forEachEnemyNear(x, y, range, visit);
            return nearest;
        }

        // Final fallback: full scan.
        for (let i = 0, n = enemies.length; i < n; i++) visit(enemies[i]);
        return nearest;
    },

    toggleInventory() {
        const modal = document.getElementById('inventory-modal');
        if (this.state === 'playing') {
            this.state = 'paused';
            try { window.AudioManager?.select?.(); } catch { /* ignore */ }
            this.ui?.setScreenContext?.('loadout', 'Loadout paused. Review your current signal.');
            this.ui.updateInventory();
            this.ui?.showModal?.(modal, 'loadout');
        } else if (this.state === 'paused') {
            this.state = 'playing';
            this.ui?.setScreenContext?.('playing');
            modal.classList.remove('active');
            this.lastTime = performance.now();
            this._accumulator = 0;  // Reset accumulator to prevent burst of updates
            // No requestAnimationFrame here: the main loop is always running.
        }
    },

    triggerLevelUp() {
        const numChoices = this.player.classId === 'the_hoarder' ? 4 : 3;
        const items = (LootSystem.generateRewardChoices ? LootSystem.generateRewardChoices(this.player, numChoices) : Array.from({ length: numChoices }, () => LootSystem.generateItem()));
        this.openRewardModal({
            title: 'Choose Your Reward',
            items
        });
    },

    openRewardModal({ title, items }) {
        this.state = 'levelup';
        this.ui?.setScreenContext?.('reward', 'New reward signal detected. Choose what shapes the next wave.');
        const resume = () => {
            this.ui?.unpinTooltip?.();
            this.ui?.hideTooltip?.(true);
            document.getElementById('levelup-modal')?.classList.remove('active');
            this.state = 'playing';
            this.ui?.setScreenContext?.('playing');
            this.lastTime = performance.now();
            this._accumulator = 0;  // Reset accumulator to prevent burst of updates

            // Spawn queued boss immediately after resuming (e.g., after picking reward).
            this.trySpawnBossIfQueued();
        };

        const refresh = () => {
            if (this.player.shopRefreshStacks > 0) {
                this.player.shopRefreshStacks--;
                const numChoices = this.player.classId === 'the_hoarder' ? 4 : 3;
                const newItems = (LootSystem.generateRewardChoices ? LootSystem.generateRewardChoices(this.player, numChoices) : Array.from({ length: numChoices }, () => LootSystem.generateItem()));
                this.openRewardModal({
                    title,
                    items: newItems
                });
            }
        };

        this.ui?.showRewardModal?.({
            title,
            items,
            onTake: (item) => this.player.equip(item, { onAfterEquip: resume }),
            onExit: resume,
            onSacrifice: () => {
                const ok = this.player.consumeEssence();
                if (ok) resume();
            },
            onRefresh: refresh,
            refreshStacks: this.player.shopRefreshStacks || 0
        });
    },

    onPlayerLevelUp(newLevel) {
        if (!newLevel || newLevel < 1) return;
        if (newLevel % 5 !== 0) return;
        // Queue boss; spawn after the reward modal closes.
        this.bossQueuedLevel = newLevel;
        this.bossQueueFrames = 0;
    },

    trySpawnBossIfQueued() {
        if (this.bossActive) return;
        if (!this.bossQueuedLevel) return;

        // Wait until all enemies are cleared before spawning the boss.
        // Only count alive enemies. Force-spawn after ~15s so kiting the
        // last enemy can't stall the run forever (spawns are paused meanwhile).
        if (this.enemies.some(e => !e.dead)) {
            this.bossQueueFrames = (this.bossQueueFrames || 0) + 1;
            if (this.bossQueueFrames < 900) return;
        }

        this.spawnBossRandom(this.bossQueuedLevel);
        this.bossQueuedLevel = null;
        this.bossQueueFrames = 0;
    },

    spawnBossRandom(level) {
        // Level 10+ allows the Void Reaper boss; level 20+ adds the Gravity Tyrant.
        let bosses = level >= 10 
            ? ['boss_hex_hydra', 'boss_broodmother', 'boss_stone_colossus', 'boss_void_reaper']
            : ['boss_hex_hydra', 'boss_broodmother', 'boss_stone_colossus'];

        if (level >= 20) {
            bosses = [...bosses, 'boss_gravity_tyrant'];
        }
        
        let pick = bosses[Math.floor(Math.random() * bosses.length)];
        if (bosses.length > 1 && pick === this.lastBossId) {
            pick = bosses[(bosses.indexOf(pick) + 1) % bosses.length];
        }
        this.lastBossId = pick;

        // Spawn near the top edge of viewport, roughly centered
        // Ensure boss spawns within world bounds and potentially ON SCREEN to be safe
        let x = this.player.x + (Math.random() * 0.3 - 0.15) * this.VIEW_WIDTH;
        let y = Math.max(20, this.camera.y + 100); // 100px from top of SCREEN, not just world 

        // Clamp to world bounds
        x = Math.max(100, Math.min(this.world.width - 100, x));
        y = Math.max(100, Math.min(this.world.height - 100, y));

        console.log(`Spawning Boss: ${pick} at ${x}, ${y}`);

        const boss = new Enemy(pick, { x, y, boss: true });
        this.enemies.push(boss);
        this.bossActive = true;
        this.bossEnemy = boss;
        try { window.AudioManager?.bossWarn?.(); } catch { /* ignore */ }
        try { window.AudioManager?.startMusic?.('boss'); } catch { /* ignore */ }
        if (!window.GameConstants?.SETTINGS?.LOW_QUALITY) {
            this.effects.push(new TelegraphRingEffect(x, y, 120, 54, '#ff6470', true));
            this.effects.push(new TelegraphRingEffect(x, y, 42, 36, '#f4b866', false));
        }
        this.floatingTexts.push(new FloatingText('APEX SIGNAL', x, y - 44, '#ffb9a6', true));
        window.VisualFX?.shake?.('explosion');
    },

    onBossDefeated(bossEnemy) {
        if (this.bossEnemy === bossEnemy) {
            this.bossEnemy = null;
        }
        this.bossActive = false;
        window.VisualFX?.shake?.('bossDeath');
        try { window.AudioManager?.bossDie?.(); } catch { /* ignore */ }
        try { window.AudioManager?.startMusic?.('playing'); } catch { /* ignore */ }

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
        try { window.AudioManager?.gameOver?.(); } catch { /* ignore */ }
        try { window.AudioManager?.startMusic?.('gameover'); } catch { /* ignore */ }

        // Ensure in-run modals are closed.
        document.getElementById('inventory-modal')?.classList.remove('active');
        document.getElementById('levelup-modal')?.classList.remove('active');
        document.getElementById('accessory-replace-modal')?.classList.remove('active');

        const timeSec = Math.max(0, Math.floor((this.elapsedFrames || 0) / 60));
        const mins = Math.floor(timeSec / 60);
        const secs = timeSec % 60;
        const lvl = this.player?.level || 1;
        const difficulty = this.selectedDifficulty || 'normal';

        // Save stats for the current difficulty
        const currentRunStats = {
            timeSec,
            kills: this.stats.kills || 0,
            level: lvl
        };
        if (window.SaveSystem) {
            window.SaveSystem.save(currentRunStats, difficulty);
        }

        // Calculate Essence earned
        const levelEssence = lvl;
        const killEssence = Math.floor((this.stats.kills || 0) / 100);
        const eliteEssence = Math.floor((this.stats.elitesKilled || 0) / 5);
        const timeEssence = Math.floor(mins / 3);
        const baseEssence = levelEssence + killEssence + eliteEssence + timeEssence;
        
        // Difficulty multipliers
        const difficultyMultipliers = {
            easy: 0.75,
            normal: 1.0,
            hard: 1.5,
            nightmare: 2.0
        };
        const essenceMultiplier = difficultyMultipliers[difficulty] || 1.0;
        const earnedEssence = Math.floor(baseEssence * essenceMultiplier);
        
        // Add essence to save system
        if (window.SaveSystem && earnedEssence > 0) {
            window.SaveSystem.addEssence(earnedEssence);
        }
        
        const totalEssence = window.SaveSystem ? window.SaveSystem.getEssence() : 0;

        // Get best stats for current difficulty
        const best = window.SaveSystem ? window.SaveSystem.getBest(difficulty) : {};
        const bestMin = Math.floor((best.bestTimeSec || 0) / 60);
        const bestSec = (best.bestTimeSec || 0) % 60;

        // Get difficulty display name
        const diffSettings = window.GameConstants?.DIFFICULTY_SETTINGS?.[difficulty] || {};
        const esc = (typeof window.escapeHtml === 'function') ? window.escapeHtml : ((v) => String(v ?? ''));
        const diffName = diffSettings.name || difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

        const summary = `
            <div id="end-screen-stats-panel">
                <div class="stat-row run-summary-primary"><span>Difficulty</span><span class="stat-val">${esc(diffName)}</span></div>
                <div class="stat-row"><span>Time</span><span class="stat-val">${mins}:${String(secs).padStart(2, '0')}</span></div>
                <div class="stat-row"><span>Kills</span><span class="stat-val">${this.stats.kills || 0}</span></div>
                <div class="stat-row"><span>Bosses</span><span class="stat-val">${this.stats.bossesKilled || 0}</span></div>
                <div class="stat-row"><span>Elites</span><span class="stat-val">${this.stats.elitesKilled || 0}</span></div>
                <div class="stat-row"><span>Level</span><span class="stat-val">${lvl}</span></div>
                <div class="stat-row"><span>Artifacts</span><span class="stat-val">${this.player?.artifacts?.length || 0}</span></div>
                <div class="stat-row run-summary-reward"><span>Essence earned</span><span class="stat-val">+${earnedEssence}</span></div>
                <div class="stat-row run-summary-reward"><span>Total essence</span><span class="stat-val">${totalEssence}</span></div>
                <div class="stat-row run-summary-best"><span>Best time (${esc(diffName)})</span><span class="stat-val">${bestMin}:${String(bestSec).padStart(2, '0')}</span></div>
                <div class="stat-row run-summary-best"><span>Best kills (${esc(diffName)})</span><span class="stat-val">${best.bestKills || 0}</span></div>
                <div class="stat-row run-summary-best"><span>Best level (${esc(diffName)})</span><span class="stat-val">${best.bestLevel || 0}</span></div>
            </div>
        `;

        this.showEndScreen(summary);
    },

    // Apply armor aura effects to nearby enemies (e.g., Singularity Mantle damage vulnerability)
    applyArmorAuraEffects() {
        if (!this.player || !this.player.equipment?.armor) return;

        const armor = this.player.equipment.armor;
        const aura = armor.specialEffect?.aura;
        if (!aura || !aura.radius || !aura.enemyDamageTakenMult) return;
        
        // Reset all enemy aura multipliers first
        for (const enemy of this.enemies) {
            if (enemy && !enemy.dead) {
                enemy.auraDamageTakenMult = 1;
            }
        }

        // Apply aura effects if armor has them
        {
            const radius = aura.radius;
            const damageMult = aura.enemyDamageTakenMult; // Use value directly (e.g., 1.35 = 35% more damage)

            for (const enemy of this.enemies) {
                if (!enemy || enemy.dead) continue;

                const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
                if (dist <= radius) {
                    enemy.auraDamageTakenMult = damageMult;
                }
            }
        }
    },

    // Fixed timestep update - runs at consistent 60 FPS regardless of display refresh rate
    fixedUpdate() {
        this.elapsedFrames++;

        this.player.update();

        // Apply armor aura effects to nearby enemies
        this.applyArmorAuraEffects();

        // Safety: If bossActive is true but no boss exists, reset it.
        // Or if the boss exists but is lost/stuck, rescue it.
        if (this.bossActive) {
            const b = this.bossEnemy;
            if (!b || b.dead) {
                // Boss died or is null, but bossActive is true.
                // Reset state to remove the ghost HP bar.
                if (this.enemies.every(e => !e.isBoss || e.dead)) {
                    console.warn("Main Loop: bossActive true, boss missing/dead. Resetting.");
                    this.bossActive = false;
                    this.bossEnemy = null;
                }
            } else {
                // Boss is alive. Ensure it's in the enemy list.
                if (!this.enemies.includes(b)) {
                     console.warn("Main Loop: Boss alive but missing from list. Re-adding.");
                     this.enemies.push(b);
                }

                // Ensure boss is within bounds (Rescue from the void or NaN)
                const outOfBounds = b.x < -1000 || b.x > this.world.width + 1000 || b.y < -1000 || b.y > this.world.height + 1000;
                if (outOfBounds || isNaN(b.x) || isNaN(b.y)) {
                     console.warn("Main Loop: Boss lost or NaN. Teleporting to player.");
                     b.x = this.player.x || 100;
                     b.y = (this.player.y || 100) - 300;
                     
                     // Reset velocity and speed if they became NaN
                     if (isNaN(b.vx)) b.vx = 0;
                     if (isNaN(b.vy)) b.vy = 0;
                     if (isNaN(b.baseSpeed)) b.baseSpeed = b.archetype?.speed ? (Array.isArray(b.archetype.speed) ? b.archetype.speed[0] : b.archetype.speed) : 1.2;
                     if (isNaN(b.speed)) b.speed = b.baseSpeed;
                }
            }
        }

        // Spawn queued boss as soon as we're in active play.
        this.trySpawnBossIfQueued();

        this.spawnTimer++;
        const levelRate = 50 - Math.min(40, this.player.level);
        const timeRate = Math.floor(Math.min(18, this.elapsedFrames / 1800)); // ramps over ~30s chunks
        // Higher late-game pressure: allow denser spawns.
        const minSpawnRate = (this.player.level >= 15 || this.elapsedFrames >= 60 * 60 * 6) ? 5 : 7;
        
        const baseSpawnRate = Math.max(minSpawnRate, levelRate - timeRate);
        const diffSettings = window.GameConstants?.DIFFICULTY_SETTINGS?.[this.selectedDifficulty || 'normal'] || {};
        const spawnIntervalMult = diffSettings.spawnIntervalMult || 1.0;
        const spawnRate = baseSpawnRate * spawnIntervalMult;

        const pauseSpawns = window.DevMode?.enabled && window.DevMode?.cheats?.pauseSpawns;
        // Pause spawning if boss is active OR if a boss is queued (waiting for enemy clear)
        if (!pauseSpawns && !this.bossActive && !this.bossQueuedLevel && this.spawnTimer > spawnRate) {
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
        
        // Update player's active beams
        if (this.player?.activeBeams) {
            for (let i = 0; i < this.player.activeBeams.length; i++) {
                this.player.activeBeams[i]?.update?.();
            }
            // Clean up dead beams
            this.player.activeBeams = this.player.activeBeams.filter(b => !b.dead);
        }
        
        n = this.pickups.length;
        for (let i = 0; i < n; i++) this.pickups[i]?.update?.();
        n = this.effects.length;
        for (let i = 0; i < n; i++) this.effects[i]?.update?.();
        n = this.floatingTexts.length;
        for (let i = 0; i < n; i++) this.floatingTexts[i]?.update?.();
        n = this.particles.length;
        for (let i = 0; i < n; i++) this.particles[i]?.update?.();
        
        // Update pooled systems
        if (this.particlePool) this.particlePool.update();
        if (this.screenShake) this.screenShake.update();

        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const effectLimit = (window.GameConstants?.SETTINGS?.LOW_QUALITY || reducedMotion) ? 160 : this.effectBudget;
        if (this.effects.length > effectLimit) this.effects.splice(0, this.effects.length - effectLimit);
        const particleLimit = window.GameConstants?.SETTINGS?.LOW_QUALITY ? 100 : 900;
        if (this.particles.length > particleLimit) this.particles.splice(0, this.particles.length - particleLimit);

        // In-place compaction to avoid per-frame allocations.
        compactInPlace(this.enemies, (e) => !!e && !e.dead);
        compactInPlace(this.projectiles, (p) => !!p && !p.dead);
        compactInPlace(this.pickups, (p) => !!p && !p.dead);
        compactInPlace(this.effects, (e) => !!e && (e.life === undefined || e.life > 0));
        compactInPlace(this.floatingTexts, (t) => !!t && (t.life === undefined || t.life > 0));
        compactInPlace(this.particles, (p) => !!p && (p.life === undefined || p.life > 0));
    },

    updateCamera() {
        if (!this.player) return;
        
        // Center camera on player
        const targetX = this.player.x - this.VIEW_WIDTH / 2;
        const targetY = this.player.y - this.VIEW_HEIGHT / 2;
        
        // Clamp camera to world bounds
        this.camera.x = Math.max(0, Math.min(this.world.width - this.VIEW_WIDTH, targetX));
        this.camera.y = Math.max(0, Math.min(this.world.height - this.VIEW_HEIGHT, targetY));
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
        while (this._accumulator >= this._fixedDt) {
            this.fixedUpdate();
            this._accumulator -= this._fixedDt;
        }

        // Update camera to follow player
        this.updateCamera();

        if (perfOn) t0 = perf.record('updateMs', t0);

        // Draw (always runs at display refresh rate for smooth visuals)
        // Apply camera transformation for world entities
        ctx.save();
        
        // Apply screen shake offset
        if (this.screenShake) this.screenShake.apply(ctx);
        
        ctx.translate(-this.camera.x, -this.camera.y);

        let n = 0;
        this.player?.draw?.();
        n = this.pickups.length;
        for (let i = 0; i < n; i++) {
            if (this.isVisible(this.pickups[i], 80)) this.pickups[i]?.draw?.();
        }
        n = this.enemies.length;
        for (let i = 0; i < n; i++) {
            if (this.isVisible(this.enemies[i])) this.enemies[i]?.draw?.();
        }
        n = this.projectiles.length;
        for (let i = 0; i < n; i++) {
            if (this.isVisible(this.projectiles[i], 260)) this.projectiles[i]?.draw?.();
        }
        
        // Render player's active beams
        if (this.player?.activeBeams) {
            for (let i = 0; i < this.player.activeBeams.length; i++) {
                this.player.activeBeams[i]?.render?.(ctx, this.camera);
            }
        }
        
        n = this.effects.length;
        for (let i = 0; i < n; i++) {
            if (this.isVisible(this.effects[i], 240)) this.effects[i]?.draw?.();
        }
        n = this.particles.length;
        for (let i = 0; i < n; i++) {
            if (this.isVisible(this.particles[i], 220)) this.particles[i]?.draw?.();
        }
        
        // Draw pooled particles
        if (this.particlePool) this.particlePool.draw();
        
        n = this.floatingTexts.length;
        for (let i = 0; i < n; i++) {
            if (this.isVisible(this.floatingTexts[i], 180)) this.floatingTexts[i]?.draw?.();
        }

        ctx.restore();

        if (perfOn) t0 = perf.record('drawMs', t0);

        // One-Shot Protection screen border flash (in screen space)
        if (this.player && this.player.buffManager && this.player.buffManager.getBuff('oneShotProtection')) {
            ctx.save();
            const pulse = 0.5 + Math.sin(timestamp / 80) * 0.3; // Faster pulse
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 8;
            ctx.globalAlpha = pulse;
            ctx.strokeRect(0, 0, this.VIEW_WIDTH, this.VIEW_HEIGHT);
            
            // Inner white glow
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.globalAlpha = pulse * 0.7;
            ctx.strokeRect(4, 4, this.VIEW_WIDTH - 8, this.VIEW_HEIGHT - 8);
            ctx.restore();
        }

        // UI rendering in screen space (not affected by camera)
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

        const w = Math.min(this.VIEW_WIDTH - 40, 560);
        const x = (this.VIEW_WIDTH - w) / 2;
        const y = 14;
        const hpPct = Math.max(0, Math.min(1, (b.hp || 0) / Math.max(1, b.maxHp || 1)));
        const phase = b.strengthPhase || b.bossState?.phase || 1;

        ctx.save();
        ctx.globalAlpha = 0.96;
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(255, 100, 112, 0.28)';
        ctx.fillStyle = 'rgba(4, 10, 16, 0.9)';
        ctx.fillRect(x - 12, y - 18, w + 24, 50);
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(255, 100, 112, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 12, y - 18, w + 24, 50);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(x, y, w, 16);
        const hpGradient = ctx.createLinearGradient(x, 0, x + w, 0);
        hpGradient.addColorStop(0, '#8e2948');
        hpGradient.addColorStop(0.7, '#ff6470');
        hpGradient.addColorStop(1, '#ffd0a1');
        ctx.fillStyle = hpGradient;
        ctx.fillRect(x, y, w * hpPct, 16);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.strokeRect(x, y, w, 16);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        for (let i = 1; i < 5; i++) {
            const tickX = x + (w * i) / 5;
            ctx.fillRect(tickX, y, 1, 16);
        }

        ctx.font = '700 12px "Segoe UI", sans-serif';
        ctx.fillStyle = '#ffe8e7';
        ctx.textAlign = 'center';
        const name = b.archetype?.name || 'Boss';
        ctx.letterSpacing = '2px';
        ctx.fillText(`${name.toUpperCase()}  //  PHASE ${phase}`, this.VIEW_WIDTH / 2, y - 25);

        ctx.restore();
    },

    ui: null
};
