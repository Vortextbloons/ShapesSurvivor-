// Test: Generate many items and calculate average stats by rarity

// Mock Game object (needed for item generation)
window.Game = {
    elapsedFrames: 0,
    player: {
        level: 1,
        stats: { rarityFind: 0 }
    }
};

// Count stats across many generated items
function runItemGenerationTest(count = 1000) {
    const results = {};
    const rarityNames = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    
    // Initialize result buckets
    rarityNames.forEach(r => {
        results[r] = {
            count: 0,
            byType: {
                weapon: 0,
                armor: 0,
                accessory: 0,
                artifact: 0
            },
            stats: {}
        };
    });

    // Generate items
    for (let i = 0; i < count; i++) {
        const item = LootSystem.generateItem();
        const rarityId = item.rarity.id;
        
        results[rarityId].count++;
        results[rarityId].byType[item.type]++;
        
        // Aggregate stat values
        if (!results[rarityId].stats[item.type]) {
            results[rarityId].stats[item.type] = {};
        }
        
        const typeStats = results[rarityId].stats[item.type];
        
        (item.modifiers || []).forEach(mod => {
            if (!mod || !mod.stat) return;
            
            if (!typeStats[mod.stat]) {
                typeStats[mod.stat] = { sum: 0, count: 0, operation: mod.operation };
            }
            
            typeStats[mod.stat].sum += (Number(mod.value) || 0);
            typeStats[mod.stat].count++;
        });
    }

    // Calculate averages and display
    console.log(`\n=== ITEM GENERATION TEST (${count} items) ===\n`);
    
    rarityNames.forEach(rarityId => {
        const data = results[rarityId];
        if (data.count === 0) return;
        
        const rarity = Object.values(Rarity).find(r => r.id === rarityId);
        console.log(`\n📊 ${rarity.name.toUpperCase()} (${data.count} items)`);
        console.log(`   Distribution: Weapon=${data.byType.weapon} | Armor=${data.byType.armor} | Accessory=${data.byType.accessory} | Artifact=${data.byType.artifact}`);
        
        Object.keys(data.stats).forEach(itemType => {
            const typeStats = data.stats[itemType];
            if (Object.keys(typeStats).length === 0) return;
            
            console.log(`\n   ${itemType.toUpperCase()}:`);
            
            Object.keys(typeStats).sort().forEach(stat => {
                const stat_data = typeStats[stat];
                const avg = (stat_data.sum / stat_data.count).toFixed(3);
                const appears = `${stat_data.count}/${data.byType[itemType]} items`;
                const op = stat_data.operation === 'multiply' ? '(×)' : '(+)';
                
                console.log(`      ${stat.padEnd(20)} ${avg.padStart(10)} avg  ${op}  [${appears}]`);
            });
        });
    });
    
    console.log(`\n=== END TEST ===\n`);
}

// Run the test
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runItemGenerationTest };
} else {
    // Browser environment - run immediately
    console.log('Generating 1000 items for analysis... (this may take a moment)');
    runItemGenerationTest(1000);
}
