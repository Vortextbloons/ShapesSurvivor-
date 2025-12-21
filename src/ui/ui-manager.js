// UIManager: all DOM UI rendering / interaction glue.
// Loaded before src/core/game-engine.js (non-module script).

class UIManager {
    constructor() {
        this._els = null;
        this._barsState = null;
        this._nextBarsUpdateAt = 0;

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
        this.cacheEls();
        this._initMainMenuMeta();
        this._initTooltipInteractivity();
        const coarseQuery = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
        this._isCoarsePointer = !!coarseQuery?.matches || ('ontouchstart' in window);
        coarseQuery?.addEventListener?.('change', (e) => {
            this._isCoarsePointer = !!e.matches;
        });
        this._barsState = {
            hpWidth: '',
            xpWidth: '',
            hpText: '',
            xpText: '',
            lvlText: '',
            buffsHtml: '',
            runInfoHtml: ''
        };
        this._nextBarsUpdateAt = 0;
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
            tt.style.left = '50%';
            tt.style.right = 'auto';
            tt.style.top = 'auto';
            tt.style.bottom = 'calc(16px + env(safe-area-inset-bottom))';
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

        if (startBtn) startBtn.onclick = () => Game.startNewRun();
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
        if (!force && now < (this._nextBarsUpdateAt || 0)) return;
        this._nextBarsUpdateAt = now + 100; // ~10Hz to keep DOM work cheap

        const p = Game.player;
        if (!this._els) this.cacheEls();
        const { hpFill, xpFill, hpText, xpText, lvlEl, buffsPanel, runTime, runKills } = this._els;
        if (!this._barsState) {
            this._barsState = {
                hpWidth: '',
                xpWidth: '',
                hpText: '',
                xpText: '',
                lvlText: '',
                buffsHtml: '',
                runInfoHtml: ''
            };
        }
        const st = this._barsState;

        // Run info (time/kills) always visible.
        const timeSec = Math.max(0, Math.floor((Game.elapsedFrames || 0) / 60));
        const mins = Math.floor(timeSec / 60);
        const secs = timeSec % 60;
        const timeText = `${mins}:${String(secs).padStart(2, '0')}`;
        const killsText = String(Game?.stats?.kills || 0);
        if (runTime && runTime.textContent !== timeText) runTime.textContent = timeText;
        if (runKills && runKills.textContent !== killsText) runKills.textContent = killsText;

        if (!p) {
            if (hpFill && st.hpWidth !== '0%') { hpFill.style.width = '0%'; st.hpWidth = '0%'; }
            if (xpFill && st.xpWidth !== '0%') { xpFill.style.width = '0%'; st.xpWidth = '0%'; }
            if (hpText && st.hpText !== '0/0') { hpText.textContent = '0/0'; st.hpText = '0/0'; }
            if (xpText && st.xpText !== '0/0') { xpText.textContent = '0/0'; st.xpText = '0/0'; }
            if (lvlEl && st.lvlText !== '1') { lvlEl.textContent = '1'; st.lvlText = '1'; }
            const emptyHtml = '<div class="buff-empty">None</div>';
            if (buffsPanel && st.buffsHtml !== emptyHtml) { buffsPanel.innerHTML = emptyHtml; st.buffsHtml = emptyHtml; }
            return;
        }

        const hpPct = UIManager.clamp01((p.hp || 0) / Math.max(1, p.stats.maxHp || 1));
        const xpPct = UIManager.clamp01((p.xp || 0) / Math.max(1, p.nextLevelXp || 1));

        const hpWidth = `${(hpPct * 100).toFixed(2)}%`;
        const xpWidth = `${(xpPct * 100).toFixed(2)}%`;
        const hpTextStr = `${Math.ceil(p.hp || 0)}/${Math.ceil(p.stats.maxHp || 0)}`;
        const xpTextStr = `${Math.floor(p.xp || 0)}/${Math.floor(p.nextLevelXp || 0)}`;
        const lvlTextStr = String(p.level || 1);

        if (hpFill && st.hpWidth !== hpWidth) { hpFill.style.width = hpWidth; st.hpWidth = hpWidth; }
        if (xpFill && st.xpWidth !== xpWidth) { xpFill.style.width = xpWidth; st.xpWidth = xpWidth; }
        if (hpText && st.hpText !== hpTextStr) { hpText.textContent = hpTextStr; st.hpText = hpTextStr; }
        if (xpText && st.xpText !== xpTextStr) { xpText.textContent = xpTextStr; st.xpText = xpTextStr; }
        if (lvlEl && st.lvlText !== lvlTextStr) { lvlEl.textContent = lvlTextStr; st.lvlText = lvlTextStr; }

        if (buffsPanel) {
            const buffs = (p.getActiveBuffs ? p.getActiveBuffs() : []) || [];
            if (!buffs.length) {
                const emptyHtml = '<div class="buff-empty">None</div>';
                if (st.buffsHtml !== emptyHtml) {
                    buffsPanel.innerHTML = emptyHtml;
                    st.buffsHtml = emptyHtml;
                }
            } else {
                const html = buffs.map(b => {
                    const maxT = Math.max(1, Number(b.maxTime || b.duration || b.time || 1));
                    const pct = UIManager.clamp01((Number(b.time) || 0) / maxT);
                    const initials = String(b.name || 'Buff').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
                    const stacks = (b.stacks && b.stacks > 1) ? `x${b.stacks}` : '';
                    return `
                        <div class="buff-icon" style="--p:${pct.toFixed(4)}" aria-label="${b.name}">
                            <div class="buff-icon-inner">${initials || 'B'}</div>
                            ${stacks ? `<div class="buff-stack">${stacks}</div>` : ''}
                        </div>
                    `;
                }).join('');
                if (st.buffsHtml !== html) {
                    buffsPanel.innerHTML = html;
                    st.buffsHtml = html;
                }
            }
        }
    }

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

            slotEl.onmouseenter = null;
            slotEl.onmouseleave = null;
            slotEl.onmousemove = null;
            slotEl.onclick = null;

            if (item) {
                const color = (item.rarity?.color || '#fff');
                contentEl.innerHTML = `<span class="slot-name" style="color:${color};">${item.name}</span><div class="slot-sub">${item.rarity?.name || ''}</div>`;
                slotEl.classList.add('filled');
                slotEl.style.borderColor = color;

                slotEl.onmouseenter = (e) => {
                    if (this._tooltipPinned) return;
                    this.showTooltip(e, item, isWeapon);
                };
                slotEl.onmouseleave = () => this.hideTooltip();
                slotEl.onmousemove = (e) => this.moveTooltip(e);
                slotEl.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleTooltipPin(e, item, isWeapon);
                };
            } else {
                contentEl.innerHTML = '<span class="slot-empty">Empty</span>';
                slotEl.classList.remove('filled');
                slotEl.style.borderColor = '';
            }
        });

        const grid = document.getElementById('artifact-container');
        if (grid) {
            grid.innerHTML = '';
            (p.artifacts || []).forEach(art => {
                const div = document.createElement('div');
                div.className = 'artifact-slot';
                div.innerHTML = `<span class="artifact-icon">${art.icon || '💎'}</span>`;
                div.style.borderColor = art.rarity?.color || '#fff';

                div.addEventListener('mouseenter', (e) => {
                    if (this._tooltipPinned) return;
                    this.showTooltip(e, art, false);
                });
                div.addEventListener('mouseleave', () => this.hideTooltip());
                div.addEventListener('mousemove', (e) => this.moveTooltip(e));
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleTooltipPin(e, art, false);
                });

                grid.appendChild(div);
            });
        }

        this.updateStatsPanel();
    }

    updateStatsPanel() {
        const p = Game.player;
        if (!p) return;
        const s = p.stats;
        const panel = document.getElementById('stats-panel');
        if (!panel) return;

        const xpBonusPct = Math.round(Math.max(0, (s.xpGain || 1) - 1) * 100);
        const critChance = (p.getEffectiveCritChance ? p.getEffectiveCritChance() : 0);

        panel.innerHTML = `
            <div class="stat-row"><span>Max HP</span><span class="stat-val">${Math.round(s.maxHp)}</span></div>
            <div class="stat-row"><span>Damage</span><span class="stat-val">x${s.damage.toFixed(2)}</span></div>
            <div class="stat-row"><span>Speed</span><span class="stat-val">${s.moveSpeed.toFixed(1)}</span></div>
            <div class="stat-row"><span>Crit %</span><span class="stat-val">${Math.round(critChance * 100)}%</span></div>
            <div class="stat-row"><span>Regen</span><span class="stat-val">${s.regen.toFixed(2)}/f</span></div>
            <div class="stat-row"><span>AOE</span><span class="stat-val">+${Math.round(s.areaOfEffect)}</span></div>
            <div class="stat-row"><span>XP Gain</span><span class="stat-val">+${xpBonusPct}%</span></div>
        `;
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

    showRewardModal({ title, items, onTake, onExit }) {
        const modal = document.getElementById('levelup-modal');
        const header = modal?.querySelector('h2');
        if (header) header.textContent = title || 'Choose Your Reward';

        const container = document.getElementById('card-container');
        if (container) container.innerHTML = '';

        this.updateUpgradeSidebar();

        const exitBtn = document.getElementById('levelup-exit-btn');
        if (exitBtn) exitBtn.onclick = () => {
            // On mobile, tooltips are often pinned; ensure they don't persist into gameplay.
            this.unpinTooltip();
            this.hideTooltip(true);
            if (typeof onExit === 'function') onExit();
        };

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
            if (!affixes.length) return '';

            let body = '';
            affixes.forEach(a => {
                body += `<div class="tt-row"><span class="tt-label" style="color:#ffb74d; font-weight:800;">${a.name}</span><span class="tt-value" style="color:#888; font-weight:600;">Affix</span></div>`;
                const mods = Array.isArray(a.modifiers) ? a.modifiers : [];
                mods.forEach(m => {
                    const v = Number(m.value) || 0;
                    const val = LootSystem.formatStat(m.stat, v, m.operation);
                    const color = v < 0 ? '#ff5252' : '#81c784';
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
            const overCrit = Math.max(0, effectiveCritChance - 1);
            const overCritEffective = overCrit / (1 + overCrit);
            const effectiveCritDmgMult = baseCritDmgMult * (1 + overCritEffective);

            const pierce = Math.floor(getEff('pierce', 0));
            const knockback = getEff('knockback', 0);
            const aoe = getEff('areaOfEffect', 0);
            const projSpeed = getEff('projSpeed', 8);

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

            content += `</div></div>`;

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
                    const color = v < 0 ? '#ff5252' : '#81c784';
                    content += `<div class="tt-row"><span class="tt-label">${m.name || m.stat}</span> <span class="tt-value" style="color:${color}">${val}</span></div>`;
                });
                content += `</div>`;
            }

            content += renderAffixesSection();
            const fx = renderEffectsSection();
            content += wrapDetails(`✨ Effects <span class="tt-pill">${fx ? '!' : '0'}</span>`, fx, false);
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
