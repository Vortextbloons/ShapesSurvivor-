class Projectile {
    constructor(x, y, vx, vy, damage, isCrit, pierce, knockback, attacker = null, targetTeam = 'enemy') {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.damage = damage; this.isCrit = isCrit;
        this.pierce = pierce; this.knockback = knockback;
        this.radius = 5; this.dead = false;
        this.hitList = [];
        this.attacker = attacker;
        this.targetTeam = targetTeam;
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
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + (this.isCrit?2:0), 0, Math.PI*2);
        ctx.fillStyle = this.isCrit ? '#fff' : '#f1c40f';
        ctx.fill();
        ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle; ctx.fill(); ctx.shadowBlur=0;
    }
}

class OrbitalProjectile {
    constructor(attacker, orbitRadius, angle, angularSpeed, damage, isCrit, knockback, life = 999, hitEvery = 12) {
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
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + (this.isCrit ? 2 : 0), 0, Math.PI * 2);
        ctx.fillStyle = this.isCrit ? '#fff' : '#f1c40f';
        ctx.fill();
        ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle; ctx.fill(); ctx.shadowBlur = 0;
    }
}
