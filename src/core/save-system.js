class SaveSystem {
    constructor() {
        this.data = {
            easy: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 },
            normal: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 },
            hard: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 },
            nightmare: { bestTimeSec: 0, bestKills: 0, bestLevel: 0 }
        };
        this.essence = 0;

        // Meta progression: starter weapon templates
        // - ownedStarterTemplates: array of template ids
        // - selectedStarterTemplateId: active starter template id
        this.ownedStarterTemplates = ['projectile'];
        this.selectedStarterTemplateId = 'projectile';
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

            // Load starter weapon template meta
            const ownedJson = localStorage.getItem('ss_meta_owned_starter_templates');
            if (ownedJson) {
                try {
                    const parsed = JSON.parse(ownedJson);
                    if (Array.isArray(parsed)) {
                        const cleaned = parsed.map(String).filter(Boolean);
                        this.ownedStarterTemplates = cleaned.length ? cleaned : ['projectile'];
                    }
                } catch (e) {
                    this.ownedStarterTemplates = ['projectile'];
                }
            }

            const selected = localStorage.getItem('ss_meta_selected_starter_template');
            if (selected) {
                this.selectedStarterTemplateId = String(selected);
            }

            // Ensure defaults always exist
            if (!Array.isArray(this.ownedStarterTemplates) || this.ownedStarterTemplates.length === 0) {
                this.ownedStarterTemplates = ['projectile'];
            }
            if (!this.selectedStarterTemplateId) {
                this.selectedStarterTemplateId = 'projectile';
            }
            if (!this.ownedStarterTemplates.includes('projectile')) {
                this.ownedStarterTemplates.unshift('projectile');
            }
            if (!this.ownedStarterTemplates.includes(this.selectedStarterTemplateId)) {
                this.selectedStarterTemplateId = this.ownedStarterTemplates[0] || 'projectile';
            }
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

            // Persist starter weapon template meta
            localStorage.setItem('ss_meta_owned_starter_templates', JSON.stringify(this.ownedStarterTemplates || []));
            localStorage.setItem('ss_meta_selected_starter_template', String(this.selectedStarterTemplateId || 'projectile'));
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
        this.ownedStarterTemplates = ['projectile'];
        this.selectedStarterTemplateId = 'projectile';
        try {
            const difficulties = ['easy', 'normal', 'hard', 'nightmare'];
            for (const diff of difficulties) {
                localStorage.removeItem(`ss_best_time_sec_${diff}`);
                localStorage.removeItem(`ss_best_kills_${diff}`);
                localStorage.removeItem(`ss_best_level_${diff}`);
            }
            localStorage.removeItem('ss_meta_essence');
            localStorage.removeItem('ss_meta_owned_starter_templates');
            localStorage.removeItem('ss_meta_selected_starter_template');
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

    spendEssence(amount) {
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) return false;
        if ((this.essence || 0) < amt) return false;
        this.essence -= amt;
        this._persist();
        return true;
    }

    getEssence() {
        return this.essence;
    }

    // Starter weapon template meta
    getOwnedStarterWeaponTemplateIds() {
        return Array.isArray(this.ownedStarterTemplates) ? [...this.ownedStarterTemplates] : ['projectile'];
    }

    isStarterWeaponTemplateOwned(templateId) {
        const id = String(templateId || '');
        if (!id) return false;
        return Array.isArray(this.ownedStarterTemplates) && this.ownedStarterTemplates.includes(id);
    }

    unlockStarterWeaponTemplate(templateId) {
        const id = String(templateId || '');
        if (!id) return false;
        if (!Array.isArray(this.ownedStarterTemplates)) this.ownedStarterTemplates = [];
        if (!this.ownedStarterTemplates.includes(id)) {
            this.ownedStarterTemplates.push(id);
            this._persist();
            return true;
        }
        return false;
    }

    getSelectedStarterWeaponTemplateId() {
        return this.selectedStarterTemplateId || 'projectile';
    }

    setSelectedStarterWeaponTemplateId(templateId) {
        const id = String(templateId || '');
        if (!id) return false;
        if (!this.isStarterWeaponTemplateOwned(id)) return false;
        this.selectedStarterTemplateId = id;
        this._persist();
        return true;
    }
}

window.SaveSystem = new SaveSystem();
