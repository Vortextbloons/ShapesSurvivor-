// Armor archetype definitions with stat pools

const ArmorArchetypes = {
    plate: {
        id: 'plate',
        noun: 'Plate',
        required: ['maxHp'],
        pool: [
            statPoolEntry('maxHp', [50, 120]),
            statPoolEntry('damageTakenMult', [-0.08, -0.03], { op: 'multiply' }),
            statPoolEntry('regen', [0.02, 0.06])
        ]
    },
    robes: {
        id: 'robes',
        noun: 'Robes',
        required: ['cooldownMult', 'regen'],
        pool: [
            statPoolEntry('cooldownMult', [-0.05, -0.03]),
            statPoolEntry('regen', [0.03, 0.05]),
            statPoolEntry('maxHp', [10, 40]),
            statPoolEntry('areaOfEffect', [10, 25], )
        ]
    },
    leather: {
        id: 'leather',
        noun: 'Vest',
        required: ['maxHp', 'moveSpeed'],
        pool: [
            statPoolEntry('maxHp', [30, 70]),
            statPoolEntry('moveSpeed', [0.05, 0.08], { op: 'multiply' }),
            statPoolEntry('critChanceMult', [0.06, 0.14], { op: 'multiply'})
        ]
    },
    battlegear: {
        id: 'battlegear',
        noun: 'Battlegear',
        required: ['damage',"maxHp" ],
        pool: [
            statPoolEntry('damage', [0.10, 0.25], { op: 'multiply' }),
            statPoolEntry('critChanceMult', [0.10, 0.25], { op: 'multiply' }),
            statPoolEntry('maxHp', [10, 30])
        ]
    }
};

function pickArmorArchetype() {
    return pickArchetype(ArmorArchetypes);
}
