// Accessory archetype definitions with stat pools

const AccessoryArchetypes = {
    ring: {
        id: 'ring',
        noun: 'Ring',
        required: ['damage', 'critChanceMult'],
        pool: [
            statPoolEntry('damage', [0.05, 0.1], { op: 'multiply'}),
            statPoolEntry('critChanceMult', [0.10, 0.22], { op: 'multiply' }),
            statPoolEntry('critDamageMultBase', [0.1, 0.3], { op: 'add' })
        ]
    },
    amulet: {
        id: 'amulet',
        noun: 'Amulet',
        required: ['cooldownMult', 'areaOfEffect'],
        pool: [
            statPoolEntry('cooldownMult', [-0.085, -0.04]),
            statPoolEntry('areaOfEffect', [5, 15]),
            statPoolEntry('xpGain', [0.05, 0.1])
        ]
    },
    boots: {
        id: 'boots',
        noun: 'Boots',
        required: ['moveSpeed'],
        pool: [
            statPoolEntry('moveSpeed', [0.08, 0.20], { op: 'multiply' }),
            statPoolEntry('regen', [0.0085, 0.015]),
            statPoolEntry('maxHp', [10, 40])
        ]
    },
    charm: {
        id: 'charm',
        noun: 'Charm',
        required: ['rarityFind', 'xpGain'],
        pool: [
            statPoolEntry('rarityFind', [0.03, 0.05]),
            statPoolEntry('xpGain', [0.10, 0.2]),
            statPoolEntry('maxHp', [20, 60])
        ]
    }
};

function pickAccessoryArchetype() {
    return pickArchetype(AccessoryArchetypes);
}
