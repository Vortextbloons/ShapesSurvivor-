class SaveSystem {
    constructor() {
        this.data = {
            bestTimeSec: 0,
            bestKills: 0,
            bestLevel: 0
        };
    }

    load() {
        try {
            const t = Number(localStorage.getItem('ss_best_time_sec') || 0);
            const k = Number(localStorage.getItem('ss_best_kills') || 0);
            const l = Number(localStorage.getItem('ss_best_level') || 0);
            
            this.data.bestTimeSec = Number.isFinite(t) ? t : 0;
            this.data.bestKills = Number.isFinite(k) ? k : 0;
            this.data.bestLevel = Number.isFinite(l) ? l : 0;
        } catch (e) {
            console.warn('SaveSystem load failed', e);
        }
        return { ...this.data };
    }

    save(currentRunStats) {
        if (!currentRunStats) {
            this._persist();
            return;
        }

        // Update high scores
        let changed = false;
        
        // currentRunStats might be { timeSec, kills, level }
        if (currentRunStats.timeSec > this.data.bestTimeSec) {
            this.data.bestTimeSec = currentRunStats.timeSec;
            changed = true;
        }
        if (currentRunStats.kills > this.data.bestKills) {
            this.data.bestKills = currentRunStats.kills;
            changed = true;
        }
        if (currentRunStats.level > this.data.bestLevel) {
            this.data.bestLevel = currentRunStats.level;
            changed = true;
        }

        if (changed) {
            this._persist();
        }
    }

    _persist() {
        try {
            localStorage.setItem('ss_best_time_sec', String(this.data.bestTimeSec));
            localStorage.setItem('ss_best_kills', String(this.data.bestKills));
            localStorage.setItem('ss_best_level', String(this.data.bestLevel));
        } catch (e) {
            console.warn('SaveSystem save failed', e);
        }
    }

    // Helper for dev tools or clears
    clear() {
        this.data = { bestTimeSec: 0, bestKills: 0, bestLevel: 0 };
        try {
            localStorage.removeItem('ss_best_time_sec');
            localStorage.removeItem('ss_best_kills');
            localStorage.removeItem('ss_best_level');
        } catch (e) {}
    }
}

window.SaveSystem = new SaveSystem();
