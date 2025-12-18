// Stat pools for item generation by type

function statPoolEntry(stat, range, opts) {
    const o = opts || {};
    const entry = { stat, range, op: o.op || 'add' };
    if (o.integer) entry.integer = true;
    if (o.noRarityScale) entry.noRarityScale = true;
    return entry;
}

const StatPoolsByType = {
    [ItemType.WEAPON]: [
        statPoolEntry('baseDamage', [6, 22]),
        statPoolEntry('cooldown', [35, 110], { integer: true }),
        statPoolEntry('projectileCount', [1, 3], { integer: true, noRarityScale: true }),
        statPoolEntry('pierce', [0, 3], { integer: true, noRarityScale: true }),
        statPoolEntry('knockback', [0, 7], { noRarityScale: true }),
        statPoolEntry('projSpeed', [5, 10], { noRarityScale: true }),
        statPoolEntry('areaOfEffect', [35, 90], { noRarityScale: true })
    ],
    [ItemType.ARMOR]: [
        statPoolEntry('maxHp', [20, 90]),
        statPoolEntry('regen', [0.02, 0.18]),
        statPoolEntry('damageTakenMult', [-0.15, -0.05], { op: 'multiply', noRarityScale: true })
    ],
    [ItemType.ACCESSORY]: [
        statPoolEntry('moveSpeed', [0.05, 0.20], { op: 'multiply', noRarityScale: true }),
        statPoolEntry('damage', [0.05, 0.25], { op: 'multiply', noRarityScale: true }),
        statPoolEntry('critChanceBonus', [0.03, 0.10], { noRarityScale: true }),
        statPoolEntry('areaOfEffect', [8, 35]),
        statPoolEntry('cooldownMult', [-0.12, -0.03], { noRarityScale: true }),
        statPoolEntry('xpGain', [0.05, 0.30], { noRarityScale: true })
    ],
    [ItemType.ARTIFACT]: [
        statPoolEntry('cooldownMult', [-0.10, -0.02], { noRarityScale: true }),
        statPoolEntry('damage', [0.03, 0.12], { op: 'multiply', noRarityScale: true }),
        statPoolEntry('moveSpeed', [0.03, 0.10], { op: 'multiply', noRarityScale: true }),
        statPoolEntry('critChanceBonus', [0.02, 0.07], { noRarityScale: true }),
        statPoolEntry('maxHp', [10, 55]),
        statPoolEntry('regen', [0.02, 0.14]),
        statPoolEntry('xpGain', [0.04, 0.20], { noRarityScale: true })
    ]
};
