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
        }

        setBaseValue(baseValue) {
            this._baseValue = toNumber(baseValue, 0);
            this._ensureLayer(BASE_LAYER);
            // Reset base layer to the new base value.
            this._layers[BASE_LAYER].add = this._baseValue;
            this._layers[BASE_LAYER].mult = 0;
            this._layers[BASE_LAYER].entries = [
                { layer: BASE_LAYER, operation: 'add', value: this._baseValue, source: 'base', stat: null }
            ];
        }

        resetToBase(baseValue = undefined) {
            if (baseValue !== undefined) this._baseValue = toNumber(baseValue, 0);
            this._layers = [];
            this._ensureLayer(BASE_LAYER);
            this._layers[BASE_LAYER].add = this._baseValue;
            this._layers[BASE_LAYER].mult = 0;
            this._layers[BASE_LAYER].entries = [
                { layer: BASE_LAYER, operation: 'add', value: this._baseValue, source: 'base', stat: null }
            ];
        }

        _ensureLayer(layer) {
            const idx = Math.max(0, Math.floor(toNumber(layer, 0)));
            while (this._layers.length <= idx) {
                this._layers.push({ add: 0, mult: 0, entries: [] });
            }
            return idx;
        }

        addModifier({ layer = 1, operation = 'add', value = 0, source = undefined, stat = undefined, name = undefined } = {}) {
            const idx = this._ensureLayer(layer);
            const v = toNumber(value, 0);

            if (operation === 'multiply') {
                this._layers[idx].mult += v;
            } else {
                this._layers[idx].add += v;
            }

            this._layers[idx].entries.push({ layer: idx, operation, value: v, source, stat, name });
        }

        calculate() {
            let current = 0;
            for (let i = 0; i < this._layers.length; i++) {
                const layer = this._layers[i];
                if (!layer) continue;

                const before = current;
                const afterAdd = before + (layer.add || 0);
                const mult = Math.max(0, 1 + (layer.mult || 0));
                current = afterAdd * mult;
            }
            return current;
        }

        getBreakdown() {
            const out = [];
            let current = 0;

            for (let i = 0; i < this._layers.length; i++) {
                const layer = this._layers[i];
                if (!layer) continue;

                const start = current;
                const add = toNumber(layer.add, 0);
                const multSum = toNumber(layer.mult, 0);
                const afterAdd = start + add;
                const mult = Math.max(0, 1 + multSum);
                const end = afterAdd * mult;

                out.push({
                    layer: i,
                    isBase: i === BASE_LAYER,
                    start,
                    add,
                    multSum,
                    mult,
                    afterAdd,
                    end,
                    entries: Array.isArray(layer.entries) ? layer.entries.slice() : []
                });

                current = end;
            }

            return {
                final: current,
                layers: out
            };
        }
    }

    function calculateTurretStats(player, inheritanceMult = 0.5) {
        const turretStats = {};
        
        // Damage
        turretStats.damage = (player.stats.damage || 0) * inheritanceMult;
        
        // Attack Speed (Cooldown Mult)
        // Player AS = 1 / cooldownMult.
        // Turret AS = 1 + (Player AS - 1) * inheritanceMult.
        // Turret CooldownMult = 1 / Turret AS.
        const playerCd = player.stats.cooldownMult || 1;
        const playerAS = 1 / Math.max(0.01, playerCd);
        const turretAS = 1 + (playerAS - 1) * inheritanceMult;
        turretStats.cooldownMult = 1 / Math.max(0.01, turretAS);

        // Crit Chance
        const playerCritChance = player.getEffectiveCritChance ? player.getEffectiveCritChance() : 0;
        turretStats.critChance = playerCritChance * inheritanceMult;

        // Crit Damage
        let playerCritDamage = 1.5;
        if (player.getBaseCritDamageMult) {
             playerCritDamage = player.getBaseCritDamageMult(player.equipment.weapon);
             if (player.effects.critDamageMult && player.effects.critDamageMult > 0) {
                 playerCritDamage = Math.max(playerCritDamage, player.effects.critDamageMult);
             }
        }
        turretStats.critDamage = playerCritDamage * inheritanceMult;

        return turretStats;
    }

    window.StatCalculator = {
        BASE_LAYER,
        Stat,
        calculateTurretStats
    };
})();
