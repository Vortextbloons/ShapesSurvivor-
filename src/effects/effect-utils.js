// Effect utilities - moved to new location
const EffectUtils = {
    additiveKeys: new Set([
        'healOnHitPct',
        'healOnHitFlat',
        'critChanceBonus',
        'freezeOnHitChance',
        'stunOnHitChance'
    ]),

    defaults: {
        ignoreResistance: false,

        healOnHitPct: 0,
        healOnHitFlat: 0,
        critChanceBonus: 0,
        freezeOnHitChance: 0,
        stunOnHitChance: 0,

        burnOnHitPctTotal: 0,
        burnDuration: 0,
        burnTickEvery: 0,

        poisonOnHitPctTotal: 0,
        poisonDuration: 0,
        poisonTickEvery: 0,

        slowOnHitMult: 0,
        slowDuration: 0,

        chainJumps: 0,
        chainRange: 0,
        chainDamageMult: 0,

        critDamageMult: 0,
        executeBelowPct: 0,
        executeDamageMult: 0,

        knockbackOnHitBonus: 0,
        freezeDuration: 0,
        stunDuration: 0,
        shatterVsFrozenMult: 0,

        // Synergy-driven multipliers (0 => inactive)
        damageVsPoisonedMult: 0,
        damageVsBurningMult: 0,
        damageVsFrozenMult: 0,
        damageVsSlowedMult: 0,
        damageVsStunnedMult: 0,

        // Orbital build tuning (synergies may set these)
        orbitalCountBonus: 0,
        orbitalLifeMult: 1
    },

    createDefaultEffects() {
        // Primitives only, so shallow copy is enough.
        return { ...this.defaults };
    },

    mergeEffects(into, from) {
        if (!into || !from) return into;

        for (const [k, v] of Object.entries(from)) {
            if (v === undefined || v === null) continue;

            if (k === 'ignoreResistance') {
                if (v) into.ignoreResistance = true;
                continue;
            }

            if (typeof v === 'number') {
                if (this.additiveKeys.has(k)) into[k] = (into[k] || 0) + v;
                else into[k] = Math.max(into[k] ?? 0, v);
                continue;
            }

            // Fallback for any future non-numeric fields.
            into[k] = v;
        }

        return into;
    },

    describeEffect(fx) {
        if (!fx) return [];
        const lines = [];
        const num = (k) => Number(fx[k]) || 0;
        
        if (num('healOnHitPct') > 0) lines.push(`Heal ${(num('healOnHitPct') * 100).toFixed(1)}% on hit`);
        if (num('healOnHitFlat') > 0) lines.push(`Heal +${num('healOnHitFlat').toFixed(2)} on hit`);
        if (num('burnOnHitPctTotal') > 0) lines.push(`Burn ${(num('burnOnHitPctTotal') * 100).toFixed(0)}% over time`);
        if (num('poisonOnHitPctTotal') > 0) lines.push(`Poison ${(num('poisonOnHitPctTotal') * 100).toFixed(0)}% over time`);
        if (num('slowOnHitMult') > 0) lines.push(`Slow on hit to ${(num('slowOnHitMult') * 100).toFixed(0)}%`);
        if (num('freezeOnHitChance') > 0) lines.push(`Freeze chance ${(num('freezeOnHitChance') * 100).toFixed(0)}%`);
        if (num('stunOnHitChance') > 0) lines.push(`Stun chance ${(num('stunOnHitChance') * 100).toFixed(0)}%`);
        if (num('chainJumps') > 0) lines.push(`Chains to ${Math.floor(num('chainJumps'))} extra targets`);
        if (num('executeBelowPct') > 0) lines.push(`Execute below ${(num('executeBelowPct') * 100).toFixed(0)}% HP`);
        if (num('shatterVsFrozenMult') > 0) lines.push(`Bonus vs Frozen x${num('shatterVsFrozenMult').toFixed(2)}`);
        if (fx.ignoreResistance) lines.push(`Ignores resistance`);
        
        return lines;
    }
};
