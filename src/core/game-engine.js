const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const Game = {
    state: 'playing',
    lastTime: 0,
    player: null,
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    particles: [],
    effects: [],
    spawnTimer: 0,
    elapsedFrames: 0,
    bgGrid: null,

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
        
        this.player = new Player();
        const starter = LootSystem.generateStarterWeapon ? LootSystem.generateStarterWeapon() : LootSystem.generateItem({ forceType: ItemType.WEAPON, forceRarity: Rarity.COMMON, forceBehavior: BehaviorType.PROJECTILE });
        this.player.equip(starter);
        
        this.ui.updateBars();
        requestAnimationFrame(this.loop.bind(this));
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
            requestAnimationFrame(this.loop.bind(this));
        }
    },

    triggerLevelUp() {
        this.state = 'levelup';
        const container = document.getElementById('card-container');
        container.innerHTML = '';

        // Populate current-gear sidebar for better upgrade decisions.
        this.ui.updateUpgradeSidebar();

        const resume = () => {
            document.getElementById('levelup-modal').classList.remove('active');
            this.state = 'playing';
            this.lastTime = performance.now();
            requestAnimationFrame(this.loop.bind(this));
        };

        for(let i=0; i<3; i++) {
            const item = LootSystem.generateItem();
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
        }
        document.getElementById('levelup-modal').classList.add('active');
    },

    over() {
        this.state = 'gameover';
        alert("Run Ended! Refresh to try again.");
    },

    loop(timestamp) {
        if (this.state !== 'playing') return;
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.elapsedFrames++;

        const ptrn = ctx.createPattern(this.bgGrid, 'repeat');
        ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = ptrn; 
        ctx.save();
        ctx.translate(-this.player.x % 100, -this.player.y % 100);
        ctx.fillRect(this.player.x%100, this.player.y%100, canvas.width, canvas.height);
        ctx.restore();

        this.player.update();
        this.spawnTimer++;
        const levelRate = 50 - Math.min(40, this.player.level);
        const timeRate = Math.floor(Math.min(18, this.elapsedFrames / 1800)); // ramps over ~30s chunks
        // Higher late-game pressure: allow denser spawns.
        const minSpawnRate = (this.player.level >= 15 || this.elapsedFrames >= 60 * 60 * 6) ? 5 : 7;
        const spawnRate = Math.max(minSpawnRate, levelRate - timeRate);
        const pauseSpawns = window.DevMode?.enabled && window.DevMode?.cheats?.pauseSpawns;
        if (!pauseSpawns && this.spawnTimer > spawnRate) {
            this.enemies.push(EnemyFactory.spawn(this.player.level));
            this.spawnTimer = 0;
        }

        [this.enemies, this.projectiles, this.effects, this.floatingTexts, this.particles].forEach(arr => arr.forEach(e => e.update()));

        this.enemies = this.enemies.filter(e => !e.dead);
        this.projectiles = this.projectiles.filter(p => !p.dead);
        this.effects = this.effects.filter(e => e.life > 0);
        this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);
        this.particles = this.particles.filter(p => p.life > 0);

        this.player.draw();
        [this.enemies, this.projectiles, this.effects, this.particles, this.floatingTexts].forEach(arr => arr.forEach(e => e.draw()));
        this.ui.updateBars();

        requestAnimationFrame(this.loop.bind(this));
    },

    ui: {
        updateBars() {
            const p = Game.player;
            document.getElementById('hp-fill').style.width = `${(p.hp/p.stats.maxHp)*100}%`;
            document.getElementById('xp-fill').style.width = `${(p.xp/p.nextLevelXp)*100}%`;
            document.getElementById('lvl-display').innerText = p.level;
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
            
            // Header
            const headerColor = item.isCursed ? '#9c27b0' : item.rarity.color;
            const headerClass = item.isCursed ? 'tt-cursed-header' : '';
            const icon = item.isCursed ? '💀' : '⚔️';
            const badge = item.isCursed ? '<span class="cursed-badge">Cursed</span>' : '';

            let content = `<h4 style="color:${headerColor}" class="${headerClass}">${icon} ${item.name}${badge}</h4>`;
            content += `<div class="tt-header-meta">${item.rarity.name} ${item.type}</div>`;
            content += `<div style="color:#aaa; font-size:11px; margin-bottom:12px; line-height:1.3;">${item.description}</div>`;

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
