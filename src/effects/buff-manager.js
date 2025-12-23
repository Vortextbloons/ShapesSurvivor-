// Centralized buff management system
// Handles buff lifecycle, stacking, duration, stat modifiers, and rendering data

class Buff {
    /**
     * @param {Object} config - Buff configuration
     * @param {string} config.id - Unique identifier for the buff
     * @param {string} config.name - Display name
     * @param {string} [config.description] - Description shown in UI
     * @param {number} [config.duration] - Duration in ticks (0 = permanent)
     * @param {number} [config.maxStacks] - Maximum stacks (1 = no stacking)
     * @param {boolean} [config.refreshOnReapply] - Whether to refresh duration on reapply
     * @param {Array} [config.modifiers] - Stat modifiers [{stat, operation, value, layer}]
     * @param {Function} [config.onApply] - Called when buff is first applied (entity, buff)
     * @param {Function} [config.onTick] - Called every tick (entity, buff)
     * @param {Function} [config.onExpire] - Called when buff expires (entity, buff)
     * @param {Function} [config.onStack] - Called when stacks increase (entity, buff, newStacks)
     * @param {Object} [config.visual] - Visual config {color, icon, showProgress}
     * @param {Object} [config.metadata] - Custom data storage
     */
    constructor(config) {
        this.id = config.id || 'unknown';
        this.name = config.name || 'Buff';
        this.description = config.description || '';
        
        // Duration & Stacking
        this.duration = Math.max(0, Number(config.duration) || 0);
        this.maxDuration = this.duration;
        this.time = this.duration;
        this.maxStacks = Math.max(1, Number(config.maxStacks) || 1);
        this.stacks = 1;
        this.refreshOnReapply = config.refreshOnReapply !== false; // default true
        
        // Stat modifiers - will be applied through StatCalculator
        this.modifiers = Array.isArray(config.modifiers) ? config.modifiers : [];
        
        // Callbacks for custom behavior
        this.onApply = typeof config.onApply === 'function' ? config.onApply : null;
        this.onTick = typeof config.onTick === 'function' ? config.onTick : null;
        this.onExpire = typeof config.onExpire === 'function' ? config.onExpire : null;
        this.onStack = typeof config.onStack === 'function' ? config.onStack : null;
        
        // Visual config
        this.visual = {
            color: config.visual?.color || '#4CAF50',
            icon: config.visual?.icon || null,
            showProgress: config.visual?.showProgress !== false
        };
        
        // Custom metadata for complex buffs
        this.metadata = config.metadata || {};
    }
    
    /**
     * Advance buff timer by 1 tick
     * @returns {boolean} - True if buff is still active
     */
    tick() {
        if (this.duration === 0) return true; // Permanent buff
        
        this.time--;
        return this.time > 0;
    }
    
    /**
     * Add stacks to the buff
     * @param {number} amount - Stacks to add
     * @returns {number} - New stack count
     */
    addStacks(amount = 1) {
        const oldStacks = this.stacks;
        this.stacks = Math.min(this.maxStacks, this.stacks + amount);
        return this.stacks;
    }
    
    /**
     * Refresh buff duration
     */
    refresh() {
        this.time = this.maxDuration;
    }
    
    /**
     * Get progress percentage (for visual bars)
     * @returns {number} - 0 to 1
     */
    getProgress() {
        if (this.duration === 0) return 1; // Permanent buffs always full
        return Math.max(0, Math.min(1, this.time / this.maxDuration));
    }
    
    /**
     * Get display data for UI
     * @returns {Object}
     */
    getDisplayData() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            time: this.time,
            maxTime: this.maxDuration,
            stacks: this.stacks > 1 ? this.stacks : null,
            progress: this.getProgress(),
            color: this.visual.color,
            icon: this.visual.icon,
            showProgress: this.visual.showProgress
        };
    }
}

class BuffManager {
    /**
     * @param {Object} entity - The entity this manager belongs to (Player or Enemy)
     */
    constructor(entity) {
        this.entity = entity;
        this.buffs = new Map(); // id -> Buff
        this.buffDefinitions = new Map(); // id -> config template
    }
    
    /**
     * Register a buff definition for later use
     * @param {Object} config - Buff configuration
     */
    registerBuffDefinition(config) {
        if (!config.id) {
            console.warn('BuffManager: Cannot register buff without id', config);
            return;
        }
        this.buffDefinitions.set(config.id, config);
    }
    
    /**
     * Register multiple buff definitions
     * @param {Array|Object} definitions - Array of configs or object keyed by id
     */
    registerBuffDefinitions(definitions) {
        if (Array.isArray(definitions)) {
            definitions.forEach(def => this.registerBuffDefinition(def));
        } else if (typeof definitions === 'object') {
            Object.values(definitions).forEach(def => this.registerBuffDefinition(def));
        }
    }
    
    /**
     * Apply a buff to the entity
     * @param {string|Object} buffIdOrConfig - Buff id (registered) or full config
     * @param {Object} [overrides] - Override config properties
     * @returns {Buff|null}
     */
    applyBuff(buffIdOrConfig, overrides = {}) {
        let config;
        
        if (typeof buffIdOrConfig === 'string') {
            // Look up registered definition
            config = this.buffDefinitions.get(buffIdOrConfig);
            if (!config) {
                console.warn(`BuffManager: Buff definition not found: ${buffIdOrConfig}`);
                return null;
            }
            config = { ...config, ...overrides };
        } else {
            config = { ...buffIdOrConfig, ...overrides };
        }
        
        const buffId = config.id;
        if (!buffId) {
            console.warn('BuffManager: Cannot apply buff without id', config);
            return null;
        }
        
        const existing = this.buffs.get(buffId);
        
        if (existing) {
            // Buff already active - handle stacking/refreshing
            const oldStacks = existing.stacks;
            
            if (existing.maxStacks > 1) {
                existing.addStacks(1);
                if (existing.onStack) {
                    existing.onStack(this.entity, existing, existing.stacks);
                }
            }
            
            if (existing.refreshOnReapply) {
                existing.refresh();
            }
            
            return existing;
        } else {
            // Create new buff
            const buff = new Buff(config);
            this.buffs.set(buffId, buff);
            
            if (buff.onApply) {
                buff.onApply(this.entity, buff);
            }
            
            return buff;
        }
    }
    
    /**
     * Remove a buff by id
     * @param {string} buffId
     * @returns {boolean} - True if buff was removed
     */
    removeBuff(buffId) {
        const buff = this.buffs.get(buffId);
        if (!buff) return false;
        
        if (buff.onExpire) {
            buff.onExpire(this.entity, buff);
        }
        
        this.buffs.delete(buffId);
        return true;
    }
    
    /**
     * Check if entity has a specific buff
     * @param {string} buffId
     * @returns {boolean}
     */
    hasBuff(buffId) {
        return this.buffs.has(buffId);
    }
    
    /**
     * Get a specific buff
     * @param {string} buffId
     * @returns {Buff|null}
     */
    getBuff(buffId) {
        return this.buffs.get(buffId) || null;
    }
    
    /**
     * Get all active buffs
     * @returns {Array<Buff>}
     */
    getActiveBuffs() {
        return Array.from(this.buffs.values());
    }
    
    /**
     * Get display data for all buffs (for UI)
     * @returns {Array<Object>}
     */
    getBuffDisplayData() {
        return this.getActiveBuffs().map(buff => buff.getDisplayData());
    }
    
    /**
     * Tick all buffs (call every game tick)
     */
    tick() {
        const toRemove = [];
        
        for (const [id, buff] of this.buffs.entries()) {
            // Call custom tick logic
            if (buff.onTick) {
                buff.onTick(this.entity, buff);
            }
            
            // Advance timer
            const stillActive = buff.tick();
            
            if (!stillActive) {
                toRemove.push(id);
            }
        }
        
        // Remove expired buffs
        toRemove.forEach(id => this.removeBuff(id));
        
        return toRemove.length > 0; // Return true if any buffs expired
    }
    
    /**
     * Apply all buff stat modifiers to StatCalculator objects
     * @param {Object} statObjs - Object of Stat instances from StatCalculator
     */
    applyModifiers(statObjs) {
        for (const buff of this.buffs.values()) {
            for (const mod of buff.modifiers) {
                const statName = mod.stat;
                const statObj = statObjs[statName];
                
                if (!statObj) {
                    console.warn(`BuffManager: Stat '${statName}' not found for buff '${buff.id}'`);
                    continue;
                }
                
                // Calculate per-stack value if buff has stacks
                let value = mod.value || 0;
                if (mod.perStack && buff.stacks > 1) {
                    value = value * buff.stacks;
                }
                
                statObj.addModifier({
                    layer: mod.layer !== undefined ? mod.layer : 3, // Buffs default to layer 3
                    operation: mod.operation || 'add',
                    value: value,
                    source: 'buff',
                    stat: statName,
                    name: buff.name
                });
            }
        }
    }
    
    /**
     * Clear all buffs
     */
    clearAll() {
        // Call onExpire for all buffs
        for (const buff of this.buffs.values()) {
            if (buff.onExpire) {
                buff.onExpire(this.entity, buff);
            }
        }
        this.buffs.clear();
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.Buff = Buff;
    window.BuffManager = BuffManager;
}
