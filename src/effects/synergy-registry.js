// Data-driven synergy definitions - moved to effects folder
const SynergyRegistry = {
    // IMPORTANT: ordering is intentional to preserve current behavior.
    list: [
        {
            id: 'frostbreak',
            name: 'Frostbreak',
            isActive: (ctx) => ctx.flags.hasFreeze && ctx.flags.hasShatter,
            apply: (ctx) => {
                const p = ctx.player;
                p.effects.shatterVsFrozenMult = Math.max(p.effects.shatterVsFrozenMult || 0, 1.50);
                p.effects.damageVsFrozenMult = Math.max(p.effects.damageVsFrozenMult || 0, 1.15);
                p.effects.freezeDuration = Math.max(p.effects.freezeDuration || 0, 85);
            }
        },
        {
            id: 'plaguefire',
            name: 'Plaguefire',
            isActive: (ctx) => ctx.flags.hasPoison && ctx.flags.hasBurn,
            apply: (ctx) => {
                const p = ctx.player;
                p.effects.damageVsPoisonedMult = Math.max(p.effects.damageVsPoisonedMult || 0, 1.12);
                p.effects.damageVsBurningMult = Math.max(p.effects.damageVsBurningMult || 0, 1.12);
            }
        },
        {
            id: 'stormweaver',
            name: 'Stormweaver',
            isActive: (ctx) => ctx.flags.hasChain && (ctx.flags.hasPoison || ctx.flags.hasBurn),
            apply: (ctx) => {
                const p = ctx.player;
                p.effects.chainJumps = Math.max(0, (p.effects.chainJumps || 0)) + 1;
                const bumped = Math.min(0.85, (p.effects.chainDamageMult || 0) + 0.08);
                p.effects.chainDamageMult = Math.max(p.effects.chainDamageMult || 0, bumped);
            }
        },
        {
            id: 'relic_convergence',
            name: 'Relic Convergence',
            isActive: (ctx) => (ctx.artifactCount || 0) >= 3,
            apply: (ctx) => {
                const p = ctx.player;
                p.effects.healOnHitPct += 0.006;
                p.effects.critChanceBonus += 0.02;
            }
        },
        {
            id: 'cursed_might',
            name: 'Cursed Might',
            isActive: (ctx) => (ctx.cursedCount || 0) >= 1,
            apply: (ctx) => {
                const p = ctx.player;
                const cursedCount = ctx.cursedCount || 0;
                const dmgBonus = Math.min(0.12, cursedCount * 0.04);
                p.stats.damage *= (1 + dmgBonus);
                p.stats.damageTakenMult *= (1 + Math.min(0.09, cursedCount * 0.03));
            }
        },
        {
            id: 'orbital_guard',
            name: 'Orbital Guard',
            isActive: (ctx) => ctx.flags.isOrbitalWeapon && (ctx.flags.hasSlow || ctx.flags.hasStun || ctx.flags.hasFreeze),
            apply: (ctx) => {
                const p = ctx.player;
                p.stats.damageTakenMult *= 0.95;
                p.effects.knockbackOnHitBonus = Math.max(p.effects.knockbackOnHitBonus || 0, 1.0);
            }
        },
        {
            id: 'cryo_lock',
            name: 'Cryo Lock',
            isActive: (ctx) => ctx.flags.hasFreeze && ctx.flags.hasStun,
            apply: (ctx) => {
                const p = ctx.player;
                p.effects.damageVsFrozenMult = Math.max(p.effects.damageVsFrozenMult || 0, 1.10);
                p.effects.damageVsStunnedMult = Math.max(p.effects.damageVsStunnedMult || 0, 1.10);
                p.effects.stunOnHitChance += 0.03;
            }
        },
        {
            id: 'venom_harvest',
            name: 'Venom Harvest',
            isActive: (ctx) => ctx.flags.hasPoison && ctx.flags.hasLeech,
            apply: (ctx) => {
                const p = ctx.player;
                p.effects.healOnHitFlat += 0.20;
                p.effects.damageVsPoisonedMult = Math.max(p.effects.damageVsPoisonedMult || 0, 1.08);
            }
        },
        {
            id: 'predators_mark',
            name: "Predator's Mark",
            isActive: (ctx) => (ctx.player.effects.critChanceBonus || 0) >= 0.08 && ctx.flags.hasExecute,
            apply: (ctx) => {
                const p = ctx.player;
                p.effects.executeBelowPct = Math.max(p.effects.executeBelowPct || 0, 0.18);
                p.effects.critDamageMult = Math.max(p.effects.critDamageMult || 0, 2.20);
            }
        },
        {
            id: 'overclocked_arsenal',
            name: 'Overclocked Arsenal',
            isActive: (ctx) => {
                const weapon = ctx.weapon;
                if (!weapon) return false;
                const weaponCooldown = ctx.weaponCooldown;
                const weaponProjectileCount = ctx.weaponProjectileCount;
                const cdMult = (ctx.player.stats.cooldownMult || 1);
                return weaponCooldown <= 65 && cdMult <= 0.92 && (weaponProjectileCount >= 2 || ctx.flags.hasChain);
            },
            apply: (ctx) => {
                const p = ctx.player;
                p.stats.cooldownMult *= 0.97;
                p.effects.chainRange = Math.max(p.effects.chainRange || 0, (p.effects.chainRange || 0) + 20);
            }
        },
        {
            id: 'orbital_swarm',
            name: 'Orbital Swarm',
            isActive: (ctx) => ctx.flags.isOrbitalWeapon && (ctx.weaponProjectileCount || 1) >= 2,
            apply: (ctx) => {
                const p = ctx.player;
                p.effects.orbitalCountBonus = Math.max(p.effects.orbitalCountBonus || 0, 1);
                p.effects.orbitalLifeMult = Math.max(p.effects.orbitalLifeMult || 1, 1.25);
            }
        },
        {
            id: 'control_matrix',
            name: 'Control Matrix',
            isActive: (ctx) => ctx.flags.hasSlow && (ctx.flags.hasFreeze || ctx.flags.hasStun),
            apply: (ctx) => {
                const p = ctx.player;
                p.effects.damageVsSlowedMult = Math.max(p.effects.damageVsSlowedMult || 0, 1.12);
                p.effects.slowDuration = Math.max(p.effects.slowDuration || 0, 120);
            }
        }
    ],

    apply(ctx) {
        if (!ctx || typeof ctx.activate !== 'function') return;
        for (const s of this.list) {
            if (!s || typeof s.isActive !== 'function' || typeof s.apply !== 'function') continue;
            if (!s.isActive(ctx)) continue;
            ctx.activate(s.id, s.name);
            s.apply(ctx);
        }
    }
};
