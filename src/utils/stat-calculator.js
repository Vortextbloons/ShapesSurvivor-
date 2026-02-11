// Layered stat calculation utility.
// - Layer 0 is always the base layer (flat sum).
// - Other layers are numeric and intentionally unlabeled.
// - Within a layer, values are summed.
// - Across layers, layer totals multiply each other.

(function () {
    const BASE_LAYER = 0;

    function toNumber(v, def = 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    }

    class Stat {
        constructor(baseValue = 0) {
            this._baseValue = toNumber(baseValue, 0);
            this._layers = [];
            this._ensureLayer(BASE_LAYER);
            this._layers[BASE_LAYER].sum += this._baseValue;
            
            this._cachedValue = null;
            this._cachedBreakdown = null;
            this._dirty = true;
        }

        setBaseValue(baseValue) {
            const newVal = toNumber(baseValue, 0);
            if (this._baseValue === newVal) return;
            
            this._baseValue = newVal;
            this._ensureLayer(BASE_LAYER);
            this._layers[BASE_LAYER] = {
                sum: this._baseValue,
                entries: [{ layer: BASE_LAYER, value: this._baseValue, source: 'base', stat: null }]
            };
            this._dirty = true;
        }

        resetToBase(baseValue) {
            if (baseValue !== undefined) this._baseValue = toNumber(baseValue, 0);
            this._layers = [];
            this._ensureLayer(BASE_LAYER);
            this._layers[BASE_LAYER] = {
                sum: this._baseValue,
                entries: [{ layer: BASE_LAYER, value: this._baseValue, source: 'base', stat: null }]
            };
            this._dirty = true;
        }

        _ensureLayer(layer) {
            const idx = Math.max(0, Math.floor(toNumber(layer, 0)));
            while (this._layers.length <= idx) {
                this._layers.push({ sum: 0, entries: [] });
            }
            return idx;
        }

        addModifier({ layer = 1, value = 0, source, stat, name } = {}) {
            const idx = this._ensureLayer(layer);
            const v = toNumber(value, 0);
            this._layers[idx].sum += v;
            this._layers[idx].entries.push({ layer: idx, value: v, source, stat, name });
            this._dirty = true;
        }

        calculate() {
            if (!this._dirty && this._cachedValue !== null) return this._cachedValue;

            let current = 1;
            for (let i = 0; i < this._layers.length; i++) {
                const layer = this._layers[i];
                if (!layer) continue;
                const sum = toNumber(layer.sum, 0);
                const hasEntries = (layer.entries && layer.entries.length > 0);
                
                let layerValue = 1;
                if (i === BASE_LAYER) {
                    layerValue = sum;
                } else if (hasEntries) {
                    // Correction for additive multipliers (assuming 1.X format)
                    layerValue = 1 + (sum - layer.entries.length);
                }
                
                current *= layerValue;
            }
            
            this._cachedValue = current;
            return current;
        }

        getBreakdown() {
            if (!this._dirty && this._cachedBreakdown !== null) return this._cachedBreakdown;

            const finalVal = this.calculate();
            const out = [];
            let current = 1;

            for (let i = 0; i < this._layers.length; i++) {
                const layer = this._layers[i];
                if (!layer) continue;

                const sum = toNumber(layer.sum, 0);
                const hasEntries = (layer.entries && layer.entries.length > 0);
                
                let layerValue = 1;
                if (i === BASE_LAYER) {
                    layerValue = sum;
                } else if (hasEntries) {
                    layerValue = 1 + (sum - layer.entries.length);
                }

                const end = current * layerValue;

                out.push({
                    layer: i,
                    isBase: i === BASE_LAYER,
                    start: current,
                    sum,
                    layerValue,
                    end,
                    entries: layer.entries?.slice() || []
                });

                current = end;
            }

            this._cachedBreakdown = { final: finalVal, layers: out };
            this._dirty = false;
            return this._cachedBreakdown;
        }
    }

    function calculateTurretStats(player, inheritanceMult = 0.5) {
        const turretStats = {};
        
        // Damage (Inheritance applies only here)
        let baseDamage = 5;
        if (player.equipment?.weapon && player.getEffectiveItemStat) {
            baseDamage = player.getEffectiveItemStat(player.equipment.weapon, 'baseDamage', 5);
        }
        turretStats.damage = baseDamage * (player.stats.damage || 0) * inheritanceMult;
        
        // Attack Speed (100% inheritance)
        const playerCd = player.stats.cooldownReduction || 1;
        turretStats.cooldownReduction = playerCd;

        // Crit Chance (100% inheritance)
        const playerCritChance = player.stats.critChance || (player.getEffectiveCritChance ? player.getEffectiveCritChance() : 0);
        turretStats.critChance = playerCritChance;

        // Pierce (100% inheritance)
        let pierce = 0;
        if (player.equipment?.weapon && player.getEffectiveItemStat) {
            pierce = player.getEffectiveItemStat(player.equipment.weapon, 'pierce', 0);
        }
        turretStats.pierce = Math.floor(pierce);

        // Knockback (100% inheritance)
        let knockback = 0;
        if (player.equipment?.weapon && player.getEffectiveItemStat) {
            knockback = player.getEffectiveItemStat(player.equipment.weapon, 'knockback', 0);
        }
        turretStats.knockback = knockback;

        // Crit Damage (100% inheritance)
        // Prefer 'critDamage' which corresponds to the multiplier (e.g., 1.5, 2.0)
        let playerCritDamage = 1.5;
        if (player.stats.critDamage) {
            playerCritDamage = player.stats.critDamage;
        } else if (player.getBaseCritDamageMult) {
             playerCritDamage = player.getBaseCritDamageMult(player.equipment.weapon);
             if (player.effects.critDamageMult && player.effects.critDamageMult > 0) {
                 playerCritDamage = Math.max(playerCritDamage, player.effects.critDamageMult);
             }
        }
        turretStats.critDamage = playerCritDamage;

        return turretStats;
    }

    window.StatCalculator = {
        BASE_LAYER,
        Stat,
        calculateTurretStats
    };
})();

