// UIManager: all DOM UI rendering / interaction glue.
// Loaded before src/core/game-engine.js (non-module script).

class UIManager {
    constructor() {
        this.hud = new HUDManager();
        this.inventory = new InventoryUI(this);

        this._tooltipHideTimer = null;
        this._tooltipPinned = false;
        this._tooltipPinnedItem = null;
        this._tooltipPinnedIsWeapon = false;
        this._isCoarsePointer = false;
        this._lastTooltipEvent = null;
    }

    static clamp01(v) {
        return Math.max(0, Math.min(1, v));
    }

    init() {
        this.initScreens();
        this.hud.init();
        this._initMainMenuMeta();
        this._initSettings();
        this._initTooltipInteractivity();
        const coarseQuery = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
        this._isCoarsePointer = !!coarseQuery?.matches || ('ontouchstart' in window);
        coarseQuery?.addEventListener?.('change', (e) => {
            this._isCoarsePointer = !!e.matches;
        });
    }

    _initMainMenuMeta() {
        const version = window.GameConstants?.VERSION;
        if (version) {
            document.title = `Shapes Survivor v${version}`;
        }

        const vEl = document.getElementById('main-menu-version');
        if (vEl) {
            vEl.textContent = version ? `Version ${version}` : '';
        }

        const link = document.getElementById('main-menu-patch-notes');
        if (link) {
            const url = window.GameConstants?.PATCH_NOTES_URL;
            if (url && typeof url === 'string' && url.trim()) {
                link.href = url;
                link.style.pointerEvents = 'auto';
                link.style.opacity = '1';
            } else {
                // Keep visible, but make it inert until a URL is configured.
                link.href = '#';
                link.style.pointerEvents = 'none';
                link.style.opacity = '0.6';
            }
        }
    }

    _initSettings() {
        const toggle = document.getElementById('low-quality-toggle');
        if (toggle) {
            try {
                const saved = localStorage.getItem('ss_low_quality');
                if (saved === 'true') {
                    window.GameConstants.SETTINGS.LOW_QUALITY = true;
                    toggle.checked = true;
                }
            } catch (e) {
                console.warn('Failed to load settings', e);
            }

            toggle.addEventListener('change', (e) => {
                window.GameConstants.SETTINGS.LOW_QUALITY = e.target.checked;
                try {
                    localStorage.setItem('ss_low_quality', String(e.target.checked));
                } catch (e) {
                    // ignore
                }
            });
        }
    }

    _initTooltipInteractivity() {
        const tt = document.getElementById('tooltip');
        if (!tt) return;

        // Prevent outside-click handler from firing when interacting with tooltip.
        tt.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });

        tt.addEventListener('mouseenter', () => {
            if (this._tooltipHideTimer) {
                clearTimeout(this._tooltipHideTimer);
                this._tooltipHideTimer = null;
            }
        });
        tt.addEventListener('mouseleave', () => this.hideTooltip());

        // Click/tap anywhere else to close a pinned tooltip.
        document.addEventListener('pointerdown', () => {
            if (this._tooltipPinned) this.unpinTooltip();
        });
    }

    _useMobileTooltip() {
        return !!this._isCoarsePointer;
    }

    _positionTooltip(e) {
        const tt = document.getElementById('tooltip');
        if (!tt) return;

        if (this._useMobileTooltip()) {
            tt.classList.add('mobile-friendly');
            
            // Determine vertical position based on click/touch Y coordinate
            let atTop = false;
            if (e) {
                const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
                const vh = window.innerHeight || document.documentElement.clientHeight;
                // If interaction is in the bottom 50% of the screen, move tooltip to top
                if (clientY > vh * 0.5) {
                    atTop = true;
                }
            }

            if (atTop) {
                tt.classList.add('at-top');
                tt.style.top = 'calc(16px + env(safe-area-inset-top))';
                tt.style.bottom = 'auto';
            } else {
                tt.classList.remove('at-top');
                tt.style.top = 'auto';
                tt.style.bottom = 'calc(16px + env(safe-area-inset-bottom))';
            }

            tt.style.left = '50%';
            tt.style.right = 'auto';
            tt.style.transform = 'translateX(-50%)';
            return;
        }

        tt.classList.remove('mobile-friendly');
        tt.style.bottom = '';
        tt.style.right = '';
        if (!e) return;

        let x = e.pageX + 15;
        let y = e.pageY + 15;

        const rect = tt.getBoundingClientRect();
        const ttWidth = rect.width || 260;
        const ttHeight = rect.height;

        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

        const pad = 10;
        const maxX = scrollX + vw - ttWidth - pad;
        const maxY = scrollY + vh - ttHeight - pad;

        x = Math.max(scrollX + pad, Math.min(x, maxX));
        y = Math.max(scrollY + pad, Math.min(y, maxY));

        tt.style.left = x + 'px';
        tt.style.top = y + 'px';
        tt.style.transform = '';
    }

    pinTooltip(e, item, isWeapon) {
        if (!item) return;
        this._tooltipPinned = true;
        this._tooltipPinnedItem = item;
        this._tooltipPinnedIsWeapon = !!isWeapon;
        this.showTooltip(e, item, !!isWeapon);
        const tt = document.getElementById('tooltip');
        if (tt) tt.classList.add('pinned');
    }

    unpinTooltip() {
        this._tooltipPinned = false;
        this._tooltipPinnedItem = null;
        this._tooltipPinnedIsWeapon = false;
        const tt = document.getElementById('tooltip');
        if (tt) tt.classList.remove('pinned');
        this.hideTooltip(true);
    }

    toggleTooltipPin(e, item, isWeapon) {
        if (!item) return;
        // If already pinned to the same item, unpin.
        if (this._tooltipPinned && this._tooltipPinnedItem === item) {
            this.unpinTooltip();
            return;
        }
        this.pinTooltip(e, item, isWeapon);
    }

    handleApplyToken() {
        this.inventory.handleApplyToken();
    }

    cacheEls() {
        this._els = {
            hpFill: document.getElementById('hp-fill'),
            xpFill: document.getElementById('xp-fill'),
            hpText: document.getElementById('hp-text'),
            xpText: document.getElementById('xp-text'),
            lvlEl: document.getElementById('lvl-display'),
            buffsPanel: document.getElementById('buffs-panel'),
            runInfo: document.getElementById('run-info'),
            runTime: document.getElementById('run-time'),
            runKills: document.getElementById('run-kills')
        };
    }

    initScreens() {
        const startBtn = document.getElementById('main-menu-start-btn');
        const retryBtn = document.getElementById('end-screen-retry-btn');
        const menuBtn = document.getElementById('end-screen-menu-btn');
        const mobileInvBtn = document.getElementById('mobile-inv-btn');

        const canvas = document.getElementById('gameCanvas');

        // Start button now handled by showMainMenu to show character selection
        // if (startBtn) startBtn.onclick = () => Game.startNewRun();
        if (retryBtn) retryBtn.onclick = () => Game.startNewRun();
        if (menuBtn) menuBtn.onclick = () => Game.showMainMenu();

        if (mobileInvBtn) {
            mobileInvBtn.onclick = () => {
                if (typeof Game !== 'undefined' && (Game.state === 'playing' || Game.state === 'paused')) {
                    Game.toggleInventory();
                }
            };
        }

        // Tap/click canvas to start/retry (mobile-friendly).
        if (canvas) {
            canvas.addEventListener('pointerdown', () => {
                if (typeof Game === 'undefined') return;
                if (Game.state === 'mainmenu' || Game.state === 'gameover') {
                    Game.startNewRun();
                }
            }, { passive: true });
        }
    }

    updateBars(now = performance.now(), force = false) {
        this.hud.update(now, force);
    }

    updateInventory() {
        this.inventory.update();
    }

    updateStatsPanel() {
        this.inventory.updateStatsPanel();
    }

    updateUpgradeSidebar() {
        const list = document.getElementById('upgrade-inventory-items');
        const art = document.getElementById('upgrade-artifact-summary');
        if (!list || !art || !Game.player) return;

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
                const color = r.item.rarity.color;
                div.style.borderColor = color;
                div.innerHTML = `
                    <div class="upgrade-gear-label">${r.label}</div>
                    <div style="color:${color}; font-weight:800;">${r.item.name}</div>
                    <div class="upgrade-gear-sub">${r.item.rarity.name}</div>
                `;
                div.addEventListener('mouseenter', (e) => {
                    if (this._tooltipPinned) return;
                    this.showTooltip(e, r.item, r.isWeapon);
                });
                div.addEventListener('mouseleave', () => this.hideTooltip());
                div.addEventListener('mousemove', (e) => this.moveTooltip(e));
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleTooltipPin(e, r.item, r.isWeapon);
                });
            } else {
                div.style.borderColor = '#444';
                div.innerHTML = `
                    <div class="upgrade-gear-label">${r.label}</div>
                    <div style="color:#666; font-weight:800;">Empty</div>
                `;
            }
            list.appendChild(div);
        });

        const count = Game.player.artifacts.length;
        art.textContent = `${count} collected`;
    }

    promptAccessoryReplace(newItem, onPickSlot, onCancel) {
        const modal = document.getElementById('accessory-replace-modal');
        const summary = document.getElementById('accessory-replace-summary');
        const btnA1 = document.getElementById('replace-accessory1-btn');
        const btnA2 = document.getElementById('replace-accessory2-btn');
        const btnCancel = document.getElementById('replace-accessory-cancel-btn');

        if (!modal || !summary || !btnA1 || !btnA2 || !btnCancel) {
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
    }

    // --- Reward modal (level up / boss chest) ---

    showRewardModal({ title, items, onTake, onExit, onSacrifice, onRefresh, refreshStacks }) {
        const modal = document.getElementById('levelup-modal');
        const header = modal?.querySelector('h2');
        if (header) header.textContent = title || 'Choose Your Reward';

        const container = document.getElementById('card-container');
        if (container) container.innerHTML = '';

        this.updateUpgradeSidebar();

        const exitBtn = document.getElementById('levelup-exit-btn');
        if (exitBtn) {
            exitBtn.onclick = () => {
                // On mobile, tooltips are often pinned; ensure they don't persist into gameplay.
                this.unpinTooltip();
                this.hideTooltip(true);
                if (typeof onExit === 'function') onExit();
            };

            let sacrificeBtn = document.getElementById('levelup-sacrifice-btn');
            if (onSacrifice) {
                if (!sacrificeBtn) {
                    sacrificeBtn = document.createElement('button');
                    sacrificeBtn.id = 'levelup-sacrifice-btn';
                    sacrificeBtn.className = 'btn';
                    sacrificeBtn.textContent = 'Consume Essence';
                    sacrificeBtn.style.backgroundColor = '#8e44ad';
                    sacrificeBtn.style.marginTop = '0';
                    sacrificeBtn.style.marginLeft = '10px';
                    exitBtn.parentNode.appendChild(sacrificeBtn);
                }
                sacrificeBtn.style.display = 'inline-block';
                
                // Update text with current prize values
                const prize = window.GameConstants?.ESSENCE_PRIZE;
                const player = window.Game?.player;
                const essenceMult = player?.effects?.essenceBoostMult || 1;
                
                let prizeText = '';
                if (prize) {
                    const hpGain = (prize.maxHp || 0) * essenceMult;
                    const dmgGain = Math.round((prize.damage || 0) * essenceMult * 100);
                    prizeText = ` (+${hpGain} HP, +${dmgGain}% Dmg)`;
                }
                
                sacrificeBtn.textContent = 'Consume Essence' + prizeText;

                sacrificeBtn.onclick = () => {
                    this.unpinTooltip();
                    this.hideTooltip(true);
                    if (typeof onSacrifice === 'function') onSacrifice();
                };
            } else {
                if (sacrificeBtn) sacrificeBtn.style.display = 'none';
            }

            // Add or update refresh button
            let refreshBtn = document.getElementById('levelup-refresh-btn');
            if (onRefresh && refreshStacks > 0) {
                if (!refreshBtn) {
                    refreshBtn = document.createElement('button');
                    refreshBtn.id = 'levelup-refresh-btn';
                    refreshBtn.className = 'btn';
                    refreshBtn.style.backgroundColor = '#3498db';
                    refreshBtn.style.marginTop = '0';
                    refreshBtn.style.marginLeft = '10px';
                    exitBtn.parentNode.appendChild(refreshBtn);
                }
                refreshBtn.style.display = 'inline-block';
                refreshBtn.textContent = `Refresh Items (${refreshStacks})`;
                refreshBtn.onclick = () => {
                    this.unpinTooltip();
                    this.hideTooltip(true);
                    if (typeof onRefresh === 'function') onRefresh();
                };
            } else {
                if (refreshBtn) refreshBtn.style.display = 'none';
            }
        }

        (items || []).forEach((item) => {
            const card = document.createElement('div');
            card.className = `item-card card-${item.rarity.id} item-card-neo`;

            const statsHtml = (item.modifiers || []).map(m => {
                let cssClass = m.source === 'special' ? 'mod-special' : 'mod-positive';
                let valStr = LootSystem.formatStat(m.stat, m.value, m.operation);
                return `<span class="mod-line ${cssClass}">${valStr} ${m.name || m.stat}</span>`;
            }).join('');

            const headerColor = item.rarity.color;

            card.innerHTML = `
                <div class="item-card-top">
                    <h3 style="color:${headerColor}">${item.name}</h3>
                    <span class="rarity-tag" style="color:${headerColor}">${item.rarity.name} ${item.type}</span>
                </div>
                <p>${item.description}</p>
                <div class="mod-list">${statsHtml}</div>
                <div class="card-actions">
                    <button class="btn-small btn-small-primary" data-action="take">Take</button>
                </div>
            `;

            card.addEventListener('mouseenter', (e) => this.showTooltip(e, item, item.type === ItemType.WEAPON));
            card.addEventListener('mouseleave', () => this.hideTooltip());
            card.addEventListener('mousemove', (e) => this.moveTooltip(e));
            card.addEventListener('click', (e) => {
                // On mobile (no hover), this lets players inspect affixes/details without taking immediately.
                e.stopPropagation();
                this.toggleTooltipPin(e, item, item.type === ItemType.WEAPON);
            });

            const takeBtn = card.querySelector('[data-action="take"]');
            const take = () => {
                // Ensure pinned tooltips are cleared when taking an item (mobile).
                this.unpinTooltip();
                this.hideTooltip(true);
                if (typeof onTake === 'function') onTake(item);
            };
            if (takeBtn) takeBtn.onclick = (e) => { e.stopPropagation(); take(); };
            container?.appendChild(card);
        });

        document.getElementById('levelup-modal')?.classList.add('active');
    }

    // --- Tooltip (copied from prior Game.ui) ---

    showTooltip(e, item, isWeapon) {
        const tt = document.getElementById('tooltip');
        if (!tt || !item) return;

        if (this._tooltipHideTimer) {
            clearTimeout(this._tooltipHideTimer);
            this._tooltipHideTimer = null;
        }

        const wrapDetails = (labelHtml, bodyHtml, open = false) => {
            if (!bodyHtml) return '';
            return `
                <div class="tt-section">
                    <details class="tt-details" ${open ? 'open' : ''}>
                        <summary class="tt-summary">${labelHtml}</summary>
                        <div class="tt-details-body">${bodyHtml}</div>
                    </details>
                </div>
            `;
        };

        const renderAffixesSection = () => {
            const affixes = Array.isArray(item.affixes) ? item.affixes : [];
            // Don't render section if no affixes exist
            if (!affixes.length) return '';

            let body = '';
            affixes.forEach(a => {
                body += `<div class="tt-row"><span class="tt-label" style="color:#ffb74d; font-weight:800;">${a.name}</span><span class="tt-value" style="color:#888; font-weight:600;">Affix</span></div>`;
                const mods = Array.isArray(a.modifiers) ? a.modifiers : [];
                mods.forEach(m => {
                    const v = Number(m.value) || 0;
                    const val = LootSystem.formatStat(m.stat, v, m.operation);
                    // Use layer-based colors, fallback to negative/positive colors
                    let color;
                    if (v < 0) {
                        color = '#ff5252'; // Keep red for negative values
                    } else if (m.layer !== undefined && m.layer !== null) {
                        const layerColors = ['#b0bec5', '#81c784', '#64b5f6', '#ffb74d'];
                        color = layerColors[Math.min(m.layer, 3)] || '#81c784';
                    } else {
                        color = '#81c784'; // Default green
                    }
                    body += `<div class="tt-row"><span class="tt-label">${m.name || m.stat}</span> <span class="tt-value" style="color:${color}">${val}</span></div>`;
                });
            });

            return wrapDetails(`🧷 Affixes <span class="tt-pill">${affixes.length}</span>`, body, false);
        };

        const renderEffectsSection = () => {
            const parts = [];

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

        const headerColor = item.rarity.color;
        const headerClass = '';
        const icon = '⚔️';

        let content = `<div class="tt-sticky">`;
        content += `<h4 style="color:${headerColor}" class="${headerClass}">${icon} ${item.name}</h4>`;
        content += `<div class="tt-header-meta">${item.rarity.name} ${item.type}</div>`;
        if (this._tooltipPinned && this._tooltipPinnedItem === item) {
            content += `<div class="tt-pin-hint">Pinned — tap outside to close</div>`;
        }
        content += `</div>`;
        content += `<div style="color:#aaa; font-size:11px; margin-bottom:10px; line-height:1.3;">${item.description}</div>`;

        if (isWeapon) {
            const p = Game.player;
            const getBaseMod = (s) => item.modifiers.filter(m => m.stat === s).reduce((a, c) => a + c.value, 0);
            const getEff = (s, def) => (p.getEffectiveItemStat ? p.getEffectiveItemStat(item, s, def) : (getBaseMod(s) || def));

            const baseDmg = getEff('baseDamage', 5);
            const finalDmg = baseDmg * p.stats.damage;
            const baseCd = getEff('cooldown', 60);
            const finalCd = Math.max(5, baseCd * p.stats.cooldownMult);
            const proj = Math.floor(getEff('projectileCount', 1));

            const baseCritChance = (p.getEffectiveItemStat ? p.getEffectiveItemStat(item, 'critChance', 0) : (getBaseMod('critChance') || 0));
            const effectiveCritChance = (p.getEffectiveCritChance ? p.getEffectiveCritChance(item) : baseCritChance);
            const baseCritDmgMult = (p.getBaseCritDamageMult ? p.getBaseCritDamageMult(item) : (getBaseMod('critDamageMultBase') || 2));
            
            // Crit Tier Logic for Tooltip
            const tierNum = Math.floor(effectiveCritChance);
            const chanceNext = (effectiveCritChance % 1);
            const currentTierNum = Math.min(tierNum + 1, GameConstants.CRIT_TIERS.MAX);
            const tData = GameConstants.CRIT_TIERS[currentTierNum];
            
            const effectiveCritDmgMult = baseCritDmgMult * tData.multiplier;

            const pierce = Math.floor(getEff('pierce', 0));
            const knockback = getEff('knockback', 0);
            const aoe = getEff('areaOfEffect', 0);
            const projSpeed = getEff('projSpeed', 8);
            const orbitDist = getEff('orbitDistance', 0);

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

            if (item.behavior === 'orbital') {
                content += `<div class="tt-grid-item">`;
                content += `<div class="tt-row"><span class="tt-label">Orbit Dist</span></div>`;
                content += `<div class="tt-row"><span style="font-size:13px; font-weight:700; color:#81c784;">${Math.round(orbitDist)}</span></div>`;
                content += `</div>`;
            }

            content += `</div></div>`;

            content += `<div class="tt-section tt-grid-item highlight">`;
            content += `<div class="tt-section-title" style="color:#ff6b9d;">✨ Critical Strike</div>`;
            content += `<div class="tt-row"><span class="tt-label">Crit Chance</span> <span class="tt-value crit-chance">${(effectiveCritChance * 100).toFixed(1)}%</span></div>`;
            
            if (effectiveCritChance > 0) {
                const nextT = Math.min(currentTierNum + 1, GameConstants.CRIT_TIERS.MAX);
                const nextTData = GameConstants.CRIT_TIERS[nextT];
                const progress = Math.round(chanceNext * 100);
                
                content += `<div class="tt-calc" style="color:${tData.color}; font-weight:bold;">${tData.symbol} ${tData.name} Active</div>`;
                if (currentTierNum < GameConstants.CRIT_TIERS.MAX) {
                    content += `
                        <div class="tt-calc" style="display:flex; align-items:center; gap:5px; margin-top:2px;">
                            <span style="color:#aaa; font-size:9px;">Next:</span>
                            <div style="flex-grow:1; height:3px; background:rgba(255,255,255,0.1); border-radius:1px; overflow:hidden;">
                                <div style="width:${progress}%; height:100%; background:${nextTData.color};"></div>
                            </div>
                            <span style="color:${nextTData.color}; font-size:9px; font-weight:bold;">${progress}%</span>
                        </div>`;
                }
            }

            content += `<div class="tt-row"><span class="tt-label">Crit Damage</span> <span class="tt-value crit-damage">x${effectiveCritDmgMult.toFixed(2)}</span></div>`;
            if (tData.multiplier > 1) {
                content += `<div class="tt-calc" style="color:#ffa500;">Base: x${baseCritDmgMult.toFixed(2)} × ${tData.multiplier} (Tier Bonus)</div>`;
            }
            content += `</div>`;

            if (pierce > 0 || knockback > 0 || aoe > 0 || projSpeed !== 8) {
                content += `<div class="tt-section">`;
                content += `<div class="tt-section-title">⚙️ Modifiers</div>`;
                if (pierce > 0) content += `<div class="tt-row"><span class="tt-label">Pierce</span> <span class="tt-value">${pierce}</span></div>`;
                if (knockback > 0) content += `<div class="tt-row"><span class="tt-label">Knockback</span> <span class="tt-value defensive">${knockback.toFixed(1)}</span></div>`;
                if (aoe > 0) content += `<div class="tt-row"><span class="tt-label">Area Effect</span> <span class="tt-value">${aoe.toFixed(0)}</span></div>`;
                if (projSpeed !== 8) content += `<div class="tt-row"><span class="tt-label">Projectile Speed</span> <span class="tt-value">${projSpeed.toFixed(1)}</span></div>`;
                content += `</div>`;
            }

            content += renderAffixesSection();
            const fx = renderEffectsSection();
            content += wrapDetails(`✨ Effects <span class="tt-pill">${fx ? '!' : '0'}</span>`, fx, false);
        } else {
            const baseMods = (item.modifiers || []).filter(m => m && m.source === 'base');
            if (baseMods.length) {
                content += `<div class="tt-section">`;
                content += `<div class="tt-section-title">Stats</div>`;
                baseMods.forEach(m => {
                    const v = Number(m.value) || 0;
                    const val = LootSystem.formatStat(m.stat, v, m.operation);
                    // Use layer-based colors, fallback to negative/positive colors
                    let color;
                    if (v < 0) {
                        color = '#ff5252'; // Keep red for negative values
                    } else if (m.layer !== undefined && m.layer !== null) {
                        const layerColors = ['#b0bec5', '#81c784', '#64b5f6', '#ffb74d'];
                        color = layerColors[Math.min(m.layer, 3)] || '#b0bec5';
                    } else {
                        color = '#b0bec5'; // Default to layer 0 for base stats
                    }
                    content += `<div class="tt-row"><span class="tt-label">${m.name || m.stat}</span> <span class="tt-value" style="color:${color}">${val}</span></div>`;
                });
                content += `</div>`;
            }

            content += renderAffixesSection();
            const fx = renderEffectsSection();
            content += wrapDetails(`✨ Effects <span class="tt-pill">${fx ? '!' : '0'}</span>`, fx, false);
        }

        if (this._tooltipPinned && Game.player?.affixTokens > 0) {
            content += `<div class="tt-section" style="margin-top:10px; border-top:1px solid #444; padding-top:10px;">`;
            content += `<div style="text-align:center; color:#ffb74d; font-weight:bold; margin-bottom:5px;">Affix Tokens: ${Game.player.affixTokens}</div>`;
            content += `<button onclick="window.Game.ui.handleApplyToken()" class="btn-small btn-small-primary" style="width:100%; pointer-events:auto; cursor:pointer;">Apply Affix Token</button>`;
            content += `</div>`;
        }

        tt.innerHTML = content;
        tt.style.display = 'block';
        if (this._tooltipPinned && this._tooltipPinnedItem === item) tt.classList.add('pinned');
        else tt.classList.remove('pinned');
        this._lastTooltipEvent = e || this._lastTooltipEvent;
        this._positionTooltip(this._lastTooltipEvent);
    }

    hideTooltip(immediate = false) {
        if (this._tooltipPinned && !immediate) return;
        if (this._tooltipHideTimer) return;
        if (immediate) {
            const tt = document.getElementById('tooltip');
            if (tt) tt.style.display = 'none';
            return;
        }
        this._tooltipHideTimer = setTimeout(() => {
            this._tooltipHideTimer = null;
            const tt = document.getElementById('tooltip');
            if (tt) tt.style.display = 'none';
        }, 120);
    }

    moveTooltip(e) {
        if (this._tooltipPinned) return;
        this._lastTooltipEvent = e || this._lastTooltipEvent;
        this._positionTooltip(this._lastTooltipEvent);
    }
}

window.UIManager = UIManager;
