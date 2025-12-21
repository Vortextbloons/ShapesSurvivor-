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

    // Load all game data using a configuration mapping
    async loadAll() {
        const configs = [
            { url: 'data/gameplay/enemies.json', key: 'EnemyArchetypes' },
            { url: 'data/archetypes/weapon-archetypes.json', key: 'WeaponArchetypes', default: {} },
            { url: 'data/archetypes/armor-archetypes.json', key: 'ArmorArchetypes', default: {} },
            { url: 'data/archetypes/accessory-archetypes.json', key: 'AccessoryArchetypes', default: {} },
            { url: 'data/archetypes/artifact-archetypes.json', key: 'ArtifactArchetypes', default: {} },
            { url: 'data/visuals/projectile-styles.json', key: 'ProjectileStyles', default: { default: {} } },
            { url: 'data/gameplay/weapon-effects.json', key: 'WeaponEffectPool', property: 'effects', default: [] },
            { url: 'data/gameplay/enhancements.json', key: 'EnhancementPool', property: 'enhancements', default: [] }
        ];

        try {
            await Promise.all([
                ...configs.map(cfg => this.loadGeneric(cfg)),
                this.loadAffixes(),
                this.loadLegendaryItems()
            ]);
            console.log('All game data loaded successfully');
        } catch (error) {
            console.error('Failed to load game data:', error);
            throw error;
        }
    },

    async loadGeneric({ url, key, property, default: defaultValue }) {
        try {
            const data = await this.load(url);
            window[key] = property ? (data[property] || defaultValue) : data;
            return data;
        } catch (e) {
            console.warn(`Failed to load ${url}:`, e);
            if (key) window[key] = defaultValue;
            return defaultValue;
        }
    },

    // Load affixes data and apply to affix pools
    async loadAffixes() {
        try {
            const data = await this.load('data/gameplay/affixes.json');
            window.AffixPool = Array.isArray(data.affixes) 
                ? data.affixes.map(a => ({
                    ...a,
                    types: (a.types || []).map(t => ItemType[String(t).toUpperCase()] || t)
                }))
                : [];
            return data;
        } catch (e) {
            console.warn('Failed to load affixes:', e);
            window.AffixPool = [];
            return { affixes: [] };
        }
    },

    // Load legendary items
    async loadLegendaryItems() {
        try {
            const data = await this.load('data/gameplay/legendary-items.json');
            if (typeof LootSystem !== 'undefined' && Array.isArray(data)) {
                data.forEach(item => {
                    LootSystem.LegendaryTemplates[item.id] = item;
                });
            }
            return data;
        } catch (e) {
            console.warn('Failed to load legendary items:', e);
            return [];
        }
    }
};
