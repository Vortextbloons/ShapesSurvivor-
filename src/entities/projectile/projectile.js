class Projectile {
    constructor(x, y, vx, vy, damage, isCrit, pierce, knockback, attacker = null, targetTeam = 'enemy', opts = null) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.damage = damage; this.isCrit = isCrit;
        this.pierce = pierce; this.knockback = knockback;
        this.radius = 5; this.dead = false;
        this.hitSet = new Set();
        this.attacker = attacker;
        this.targetTeam = targetTeam;
        this.opts = opts || {};

        const styleId = (opts && opts.styleId) ? opts.styleId : resolveProjectileStyleId(attacker);
        this.style = resolveProjectileStyle(styleId);
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        const camX = (typeof Game !== 'undefined' && Game?.camera?.x !== undefined) ? Game.camera.x : 0;
        const camY = (typeof Game !== 'undefined' && Game?.camera?.y !== undefined) ? Game.camera.y : 0;
        const zoom = (typeof Game !== 'undefined' && typeof Game._getCameraZoom === 'function') ? Game._getCameraZoom() : 1;
        const viewW = canvas.width / zoom;
        const viewH = canvas.height / zoom;
        const margin = 240;
        if (this.x < camX - margin || this.x > camX + viewW + margin || this.y < camY - margin || this.y > camY + viewH + margin) {
            this.dead = true;
        }

        if (this.dead) return;

        if (this.targetTeam === 'enemy') {
            const kbBonus = this.attacker?.effects?.knockbackOnHitBonus || 0;
            const kb = (this.knockback || 0) + kbBonus;

            const px = this.x;
            const py = this.y;
            const searchR = (this.radius || 0) + 120;

            const iterate = (e) => {
                if (!e || e.dead) return true;
                if (this.hitSet.has(e)) return true;

                const dx = e.x - px;
                const dy = e.y - py;
                const rr = (this.radius + e.radius);
                if ((dx * dx + dy * dy) < (rr * rr)) {
                    e.takeDamage(this.damage, this.isCrit, kb, px, py, this.attacker);
                    this.hitSet.add(e);
                    
                    // Engineer Turret Effects
                    if (this.opts.nanobot && this.opts.engineer) {
                        const healAmount = this.damage * 0.10;
                        if (this.opts.engineer.heal) this.opts.engineer.heal(healAmount);
                    }
                    
                    if (this.opts.tesla) {
                        if (Math.random() < 0.25) {
                            if (e.applyStatus) e.applyStatus('stun', 1500);
                            
                            let chains = 2;
                            const chainRange = 200;
                            const chainDmg = this.damage;
                            
                            const chainIterate = (other) => {
                                if (chains <= 0) return false;
                                if (!other || other.dead || other === e) return true;
                                
                                const dx = other.x - e.x;
                                const dy = other.y - e.y;
                                if (dx*dx + dy*dy < chainRange*chainRange) {
                                    other.takeDamage(chainDmg, this.isCrit, 0, e.x, e.y, this.attacker);
                                    if (other.applyStatus) other.applyStatus('stun', 1500);
                                    chains--;
                                }
                                return true;
                            };
                            
                            if (typeof Game.forEachEnemyNear === 'function') {
                                Game.forEachEnemyNear(e.x, e.y, chainRange, chainIterate);
                            } else {
                                for (let i = 0; i < Game.enemies.length; i++) {
                                    if (!chainIterate(Game.enemies[i])) break;
                                }
                            }
                        }
                    }
                    
                    // Splinter: Chance to spawn two projectiles on hit
                    const fx = this.attacker?.effects;
                    if (fx?.splinterChance && fx?.splinterDamageMult && fx?.splinterAngle && !this.isSplinter) {
                        if (Math.random() < fx.splinterChance) {
                            const angle = Math.atan2(this.vy, this.vx);
                            const angleOffset = fx.splinterAngle;
                            const speed = Math.hypot(this.vx, this.vy);
                            const splinterDmg = this.damage * fx.splinterDamageMult;
                            
                            // Left splinter
                            const leftAngle = angle + angleOffset;
                            const leftVx = Math.cos(leftAngle) * speed;
                            const leftVy = Math.sin(leftAngle) * speed;
                            const leftProj = new Projectile(px, py, leftVx, leftVy, splinterDmg, false, Math.max(0, this.pierce - 1), kb * 0.5, this.attacker, 'enemy', this.style ? { styleId: this.style } : null);
                            leftProj.isSplinter = true;
                            
                            // Right splinter
                            const rightAngle = angle - angleOffset;
                            const rightVx = Math.cos(rightAngle) * speed;
                            const rightVy = Math.sin(rightAngle) * speed;
                            const rightProj = new Projectile(px, py, rightVx, rightVy, splinterDmg, false, Math.max(0, this.pierce - 1), kb * 0.5, this.attacker, 'enemy', this.style ? { styleId: this.style } : null);
                            rightProj.isSplinter = true;
                            
                            if (typeof Game !== 'undefined' && Game.projectiles) {
                                Game.projectiles.push(leftProj, rightProj);
                            }
                        }
                    }
                    
                    if (this.pierce > 0) this.pierce--;
                    else {
                        this.dead = true;
                        return false;
                    }
                }
                return true;
            };

            if (typeof Game.forEachEnemyNear === 'function') {
                Game.forEachEnemyNear(px, py, searchR, iterate);
            } else {
                for (let i = 0, n = Game.enemies.length; i < n; i++) {
                    if (iterate(Game.enemies[i]) === false) break;
                }
            }
        } else if (this.targetTeam === 'player') {
            const p = Game.player;
            const dx = p.x - this.x;
            const dy = p.y - this.y;
            const rr = (this.radius + p.radius);
            if ((dx * dx + dy * dy) < (rr * rr)) {
                p.takeDamage(this.damage);
                this.dead = true;
            }
        }
    }
    draw() {
        const s = this.style || DEFAULT_PROJECTILE_STYLE;
        const r = (s.radius !== undefined ? s.radius : this.radius) + (this.isCrit ? (s.critRadiusBonus || 2) : 0);

        // Cheap motion trail (no particles): one stroked segment.
        if (s.trailLen && (this.vx || this.vy)) {
            const len = s.trailLen;
            ctx.save();
            ctx.globalAlpha = (s.trailAlpha !== undefined) ? s.trailAlpha : 0.35;
            ctx.strokeStyle = this.isCrit ? (s.critTrailColor || '#ffffff') : (s.trailColor || s.color || '#f1c40f');
            ctx.lineWidth = s.trailWidth || 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.vx * len, this.y - this.vy * len);
            ctx.stroke();
            ctx.restore();
        }

        const fill = this.isCrit ? (s.critColor || '#ffffff') : (s.color || '#f1c40f');
        ctx.save();
        ctx.fillStyle = fill;
        ctx.strokeStyle = s.strokeColor || 'rgba(0,0,0,0.35)';
        ctx.lineWidth = s.strokeWidth || 1;

        // Soft glow
        const glow = (s.glowBlur !== undefined) ? s.glowBlur : 10;
        if (glow > 0) {
            ctx.shadowBlur = glow;
            ctx.shadowColor = fill;
        }

        drawStyledProjectileShape(ctx, s.shape || 'circle', this.x, this.y, r, this.vx, this.vy);
        ctx.fill();
        if (s.strokeWidth) ctx.stroke();

        // Reset shadow
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

class OrbitalProjectile {
    constructor(attacker, orbitRadius, angle, angularSpeed, damage, isCrit, knockback, life = 999, hitEvery = 12, opts = null) {
        this.attacker = attacker;
        this.orbitRadius = orbitRadius;
        this.angle = angle;
        this.angularSpeed = angularSpeed;

        this.damage = damage;
        this.isCrit = isCrit;
        this.knockback = knockback;

        this.radius = 7;
        this.dead = false;
        this.life = life;

        this.hitEvery = hitEvery;
        // Use expiry frames to avoid decrementing per-enemy cooldowns each tick.
        this.hitExpiryFrame = new WeakMap();

        this.x = attacker?.x || 0;
        this.y = attacker?.y || 0;

        const styleId = (opts && opts.styleId) ? opts.styleId : resolveProjectileStyleId(attacker);
        // Orbitals should look a bit chunkier by default.
        this.style = { ...resolveProjectileStyle(styleId), radius: 7 };
    }

    update() {
        if (!this.attacker || this.attacker.hp <= 0) {
            this.dead = true;
            return;
        }

        this.life--;
        if (this.life <= 0) {
            this.dead = true;
            return;
        }

        this.angle += this.angularSpeed;
        this.x = this.attacker.x + Math.cos(this.angle) * this.orbitRadius;
        this.y = this.attacker.y + Math.sin(this.angle) * this.orbitRadius;

        const nowFrame = (Game?.elapsedFrames || 0);
        for (let e of Game.enemies) {
            if (!e || e.dead) continue;
            const readyAt = this.hitExpiryFrame.get(e) || 0;
            if (nowFrame < readyAt) continue;

            const dx = e.x - this.x;
            const dy = e.y - this.y;
            const rr = (this.radius + e.radius);
            if ((dx * dx + dy * dy) < (rr * rr)) {
                e.takeDamage(this.damage, this.isCrit, this.knockback, this.x, this.y, this.attacker, { source: 'orbital' });
                this.hitExpiryFrame.set(e, nowFrame + (this.hitEvery || 0));
            }
        }
    }

    draw() {
        const s = this.style || DEFAULT_PROJECTILE_STYLE;
        const r = (s.radius !== undefined ? s.radius : this.radius) + (this.isCrit ? (s.critRadiusBonus || 2) : 0);

        // Orbitals: short radial streak for motion.
        if (s.trailLen) {
            const ox = this.attacker?.x || this.x;
            const oy = this.attacker?.y || this.y;
            const dx = this.x - ox;
            const dy = this.y - oy;
            const d = Math.hypot(dx, dy) || 1;
            const nx = dx / d;
            const ny = dy / d;
            ctx.save();
            ctx.globalAlpha = (s.trailAlpha !== undefined) ? s.trailAlpha : 0.25;
            ctx.strokeStyle = this.isCrit ? (s.critTrailColor || '#ffffff') : (s.trailColor || s.color || '#f1c40f');
            ctx.lineWidth = s.trailWidth || 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.x - nx * 10, this.y - ny * 10);
            ctx.lineTo(this.x + nx * 6, this.y + ny * 6);
            ctx.stroke();
            ctx.restore();
        }

        const fill = this.isCrit ? (s.critColor || '#ffffff') : (s.color || '#f1c40f');
        ctx.save();
        ctx.fillStyle = fill;
        ctx.strokeStyle = s.strokeColor || 'rgba(0,0,0,0.35)';
        ctx.lineWidth = s.strokeWidth || 1;

        const glow = (s.glowBlur !== undefined) ? s.glowBlur : 10;
        if (glow > 0) {
            ctx.shadowBlur = glow;
            ctx.shadowColor = fill;
        }

        drawStyledProjectileShape(ctx, s.shape || 'circle', this.x, this.y, r, (this.x - (this.attacker?.x || this.x)), (this.y - (this.attacker?.y || this.y)));
        ctx.fill();
        if (s.strokeWidth) ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// ------------------------------
// Projectile styling (fast, deterministic, no assets)
// ------------------------------

const DEFAULT_PROJECTILE_STYLE = {
    shape: 'circle',
    color: '#f1c40f',
    radius: 5,
    glowBlur: 10,
    strokeWidth: 0,
    trailLen: 0
};

function resolveProjectileStyleId(attacker) {
    const w = attacker?.equipment?.weapon || null;
    if (!w) return 'default';
    return w.legendaryId || w.archetypeId || w.name || 'default';
}

function hashStringToInt(str) {
    const s = String(str || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function resolveProjectileStyle(styleId) {
    const id = String(styleId || 'default');
    const styles = window.ProjectileStyles || { default: DEFAULT_PROJECTILE_STYLE };
    
    // Check curated styles first
    if (styles.curated && styles.curated[id]) {
        return { ...styles.default, ...styles.curated[id] };
    }

    // Check legendary styles
    if (styles.legendary && styles.legendary[id]) {
        return { ...styles.default, ...styles.legendary[id] };
    }

    // Deterministic fallback: gives *every* weapon id a distinct look.
    const h = hashStringToInt(id);
    const shapes = ['circle', 'diamond', 'triangle', 'square', 'hex', 'shard'];
    const shape = shapes[h % shapes.length];

    const hue = (h % 360);
    const color = `hsl(${hue}, 90%, 60%)`;
    const trailLen = 1.0 + ((h >>> 8) % 140) / 100; // 1.0 .. 2.4
    const trailWidth = 2 + ((h >>> 16) % 3); // 2..4
    const glowBlur = 10 + ((h >>> 20) % 10); // 10..19

    return {
        ...styles.default,
        shape,
        color,
        trailLen,
        trailWidth,
        glowBlur,
        critColor: '#ffffff',
        critTrailColor: '#ffffff'
    };
}

function drawStyledProjectileShape(ctx, shape, x, y, r, vx, vy) {
    ctx.beginPath();

    if (shape === 'circle') {
        ctx.arc(x, y, r, 0, Math.PI * 2);
        return;
    }

    const ang = (vx || vy) ? Math.atan2(vy, vx) : 0;

    if (shape === 'diamond') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.rect(-r, -r, r * 2, r * 2);
        ctx.restore();
        return;
    }

    if (shape === 'square') {
        ctx.rect(x - r, y - r, r * 2, r * 2);
        return;
    }

    if (shape === 'triangle') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.moveTo(r * 1.35, 0);
        ctx.lineTo(-r * 1.0, r * 0.8);
        ctx.lineTo(-r * 1.0, -r * 0.8);
        ctx.closePath();
        ctx.restore();
        return;
    }

    if (shape === 'hex') {
        const n = 6;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + ang * 0.35;
            const px = x + Math.cos(a) * r;
            const py = y + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        return;
    }

    if (shape === 'shard') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.moveTo(r * 1.6, 0);
        ctx.lineTo(-r * 1.2, r * 0.45);
        ctx.lineTo(-r * 0.6, 0);
        ctx.lineTo(-r * 1.2, -r * 0.45);
        ctx.closePath();
        ctx.restore();
        return;
    }

    // Fun special-case for stormcaller: a tiny zig bolt.
    if (shape === 'zig') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        const w = r * 0.7;
        const h = r * 1.8;
        ctx.moveTo(-w * 0.3, -h * 0.9);
        ctx.lineTo(w * 0.5, -h * 0.2);
        ctx.lineTo(0, -h * 0.2);
        ctx.lineTo(w * 0.3, h * 0.9);
        ctx.lineTo(-w * 0.5, h * 0.2);
        ctx.lineTo(0, h * 0.2);
        ctx.closePath();
        ctx.restore();
        return;
    }

    // Unknown shape => circle fallback.
    ctx.arc(x, y, r, 0, Math.PI * 2);
}
