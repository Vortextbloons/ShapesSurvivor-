// Effect selection and synergy weighting logic

function getPlayerHasForEffectSteering(player) {
    const pfx = player?.effects || null;
    const pWeapon = player?.equipment?.weapon || null;

    return {
        burn: !!(pfx && (pfx.burnOnHitPctTotal || 0) > 0),
        poison: !!(pfx && (pfx.poisonOnHitPctTotal || 0) > 0),
        freeze: !!(pfx && (pfx.freezeOnHitChance || 0) > 0),
        stun: !!(pfx && (pfx.stunOnHitChance || 0) > 0),
        slow: !!(pfx && (pfx.slowOnHitMult || 0) > 0),
        chain: !!(pfx && (pfx.chainJumps || 0) > 0),
        shatter: !!(pfx && (pfx.shatterVsFrozenMult || 0) > 0),
        leech: !!(pfx && ((pfx.healOnHitPct || 0) > 0 || (pfx.healOnHitFlat || 0) > 0)),
        orbital: !!(pWeapon && pWeapon.behavior === BehaviorType.ORBITAL)
    };
}

function getEffectGives(affix) {
    const e = affix?.effect || {};
    return {
        burn: !!e.burnOnHitPctTotal,
        poison: !!e.poisonOnHitPctTotal,
        freeze: !!e.freezeOnHitChance,
        stun: !!e.stunOnHitChance,
        slow: !!e.slowOnHitMult,
        chain: !!e.chainJumps,
        shatter: !!e.shatterVsFrozenMult,
        leech: !!e.healOnHitPct || !!e.healOnHitFlat,
        ignoreRes: !!e.ignoreResistance
    };
}

function makeEffectWeightFor(playerHas) {
    return (affix) => {
        // Default small randomness.
        let w = 1;
        const gives = getEffectGives(affix);

        // Bias toward completing classic pairs.
        if (playerHas.burn && !playerHas.poison && gives.poison) w *= 2.2;
        if (playerHas.poison && !playerHas.burn && gives.burn) w *= 2.2;

        if (playerHas.freeze && !playerHas.shatter && gives.shatter) w *= 2.0;
        if (playerHas.shatter && !playerHas.freeze && gives.freeze) w *= 2.0;

        // If you're already chaining, nudge toward DOT to power combos.
        if (playerHas.chain && !(playerHas.burn || playerHas.poison) && (gives.burn || gives.poison)) w *= 1.6;

        // Orbital builds like control to stay safe.
        if (playerHas.orbital && !(playerHas.freeze || playerHas.stun || playerHas.slow) && (gives.freeze || gives.stun || gives.slow)) w *= 1.7;

        // Early sustain is valuable.
        if (!playerHas.leech && gives.leech) w *= 1.3;

        // Slightly reduce weighting for redundant picks.
        if (playerHas.burn && gives.burn) w *= 0.85;
        if (playerHas.poison && gives.poison) w *= 0.85;
        if (playerHas.freeze && gives.freeze) w *= 0.90;
        if (playerHas.stun && gives.stun) w *= 0.90;
        if (playerHas.chain && gives.chain) w *= 0.90;
        if (playerHas.shatter && gives.shatter) w *= 0.85;

        // Keep phasing rare-ish (it's very broadly good).
        if (gives.ignoreRes) w *= 0.80;

        return w;
    };
}

function getEffectSlotsForRarity(rarity) {
    if (rarity === Rarity.LEGENDARY) return 2;
    if (rarity === Rarity.EPIC) return 1;
    if (rarity === Rarity.RARE) return 1;
    return 0;
}
