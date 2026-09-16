// Rarity tiers and properties
const Rarity = {
    COMMON:    { id: 'common',    name: 'Common',    multiplier: 1.0, critDamageMultiplier: 1.0, color: '#b4c5c8', minAffixes: 0, maxAffixes: 0 },
    UNCOMMON:  { id: 'uncommon',  name: 'Uncommon',  multiplier: 1.25, critDamageMultiplier: 1.1, color: '#75e0ae', minAffixes: 0, maxAffixes: 1 },
    RARE:      { id: 'rare',      name: 'Rare',      multiplier: 1.5, critDamageMultiplier: 1.15, color: '#70c8f5', minAffixes: 0, maxAffixes: 2 },
    EPIC:      { id: 'epic',      name: 'Epic',      multiplier: 2.0, critDamageMultiplier: 1.25, color: '#bd8cff', minAffixes: 1, maxAffixes: 3 },
    LEGENDARY: { id: 'legendary', name: 'Legendary', multiplier: 3.0, critDamageMultiplier: 1.5, color: '#f4b866', minAffixes: 3, maxAffixes: 3 },
    CHARACTER: { id: 'character', name: 'Character', multiplier: 1.0, critDamageMultiplier: 1.0, color: '#ff6f91', minAffixes: 0, maxAffixes: 0 }
};

// Rarity hierarchy (higher index = higher tier)
const RarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'character'];

// Check if a rarity meets or exceeds a minimum rarity level
function rarityAtLeast(rarity, minId) {
    const rIdx = RarityOrder.indexOf(rarity?.id);
    const mIdx = RarityOrder.indexOf(minId);
    return rIdx >= 0 && mIdx >= 0 && rIdx >= mIdx;
}

// Get rarity object by ID string
function getRarityById(rarityId) {
    const rarityKey = Object.keys(Rarity).find(key => Rarity[key].id === rarityId);
    return rarityKey ? Rarity[rarityKey] : null;
}

// Compare two rarity IDs (returns true if rarityId >= minRarityId)
function meetsMinimumRarity(rarityId, minRarityId) {
    if (!minRarityId) return true; // No gate = always allowed
    const rIdx = RarityOrder.indexOf(rarityId);
    const mIdx = RarityOrder.indexOf(minRarityId);
    return rIdx >= 0 && mIdx >= 0 && rIdx >= mIdx;
}
