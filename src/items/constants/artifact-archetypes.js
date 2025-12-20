// Artifact archetype definitions with stat pools

const ArtifactArchetypes = {
    relic: {
        id: 'relic',
        noun: 'Relic',
        required: ['cooldownMult'],
        pool: [
            statPoolEntry('cooldownMult', [-0.04, -0.02]),
            statPoolEntry('maxHp', [20, 30]),
            statPoolEntry('regen', [0.02, 0.04])
        ]
    },
    tome: {
        id: 'tome',
        noun: 'Tome',
        required: ['xpGain'],
        pool: [
            statPoolEntry('xpGain', [0.05, 0.1]),
            statPoolEntry('areaOfEffect', [5, 10]),
            statPoolEntry('damage', [0.05, 0.15], { op: 'multiply' })
        ]
    },
    gem: {
        id: 'gem',
        noun: 'Gem',
        required: ['damage'],
        pool: [
            statPoolEntry('damage', [0.08, 0.14], { op: 'multiply'}),
            statPoolEntry('critChanceBonus', [0.03, 0.08]),
            statPoolEntry('moveSpeed', [0.05, 0.10], { op: 'multiply', noRarityScale: true })
        ]
    },
    idol: {
        id: 'idol',
        noun: 'Idol',
        required: ['maxHp', 'regen'],
        pool: [
            statPoolEntry('maxHp', [30, 45]),
            statPoolEntry('regen', [0.06, 0.08]),
            statPoolEntry('damageTakenMult', [-0.03, -0.02], { op: 'multiply', noRarityScale: true })
        ]
    }
};

function pickArtifactArchetype() {
    return pickArchetype(ArtifactArchetypes);
}
