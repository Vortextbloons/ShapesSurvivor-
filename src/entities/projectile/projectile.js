class Projectile {
    constructor(x, y, vx, vy, damage, isCrit, pierce, knockback, attacker = null, targetTeam = 'enemy', opts = null) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.damage = damage; this.isCrit = isCrit;
        this.pierce = pierce; this.knockback = knockback;
        this.radius = 5; this.dead = false;
        this.hitList = [];
        this.attacker = attacker;
        this.targetTeam = targetTeam;

        const styleId = (opts && opts.styleId) ? opts.styleId : resolveProjectileStyleId(attacker);
        this.style = resolveProjectileStyle(styleId);
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x<0 || this.x>canvas.width || this.y<0 || this.y>canvas.height) this.dead = true;

        if (this.dead) return;

        if (this.targetTeam === 'enemy') {
            const kbBonus = this.attacker?.effects?.knockbackOnHitBonus || 0;
            const kb = (this.knockback || 0) + kbBonus;

            for (let e of Game.enemies) {
                if (this.hitList.includes(e)) continue;

                if (Math.hypot(e.x - this.x, e.y - this.y) < this.radius + e.radius) {
                    e.takeDamage(this.damage, this.isCrit, kb, this.x, this.y, this.attacker);
                    this.hitList.push(e);
                    if (this.pierce > 0) this.pierce--;
                    else { this.dead = true; break; }
                }
            }
        } else if (this.targetTeam === 'player') {
            const p = Game.player;
            if (Math.hypot(p.x - this.x, p.y - this.y) < this.radius + p.radius) {
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
        this.hitCooldown = new Map();

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

        // Reduce per-enemy cooldowns.
        for (const [e, cd] of this.hitCooldown.entries()) {
            const next = cd - 1;
            if (next <= 0) this.hitCooldown.delete(e);
            else this.hitCooldown.set(e, next);
        }

        for (let e of Game.enemies) {
            if (!e || e.dead) continue;
            if (this.hitCooldown.has(e)) continue;

            if (Math.hypot(e.x - this.x, e.y - this.y) < this.radius + e.radius) {
                e.takeDamage(this.damage, this.isCrit, this.knockback, this.x, this.y, this.attacker, { source: 'orbital' });
                this.hitCooldown.set(e, this.hitEvery);
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

    // Curated styles for the core weapon archetypes.
    // (Fallback below ensures *every* weapon id still looks distinct.)
    const curated = {
        starter_wand: { shape: 'diamond', color: '#5dade2', trailLen: 1.6, trailWidth: 2, glowBlur: 14 },
        wand: { shape: 'diamond', color: '#85c1e9', trailLen: 1.8, trailWidth: 2, glowBlur: 14 },
        scepter: { shape: 'circle', color: '#bb8fce', trailLen: 1.2, trailWidth: 3, glowBlur: 18 },
        dagger: { shape: 'shard', color: '#ecf0f1', trailLen: 2.2, trailWidth: 2, glowBlur: 12 },
        hatchet: { shape: 'square', color: '#f39c12', trailLen: 1.3, trailWidth: 3, glowBlur: 10 },
        axe: { shape: 'hex', color: '#e74c3c', trailLen: 1.0, trailWidth: 4, glowBlur: 12 },
        talisman: { shape: 'triangle', color: '#1abc9c', trailLen: 1.5, trailWidth: 2, glowBlur: 12 },
        relic: { shape: 'square', color: '#f7dc6f', trailLen: 1.0, trailWidth: 2, glowBlur: 16 }
    };
    if (curated[id]) {
        return { ...DEFAULT_PROJECTILE_STYLE, ...curated[id] };
    }

    // Curated styles for some legendaries (still falls back if new ones are added).
    const legendary = {
        bloodthirst: { shape: 'shard', color: '#c0392b', trailLen: 2.0, trailWidth: 3, glowBlur: 16, critColor: '#ffffff' },
        void_walker: { shape: 'hex', color: '#8e44ad', trailLen: 1.4, trailWidth: 3, glowBlur: 18 },
        frostbite: { shape: 'diamond', color: '#aed6f1', trailLen: 1.6, trailWidth: 2, glowBlur: 16 },
        stormcaller: { shape: 'zig', color: '#f4d03f', trailLen: 2.0, trailWidth: 2, glowBlur: 18 },
        tempest: { shape: 'triangle', color: '#5dade2', trailLen: 2.1, trailWidth: 2, glowBlur: 14 },
        grave_needle: { shape: 'shard', color: '#d7dbdd', trailLen: 2.4, trailWidth: 2, glowBlur: 12 },
        infernal_wrath: { shape: 'circle', color: '#e67e22', trailLen: 1.4, trailWidth: 3, glowBlur: 18 }
    };
    if (legendary[id]) {
        return { ...DEFAULT_PROJECTILE_STYLE, ...legendary[id] };
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
        ...DEFAULT_PROJECTILE_STYLE,
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
