/**
 * Meta Progression System for Shapes Survivor v0.9
 * 
 * Manages persistent unlocks and upgrades that carry between runs.
 * Players earn "Essence" from completed runs and spend it on permanent upgrades.
 * 
 * Features:
 * - Essence currency system
 * - Unlock tree for characters, items, and stat boosts
 * - Achievement tracking
 * - Statistics persistence
 * - LocalStorage integration
 * 
 * @module MetaProgression
 */

class MetaProgression {
    constructor() {
        this.essence = 0;
        this.totalEssenceEarned = 0;
        this.unlocks = new Set();
        this.achievements = new Map();
        this.statistics = {
            totalRuns: 0,
            totalKills: 0,
            totalPlaytime: 0,
            bestTime: 0,
            longestSurvival: 0,
            highestLevel: 0
        };
        
        this.load();
    }
    
    /**
     * Calculate Essence earned from a completed run
     * @param {number} survivalTime - Time survived in seconds
     * @param {number} kills - Total kills
     * @param {number} level - Final level reached
     * @returns {number} Essence earned
     */
    calculateEssenceEarned(survivalTime, kills, level) {
        // TODO: Implement essence calculation formula
        // Base: survivalTime / 10 + kills / 5 + level * 10
        const baseEssence = Math.floor(survivalTime / 10) + Math.floor(kills / 5) + (level * 10);
        return Math.max(1, baseEssence);
    }
    
    /**
     * Award Essence to the player
     * @param {number} amount - Amount of Essence to award
     */
    awardEssence(amount) {
        this.essence += amount;
        this.totalEssenceEarned += amount;
        this.save();
    }
    
    /**
     * Check if player can afford an unlock
     * @param {string} unlockId - ID of the unlock
     * @returns {boolean} Whether unlock is affordable
     */
    canUnlock(unlockId) {
        // TODO: Load unlock cost from data/progression/unlocks.json
        // TODO: Check if already unlocked
        // TODO: Check prerequisites
        return false;
    }
    
    /**
     * Purchase an unlock
     * @param {string} unlockId - ID of the unlock to purchase
     * @returns {boolean} Success/failure
     */
    unlock(unlockId) {
        if (!this.canUnlock(unlockId)) {
            return false;
        }
        
        // TODO: Deduct essence cost
        // TODO: Add to unlocks set
        // TODO: Apply unlock effects
        this.unlocks.add(unlockId);
        this.save();
        return true;
    }
    
    /**
     * Check if a specific item is unlocked
     * @param {string} unlockId - ID to check
     * @returns {boolean} Whether it's unlocked
     */
    isUnlocked(unlockId) {
        return this.unlocks.has(unlockId);
    }
    
    /**
     * Award an achievement
     * @param {string} achievementId - Achievement ID
     */
    awardAchievement(achievementId) {
        if (!this.achievements.has(achievementId)) {
            this.achievements.set(achievementId, {
                id: achievementId,
                unlockedAt: Date.now()
            });
            this.save();
            // TODO: Show achievement notification
        }
    }
    
    /**
     * Update statistics after a run
     * @param {Object} runStats - Statistics from the completed run
     */
    updateStatistics(runStats) {
        this.statistics.totalRuns++;
        this.statistics.totalKills += runStats.kills || 0;
        this.statistics.totalPlaytime += runStats.survivalTime || 0;
        this.statistics.longestSurvival = Math.max(this.statistics.longestSurvival, runStats.survivalTime || 0);
        this.statistics.highestLevel = Math.max(this.statistics.highestLevel, runStats.level || 0);
        
        // Check for achievements
        this._checkAchievements(runStats);
        
        this.save();
    }
    
    /**
     * Check and award achievements based on run stats
     * @private
     */
    _checkAchievements(runStats) {
        // TODO: Implement achievement checking logic
        // Examples:
        // - Survive 10 minutes
        // - Kill 1000 enemies
        // - Reach level 20
        // - Collect all artifacts
        // - Complete all synergies
    }
    
    /**
     * Save meta progression to localStorage
     */
    save() {
        const data = {
            essence: this.essence,
            totalEssenceEarned: this.totalEssenceEarned,
            unlocks: Array.from(this.unlocks),
            achievements: Array.from(this.achievements.entries()),
            statistics: this.statistics
        };
        
        try {
            localStorage.setItem('shapesSurvivor_metaProgression', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save meta progression:', e);
        }
    }
    
    /**
     * Load meta progression from localStorage
     */
    load() {
        try {
            const saved = localStorage.getItem('shapesSurvivor_metaProgression');
            if (saved) {
                const data = JSON.parse(saved);
                this.essence = data.essence || 0;
                this.totalEssenceEarned = data.totalEssenceEarned || 0;
                this.unlocks = new Set(data.unlocks || []);
                this.achievements = new Map(data.achievements || []);
                this.statistics = { ...this.statistics, ...data.statistics };
            }
        } catch (e) {
            console.error('Failed to load meta progression:', e);
        }
    }
    
    /**
     * Reset all meta progression (for debugging/testing)
     */
    reset() {
        this.essence = 0;
        this.totalEssenceEarned = 0;
        this.unlocks.clear();
        this.achievements.clear();
        this.statistics = {
            totalRuns: 0,
            totalKills: 0,
            totalPlaytime: 0,
            longestSurvival: 0,
            highestLevel: 0
        };
        this.save();
    }
}

// Export for use in game engine
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetaProgression;
}
