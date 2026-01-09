class Entity {
    constructor(x, y, radius, color) {
        this.x = x || 0;
        this.y = y || 0;
        this.radius = radius || 16;
        this.color = color || '#fff';
        
        this.hp = 10;
        this.maxHp = 10;
        this.dead = false;
        
        // Hit flash effect
        this.hitFlashTimer = 0;
        this.hitFlashDuration = window.EffectsConfig?.hitFlash?.duration || 5;
        this.hitFlashColor = window.EffectsConfig?.hitFlash?.color || '#ffffff';
        this.hitFlashIntensity = window.EffectsConfig?.hitFlash?.intensity || 0.7;

        // Universal status effects (definitions shared across Player/Enemy)
        this.slow = { mult: 1, time: 0, stacks: 0 };
        this.freeze = { time: 0 };
        this.stun = { time: 0 };
        this.fear = { time: 0, active: false }; // unified structure
    }

    /**
     * Basic distance calculation to another entity or point {x, y}
     */
    distanceTo(other) {
        if (!other) return 999999;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Apply damage. Can be overridden for complex mitigation logic.
     */
    takeDamage(amount) {
        this.hp -= amount;
        
        // Trigger hit flash effect
        this.hitFlashTimer = this.hitFlashDuration;
        
        if (this.hp <= 0) {
            this.hp = 0;
            if (!this.dead) this.die();
        }
        return amount;
    }

    /**
     * Restore health, capped at maxHp.
     */
    heal(amount) {
        if (this.dead) return;
        this.hp += amount;
        if (this.hp > this.maxHp) {
            this.hp = this.maxHp;
        }
    }

    kill() {
        this.hp = 0;
        this.die();
    }

    die() {
        this.dead = true;
    }

    // Common update hook for status effects timers
    updateStatusEffects() {
        // Hit flash decay
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer--;
        }
        
        // Slow decay
        if (this.slow.time > 0) {
            this.slow.time--;
            if (this.slow.time <= 0) {
                this.slow.mult = 1;
                this.slow.stacks = 0;
            }
        }

        // Freeze decay
        if (this.freeze.time > 0) {
            this.freeze.time--;
        }

        // Stun decay
        if (this.stun.time > 0) {
            this.stun.time--;
        }
        
        // Fear decay
        if (this.fear.time > 0) {
            this.fear.time--;
            if (this.fear.time <= 0) this.fear.active = false;
        }
    }
}

// Export for module usage if needed, but keeping global for now as per project style
window.Entity = Entity;
