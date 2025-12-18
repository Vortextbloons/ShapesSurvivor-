// Main loot system entry point - imports from modular components
// This file now serves as a thin wrapper that loads JSON data and exports the LootSystem class.

// The modular components (generation-core, weapon-archetypes, stat-pools, name-generator, 
// effect-selection, item-utils) must be loaded before this file.

// Initialize async data loading on page load
window.addEventListener('load', async () => {
    await LootSystem.loadLegendaryTemplates();
    await LootSystem.loadCurseAffixes();
    console.log('[LootSystem] Async data loaded. Ready for item generation.');
});
