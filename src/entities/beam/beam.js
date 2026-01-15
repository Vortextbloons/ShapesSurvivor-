class Beam {
    constructor(player, weapon) {
        this.player = player;
        this.weapon = weapon;
        this.cooldown = 0;
        this.active = false;
        this.chainTargets = []; // Array of enemy references that the beam is hitting
        this.dead = false;
        
        // Calculate damage and pierce from weapon stats
        this.baseDamage = weapon.stats?.baseDamage || 5;
        this.cooldownFrames = weapon.stats?.cooldown || 10;
        this.maxChainCount = weapon.stats?.pierce || 3;
        this.knockback = weapon.stats?.knockback || 0.5;
        
        // Debug logging
        if (window.DevMode?.enabled) {
            console.log('[Beam] Created:', {
                baseDamage: this.baseDamage,
                cooldown: this.cooldownFrames,
                maxChain: this.maxChainCount,
                knockback: this.knockback
            });
        }
        
        // Visual properties
        const fx = weapon.specialEffect || {};
        this.beamWidth = fx.beamWidth || 4;
        this.beamColor = fx.beamColor || '#66d9ff';
        this.glowColor = fx.beamGlowColor || '#99e6ff';
        this.coreColor = fx.beamCoreColor || '#ffffff';
         
        // Animation properties
        this.pulseTimer = 0;
        
        // Track hit enemies this frame to prevent multiple hits
        this.hitThisFrame = new Set();
    }
    
    update() {
        if (this.dead) return;
        
        // Update pulse animation
        this.pulseTimer += 0.15;
        
        // Always find chain targets for visual tracking
        this.updateChainTargets();
        
        // Set active state based on whether we have targets
        this.active = this.chainTargets.length > 0;
        
        // Update cooldown
        if (this.cooldown > 0) {
            this.cooldown--;
        }
        
        // Apply damage only when cooldown is ready and we have targets
        if (this.cooldown === 0 && this.chainTargets.length > 0) {
            this.applyDamage();
            this.cooldown = this.cooldownFrames;
        }
        
        // Clear hit tracking for next frame
        this.hitThisFrame.clear();
    }
    
    updateChainTargets() {
        this.chainTargets = [];
        if (!Game || !Game._enemyGrid) return;
        
        // Configuration
        const maxRange = 400;   // Maximum range for finding initial target
        const chainRange = 300; // Range for chaining between targets
        
        // Start from player position
        let currentPos = { x: this.player.x, y: this.player.y };
        const hitEnemies = new Set();
        
        // Find first target (nearest to player)
        const firstTarget = this.findNearestEnemy(currentPos.x, currentPos.y, maxRange, hitEnemies);
        
        if (!firstTarget) return;
        
        this.chainTargets.push(firstTarget);
        hitEnemies.add(firstTarget);
        currentPos = { x: firstTarget.x, y: firstTarget.y };
        
        // Chain to additional targets based on pierce stat
        for (let i = 1; i < this.maxChainCount; i++) {
            const nextTarget = this.findNearestEnemy(currentPos.x, currentPos.y, chainRange, hitEnemies);
            
            if (!nextTarget) break;
            
            this.chainTargets.push(nextTarget);
            hitEnemies.add(nextTarget);
            currentPos = { x: nextTarget.x, y: nextTarget.y };
        }
    }
    
    findNearestEnemy(x, y, range, excludeSet) {
        let nearest = null;
        let minDist = range * range;
        
        const iterate = (enemy) => {
            if (!enemy || enemy.dead) return true;
            if (excludeSet.has(enemy)) return true;
            
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < minDist) {
                minDist = distSq;
                nearest = enemy;
            }
            return true;
        };
        
        Game._enemyGrid.forEachNear(x, y, range, iterate);
        
        return nearest;
    }
    
    applyDamage() {
        if (!this.player) return;
        
        // Get player stats for damage calculation
        const playerDmgMult = this.player.stats?.damage || 1;
        const playerCritChance = this.weapon.stats?.critChance || 0.1;
        const playerCritDmg = this.player.stats?.critDamage || 2;
        
        // Beam damage scales with projectile count (like auras)
        const projectileCount = Math.max(1, Math.floor(this.player.effects?.projectileCount || 1));
        
        // Apply damage to each target in the chain
        for (let i = 0; i < this.chainTargets.length; i++) {
            const enemy = this.chainTargets[i];
            
            if (!enemy || enemy.dead || this.hitThisFrame.has(enemy)) continue;
            
            // Calculate damage with diminishing returns for chained targets
            const chainMult = Math.pow(0.85, i); // 15% reduction per chain
            const isCrit = Math.random() < playerCritChance;
            const critMult = isCrit ? playerCritDmg : 1;
            const finalDamage = this.baseDamage * playerDmgMult * projectileCount * chainMult * critMult;
            
            // Get source position for knockback calculation
            const prevPos = i === 0 ? 
                { x: this.player.x, y: this.player.y } : 
                { x: this.chainTargets[i - 1].x, y: this.chainTargets[i - 1].y };
            
            // Apply damage with correct parameters: (amount, isCrit, knockback, sourceX, sourceY, attacker, meta)
            enemy.takeDamage(finalDamage, isCrit, this.knockback, prevPos.x, prevPos.y, this.player);
            
            // Apply additional knockback from player effects
            const kbBonus = this.player.effects?.knockbackOnHitBonus || 0;
            if (kbBonus > 0) {
                const dx = enemy.x - prevPos.x;
                const dy = enemy.y - prevPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0) {
                    enemy.vx += (dx / dist) * kbBonus;
                    enemy.vy += (dy / dist) * kbBonus;
                }
            }
            
            // Track that we hit this enemy this frame
            this.hitThisFrame.add(enemy);
            
            // Trigger on-hit effects
            if (this.player.onProjectileHit) {
                this.player.onProjectileHit(enemy, isCrit, finalDamage);
            }
        }
    }
    
    render(ctx) {
        if (!this.active || this.chainTargets.length === 0) return;
        
        ctx.save();
        
        // Calculate pulsing animation
        const pulse = Math.sin(this.pulseTimer) * 0.3 + 0.7;
        
        // Draw all beam segments from player through chain targets
        let prevPos = { x: this.player.x, y: this.player.y };
        
        for (let i = 0; i < this.chainTargets.length; i++) {
            const target = this.chainTargets[i];
            if (!target || target.dead) continue;
            
            // Outer glow
            ctx.strokeStyle = this.glowColor;
            ctx.lineWidth = this.beamWidth + 8;
            ctx.globalAlpha = 0.2 * pulse;
            ctx.beginPath();
            ctx.moveTo(prevPos.x, prevPos.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
            
            // Middle glow
            ctx.strokeStyle = this.glowColor;
            ctx.lineWidth = this.beamWidth + 4;
            ctx.globalAlpha = 0.4 * pulse;
            ctx.beginPath();
            ctx.moveTo(prevPos.x, prevPos.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
            
            // Main beam with jagged lightning effect
            ctx.strokeStyle = this.beamColor;
            ctx.lineWidth = this.beamWidth;
            ctx.globalAlpha = 0.9 * pulse;
            this.drawLightningSegment(ctx, prevPos.x, prevPos.y, target.x, target.y);
            
            // Bright core
            ctx.strokeStyle = this.coreColor;
            ctx.lineWidth = this.beamWidth * 0.4;
            ctx.globalAlpha = 0.7 * pulse;
            ctx.beginPath();
            ctx.moveTo(prevPos.x, prevPos.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
            
            // Impact effect at target
            this.drawImpactEffect(ctx, target.x, target.y, pulse);
            
            prevPos = { x: target.x, y: target.y };
        }
        
        // Origin effect at player
        this.drawOriginEffect(ctx, this.player.x, this.player.y, pulse);
        
        ctx.restore();
    }
    
    drawImpactEffect(ctx, x, y, pulse) {
        // Outer ring
        ctx.beginPath();
        ctx.arc(x, y, 8 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = this.glowColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4 * pulse;
        ctx.stroke();
        
        // Inner flash
        ctx.beginPath();
        ctx.arc(x, y, 4 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = this.coreColor;
        ctx.globalAlpha = 0.6 * pulse;
        ctx.fill();
    }
    
    drawOriginEffect(ctx, x, y, pulse) {
        // Pulsing glow at beam origin
        ctx.beginPath();
        ctx.arc(x, y, 10 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = this.beamColor;
        ctx.globalAlpha = 0.3 * pulse;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y, 5 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = this.coreColor;
        ctx.globalAlpha = 0.5 * pulse;
        ctx.fill();
    }
    
    drawLightningSegment(ctx, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 10) {
            // Too short, draw straight line
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            return;
        }
        
        // Create jagged lightning effect
        const segments = Math.floor(dist / 20);
        const points = [{ x: x1, y: y1 }];
        
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const baseX = x1 + dx * t;
            const baseY = y1 + dy * t;
            
            // Perpendicular offset
            const perpX = -dy / dist;
            const perpY = dx / dist;
            const offset = (Math.random() - 0.5) * 15;
            
            points.push({
                x: baseX + perpX * offset,
                y: baseY + perpY * offset
            });
        }
        
        points.push({ x: x2, y: y2 });
        
        // Draw the jagged line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
    }
}

// Export to window for global access
window.Beam = Beam;
