/**
 * Boss System for Shapes Survivor v0.9
 * 
 * Manages unique boss encounters that spawn at specific time intervals.
 * Bosses have special mechanics, multiple phases, and guaranteed legendary drops.
 * 
 * @module Boss
 */

class Boss {
    /**
     * Create a boss entity
     * @param {Object} data - Boss data from bosses.json
     * @param {number} x - Initial X position
     * @param {number} y - Initial Y position
     * @param {number} level - Current game level for scaling
     */
    constructor(data, x, y, level) {
        this.id = data.id;
        this.name = data.name;
        this.x = x;
        this.y = y;
        this.level = level;
        
        // Boss stats
        this.maxHp = this.calculateMaxHp(data, level);
        this.hp = this.maxHp;
        this.damage = data.baseDamage * (1 + level * 0.1);
        this.speed = data.baseSpeed || 1.0;
        this.radius = data.radius || 30;
        
        // Boss mechanics
        this.phase = 1;
        this.maxPhases = data.phases?.length || 1;
        this.mechanics = data.mechanics || [];
        this.abilities = data.abilities || [];
        
        // Timers
        this.abilityTimer = 0;
        this.phaseTransitionTimer = 0;
        
        // Visual
        this.color = data.color || '#ff0000';
        this.isElite = true; // Bosses always render as elite
        this.isBoss = true;
        
        // State
        this.active = true;
        this.invulnerable = false;
        
        // Loot
        this.guaranteedDrops = data.guaranteedDrops || [];
    }
    
    /**
     * Calculate boss max HP based on level
     * @param {Object} data - Boss data
     * @param {number} level - Game level
     * @returns {number} Calculated max HP
     */
    calculateMaxHp(data, level) {
        const baseHp = data.baseHp || 1000;
        const hpPerLevel = data.hpPerLevel || 100;
        return baseHp + (hpPerLevel * level);
    }
    
    /**
     * Update boss state
     * @param {number} deltaTime - Time since last update in seconds
     * @param {Object} player - Player entity for targeting
     */
    update(deltaTime, player) {
        if (!this.active) return;
        
        // Check for phase transition
        this.checkPhaseTransition();
        
        // Update ability cooldowns
        this.abilityTimer += deltaTime;
        
        // Execute boss AI behavior
        this.executeBehavior(deltaTime, player);
        
        // Use abilities
        if (this.abilityTimer >= 3.0) { // Ability every 3 seconds
            this.useAbility(player);
            this.abilityTimer = 0;
        }
    }
    
    /**
     * Check if boss should transition to next phase
     */
    checkPhaseTransition() {
        const hpThreshold = this.maxHp * ((this.maxPhases - this.phase) / this.maxPhases);
        
        if (this.hp <= hpThreshold && this.phase < this.maxPhases) {
            this.phase++;
            this.onPhaseTransition();
        }
    }
    
    /**
     * Handle phase transition effects
     */
    onPhaseTransition() {
        // TODO: Implement phase transition effects
        // - Brief invulnerability
        // - Screen shake
        // - Visual effect
        // - Change behavior pattern
        // - Spawn minions
        
        console.log(`${this.name} entering phase ${this.phase}!`);
        this.invulnerable = true;
        
        setTimeout(() => {
            this.invulnerable = false;
        }, 2000);
    }
    
    /**
     * Execute boss behavior pattern
     * @param {number} deltaTime - Time delta
     * @param {Object} player - Player entity
     */
    executeBehavior(deltaTime, player) {
        // TODO: Implement boss-specific movement patterns
        // - Chase player
        // - Circle player
        // - Teleport
        // - Retreat when low HP
        
        // Simple chase for now
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            this.x += (dx / dist) * this.speed * deltaTime * 60;
            this.y += (dy / dist) * this.speed * deltaTime * 60;
        }
    }
    
    /**
     * Use a boss ability
     * @param {Object} player - Player entity for targeting
     */
    useAbility(player) {
        if (this.abilities.length === 0) return;
        
        // TODO: Implement boss abilities
        // - Summon minions
        // - Fire projectile patterns
        // - Create hazard zones
        // - Temporary buffs/shields
        // - Area attacks
        
        const ability = this.abilities[Math.floor(Math.random() * this.abilities.length)];
        console.log(`${this.name} uses ${ability.name}!`);
    }
    
    /**
     * Take damage
     * @param {number} damage - Amount of damage
     * @returns {boolean} Whether boss is still alive
     */
    takeDamage(damage) {
        if (this.invulnerable) return true;
        
        this.hp -= damage;
        
        if (this.hp <= 0) {
            this.hp = 0;
            this.active = false;
            this.onDeath();
            return false;
        }
        
        return true;
    }
    
    /**
     * Handle boss death
     */
    onDeath() {
        // TODO: Implement death effects
        // - Screen shake
        // - Explosion effect
        // - Drop guaranteed loot
        // - Award achievements
        // - Grant bonus essence
        
        console.log(`${this.name} defeated!`);
    }
    
    /**
     * Render the boss
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} camera - Camera offset
     */
    render(ctx, camera) {
        if (!this.active) return;
        
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;
        
        // TODO: Implement boss rendering
        // - Larger size than normal enemies
        // - Special visual effects
        // - Phase-dependent appearance
        // - Boss glow/aura
        
        // Simple circle for now
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Boss indicator (crown or special marker)
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👑', screenX, screenY - this.radius - 10);
        
        ctx.restore();
    }
    
    /**
     * Render boss health bar at top of screen
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} canvasWidth - Canvas width
     */
    renderHealthBar(ctx, canvasWidth) {
        const barWidth = canvasWidth * 0.6;
        const barHeight = 30;
        const x = (canvasWidth - barWidth) / 2;
        const y = 60;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - 5, y - 5, barWidth + 10, barHeight + 10);
        
        // Health bar
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        const healthPercent = this.hp / this.maxHp;
        ctx.fillStyle = healthPercent > 0.5 ? '#e74c3c' : '#c0392b';
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        
        // Border
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);
        
        // Boss name and HP text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.name} - Phase ${this.phase}/${this.maxPhases}`, canvasWidth / 2, y - 10);
        ctx.fillText(`${Math.ceil(this.hp)} / ${Math.ceil(this.maxHp)}`, canvasWidth / 2, y + barHeight / 2 + 5);
    }
}

// Export for use in game engine
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Boss;
}
