// Data loader utility for loading JSON configuration files
const DataLoader = {
    cache: {},

    async load(url) {
        if (this.cache[url]) return this.cache[url];
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
            const data = await response.json();
            this.cache[url] = data;
            return data;
        } catch (error) {
            console.error(`DataLoader error: ${error.message}`);
            throw error;
        }
    },

    // Load enemies data and apply to EnemyArchetypes
    async loadEnemies() {
        const data = await this.load('data/enemies.json');
        window.EnemyArchetypes = data;
        return data;
    },

    // Load affixes data and apply to affix pools
    async loadAffixes() {
        const data = await this.load('data/affixes.json');
        // New unified affix pool (multi-mod affixes)
        if (Array.isArray(data.affixes)) {
            window.AffixPool = data.affixes.map(a => ({
                ...a,
                types: (a.types || []).map(t => ItemType[String(t).toUpperCase()] || t)
            }));
        } else {
            window.AffixPool = [];
        }

        // Backwards compatibility (older code paths may still read these)
        window.StatAffixPool = data.statAffixes || [];
        window.SpecialAffixPool = data.specialAffixes || [];
        
        // Convert effect affix types from strings to ItemType constants
        if (data.effectAffixes) {
            window.EffectAffixPool = data.effectAffixes.map(affix => ({
                ...affix,
                types: affix.types.map(t => ItemType[t.toUpperCase()] || t)
            }));
        }
        
        return data;
    },

    // Load all game data
    async loadAll() {
        try {
            await Promise.all([
                this.loadEnemies(),
                this.loadAffixes()
            ]);
            console.log('All game data loaded successfully');
        } catch (error) {
            console.error('Failed to load game data:', error);
            throw error;
        }
    }
};
