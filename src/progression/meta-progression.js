/**
 * Meta Progression System for Shapes Survivor v0.9.10
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
            highestLevel: 0,
            totalBossesKilled: 0,
            totalArtifactsCollected: 0
        };
        
        // Data caches (populated from JSON files)
        this._achievementsData = null;
        this._unlocksData = null;
        
        // Pending notification queue
        this._pendingNotifications = [];
        
        this.load();
    }
    
    /**
     * Initialize with data from JSON files
     * @param {Object} achievementsData - Achievements data from achievements.json
     * @param {Object} unlocksData - Unlocks data from unlocks.json
     */
    initWithData(achievementsData, unlocksData) {
        this._achievementsData = achievementsData || {};
        this._unlocksData = unlocksData || {};
    }
    
    /**
     * Calculate Essence earned from a completed run
     * @param {number} survivalTime - Time survived in seconds
     * @param {number} kills - Total kills
     * @param {number} level - Final level reached
     * @param {number} bossesKilled - Number of bosses defeated
     * @returns {number} Essence earned
     */
    calculateEssenceEarned(survivalTime, kills, level, bossesKilled = 0) {
        // Base: survivalTime / 10 + kills / 5 + level * 10 + bossesKilled * 50
        const timeBonus = Math.floor(survivalTime / 10);
        const killBonus = Math.floor(kills / 5);
        const levelBonus = level * 10;
        const bossBonus = bossesKilled * 50;
        
        const baseEssence = timeBonus + killBonus + levelBonus + bossBonus;
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
     * Get unlock data by ID
     * @param {string} unlockId - ID of the unlock
     * @returns {Object|null} Unlock data or null if not found
     */
    getUnlockData(unlockId) {
        if (!this._unlocksData || !this._unlocksData.unlocks) return null;
        return this._unlocksData.unlocks[unlockId] || null;
    }
    
    /**
     * Get all unlocks in a category
     * @param {string} category - Category name
     * @returns {Array} Array of unlock data objects
     */
    getUnlocksByCategory(category) {
        if (!this._unlocksData || !this._unlocksData.unlocks) return [];
        return Object.values(this._unlocksData.unlocks).filter(u => u.category === category);
    }
    
    /**
     * Get all unlock categories
     * @returns {Object} Categories object
     */
    getCategories() {
        if (!this._unlocksData || !this._unlocksData.categories) return {};
        return this._unlocksData.categories;
    }
    
    /**
     * Check if prerequisites are met for an unlock
     * @param {string} unlockId - ID of the unlock
     * @returns {boolean} Whether prerequisites are met
     */
    arePrerequisitesMet(unlockId) {
        const unlockData = this.getUnlockData(unlockId);
        if (!unlockData) return false;
        
        const prerequisites = unlockData.prerequisites || [];
        for (const prereq of prerequisites) {
            // Check if prerequisite is an achievement or unlock
            if (!this.isUnlocked(prereq) && !this.hasAchievement(prereq)) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Check if player can afford an unlock
     * @param {string} unlockId - ID of the unlock
     * @returns {boolean} Whether unlock is affordable and available
     */
    canUnlock(unlockId) {
        // Check if already unlocked
        if (this.isUnlocked(unlockId)) {
            return false;
        }
        
        const unlockData = this.getUnlockData(unlockId);
        if (!unlockData) {
            return false;
        }
        
        // Check if player has enough essence
        if (this.essence < unlockData.cost) {
            return false;
        }
        
        // Check prerequisites
        if (!this.arePrerequisitesMet(unlockId)) {
            return false;
        }
        
        return true;
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
        
        const unlockData = this.getUnlockData(unlockId);
        if (!unlockData) {
            return false;
        }
        
        // Deduct essence cost
        this.essence -= unlockData.cost;
        
        // Add to unlocks set
        this.unlocks.add(unlockId);
        
        this.save();
        
        // Queue notification
        this._queueNotification({
            type: 'unlock',
            title: 'Unlocked!',
            message: unlockData.name,
            icon: '🔓'
        });
        
        return true;
    }
    
    /**
     * Get the effect of an unlock (for applying permanent stat bonuses)
     * @param {string} unlockId - ID of the unlock
     * @returns {Object|null} Effect data
     */
    getUnlockEffect(unlockId) {
        const unlockData = this.getUnlockData(unlockId);
        return unlockData?.effect || null;
    }
    
    /**
     * Get all permanent stat multipliers from unlocked upgrades
     * @returns {Object} Stat multipliers
     */
    getPermanentStats() {
        const stats = {
            maxHp: 1,
            damage: 1,
            moveSpeed: 1,
            xpGain: 1,
            pickupRadius: 1
        };
        
        for (const unlockId of this.unlocks) {
            const effect = this.getUnlockEffect(unlockId);
            if (effect && effect.type === 'permanentStat') {
                const stat = effect.stat;
                const value = effect.value;
                if (stats[stat] !== undefined) {
                    stats[stat] *= value;
                }
            }
        }
        
        return stats;
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
     * Check if player has an achievement
     * @param {string} achievementId - Achievement ID
     * @returns {boolean} Whether achievement is earned
     */
    hasAchievement(achievementId) {
        return this.achievements.has(achievementId);
    }
    
    /**
     * Get achievement data by ID
     * @param {string} achievementId - Achievement ID
     * @returns {Object|null} Achievement data
     */
    getAchievementData(achievementId) {
        if (!this._achievementsData) return null;
        return this._achievementsData[achievementId] || null;
    }
    
    /**
     * Get all achievements with their status
     * @returns {Array} Array of achievement objects with earned status
     */
    getAllAchievements() {
        if (!this._achievementsData) return [];
        return Object.values(this._achievementsData).map(ach => ({
            ...ach,
            earned: this.hasAchievement(ach.id),
            earnedAt: this.achievements.get(ach.id)?.unlockedAt || null
        }));
    }
    
    /**
     * Award an achievement
     * @param {string} achievementId - Achievement ID
     * @returns {boolean} Whether achievement was newly awarded
     */
    awardAchievement(achievementId) {
        if (this.achievements.has(achievementId)) {
            return false;
        }
        
        const achData = this.getAchievementData(achievementId);
        if (!achData) {
            return false;
        }
        
        this.achievements.set(achievementId, {
            id: achievementId,
            unlockedAt: Date.now()
        });
        
        // Award essence reward
        if (achData.essenceReward && achData.essenceReward > 0) {
            this.awardEssence(achData.essenceReward);
        }
        
        // Queue achievement notification
        this._queueNotification({
            type: 'achievement',
            title: 'Achievement Unlocked!',
            message: achData.name,
            icon: achData.icon || '🏆',
            description: achData.description,
            reward: achData.essenceReward
        });
        
        this.save();
        return true;
    }
    
    /**
     * Update statistics after a run
     * @param {Object} runStats - Statistics from the completed run
     * @returns {Object} Summary of achievements earned and essence gained
     */
    updateStatistics(runStats) {
        this.statistics.totalRuns++;
        this.statistics.totalKills += runStats.kills || 0;
        this.statistics.totalPlaytime += runStats.survivalTime || 0;
        this.statistics.longestSurvival = Math.max(this.statistics.longestSurvival, runStats.survivalTime || 0);
        this.statistics.highestLevel = Math.max(this.statistics.highestLevel, runStats.level || 0);
        this.statistics.totalBossesKilled += runStats.bossesKilled || 0;
        this.statistics.totalArtifactsCollected += runStats.artifactsCollected || 0;
        
        // Check for achievements
        const earnedAchievements = this._checkAchievements(runStats);
        
        this.save();
        
        return {
            achievementsEarned: earnedAchievements,
            notificationCount: this._pendingNotifications.length
        };
    }
    
    /**
     * Check and award achievements based on run stats
     * @private
     * @param {Object} runStats - Current run statistics
     * @returns {Array} Array of earned achievement IDs
     */
    _checkAchievements(runStats) {
        if (!this._achievementsData) return [];
        
        const earned = [];
        
        for (const [achId, achData] of Object.entries(this._achievementsData)) {
            if (this.hasAchievement(achId)) continue;
            
            const req = achData.requirement;
            if (!req) continue;
            
            let met = false;
            
            switch (req.type) {
                case 'kills':
                    // Total kills (cumulative)
                    met = this.statistics.totalKills >= req.value;
                    break;
                case 'killsInRun':
                    // Kills in the current run
                    met = (runStats.kills || 0) >= req.value;
                    break;
                case 'survivalTime':
                    // Longest survival time (in seconds)
                    met = this.statistics.longestSurvival >= req.value;
                    break;
                case 'level':
                    // Highest level reached
                    met = this.statistics.highestLevel >= req.value;
                    break;
                case 'artifactsCollected':
                    // Artifacts collected in a single run
                    met = (runStats.artifactsCollected || 0) >= req.value;
                    break;
                case 'synergiesActivated':
                    // Synergies activated in a single run
                    met = (runStats.synergiesActivated || 0) >= req.value;
                    break;
                case 'bossesDefeated':
                    // Bosses defeated (cumulative)
                    met = this.statistics.totalBossesKilled >= req.value;
                    break;
                case 'legendariesEquipped':
                    // Legendaries equipped at once
                    met = (runStats.legendariesEquipped || 0) >= req.value;
                    break;
                default:
                    break;
            }
            
            if (met && this.awardAchievement(achId)) {
                earned.push(achId);
            }
        }
        
        return earned;
    }
    
    /**
     * Queue a notification for display
     * @private
     */
    _queueNotification(notification) {
        this._pendingNotifications.push(notification);
    }
    
    /**
     * Get and clear pending notifications
     * @returns {Array} Array of pending notifications
     */
    getAndClearNotifications() {
        const notifications = [...this._pendingNotifications];
        this._pendingNotifications = [];
        return notifications;
    }
    
    /**
     * Check if there are pending notifications
     * @returns {boolean}
     */
    hasPendingNotifications() {
        return this._pendingNotifications.length > 0;
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
            highestLevel: 0,
            totalBossesKilled: 0,
            totalArtifactsCollected: 0
        };
        this._pendingNotifications = [];
        this.save();
    }
}

// Export for browser and Node.js
if (typeof window !== 'undefined') {
    window.MetaProgression = MetaProgression;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetaProgression;
}
