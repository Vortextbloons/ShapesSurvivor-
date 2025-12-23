/**
 * Turret Entity Class for the Engineer character
 * Turrets are automated defense units that inherit stats from the player
 * and attack nearby enemies.
 */
class Turret {
    constructor(x, y, owner, options = {}) {
        this.x = x;
        this.y = y;
        this.owner = owner; // The player who spawned this turret
        this.radius = 12;
        this.dead = false;
        
        // Turret lifetime (in frames, ~60fps)
        // Base duration: 30 seconds (1800 frames), can be extended by artifacts
        const baseDuration = options.duration || 1800;
        const durationBonus = this.getArtifactDurationBonus();
        this.maxLife = Math.floor(baseDuration * (1 + durationBonus));
        this.life = this.maxLife;
        
        // Calculate inherited stats from owner
        this.inheritStats();
        
        // Attack state
        this.attackCooldown = 0;
        this.baseAttackCooldown = 40; // frames between attacks
        
        // Visual state
        this.angle = 0; // Facing direction
        this.pulsePhase = Math.random() * Math.PI * 2;
        
        // Healing tick timer (for Repair Drone artifact)
        this.healTickTimer = 0;
    }

    /**
     * Get turret duration bonus from artifacts (Repair Drone: +25%)
     */
    getArtifactDurationBonus() {
        if (!this.owner?.artifacts) return 0;
        
        const repairDrone = this.owner.artifacts.find(a => 
            (a.id === 'repair_drone' || a.archetypeId === 'repair_drone') && 
            a.specialEffect?.turretDurationBonus
        );
        
        return repairDrone?.specialEffect?.turretDurationBonus || 0;
    }

    /**
     * Get turret attack speed bonus from artifacts (Overclocked Core: +50%)
     */
    getArtifactAttackSpeedBonus() {
        if (!this.owner?.artifacts) return 0;
        
        const overclockedCore = this.owner.artifacts.find(a => 
            (a.id === 'overclocked_core' || a.archetypeId === 'overclocked_core') && 
            a.specialEffect?.turretAttackSpeedBonus
        );
        
        return overclockedCore?.specialEffect?.turretAttackSpeedBonus || 0;
    }

    /**
     * Get turret range bonus from artifacts (Overclocked Core: +25%)
     */
    getArtifactRangeBonus() {
        if (!this.owner?.artifacts) return 0;
        
        const overclockedCore = this.owner.artifacts.find(a => 
            (a.id === 'overclocked_core' || a.archetypeId === 'overclocked_core') && 
            a.specialEffect?.turretRangeBonus
        );
        
        return overclockedCore?.specialEffect?.turretRangeBonus || 0;
    }

    /**
     * Get turret heal per second from artifacts (Repair Drone: 2% max HP/sec)
     */
    getArtifactHealPerSecond() {
        if (!this.owner?.artifacts) return 0;
        
        const repairDrone = this.owner.artifacts.find(a => 
            (a.id === 'repair_drone' || a.archetypeId === 'repair_drone') && 
            a.specialEffect?.turretHealPerSecond
        );
        
        return repairDrone?.specialEffect?.turretHealPerSecond || 0;
    }

    /**
     * Calculate inherited stats from the owner player
     */
    inheritStats() {
        if (!this.owner) {
            this.damage = 10;
            this.range = 200;
            this.critChance = 0.1;
            this.critDamageMult = 2;
            return;
        }

        // Base stat inheritance (50% by default, can be boosted by Weapons Cache)
        let inheritance = this.owner.turretStatInheritance || 0.5;
        
        // Weapons Cache artifact: +25% stat inheritance
        const weaponsCache = this.owner.artifacts?.find(a => 
            (a.id === 'weapons_cache' || a.archetypeId === 'weapons_cache') && 
            a.specialEffect?.turretStatInheritanceBonus
        );
        if (weaponsCache) {
            inheritance += weaponsCache.specialEffect.turretStatInheritanceBonus;
        }

        // Inherit damage from player
        const weapon = this.owner.equipment?.weapon;
        const baseDamage = weapon ? this.owner.getEffectiveItemStat(weapon, 'baseDamage', 10) : 10;
        this.damage = baseDamage * (this.owner.stats?.damage || 1) * inheritance;

        // Base range, with artifact bonus
        this.range = 200 * (1 + this.getArtifactRangeBonus());

        // Inherit crit stats
        this.critChance = (this.owner.getEffectiveCritChance?.() || 0.1) * inheritance;
        this.critDamageMult = (this.owner.getBaseCritDamageMult?.() || 2) * inheritance;

        // Inherit knockback
        const weaponKnockback = weapon ? this.owner.getEffectiveItemStat(weapon, 'knockback', 0) : 0;
        this.knockback = weaponKnockback * inheritance;
    }

    update() {
        if (this.dead) return;

        // Decrease lifetime
        this.life--;
        if (this.life <= 0) {
            this.dead = true;
            return;
        }

        // Pulse animation
        this.pulsePhase += 0.05;

        // Repair Drone healing tick (every second = 60 frames)
        const healPerSecond = this.getArtifactHealPerSecond();
        if (healPerSecond > 0 && this.owner && typeof this.owner.heal === 'function') {
            this.healTickTimer++;
            if (this.healTickTimer >= 60) {
                this.healTickTimer = 0;
                const healAmount = (this.owner.stats?.maxHp || 100) * healPerSecond;
                this.owner.heal(healAmount);
            }
        }

        // Attack cooldown with artifact speed bonus
        const attackSpeedBonus = this.getArtifactAttackSpeedBonus();
        const effectiveCooldown = Math.max(10, this.baseAttackCooldown / (1 + attackSpeedBonus));
        
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
            return;
        }

        // Find nearest enemy in range
        let nearestEnemy = null;
        let nearestDist = Infinity;

        for (const enemy of Game.enemies) {
            if (!enemy || enemy.dead) continue;
            
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.range && dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        }

        if (nearestEnemy) {
            this.attack(nearestEnemy);
            this.attackCooldown = Math.floor(effectiveCooldown);
            
            // Update facing angle
            const dx = nearestEnemy.x - this.x;
            const dy = nearestEnemy.y - this.y;
            this.angle = Math.atan2(dy, dx);
        }
    }

    attack(enemy) {
        if (!enemy || enemy.dead) return;

        // Calculate projectile direction
        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const dirX = dx / dist;
        const dirY = dy / dist;

        // Projectile speed
        const speed = 10;
        const vx = dirX * speed;
        const vy = dirY * speed;

        // Determine if crit
        const isCrit = Math.random() < this.critChance;
        let finalDamage = this.damage;
        if (isCrit) {
            finalDamage *= this.critDamageMult;
        }

        // Create projectile (using the player as attacker for effects)
        const projectile = new Projectile(
            this.x, this.y,
            vx, vy,
            finalDamage,
            isCrit,
            0, // pierce
            this.knockback,
            this.owner, // Use owner for on-hit effects
            'enemy',
            { styleId: 'turret' }
        );

        Game.projectiles.push(projectile);
    }

    draw() {
        if (this.dead) return;

        const ctx = window.ctx;
        if (!ctx) return;

        // Life progress for fade-out effect near end
        const lifePercent = this.life / this.maxLife;
        const fadeAlpha = lifePercent < 0.2 ? lifePercent / 0.2 : 1;

        ctx.save();
        ctx.globalAlpha = fadeAlpha;

        // Pulse effect
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.1;
        const drawRadius = this.radius * pulse;

        // Range indicator (faint)
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 152, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Turret base (hexagonal)
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const px = this.x + Math.cos(angle) * drawRadius;
            const py = this.y + Math.sin(angle) * drawRadius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#ff9800';
        ctx.fill();
        ctx.strokeStyle = '#e65100';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Turret barrel (points toward target)
        ctx.beginPath();
        const barrelLength = drawRadius * 1.5;
        const barrelWidth = 3;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#424242';
        ctx.fillRect(0, -barrelWidth / 2, barrelLength, barrelWidth);
        ctx.restore();

        // Center glow
        ctx.beginPath();
        ctx.arc(this.x, this.y, drawRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffeb3b';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffeb3b';
        ctx.fill();
        ctx.shadowBlur = 0;

        // Life bar
        const barWidth = 20;
        const barHeight = 3;
        const barX = this.x - barWidth / 2;
        const barY = this.y - drawRadius - 8;
        
        ctx.fillStyle = '#424242';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(barX, barY, barWidth * lifePercent, barHeight);

        ctx.restore();
    }
}

// Expose globally
window.Turret = Turret;
