// Data-driven synergy definitions - moved to effects folder
const SynergyRegistry = {
    // IMPORTANT: ordering is intentional to preserve current behavior.
    list: [
        {
            id: 'frostbreak',
            name: 'Frostbreak',
            description: 'Frozen enemies take +15% damage. Shatter vs Frozen +50%. Freeze duration +85f.',
            requirements: {
                allFlags: ['freeze', 'shatter']
            },
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
            description: 'Poisoned/Burning targets take +12% damage (each).',
            requirements: {
                allFlags: ['poison', 'burn']
            },
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
            description: 'Chain lightning gains +1 jump and +8% damage (up to 85%).',
            requirements: {
                allFlags: ['chain'],
                anyFlags: ['poison', 'burn']
            },
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
            description: 'At 3+ artifacts: +0.6% heal-on-hit and +2% crit chance bonus.',
            requirements: {
                minArtifacts: 3
            },
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
            description: 'Per cursed item: damage up (max +12%), damage taken up (max +9%).',
            requirements: {
                minCursed: 1
            },
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
            description: 'Orbital weapon + control (slow/stun/freeze): -5% damage taken and +knockback.',
            requirements: {
                weaponBehavior: 'orbital',
                anyFlags: ['slow', 'stun', 'freeze']
            },
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
            description: 'Freeze + Stun: +10% damage vs Frozen/Stunned and +3% stun-on-hit chance.',
            requirements: {
                allFlags: ['freeze', 'stun']
            },
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
            description: 'Poison + Leech: +0.20 heal on hit and +8% damage vs Poisoned.',
            requirements: {
                allFlags: ['poison', 'leech']
            },
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
            description: 'Crit bonus + Execute: Execute below 18% HP and crit damage becomes x2.20+.',
            requirements: {
                allFlags: ['execute'],
                minCritChanceBonus: 0.08
            },
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
            description: 'Very fast weapons get even faster and chain range increases.',
            requirements: {
                maxWeaponCooldown: 65,
                maxCooldownMult: 0.92,
                any: [
                    { minWeaponProjectiles: 2 },
                    { anyFlags: ['chain'] }
                ]
            },
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
            description: 'Orbital weapon + 2+ orbitals: +1 orbital and +25% orbital lifetime.',
            requirements: {
                weaponBehavior: 'orbital',
                minWeaponProjectiles: 2
            },
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
            description: 'Slow + Freeze/Stun: +12% damage vs Slowed and +120f slow duration.',
            requirements: {
                allFlags: ['slow'],
                anyFlags: ['freeze', 'stun']
            },
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
    },

    getById(id) {
        return this.list.find(s => s && s.id === id) || null;
    },

    _flagLabel(flag) {
        const map = {
            burn: 'Burn',
            poison: 'Poison',
            freeze: 'Freeze',
            stun: 'Stun',
            slow: 'Slow',
            chain: 'Chain',
            shatter: 'Shatter',
            leech: 'Leech',
            execute: 'Execute'
        };
        return map[flag] || flag;
    },

    evaluate(def, ctx) {
        if (!def || !ctx) return { active: false, missing: ['Unknown synergy'], summary: '' };
        const req = def.requirements || {};
        const missing = [];

        const hasFlag = (flag) => {
            if (!flag) return false;
            const k = `has${flag.charAt(0).toUpperCase()}${flag.slice(1)}`;
            return !!ctx?.flags?.[k];
        };

        (req.allFlags || []).forEach(f => {
            if (!hasFlag(f)) missing.push(this._flagLabel(f));
        });

        if (req.anyFlags && req.anyFlags.length) {
            const ok = req.anyFlags.some(f => hasFlag(f));
            if (!ok) missing.push(`One of: ${req.anyFlags.map(f => this._flagLabel(f)).join(' / ')}`);
        }

        if (req.weaponBehavior === 'orbital') {
            if (!ctx?.flags?.isOrbitalWeapon) missing.push('Orbital weapon');
        }

        if (req.minArtifacts !== undefined) {
            const n = Number(ctx?.artifactCount || 0);
            if (n < req.minArtifacts) missing.push(`${req.minArtifacts}+ artifacts`);
        }

        if (req.minCursed !== undefined) {
            const n = Number(ctx?.cursedCount || 0);
            if (n < req.minCursed) missing.push(`${req.minCursed}+ cursed item`);
        }

        if (req.minCritChanceBonus !== undefined) {
            const val = Number(ctx?.player?.effects?.critChanceBonus || 0);
            if (val < req.minCritChanceBonus) missing.push(`Crit bonus ≥ ${(req.minCritChanceBonus * 100).toFixed(0)}%`);
        }

        if (req.maxWeaponCooldown !== undefined) {
            const wc = Number(ctx?.weaponCooldown ?? Infinity);
            if (!(wc <= req.maxWeaponCooldown)) missing.push(`Weapon cooldown ≤ ${req.maxWeaponCooldown}f`);
        }

        if (req.maxCooldownMult !== undefined) {
            const m = Number(ctx?.player?.stats?.cooldownMult ?? 1);
            if (!(m <= req.maxCooldownMult)) missing.push(`Cooldown mult ≤ ${req.maxCooldownMult.toFixed(2)}`);
        }

        if (req.minWeaponProjectiles !== undefined) {
            const n = Number(ctx?.weaponProjectileCount || 1);
            if (n < req.minWeaponProjectiles) missing.push(`${req.minWeaponProjectiles}+ projectiles`);
        }

        // "any" groups (e.g. projectiles OR chain)
        if (req.any && Array.isArray(req.any) && req.any.length) {
            const anyOk = req.any.some(group => {
                const g = group || {};
                const groupMissing = [];
                // reuse logic by evaluating a synthetic def
                const fake = { requirements: g };
                const res = this.evaluate(fake, ctx);
                if (res.missing.length) groupMissing.push(...res.missing);
                return groupMissing.length === 0;
            });
            if (!anyOk) missing.push('One of: multi-projectile / chain');
        }

        const active = (typeof def.isActive === 'function') ? !!def.isActive(ctx) : (missing.length === 0);
        const summary = missing.length ? `Need: ${missing.join(', ')}` : 'Active';
        return { active, missing, summary };
    }
};
