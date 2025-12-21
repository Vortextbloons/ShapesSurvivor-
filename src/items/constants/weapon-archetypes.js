// Weapon archetype definitions with stat pools and behavior weights


const WeaponArchetypes = {
    wand: {
        id: 'wand',
        noun: 'Wand',
        baseCritChance: 0.1,
        baseCritDamageMult: 2.00,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [6, 12]),
                statPoolEntry('cooldown', [35, 50], { integer: true }),
                statPoolEntry('projSpeed', [8, 12]),
                statPoolEntry('projectileCount', [1, 2], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [1, 3], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [1, 5])
            ]
        }
    },
    hatchet: {
        id: 'hatchet',
        noun: 'Hatchet',
        baseCritChance: 0.25,
        baseCritDamageMult: 1.85,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [20, 30]),
                statPoolEntry('cooldown', [55, 80], { integer: true }),
                statPoolEntry('projSpeed', [6, 9]),
                statPoolEntry('projectileCount', [1, 2], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [1, 5], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [5, 10])
            ]
        }
    },
    axe: {
        id: 'axe',
        noun: 'Axe',
        baseCritChance: 0.15,
        baseCritDamageMult: 2.5,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [40, 60]),
                statPoolEntry('cooldown', [90, 100], { integer: true }),
                statPoolEntry('projSpeed', [5, 7]),
                statPoolEntry('projectileCount', [1, 2], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [2, 5], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [10, 25])
            ]
        }
    },
    scepter: {
        id: 'scepter',
        noun: 'Scepter',
        baseCritChance: 0.05,
        baseCritDamageMult: 1.5,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [5, 8]),
                statPoolEntry('cooldown', [20, 25], { integer: true }),
                statPoolEntry('projSpeed', [6, 9]),
                statPoolEntry('projectileCount', [1, 3], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [0, 2], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [2, 5])
            ]
        }
    },
    dagger: {
        id: 'dagger',
        noun: 'Dagger',
        baseCritChance: 0.35,
        baseCritDamageMult: 2.5,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [8, 12]),
                statPoolEntry('cooldown', [40, 55], { integer: true }),
                statPoolEntry('projSpeed', [7, 11]),
                statPoolEntry('projectileCount', [1, 4], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [0, 1], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [4, 8])
            ]
        }
    },
    talisman: {
        id: 'talisman',
        noun: 'Talisman',
        baseCritChance: 0.10,
        baseCritDamageMult: 1.75,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [10, 15]),
                statPoolEntry('cooldown', [45, 60], { integer: true }),
                statPoolEntry('projSpeed', [5, 8]),
                statPoolEntry('projectileCount', [1, 2], { integer: true, noRarityScale: true }),
                statPoolEntry('pierce', [0, 3], { integer: true, noRarityScale: true }),
                statPoolEntry('knockback', [0, 3])
            ]
        }
    },
    relic: {
        id: 'relic',
        noun: 'Relic',
        baseCritChance: 0.15,
        baseCritDamageMult: 1.5,
        weights: { [BehaviorType.PROJECTILE]: 1.0 },
        projectile: {
            required: ['baseDamage', 'cooldown', 'projSpeed'],
            pool: [
                statPoolEntry('baseDamage', [5, 25]),
                statPoolEntry('cooldown', [40, 80], { integer: true }),
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
        baseCritChance: 0.08,
        baseCritDamageMult: 1.5,
        weights: { [BehaviorType.AURA]: 1.0 },
        aura: {
            required: ['baseDamage', 'cooldown', 'areaOfEffect'],
            pool: [
                statPoolEntry('baseDamage', [9, 14]),
                statPoolEntry('cooldown', [50, 60], { integer: true }),
                statPoolEntry('areaOfEffect', [40, 50]),
                statPoolEntry('knockback', [0, 2])
            ]
        }
    },
    frost_censer: {
        id: 'frost_censer',
        noun: 'Censer',
        baseCritChance: 0.1,
        baseCritDamageMult: 2,
        weights: { [BehaviorType.AURA]: 1.0},
        aura: {
            required: ['baseDamage', 'cooldown', 'areaOfEffect'],
            pool: [
                statPoolEntry('baseDamage', [5, 10]),
                statPoolEntry('cooldown', [70, 85], { integer: true }),
                statPoolEntry('areaOfEffect', [45, 60]),
                statPoolEntry('knockback', [0, 1])
            ]
        }
    },
    storm_totem: {
        id: 'storm_totem',
        noun: 'Totem',
        baseCritChance: 0.15,
        baseCritDamageMult: 1.85,
        weights: { [BehaviorType.AURA]: 1.0},
        aura: {
            required: ['baseDamage', 'cooldown', 'areaOfEffect'],
            pool: [
                statPoolEntry('baseDamage', [10, 19]),
                statPoolEntry('cooldown', [85, 100], { integer: true }),
                statPoolEntry('areaOfEffect', [40, 50]),
                statPoolEntry('knockback', [1, 4])
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
