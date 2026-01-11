// Layered stat calculation utility.
// - Layer 0 is always the base layer.
// - Other layers are numeric and intentionally unlabeled.
// - Within a layer, multipliers are additive (two +10% => +20%).
// - Across layers, results are applied sequentially.

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
            this._layers[BASE_LAYER].add += this._baseValue;
            
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
                add: this._baseValue,
                mult: 0,
                entries: [{ layer: BASE_LAYER, operation: 'add', value: this._baseValue, source: 'base', stat: null }]
            };
            this._dirty = true;
        }

        resetToBase(baseValue) {
            if (baseValue !== undefined) this._baseValue = toNumber(baseValue, 0);
            this._layers = [];
            this._ensureLayer(BASE_LAYER);
            this._layers[BASE_LAYER] = {
                add: this._baseValue,
                mult: 0,
                entries: [{ layer: BASE_LAYER, operation: 'add', value: this._baseValue, source: 'base', stat: null }]
            };
            this._dirty = true;
        }

        _ensureLayer(layer) {
            const idx = Math.max(0, Math.floor(toNumber(layer, 0)));
            while (this._layers.length <= idx) {
                this._layers.push({ add: 0, mult: 0, entries: [] });
            }
            return idx;
        }

        addModifier({ layer = 1, operation = 'add', value = 0, source, stat, name } = {}) {
            const idx = this._ensureLayer(layer);
            const v = toNumber(value, 0);
            this._layers[idx][operation === 'multiply' ? 'mult' : 'add'] += v;
            this._layers[idx].entries.push({ layer: idx, operation, value: v, source, stat, name });
            this._dirty = true;
        }

        calculate() {
            if (!this._dirty && this._cachedValue !== null) return this._cachedValue;

            let current = 0;
            for (const layer of this._layers) {
                if (!layer) continue;
                current = (current + (layer.add || 0)) * Math.max(0, 1 + (layer.mult || 0));
            }
            
            this._cachedValue = current;
            return current;
        }

        getBreakdown() {
            if (!this._dirty && this._cachedBreakdown !== null) return this._cachedBreakdown;

            const finalVal = this.calculate();
            const out = [];
            let current = 0;

            for (let i = 0; i < this._layers.length; i++) {
                const layer = this._layers[i];
                if (!layer) continue;

                const add = toNumber(layer.add, 0);
                const multSum = toNumber(layer.mult, 0);
                const afterAdd = current + add;
                const mult = Math.max(0, 1 + multSum);
                const end = afterAdd * mult;

                out.push({
                    layer: i,
                    isBase: i === BASE_LAYER,
                    start: current,
                    add,
                    multSum,
                    mult,
                    afterAdd,
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
        const playerCd = player.stats.cooldownMult || 1;
        turretStats.cooldownMult = playerCd;

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
