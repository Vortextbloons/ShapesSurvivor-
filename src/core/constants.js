// Global, non-module constants (loaded early via <script> in index.html)
// Keep this file dependency-free.

window.GameConstants = {
    VERSION: '0.9.0',
    // Replace with your Google Docs URL.
    // Opens in the same window by default (no target="_blank").
    PATCH_NOTES_URL: 'https://docs.google.com/document/d/1GuhOzIMpLPJa0-1uVDG_kFpvNS1yed2C1ZipAccrtDI/edit?usp=sharing',
    
    // World dimensions (4x larger than canvas for camera follow system)
    WORLD_WIDTH: 25600,
    WORLD_HEIGHT: 14400,

    // Frame rate and timing
    FPS: 60,
    FRAME_MS: 16.67,

    // Combat timing
    CONTACT_DAMAGE_COOLDOWN_FRAMES: 4,
    DEFAULT_DOT_DURATION_FRAMES: 160,
    DEFAULT_DOT_TICK_INTERVAL_FRAMES: 20,

    // Spatial and collision
    SPATIAL_GRID_CELL_SIZE: 120,
    PICKUP_RANGE: 80,
    BOSS_CHEST_RADIUS: 14,

    // Color palette
    COLORS: {
        // Player
        PLAYER_DEFAULT: '#3498db',
        
        // Status effects
        BURN: '#ff8c00',
        POISON: '#2ecc71',
        FREEZE: '#81ecec',
        BLEED: '#e74c3c',
        SHOCK: '#f1c40f',
        
        // UI
        GOLD: '#FFD700',
        
        // Rarity colors (from rarity-system.js)
        RARITY_COMMON: '#b0bec5',
        RARITY_UNCOMMON: '#4caf50',
        RARITY_RARE: '#2196f3',
        RARITY_EPIC: '#9c27b0',
        RARITY_LEGENDARY: '#ff9800'
    },

    // User Settings Defaults
    SETTINGS: {
        LOW_QUALITY: false
    },

    // Consolation prize for skipping rewards
    ESSENCE_PRIZE: {
        maxHp: 5,
        damage: 0.02 // +2% base damage
    },

    // Difficulty Settings
    DIFFICULTY_SETTINGS: {
        easy: {
            id: 'easy',
            name: 'Easy',
            description: 'For a relaxed experience.',
            enemyHpMult: 0.5,
            enemyDmgMult: 0.5,
            enemySpeedMult: 0.7,
            spawnIntervalMult: 1.3
        },
        normal: {
            id: 'normal',
            name: 'Normal',
            description: 'The standard challenge.',
            enemyHpMult: 1.0,
            enemyDmgMult: 1.0,
            enemySpeedMult: 1.0,
            spawnIntervalMult: 1.0
        },
        hard: {
            id: 'hard',
            name: 'Hard',
            description: 'For veterans.',
            enemyHpMult: 1.25,
            enemyDmgMult: 1.15,
            enemySpeedMult: 1.05,
            spawnIntervalMult: 0.9
        },
        nightmare: {
            id: 'nightmare',
            name: 'Nightmare',
            description: 'Good luck.',
            enemyHpMult: 1.5,
            enemyDmgMult: 1.8,
            enemySpeedMult: 1.5,
            spawnIntervalMult: 0.9
        }
    }
};
