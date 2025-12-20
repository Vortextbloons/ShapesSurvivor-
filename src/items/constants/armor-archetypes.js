// Armor archetype definitions with stat pools

const ArmorArchetypes = {
    plate: {
        id: 'plate',
        noun: 'Plate',
        required: ['maxHp'],
        pool: [
            statPoolEntry('maxHp', [50, 120]),
            statPoolEntry('damageTakenMult', [-0.15, -0.05], { op: 'multiply', noRarityScale: true }),
            statPoolEntry('regen', [0.02, 0.06])
        ]
    },
    robes: {
        id: 'robes',
        noun: 'Robes',
        required: ['cooldownMult', 'regen'],
        pool: [
            statPoolEntry('cooldownMult', [-0.15, -0.05], { noRarityScale: true }),
            statPoolEntry('regen', [0.03, 0.05]),
            statPoolEntry('maxHp', [10, 40]),
            statPoolEntry('areaOfEffect', [10, 25], { noRarityScale: true })
        ]
    },
    leather: {
        id: 'leather',
        noun: 'Vest',
        required: ['maxHp', 'moveSpeed'],
        pool: [
            statPoolEntry('maxHp', [30, 70]),
            statPoolEntry('moveSpeed', [0.05, 0.12], { op: 'multiply', noRarityScale: true }),
            statPoolEntry('critChanceBonus', [0.02, 0.05], { noRarityScale: true })
        ]
    },
    battlegear: {
        id: 'battlegear',
        noun: 'Battlegear',
        required: ['damage', ],
        pool: [
            statPoolEntry('damage', [0.10, 0.25], { op: 'multiply', noRarityScale: true }),
            statPoolEntry('critChanceBonus', [0.05, 0.10], { noRarityScale: true }),
            statPoolEntry('maxHp', [10, 30])
        ]
    }
};

function pickArmorArchetype() {
    return pickArchetype(ArmorArchetypes);
}
