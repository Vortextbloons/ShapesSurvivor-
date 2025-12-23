// Rarity tiers and properties
const Rarity = {
    COMMON:    { id: 'common',    name: 'Common',    multiplier: 1.0, color: '#b0bec5', minAffixes: 0, maxAffixes: 0 },
    UNCOMMON:  { id: 'uncommon',  name: 'Uncommon',  multiplier: 1.25, color: '#4caf50', minAffixes: 0, maxAffixes: 1 },
    RARE:      { id: 'rare',      name: 'Rare',      multiplier: 1.5, color: '#4fc3f7', minAffixes: 0, maxAffixes: 2 },
    EPIC:      { id: 'epic',      name: 'Epic',      multiplier: 2.0, color: '#ab47bc', minAffixes: 1, maxAffixes: 3 },
    LEGENDARY: { id: 'legendary', name: 'Legendary', multiplier: 3.0, color: '#ff9800', minAffixes: 2, maxAffixes: 2 },
    CHARACTER: { id: 'character', name: 'Character', multiplier: 1.0, color: '#e91e63', minAffixes: 0, maxAffixes: 0 }
};

// Check if a rarity meets or exceeds a minimum rarity level
function rarityAtLeast(rarity, minId) {
    const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'character'];
    const rIdx = order.indexOf(rarity?.id);
    const mIdx = order.indexOf(minId);
    return rIdx >= 0 && mIdx >= 0 && rIdx >= mIdx;
}
