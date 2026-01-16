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

        if (LootSystem?.addAffixToItem(item)) {
            player.affixTokens--;
            player.recalculateStats();
            this.update(); // Refresh inventory rendering
            // Refresh tooltip if still pinned
            if (this.ui._tooltipPinned && this.ui._tooltipPinnedItem === item) {
                const isWeapon = item.type === ItemType?.WEAPON;
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

        // Helper function to generate math breakdown HTML
        const makeBreakdown = (statKey, displayValue) => {
            const breakdown = p.statBreakdowns?.[statKey];
            if (!breakdown || !breakdown.layers || breakdown.layers.length === 0) {
                return `<div class="stat-value-display"><span class="stat-val">${displayValue}</span></div>`;
            }
            
            // Build tooltip with detailed breakdown
            let tooltipHtml = `Breakdown:\\n`;
            const layerNames = ['Base', 'Additive', 'Multiplicative', 'Buffs/Other'];
            
            // Generate sequential calculation steps for tooltip
            breakdown.layers.forEach((layer, idx) => {
                if (!layer || (layer.add === 0 && layer.multSum === 0)) return;
                
                const layerName = layerNames[Math.min(idx, 3)] || `Layer ${idx}`;
                
                // Show inputs
                if (layer.entries.length > 0) {
                     tooltipHtml += `\\n[${layerName}]\\n`;
                     layer.entries.forEach(entry => {
                         const source = entry.name || entry.source || 'Unknown';
                         const value = entry.value || 0;
                         const op = entry.operation === 'multiply' ? 'x' : '+';
                         tooltipHtml += `  ${source}: ${op}${value.toFixed(2)}\\n`;
                     });
                }
                
                // Show sub-calculation 
                // Formula: (Prev + Add) * (1 + Mult) = Result
                const prev = layer.start;
                const add = layer.add;
                const mult = layer.mult; // This is (1 + multSum)
                const result = layer.end;
                
                tooltipHtml += `  => (${prev.toFixed(2)} + ${add.toFixed(2)}) x ${mult.toFixed(2)} = ${result.toFixed(2)}\\n`;
            });
            
            // Display simplified or full formula
            // We can't flatten everything, so we show the Base and then "..." if deep, or simple logic if shallow.
            let formula = '';
            
            // Check if complex (more than 1 active layer)
            const activeLayers = breakdown.layers.filter(l => l.add !== 0 || l.multSum !== 0);
            
            if (activeLayers.length <= 1) {
                 const l = activeLayers[0] || breakdown.layers[0];
                 const b = l.start; // usually 0 for layer 0
                 const a = l.add;
                 const m = l.mult;
                 if (m !== 1) formula = `(${b.toFixed(0)}+${a.toFixed(0)}) ×${m.toFixed(2)}`;
                 else formula = `${(b+a).toFixed(0)}`;
            } else {
                // Multi-layer
                formula = `Sequential Steps (Hover)`;
            }
            
            return `<div class="stat-value-display" title="${tooltipHtml}">
                <span class="stat-val">${displayValue}</span>
                <div class="stat-formula" style="font-size: 0.8em; opacity: 0.7;">${formula}</div>
            </div>`;
        };

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
        // Now using unified Stat object 'critDamage'
        const critDmgBreakdown = p.statBreakdowns?.critDamage;
        const critDmgVal = critDmgBreakdown ? critDmgBreakdown.final : (p.stats.critDamage || 2.0);
        
        const tierDamageMult = (tierInfo && tierInfo.tierData) ? tierInfo.tierData.multiplier : 1;
        const effectiveCritDmg = critDmgVal * tierDamageMult;
        
        let critDmgDisplay;
        if (tierDamageMult > 1) {
            critDmgDisplay = `
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                     <div class="stat-value-display">
                        <span class="stat-val" style="color: ${tierInfo.tierData.color}; font-weight: bold;">${Math.round(effectiveCritDmg * 100)}%</span>
                     </div>
                    <span style="font-size: 9px; color: rgba(255,255,255,0.5);">(${Math.round(critDmgVal * 100)}% x${tierDamageMult})</span>
                </div>
            `;
        } else {
             // Fallback if makeBreakdown is desired but using this custom logic
             critDmgDisplay = makeBreakdown('critDamage', `${Math.round(effectiveCritDmg * 100)}%`);
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
                ${makeBreakdown('areaOfEffect', `+${Math.round(((s.areaOfEffect || 1) - 1) * 100)}%`)}
            </div>

            <div class="stat-divider"></div>

            <!-- Defensive -->
            <div class="stat-row">
                <span class="stat-name">Max HP</span>
                ${makeBreakdown('maxHp', Math.ceil(s.maxHp || 10))}
            </div>
            <div class="stat-row">
                <span class="stat-name">Regen</span>
                ${makeBreakdown('regen', `${regenPerSec.toFixed(1)}/s`)}
            </div>
            <div class="stat-row">
                <span class="stat-name">Damage Taken</span>
                ${makeBreakdown('damageTakenMult', dmgTakenText)}
            </div>
            <div class="stat-row">
                <span class="stat-name">Move Speed</span>
                ${makeBreakdown('moveSpeed', (s.moveSpeed || 0).toFixed(1))}
            </div>
            
            <!-- Misc -->
            <div class="stat-divider"></div>
            <div class="stat-row"><span class="stat-name">Life on Kill</span><span class="stat-val">${(s.lifeOnKill || 0).toFixed(1)}</span></div>
            <div class="stat-row"><span class="stat-name">Thorns</span><span class="stat-val">${Math.round(s.thornsDamage || 0)}</span></div>
        `;
    }
}

window.InventoryUI = InventoryUI;
