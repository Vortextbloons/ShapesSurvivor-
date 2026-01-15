// Global, non-module constants (loaded early via <script> in index.html)
// Keep this file dependency-free.

window.GameConstants = {
    VERSION: '0.9.8.1',
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
        damage: 0.03 // +3% base damage
    },

    CRIT_ASCENSION_CHANCE: 0.25,

    // Difficulty Settings
    DIFFICULTY_SETTINGS: {
        easy: {
            id: 'easy',
            name: 'Easy',
            description: 'For a relaxed experience.',
            enemyHpMult: 0.65,
            enemyDmgMult: 0.5,
            enemySpeedMult: 0.7,
            spawnIntervalMult: 1.3,
            eliteSpawnMult: 1.0
        },
        normal: {
            id: 'normal',
            name: 'Normal',
            description: 'The standard challenge.',
            enemyHpMult: 1.1,
            enemyDmgMult: 1.25,
            enemySpeedMult: 1.0,
            spawnIntervalMult: 1.0,
            eliteSpawnMult: 1.0
        },
        hard: {
            id: 'hard',
            name: 'Hard',
            description: 'For veterans.',
            enemyHpMult: 1.35,
            enemyDmgMult: 1.85,
            enemySpeedMult: 1.05,
            spawnIntervalMult: 0.9,
            eliteSpawnMult: 1.5
        },
        nightmare: {
            id: 'nightmare',
            name: 'Nightmare',
            description: 'Good luck.',
            enemyHpMult: 1.65,
            enemyDmgMult: 2.3,
            enemySpeedMult: 1.2,
            spawnIntervalMult: 0.9,
            eliteSpawnMult: 2.0
        }
    },

    // Crit Tier System
    CRIT_TIERS: {
        1: { name: 'Tier 1', multiplier: 1, color: '#ffffff', symbol: '' },
        2: { name: 'Tier 2', multiplier: 2, color: '#ffff00', symbol: '★' },
        3: { name: 'Tier 3', multiplier: 3, color: '#ffa500', symbol: '★★' },
        4: { name: 'Tier 4', multiplier: 4, color: '#ff4500', symbol: '★★★' },
        5: { name: 'Tier 5', multiplier: 5, color: '#ff00ff', symbol: '★★★★' },
        MAX: 5
    },

    // Status Effect Caps
    STATUS_CAPS: {
        // Max total duration (frames) - 15 seconds
        MAX_DURATION: 900,
        
        // Burn/Poison
        // Cap per-tick damage % (e.g., 200% weapon damage per tick max)
        MAX_DOT_PCT_PER_TICK: 2.0, 
        
        // Slow
        // Min multiplier (cannot slow below 10% speed)
        MIN_SLOW_MULT: 0.1,
        
        // Shock
        // Max damage taken multiplier (+100% damage taken)
        MAX_SHOCK_DMG_MULT: 1.0,
        
        // Vulnerability
        // Max resistance reduction (80%)
        MAX_RESIST_REDUCTION: 0.8,
        
        // Crowd Control Chances (Freeze, Stun, Fear)
        // Hard cap at 100% chance
        MAX_CC_CHANCE: 1.0
    }
};
