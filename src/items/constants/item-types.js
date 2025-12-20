// Item type and behavior enumerations
const ItemType = {
    WEAPON: 'weapon',
    ARMOR: 'armor',
    ACCESSORY: 'accessory',
    ARTIFACT: 'artifact'
};

const BehaviorType = {
    NONE: 'none',
    AURA: 'aura',
    PROJECTILE: 'projectile',
    ORBITAL: 'orbital'
};

// Shared archetype utility
function statPoolEntry(stat, range, opts) {
    const o = opts || {};
    const entry = { stat, range, op: o.op || 'add' };
    if (o.integer) entry.integer = true;
    if (o.noRarityScale) entry.noRarityScale = true;
    return entry;
}

function pickArchetype(archetypeObject) {
    const keys = Object.keys(archetypeObject);
    return archetypeObject[keys[Math.floor(Math.random() * keys.length)]];
}
