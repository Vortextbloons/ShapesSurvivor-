class InventoryUI {
    constructor(uiManager) {
        this.ui = uiManager;
    }

    update() {
        this.updateEquipment();
        this.updateArtifacts();
        this.updateStatsPanel();
    }

    updateEquipment() {
        const p = window.Game?.player;
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

            // Clear old listeners
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
                    if (this.ui._tooltipPinned) return;
                    this.ui.showTooltip(e, item, isWeapon);
                };
                slotEl.onmouseleave = () => this.ui.hideTooltip();
                slotEl.onmousemove = (e) => this.ui.moveTooltip(e);
                slotEl.onclick = (e) => {
                    e.stopPropagation();
                    this.ui.toggleTooltipPin(e, item, isWeapon);
                };
            } else {
                contentEl.innerHTML = '<span class="slot-empty">Empty</span>';
                slotEl.classList.remove('filled');
                slotEl.style.borderColor = '';
            }
        });
    }

    updateArtifacts() {
        const p = window.Game?.player;
        if (!p) return;

        const grid = document.getElementById('artifact-container');
        if (grid) {
            grid.innerHTML = '';
            (p.artifacts || []).forEach(art => {
                const div = document.createElement('div');
                div.className = 'artifact-slot';
                div.innerHTML = `<span class="artifact-icon">${art.icon || '💎'}</span>`;
                div.style.borderColor = art.rarity?.color || '#fff';

                div.addEventListener('mouseenter', (e) => {
                    if (this.ui._tooltipPinned) return;
                    this.ui.showTooltip(e, art, false);
                });
                div.addEventListener('mouseleave', () => this.ui.hideTooltip());
                div.addEventListener('mousemove', (e) => this.ui.moveTooltip(e));
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.ui.toggleTooltipPin(e, art, false);
                });

                grid.appendChild(div);
            });
        }
    }

    handleApplyToken() {
        const item = this.ui._tooltipPinnedItem;
        const player = window.Game?.player;
        if (!item || !player || (player.affixTokens || 0) <= 0) return;

        if (window.LootSystem?.addAffixToItem(item)) {
            player.affixTokens--;
            player.recalculateStats();
            this.update(); // Refresh inventory rendering
            // Refresh tooltip if still pinned
            if (this.ui._tooltipPinned && this.ui._tooltipPinnedItem === item) {
                const isWeapon = item.type === window.ItemType?.WEAPON;
                this.ui.showTooltip(null, item, isWeapon);
            }
        }
    }

    updateStatsPanel() {
        const p = window.Game?.player;
        if (!p) return;
        const s = p.stats;
        const panel = document.getElementById('stats-panel');
        if (!panel) return;

        const xpBonusPct = Math.round(Math.max(0, (s.xpGain || 1) - 1) * 100);
        const critChance = (p.getEffectiveCritChance ? p.getEffectiveCritChance() : 0);
        const tierInfo = p.getCritTierInfo ? p.getCritTierInfo() : null;
        
        let tierHtml = '';
        if (tierInfo && critChance > 0) {
            const progress = Math.round(tierInfo.chanceForNext * 100);
            tierHtml = `
                <div class="crit-tier-mini" style="display: flex; align-items: center; gap: 4px; margin-top: 2px;" title="${tierInfo.tierData.name}: ${progress}% toward ${tierInfo.nextTierData.name}">
                    <span style="color: ${tierInfo.tierData.color}; font-size: 10px; font-weight: bold;">
                        ${tierInfo.tierData.symbol} T${tierInfo.currentTierNum}
                    </span>
                    <div style="width: 30px; height: 3px; background: rgba(255,255,255,0.1); border-radius: 1px; overflow: hidden; position: relative;">
                        <div style="width: ${progress}%; height: 100%; background: ${tierInfo.nextTierData.color}; box-shadow: 0 0 3px ${tierInfo.nextTierData.color};"></div>
                    </div>
                </div>
            `;
        }

        // Crit Damage (Calculated from stats)
        const critDmgVal = p.stats.critDamage || 2.0;
        const tierDamageMult = (tierInfo && tierInfo.tierData) ? tierInfo.tierData.multiplier : 1;
        const effectiveCritDmg = critDmgVal * tierDamageMult;
        
        let critDmgDisplay = `<span class="stat-val">${Math.round(effectiveCritDmg * 100)}%</span>`;
        if (tierDamageMult > 1) {
            critDmgDisplay = `
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span class="stat-val" style="color: ${tierInfo.tierData.color}; font-weight: bold;">${Math.round(effectiveCritDmg * 100)}%</span>
                    <span style="font-size: 9px; color: rgba(255,255,255,0.5);">(${Math.round(critDmgVal * 100)}% x${tierDamageMult})</span>
                </div>
            `;
        }
        
        // Regen per second (0.25 per frame * 60 frames = 15x multiplier)
        const regenPerSec = (s.regen || 0) * 15;
        
        // Cooldown Reduction (e.g., 0.8 mult = 20% reduction)
        const cdr = Math.round((1 - (s.cooldownMult || 1)) * 100);
        const cdrText = cdr >= 0 ? `-${cdr}%` : `+${Math.abs(cdr)}%`;
        
        // Damage Taken (e.g., 0.9 mult = -10% damage taken)
        const dmgTaken = Math.round(((s.damageTakenMult || 1) - 1) * 100);
        const dmgTakenText = dmgTaken > 0 ? `+${dmgTaken}%` : `${dmgTaken}%`;

        // Damage Bonus (e.g., 1.5 mult = +50% damage)
        const dmgBonus = Math.round(((s.damage || 1) - 1) * 100);
        const dmgText = dmgBonus >= 0 ? `+${dmgBonus}%` : `${dmgBonus}%`;

        // Helper function to generate math breakdown HTML
        const makeBreakdown = (statKey, displayValue) => {
            const breakdown = p.statBreakdowns?.[statKey];
            if (!breakdown || !breakdown.layers || breakdown.layers.length === 0) {
                return `<div class="stat-value-display"><span class="stat-val">${displayValue}</span></div>`;
            }
            
            // Build tooltip with detailed breakdown
            let tooltipHtml = `Breakdown:\\n`;
            const layerNames = ['Base', 'Additive', 'Multiplicative', 'Buffs'];
            
            breakdown.layers.forEach((layer, idx) => {
                if (!layer || layer.entries.length === 0) return;
                const layerName = layerNames[Math.min(idx, 3)] || `Layer ${idx}`;
                
                tooltipHtml += `\\n${layerName}:\\n`;
                layer.entries.forEach(entry => {
                    const source = entry.name || entry.source || 'Unknown';
                    const value = entry.value || 0;
                    const op = entry.operation === 'multiply' ? 'x' : '+';
                    tooltipHtml += `  ${source}: ${op}${value.toFixed(2)}\\n`;
                });
            });
            
            // Generate math formula
            let base = 0;
            let totalAdd = 0;
            let totalMult = 1;
            
            breakdown.layers.forEach((layer, idx) => {
                if (!layer) return;
                
                if (idx === 0) {
                    // Base layer
                    base = layer.add || 0;
                } else {
                    // Accumulate additive and multiplicative modifiers
                    totalAdd += (layer.add || 0);
                    totalMult *= (layer.mult || 1);
                }
            });
            
            // Build formula based on what modifiers exist
            let formula = '';
            if (totalAdd === 0 && totalMult === 1) {
                // Only base value - no breakdown needed
                return `<div class="stat-value-display"><span class="stat-val">${displayValue}</span></div>`;
            } else if (totalMult === 1) {
                // Base + Additive only
                const sign = totalAdd >= 0 ? '+' : '';
                formula = `${base.toFixed(0)} ${sign}${totalAdd.toFixed(0)}`;
            } else if (totalAdd === 0) {
                // Base × Multiplier only
                formula = `${base.toFixed(0)} ×${totalMult.toFixed(2)}`;
            } else {
                // Full formula: (Base + Add) × Mult
                const sign = totalAdd >= 0 ? '+' : '';
                formula = `(${base.toFixed(0)}${sign}${totalAdd.toFixed(0)}) ×${totalMult.toFixed(2)}`;
            }
            
            return `<div class="stat-value-display" title="${tooltipHtml}">
                <span class="stat-val">${displayValue}</span>
                <div class="stat-formula">${formula}</div>
            </div>`;
        };

        const tokenHtml = (p.affixTokens > 0) ? 
            `<div class="stat-row" style="background: rgba(255, 183, 77, 0.1); border: 1px solid rgba(255, 183, 77, 0.3); margin-bottom: 10px; padding: 5px;">
                <span class="stat-name" style="color:#ffb74d;">Affix Tokens</span>
                <span class="stat-val" style="color:#ffb74d;">${p.affixTokens}</span>
            </div>` : '';

        panel.innerHTML = `
            ${tokenHtml}
            <div class="stat-row"><span class="stat-name">Level</span><span class="stat-val">${p.level}</span></div>
            <div class="stat-row"><span class="stat-name">XP Bonus</span><span class="stat-val">+${xpBonusPct}%</span></div>
            <div class="stat-divider"></div>
            
            <!-- Offensive -->
            <div class="stat-row">
                <span class="stat-name">Damage</span>
                ${makeBreakdown('damage', dmgText)}
            </div>
            
            <div class="stat-row">
                <span class="stat-name">Crit Chance</span>
                <div style="display:flex; flex-direction:column; align-items:flex-end;">
                     ${makeBreakdown('critChance', `${Math.round(critChance * 100)}%`)}
                     ${tierHtml}
                </div>
            </div>
            
            <div class="stat-row">
                <span class="stat-name">Crit Damage</span>
                ${critDmgDisplay}
            </div>
            
            <div class="stat-row">
                <span class="stat-name">Cooldowns</span>
                ${makeBreakdown('cooldownMult', cdrText)}
            </div>
            
            <div class="stat-row">
                <span class="stat-name">Area Size</span>
                ${makeBreakdown('areaOfEffect', `+${Math.round((s.areaOfEffect || 0) * 100)}%`)}
            </div>

            <div class="stat-divider"></div>

            <!-- Defensive -->
            <div class="stat-row"><span class="stat-name">Max HP</span><span class="stat-val">${Math.ceil(s.maxHp || 10)}</span></div>
            <div class="stat-row"><span class="stat-name">Regen</span><span class="stat-val">${regenPerSec.toFixed(1)}/s</span></div>
            <div class="stat-row"><span class="stat-name">Damage Taken</span><span class="stat-val">${dmgTakenText}</span></div>
            <div class="stat-row"><span class="stat-name">Move Speed</span><span class="stat-val">${(s.moveSpeed || 0).toFixed(1)}</span></div>
            
            <!-- Misc -->
            <div class="stat-divider"></div>
            <div class="stat-row"><span class="stat-name">Life on Kill</span><span class="stat-val">${(s.lifeOnKill || 0).toFixed(1)}</span></div>
            <div class="stat-row"><span class="stat-name">Thorns</span><span class="stat-val">${Math.round(s.thornsDamage || 0)}</span></div>
        `;
    }
}

window.InventoryUI = InventoryUI;
