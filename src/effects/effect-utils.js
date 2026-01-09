// Effect utilities - moved to new location
const EffectUtils = {
    additiveKeys: new Set([
        'healOnHitPct',
        'healOnHitFlat',
        'critChanceBonus',
        'freezeOnHitChance',
        'stunOnHitChance',
        'projectileCount',
        'shockOnHitChance',
        'fearOnHitChance',
        'vulnerabilityOnHitChance',
        'maelstromChance',
        'pullStrength',
        'splitCount',
        'healingToShieldConversion',
        'reflectDamagePct',
        'timeSlowOnKill',
        'damagePerLevel',
        'reviveOnDeath',
        'chainJumps',
        'critDamageToCritChance',
        'statusDurationBonus',
        'elementalMastery',
        'multiStatusDmgAmp',
        'dmgPerDot',
        'cdPerDot',
        'burnOnHitPctTotal',
        'burnOnHitPctPerTick',
        'burnDuration',
        'poisonOnHitPctTotal',
        'poisonOnHitPctPerTick',
        'poisonDuration',
        'slowDuration',
        'freezeDuration',
        'stunDuration',
        'shockDuration',
        'shockDamageTakenMult',
        'fearDuration',
        'vulnerabilityDuration',
        'vulnerabilityReduction',
        'damageVsPoisonedMult',
        'damageVsBurningMult',
        'damageVsFrozenMult',
        'damageVsSlowedMult',
        'damageVsStunnedMult',
        'echoChance',
        'echoDamageMult'
    ]),

    defaults: {
        ignoreResistance: false,

        healOnHitPct: 0,
        healOnHitFlat: 0,
        critChanceBonus: 0,
        // Multiplier to weapon crit chance (1.0 => no change)
        critChanceMult: 1,
        freezeOnHitChance: 0,
        stunOnHitChance: 0,
        projectileCount: 0,

        burnOnHitPctTotal: 0,
        burnOnHitPctPerTick: 0,

        poisonOnHitPctTotal: 0,
        poisonOnHitPctPerTick: 0,

        slowOnHitMult: 0,
        slowDuration: 0,

        chainJumps: 0,
        chainRange: 0,
        chainDamageMult: 0,

        critDamageMult: 0,
        
        // Elementalist effects
        statusDurationBonus: 0,
        elementalMastery: 1, // Default multiplier
        multiStatusDmgAmp: 0,
        statusThreshold: 0,
        explodeOnDeath: false,
        explosionRadius: 0,
        explosionDamagePct: 0,
        dotStatScaling: false,
        dmgPerDot: 0,
        cdPerDot: 0,
        acceleratedDots: 1, // Default multiplier
        innateElements: false,
        randomElementOnCrit: false,

        executeBelowPct: 0,
        executeDamageMult: 0,

        knockbackOnHitBonus: 0,
        freezeDuration: 0,
        stunDuration: 0,
        shatterVsFrozenMult: 0,

        // New status effects
        shockOnHitChance: 0,
        shockDuration: 0,
        shockDamageTakenMult: 0,

        fearOnHitChance: 0,
        fearDuration: 0,

        vulnerabilityOnHitChance: 0,
        vulnerabilityDuration: 0,
        vulnerabilityReduction: 0,

        // Synergy-driven multipliers (0 => inactive)
        damageVsPoisonedMult: 0,
        damageVsBurningMult: 0,
        damageVsFrozenMult: 0,
        damageVsSlowedMult: 0,
        damageVsStunnedMult: 0,

        // Orbital build tuning (synergies may set these)
        orbitalCountBonus: 0,
        orbitalLifeMult: 1,

        // New Legendary Effects
        pullStrength: 0,
        splitOnHit: false,
        splitCount: 0,
        splitDamageMult: 0,
        healingToShieldConversion: 0,
        reflectDamagePct: 0,
        timeSlowOnKill: 0,
        timeSlowDuration: 0,
        damagePerLevel: 0,
        reviveOnDeath: 0,
        reviveHealthPct: 0,
        critDamageToCritChance: 0,

        // Echo affix
        echoChance: 0,
        echoDamageMult: 0
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

            if (k === 'slowOnHitMult') {
                const current = (into[k] === 0 || into[k] === undefined) ? 1 : into[k];
                const incoming = (v === 0) ? 1 : v;
                
                const result = current * incoming;
                if (result < 1) into[k] = result;
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

    clampEffects(fx) {
        if (!fx) return;
        const CAPS = GameConstants.STATUS_CAPS;
        if (!CAPS) return;

        const capMax = (key, max) => {
            if (fx[key] > max) fx[key] = max;
        };
        
        const durKeys = [
            'burnDuration', 'poisonDuration', 'slowDuration', 
            'freezeDuration', 'stunDuration', 'shockDuration', 
            'fearDuration', 'vulnerabilityDuration'
        ];
        durKeys.forEach(k => capMax(k, CAPS.MAX_DURATION));

        capMax('burnOnHitPctPerTick', CAPS.MAX_DOT_PCT_PER_TICK);
        capMax('poisonOnHitPctPerTick', CAPS.MAX_DOT_PCT_PER_TICK);
        capMax('shockDamageTakenMult', CAPS.MAX_SHOCK_DMG_MULT);
        capMax('vulnerabilityReduction', CAPS.MAX_RESIST_REDUCTION);

        const chanceKeys = [
            'freezeOnHitChance', 'stunOnHitChance', 
            'shockOnHitChance', 'fearOnHitChance', 
            'vulnerabilityOnHitChance'
        ];
        chanceKeys.forEach(k => capMax(k, CAPS.MAX_CC_CHANCE));

        if (fx.slowOnHitMult > 0 && fx.slowOnHitMult < CAPS.MIN_SLOW_MULT) {
            fx.slowOnHitMult = CAPS.MIN_SLOW_MULT;
        }
    },

    describeEffect(fx) {
        if (!fx) return [];
        const lines = [];
        const num = (k) => Number(fx[k]) || 0;
        
        if (num('healOnHitPct') > 0) lines.push(`Heal ${(num('healOnHitPct') * 100).toFixed(1)}% on hit`);
        if (num('healOnHitFlat') > 0) lines.push(`Heal +${num('healOnHitFlat').toFixed(2)} on hit`);
        if (num('burnOnHitPctPerTick') > 0) lines.push(`Burn ${(num('burnOnHitPctPerTick') * 100).toFixed(2)}% per tick`);
        else if (num('burnOnHitPctTotal') > 0) lines.push(`Burn ${(num('burnOnHitPctTotal') * 100).toFixed(0)}% over time`);
        if (num('poisonOnHitPctPerTick') > 0) lines.push(`Poison ${(num('poisonOnHitPctPerTick') * 100).toFixed(2)}% per tick`);
        else if (num('poisonOnHitPctTotal') > 0) lines.push(`Poison ${(num('poisonOnHitPctTotal') * 100).toFixed(0)}% over time`);
        if (num('slowOnHitMult') > 0) lines.push(`Slow on hit to ${(num('slowOnHitMult') * 100).toFixed(0)}%`);
        if (num('freezeOnHitChance') > 0) lines.push(`Freeze chance ${(num('freezeOnHitChance') * 100).toFixed(0)}%`);
        if (num('stunOnHitChance') > 0) lines.push(`Stun chance ${(num('stunOnHitChance') * 100).toFixed(0)}%`);
        if (num('chainJumps') > 0) lines.push(`Chains to ${Math.floor(num('chainJumps'))} extra targets`);
        if (num('reviveOnDeath') > 0) lines.push(`Extra Lives: +${Math.floor(num('reviveOnDeath'))}`);
        if (num('executeBelowPct') > 0) lines.push(`Execute below ${(num('executeBelowPct') * 100).toFixed(0)}% HP`);
        if (num('shatterVsFrozenMult') > 0) lines.push(`Bonus vs Frozen x${num('shatterVsFrozenMult').toFixed(2)}`);
        if (fx.ignoreResistance) lines.push(`Ignores resistance`);
        
        return lines;
    }
};
