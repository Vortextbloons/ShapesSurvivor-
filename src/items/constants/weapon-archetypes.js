// Weapon archetype definitions with stat pools and behavior weights

function statPoolEntry(stat, range, opts) {
    const o = opts || {};
    const entry = { stat, range, op: o.op || 'add' };
    if (o.integer) entry.integer = true;
    if (o.noRarityScale) entry.noRarityScale = true;
    return entry;
}

const WeaponArchetypes = {
    wand: {
        id: 'wand',
        noun: 'Wand',
        family: 'arcane',
        tags: ['projectile', 'precision'],
        baseCritChance: 0.1,
        baseCritDamageMult: 2.00,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [6, 12]),
                statPoolEntry('cooldown', [28, 45], { integer: true }),
                statPoolEntry('projSpeed', [8, 12], { noRarityScale: true }),
                statPoolEntry('projectileCount', [1, 2], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [1, 3], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [1, 5], { noRarityScale: true })
            ]
        }
    },
    hatchet: {
        id: 'hatchet',
        noun: 'Hatchet',
        family: 'brutal',
        tags: ['projectile', 'knockback'],
        baseCritChance: 0.25,
        baseCritDamageMult: 1.85,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [20, 30]),
                statPoolEntry('cooldown', [45, 70], { integer: true }),
                statPoolEntry('projSpeed', [6, 9], { noRarityScale: true }),
                statPoolEntry('projectileCount', [1, 2], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [1, 5], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [5, 10], { noRarityScale: true })
            ]
        }
    },
    axe: {
        id: 'axe',
        noun: 'Axe',
        family: 'execution',
        tags: ['projectile', 'burst'],
        baseCritChance: 0.15,
        baseCritDamageMult: 3,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [40, 60]),
                statPoolEntry('cooldown', [60, 75], { integer: true }),
                statPoolEntry('projSpeed', [5, 7], { noRarityScale: true }),
                statPoolEntry('projectileCount', [1, 2], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [1, 8], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [10, 25], { noRarityScale: true })
            ]
        }
    },
    scepter: {
        id: 'scepter',
        noun: 'Scepter',
        family: 'storm',
        tags: ['projectile', 'aoe'],
        baseCritChance: 0.05,
        baseCritDamageMult: 1.5,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [9, 15]),
                statPoolEntry('cooldown', [10, 20], { integer: true }),
                statPoolEntry('projSpeed', [6, 9], { noRarityScale: true }),
                statPoolEntry('projectileCount', [1, 3], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [0, 4], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [2, 5], { noRarityScale: true })
            ]
        }
    },
    dagger: {
        id: 'dagger',
        noun: 'Dagger',
        family: 'precision',
        tags: ['projectile', 'crit'],
        baseCritChance: 0.35,
        baseCritDamageMult: 2.5,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [8, 20]),
                statPoolEntry('cooldown', [25, 30], { integer: true }),
                statPoolEntry('projSpeed', [7, 11], { noRarityScale: true }),
                statPoolEntry('projectileCount', [1, 4], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [0, 1], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [4, 8], { noRarityScale: true })
            ]
        }
    },
    talisman: {
        id: 'talisman',
        noun: 'Talisman',
        family: 'frost',
        tags: ['projectile', 'control'],
        baseCritChance: 0.10,
        baseCritDamageMult: 1.75,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [10, 20]),
                statPoolEntry('cooldown', [35, 50], { integer: true }),
                statPoolEntry('projSpeed', [5, 8], { noRarityScale: true }),
                statPoolEntry('projectileCount', [1, 2], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [0, 5], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [0, 3], { noRarityScale: true })
            ]
        }
    },
    relic: {
        id: 'relic',
        noun: 'Relic',
        family: 'plague',
        tags: ['projectile', 'dot'],
        baseCritChance: 0.2,
        baseCritDamageMult: 2,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [5, 35]),
                statPoolEntry('cooldown', [35, 80], { integer: true }),
                statPoolEntry('projSpeed', [5, 20], { noRarityScale: true }),
                statPoolEntry('projectileCount', [1, 4], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [0, 4], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [0, 10], { noRarityScale: true })
            ]
            
        }
    },

    // Dedicated aura-only weapons (aura is no longer a random behavior roll on normal weapons).
    ember_lantern: {
        id: 'ember_lantern',
        noun: 'Lantern',
        family: 'inferno',
        tags: ['aura', 'burn'],
        baseCritChance: 0.08,
        baseCritDamageMult: 1.8,
        weights: { [BehaviorType.AURA]: 1.0, [BehaviorType.PROJECTILE]: 0, [BehaviorType.ORBITAL]: 0 },
        aura: {
            required: ['baseDamage', 'cooldown', 'areaOfEffect'],
            pool: [
                statPoolEntry('baseDamage', [9, 14]),
                statPoolEntry('cooldown', [45, 60], { integer: true }),
                statPoolEntry('areaOfEffect', [50, 70], { noRarityScale: true }),
                statPoolEntry('knockback', [0, 2], { noRarityScale: true })
            ]
        }
    },
    frost_censer: {
        id: 'frost_censer',
        noun: 'Censer',
        family: 'frost',
        tags: ['aura', 'control'],
        baseCritChance: 0.08,
        baseCritDamageMult: 3.0,
        weights: { [BehaviorType.AURA]: 1.0, [BehaviorType.PROJECTILE]: 0, [BehaviorType.ORBITAL]: 0 },
        aura: {
            required: ['baseDamage', 'cooldown', 'areaOfEffect'],
            pool: [
                statPoolEntry('baseDamage', [5, 10]),
                statPoolEntry('cooldown', [60, 85], { integer: true }),
                statPoolEntry('areaOfEffect', [60, 70], { noRarityScale: true }),
                statPoolEntry('knockback', [0, 1], { noRarityScale: true })
            ]
        }
    },
    storm_totem: {
        id: 'storm_totem',
        noun: 'Totem',
        family: 'storm',
        tags: ['aura', 'aoe'],
        baseCritChance: 0.25,
        baseCritDamageMult: 2,
        weights: { [BehaviorType.AURA]: 1.0, [BehaviorType.PROJECTILE]: 0, [BehaviorType.ORBITAL]: 0 },
        aura: {
            required: ['baseDamage', 'cooldown', 'areaOfEffect'],
            pool: [
                statPoolEntry('baseDamage', [7, 12]),
                statPoolEntry('cooldown', [60, 85], { integer: true }),
                statPoolEntry('areaOfEffect', [40, 50], { noRarityScale: true }),
                statPoolEntry('knockback', [1, 4], { noRarityScale: true })
            ]
        }
    }
};

function pickWeaponArchetype() {
    const keys = Object.keys(WeaponArchetypes);
    return WeaponArchetypes[randomFrom(keys)];
}

function rollBehaviorFromWeights(weights) {
    const entries = Object.entries(weights || {});
    if (!entries.length) return BehaviorType.PROJECTILE;
    const total = entries.reduce((acc, [, w]) => acc + Math.max(0, w), 0);
    if (total <= 0) return BehaviorType.PROJECTILE;
    let r = Math.random() * total;
    for (const [behavior, w] of entries) {
        r -= Math.max(0, w);
        if (r <= 0) return behavior;
    }
    return entries[entries.length - 1][0];
}
