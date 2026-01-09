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
            { url: 'data/gameplay/buffs.json', key: 'BuffDefinitions', default: {} },
            { url: 'data/gameplay/traits.json', key: 'TraitDefinitions', default: {} },
            { url: 'data/archetypes/weapon-pool.json', key: 'WeaponPool', default: [] },
            { url: 'data/archetypes/armor-archetypes.json', key: 'ArmorArchetypes', default: {} },
            { url: 'data/archetypes/accessory-archetypes.json', key: 'AccessoryArchetypes', default: {} },
            { url: 'data/archetypes/artifact-archetypes.json', key: 'ArtifactArchetypes', default: {} },
            { url: 'data/archetypes/character-artifacts.json', key: 'CharacterArtifacts', default: {} },
            { url: 'data/archetypes/character-archetypes.json', key: 'CharacterArchetypes', default: {} },
            { url: 'data/visuals/projectile-styles.json', key: 'ProjectileStyles', default: { default: {} } },
            { url: 'data/gameplay/weapon-effects.json', key: 'WeaponEffectPool', property: 'effects', default: [] },
            { url: 'data/gameplay/enhancements.json', key: 'EnhancementPool', property: 'enhancements', default: [] },
            { url: 'data/gameplay/elite-modifiers.json', key: 'EliteModifierPool', property: 'modifiers', default: [] }
        ];

        try {
            await Promise.all([
                ...configs.map(cfg => this.loadGeneric(cfg)),
                this.loadAffixes(),
                this.loadLegendaryItems()
            ]);

            // Merge character artifacts into ArtifactArchetypes for easier lookup
            if (window.CharacterArtifacts && window.ArtifactArchetypes) {
                Object.assign(window.ArtifactArchetypes, window.CharacterArtifacts);
            }

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
            const files = [
                'data/legendaries/weapons.json',
                'data/legendaries/armor.json',
                'data/legendaries/artifacts.json',
                'data/legendaries/accessories.json'
            ];
            
            const allLegendaries = [];
            
            for (const file of files) {
                try {
                    const data = await this.load(file);
                    if (Array.isArray(data)) {
                        allLegendaries.push(...data);
                    }
                } catch (e) {
                    console.warn(`Failed to load legendary file ${file}:`, e);
                }
            }

            if (typeof LootSystem !== 'undefined' && allLegendaries.length > 0) {
                allLegendaries.forEach(item => {
                    LootSystem.LegendaryTemplates[item.id] = item;
                });
            }
            return allLegendaries;
        } catch (e) {
            console.warn('Failed to load legendary items:', e);
            return [];
        }
    }
};
