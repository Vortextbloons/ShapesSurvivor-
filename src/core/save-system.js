class SaveSystem {
    constructor() {
        this.data = {
            easy: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 },
            normal: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 },
            hard: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 },
            nightmare: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 }
        };
        this.essence = 0;
    }

    load() {
        try {
            const difficulties = ['easy', 'normal', 'hard', 'nightmare'];
            for (const diff of difficulties) {
                const t = Number(localStorage.getItem(`ss_best_time_sec_${diff}`) || 0);
                const k = Number(localStorage.getItem(`ss_best_kills_${diff}`) || 0);
                const l = Number(localStorage.getItem(`ss_best_level_${diff}`) || 0);
                
                this.data[diff] = {
                    bestTimeSec: Number.isFinite(t) ? t : 0,
                    bestKills: Number.isFinite(k) ? k : 0,
                    bestLevel: Number.isFinite(l) ? l : 0
                };
            }
            
            // Load essence
            const savedEssence = Number(localStorage.getItem('ss_meta_essence') || 0);
            this.essence = Number.isFinite(savedEssence) ? savedEssence : 0;
        } catch (e) {
            console.warn('SaveSystem load failed', e);
        }
        return { ...this.data };
    }

    save(currentRunStats, difficulty = 'normal') {
        if (!currentRunStats) {
            this._persist();
            return;
        }

        // Validate difficulty
        if (!this.data[difficulty]) {
            console.warn(`Invalid difficulty: ${difficulty}, defaulting to normal`);
            difficulty = 'normal';
        }

        // Update high scores for the specific difficulty
        let changed = false;
        const diffData = this.data[difficulty];
        
        // currentRunStats might be { timeSec, kills, level }
        if (currentRunStats.timeSec > diffData.bestTimeSec) {
            diffData.bestTimeSec = currentRunStats.timeSec;
            changed = true;
        }
        if (currentRunStats.kills > diffData.bestKills) {
            diffData.bestKills = currentRunStats.kills;
            changed = true;
        }
        if (currentRunStats.level > diffData.bestLevel) {
            diffData.bestLevel = currentRunStats.level;
            changed = true;
        }

        if (changed) {
            this._persist();
        }
    }

    _persist() {
        try {
            const difficulties = ['easy', 'normal', 'hard', 'nightmare'];
            for (const diff of difficulties) {
                const diffData = this.data[diff];
                localStorage.setItem(`ss_best_time_sec_${diff}`, String(diffData.bestTimeSec));
                localStorage.setItem(`ss_best_kills_${diff}`, String(diffData.bestKills));
                localStorage.setItem(`ss_best_level_${diff}`, String(diffData.bestLevel));
            }
            
            // Persist essence
            localStorage.setItem('ss_meta_essence', String(this.essence));
        } catch (e) {
            console.warn('SaveSystem save failed', e);
        }
    }

    // Helper for dev tools or clears
    clear() {
        this.data = {
            easy: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 },
            normal: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 },
            hard: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 },
            nightmare: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 }
        };
        this.essence = 0;
        try {
            const difficulties = ['easy', 'normal', 'hard', 'nightmare'];
            for (const diff of difficulties) {
                localStorage.removeItem(`ss_best_time_sec_${diff}`);
                localStorage.removeItem(`ss_best_kills_${diff}`);
                localStorage.removeItem(`ss_best_level_${diff}`);
            }
            localStorage.removeItem('ss_meta_essence');
        } catch (e) {}
    }

    // Get best stats for a specific difficulty
    getBest(difficulty = 'normal') {
        return this.data[difficulty] || this.data.normal;
    }

    // Meta-currency methods
    addEssence(amount) {
        if (!Number.isFinite(amount) || amount < 0) return;
        this.essence += amount;
        this._persist();
    }

    getEssence() {
        return this.essence;
    }
}

window.SaveSystem = new SaveSystem();
