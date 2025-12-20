// EnemyArchetypes is now loaded from data/enemies.json via DataLoader
// It will be populated on window.EnemyArchetypes when DataLoader.loadAll() is called

function rollRange([min, max]) {
    return min + Math.random() * (max - min);
}

function spawnAtEdge() {
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) return { x: Math.random() * canvas.width, y: -30 };
    if (edge === 1) return { x: canvas.width + 30, y: Math.random() * canvas.height };
    if (edge === 2) return { x: Math.random() * canvas.width, y: canvas.height + 30 };
    return { x: -30, y: Math.random() * canvas.height };
}

class Enemy {
    constructor(archetypeId = 'basic', opts = {}) {
        this.archetypeId = archetypeId;
        this.archetype = window.EnemyArchetypes[archetypeId] || window.EnemyArchetypes.basic;

        const lvl = Math.max(1, Game?.player?.level || 1);
        const runSecs = Math.max(0, (Game?.elapsedFrames || 0) / 60);

        const pos = (opts.x !== undefined && opts.y !== undefined) ? { x: opts.x, y: opts.y } : spawnAtEdge();
        this.x = pos.x;
        this.y = pos.y;

        this.radius = this.archetype.radius;
        this.baseSpeed = rollRange(this.archetype.speed);
        this.speed = this.baseSpeed;

        // Difficulty scaling:
        // - Player power scales multiplicatively via items/effects.
        // - Enemies therefore need super-linear scaling to stay threatening.
        const levelHpScale = Math.pow(1.06, (lvl - 1));
        const timeHpScale = 1 + Math.min(0.60, runSecs / 900); // up to +60% over 15 min
        this.hp = (this.archetype.hpBase + (lvl * this.archetype.hpPerLevel)) * levelHpScale * timeHpScale;
        this.maxHp = this.hp;
        this.color = this.archetype.color;
        this.vx = 0;
        this.vy = 0;

        const resBase = rollRange(this.archetype.resistance);
        // Resistance scales upward but is capped to avoid pure bullet-sponges.
        this.resistance = Math.max(0, Math.min(0.55, resBase + (lvl * 0.004) + (runSecs * 0.00015)));

        const xpMult = 1 + Math.min(0.35, (lvl - 1) * 0.012); // up to +35%

        const levelDmgScale = Math.pow(1.035, (lvl - 1));
        const timeDmgScale = 1 + Math.min(0.50, runSecs / 720); // up to +50% over 12 min
        const dmgMult = levelDmgScale * timeDmgScale;

        this.contactDamage = this.archetype.contactDamage * dmgMult;
        this.xpValue = this.archetype.xp * xpMult;

        this.rangedDamage = (this.archetype.ranged?.damage || 0) * dmgMult;

        // Boss modifier (can also be forced via opts).
        this.isBoss = !!this.archetype.isBoss || !!opts.boss;
        if (this.isBoss) {
            const bossCfg = this.archetype.boss || {};
            const hpMult = (bossCfg.hpMult !== undefined) ? bossCfg.hpMult : 6;
            const dmgMultBoss = (bossCfg.dmgMult !== undefined) ? bossCfg.dmgMult : 1.2;
            this.hp *= hpMult;
            this.maxHp = this.hp;
            this.contactDamage *= dmgMultBoss;
            this.rangedDamage *= dmgMultBoss;
        }

        // Optional elite modifier (set by EnemyFactory).
        this.isElite = !!opts.elite;
        if (this.isElite) {
            this.radius = Math.ceil(this.radius * 1.15);
            this.hp *= 2.75;
            this.maxHp = this.hp;
            this.contactDamage *= 1.45;
            this.rangedDamage *= 1.45;
        }

        // Contact damage should not tick every frame.
        // 60fps => 6 frames ~= 0.10s.
        this.lastContactDamageFrame = -999999;

        this.lastAttacker = null;

        // Timers / states
        this.slow = { mult: 1, time: 0 };
        this.burn = StatusEffects.createDot();
        this.poison = StatusEffects.createDot();
        this.freeze = { time: 0 };
        this.stun = { time: 0 };

        this.charge = { cd: 0, time: 0, dirX: 0, dirY: 0 };
        if (this.archetype.charge) this.charge.cd = Math.floor(this.archetype.charge.cooldown * (0.6 + Math.random() * 0.7));

        this.ranged = { cd: 0 };
        if (this.archetype.ranged) this.ranged.cd = Math.floor(this.archetype.ranged.cooldown * (0.5 + Math.random() * 0.8));

        // Boss AI state
        this.bossAI = this.archetype.bossAI || null;
        this.bossState = {
            cd: 0,
            cd2: 0
        };
        if (this.isBoss && this.bossAI) {
            this.bossState.cd = Math.floor((this.bossAI.cooldown || 180) * (0.7 + Math.random() * 0.3));
            this.bossState.cd2 = Math.floor((this.bossAI.cooldown2 || this.bossAI.cooldown || 220) * (0.7 + Math.random() * 0.3));
        }
    }

    tickBossAI({ dirX, dirY, distToP, incapacitated }) {
        if (!this.isBoss || !this.bossAI) return;

        // Mild enrage: below 40% HP, skills fire slightly more often.
        const enrageMult = ((this.hp / Math.max(1, this.maxHp)) < 0.40) ? 0.75 : 1;
        const dec = (incapacitated ? 0 : 1);

        const type = this.bossAI.type;
        if (type === 'radialBurst') {
            this.bossState.cd -= dec;
            if (this.bossState.cd <= 0) {
                const n = Math.max(6, this.bossAI.projectileCount || 12);
                const spd = this.bossAI.projectileSpeed || 5.5;
                const dmg = (this.rangedDamage || this.contactDamage) * (this.bossAI.damageMult || 1);

                for (let i = 0; i < n; i++) {
                    const ang = (i / n) * Math.PI * 2;
                    const vx = Math.cos(ang) * spd;
                    const vy = Math.sin(ang) * spd;
                    Game.projectiles.push(new Projectile(this.x, this.y, vx, vy, dmg, false, 0, 0, this, 'player', null));
                }

                // Small visual pulse.
                Game.effects.push(new AuraEffect(this.x, this.y, this.radius + 28));

                this.bossState.cd = Math.floor((this.bossAI.cooldown || 150) * enrageMult);
            }
        } else if (type === 'summonMinions') {
            this.bossState.cd -= dec;
            if (this.bossState.cd <= 0) {
                const id = this.bossAI.minionId || 'swarmer';
                const count = Math.max(1, this.bossAI.count || 4);
                const r = Math.max(18, this.bossAI.spawnRadius || 32);
                for (let i = 0; i < count; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    const rr = r * (0.6 + Math.random() * 0.8);
                    Game.enemies.push(new Enemy(id, { x: this.x + Math.cos(ang) * rr, y: this.y + Math.sin(ang) * rr }));
                }
                Game.effects.push(new AuraEffect(this.x, this.y, this.radius + 22));
                this.bossState.cd = Math.floor((this.bossAI.cooldown || 210) * enrageMult);
            }
        } else if (type === 'shockwaveSlam') {
            this.bossState.cd -= dec;
            if (this.bossState.cd <= 0) {
                const range = this.bossAI.range || 200;
                const dmg = this.bossAI.damage || (this.contactDamage * 1.5);
                Game.effects.push(new AuraEffect(this.x, this.y, range));
                if (distToP <= (range + Game.player.radius)) {
                    Game.player.takeDamage(dmg);
                }
                this.bossState.cd = Math.floor((this.bossAI.cooldown || 240) * enrageMult);
            }
        }
    }

    update() {
        // Status effects
        StatusEffects.tickSlow(this.slow);
        StatusEffects.tickTimer(this.freeze);
        StatusEffects.tickTimer(this.stun);

        const incapacitated = (this.freeze.time > 0) || (this.stun.time > 0);
        this.speed = incapacitated ? 0 : (this.baseSpeed * (this.slow.mult || 1));

        if (StatusEffects.tickDot(this, this.burn, '#ff8c00', this.lastAttacker)) return;
        if (StatusEffects.tickDot(this, this.poison, '#2ecc71', this.lastAttacker)) return;

        // Velocity decay (knockback)
        this.vx *= 0.8;
        this.vy *= 0.8;

        const dxToP = Game.player.x - this.x;
        const dyToP = Game.player.y - this.y;
        const distToP = Math.hypot(dxToP, dyToP);
        const dirX = distToP > 0 ? dxToP / distToP : 0;
        const dirY = distToP > 0 ? dyToP / distToP : 0;

        // Boss skills tick alongside base movement/attacks.
        this.tickBossAI({ dirX, dirY, distToP, incapacitated });

        // Charger dash
        if (this.archetype.charge) {
            if (this.charge.time > 0) {
                this.charge.time--;
                this.x += this.charge.dirX * this.archetype.charge.speed;
                this.y += this.charge.dirY * this.archetype.charge.speed;
            } else {
                if (!incapacitated) this.charge.cd--;
                if (this.charge.cd <= 0 && distToP >= this.archetype.charge.minRange && distToP <= this.archetype.charge.maxRange) {
                    this.charge.time = this.archetype.charge.duration;
                    this.charge.dirX = dirX;
                    this.charge.dirY = dirY;
                    this.charge.cd = this.archetype.charge.cooldown;
                }
            }
        }

        // Ranged AI
        if (this.archetype.ranged) {
            const keepMin = this.archetype.ranged.keepMin;
            const keepMax = this.archetype.ranged.keepMax;

            if (!incapacitated) {
                // Move to maintain distance.
                if (distToP < keepMin) {
                    this.x -= dirX * this.speed;
                    this.y -= dirY * this.speed;
                } else if (distToP > keepMax) {
                    this.x += dirX * this.speed;
                    this.y += dirY * this.speed;
                }

                this.ranged.cd--;
                if (this.ranged.cd <= 0 && distToP <= (keepMax + 80)) {
                    this.ranged.cd = this.archetype.ranged.cooldown;
                    const spd = this.archetype.ranged.projSpeed;
                    const vx = dirX * spd;
                    const vy = dirY * spd;
                    Game.projectiles.push(new Projectile(this.x, this.y, vx, vy, this.rangedDamage || this.archetype.ranged.damage, false, 0, 0, this, 'player', null));
                }
            }
        }

        // Default chase movement if not charging and not being knocked
        if (!this.archetype.ranged && (!this.archetype.charge || this.charge.time <= 0)) {
            if (incapacitated) {
                // Still drift from knockback.
                this.x += this.vx;
                this.y += this.vy;
            } else if (Math.abs(this.vx) < 0.1 && Math.abs(this.vy) < 0.1) {
                if (distToP > 0) {
                    this.x += dirX * this.speed;
                    this.y += dirY * this.speed;
                }
            } else {
                this.x += this.vx;
                this.y += this.vy;
            }
        } else {
            // Still apply knockback drift
            this.x += this.vx;
            this.y += this.vy;
        }

        if (distToP < this.radius + Game.player.radius) {
            const nowFrame = Game?.elapsedFrames ?? 0;
            // Keep a small delay to avoid instant death from overlap.
            if ((nowFrame - this.lastContactDamageFrame) >= 6) {
                this.lastContactDamageFrame = nowFrame;
                Game.player.takeDamage(this.contactDamage);
            }
        }
    }

    applyOnHitStatuses(finalAmount, attacker) {
        const fx = attacker?.effects;
        if (!fx) return;

        StatusEffects.applyBestDot(this.burn, finalAmount, fx.burnOnHitPctTotal, fx.burnDuration, fx.burnTickEvery);
        StatusEffects.applySlow(this.slow, fx.slowOnHitMult, fx.slowDuration);
        StatusEffects.applyBestDot(this.poison, finalAmount, fx.poisonOnHitPctTotal, fx.poisonDuration, fx.poisonTickEvery);

        if (fx.freezeOnHitChance && fx.freezeDuration) {
            if (Math.random() < fx.freezeOnHitChance) {
                this.freeze.time = Math.max(this.freeze.time || 0, fx.freezeDuration);
            }
        }

        if (fx.stunOnHitChance && fx.stunDuration) {
            if (Math.random() < fx.stunOnHitChance) {
                this.stun.time = Math.max(this.stun.time || 0, fx.stunDuration);
            }
        }
    }

    takeDamage(amount, isCrit, knockback = 0, sourceX, sourceY, attacker = null, meta = null) {
        if (this.dead) return;

        if (attacker) this.lastAttacker = attacker;

        // Execute window (based on current hp).
        const fx = attacker?.effects;
        let finalAmount = amount;
        if (fx?.damageVsPoisonedMult && this.poison?.time > 0) finalAmount *= fx.damageVsPoisonedMult;
        if (fx?.damageVsBurningMult && this.burn?.time > 0) finalAmount *= fx.damageVsBurningMult;
        if (fx?.damageVsFrozenMult && this.freeze?.time > 0) finalAmount *= fx.damageVsFrozenMult;
        if (fx?.damageVsSlowedMult && this.slow?.time > 0) finalAmount *= fx.damageVsSlowedMult;
        if (fx?.damageVsStunnedMult && this.stun?.time > 0) finalAmount *= fx.damageVsStunnedMult;
        if (fx?.shatterVsFrozenMult && this.freeze?.time > 0) {
            finalAmount *= fx.shatterVsFrozenMult;
        }
        if (fx?.executeBelowPct && fx?.executeDamageMult && (this.hp / this.maxHp) <= fx.executeBelowPct) {
            finalAmount *= fx.executeDamageMult;
        }

        if (!fx?.ignoreResistance) {
            finalAmount = finalAmount * (1 - (this.resistance || 0));
        }

        this.hp -= finalAmount;
        Game.floatingTexts.push(new FloatingText(Math.round(finalAmount), this.x, this.y, isCrit ? '#f1c40f' : '#fff', isCrit));

        if (fx?.healOnHitPct || fx?.healOnHitFlat) {
            const healAmt = (finalAmount * (fx.healOnHitPct || 0)) + (fx.healOnHitFlat || 0);
            attacker?.heal?.(healAmt);
        }

        this.applyOnHitStatuses(finalAmount, attacker);

        if (knockback > 0 && sourceX !== undefined) {
            const dx = this.x - sourceX;
            const dy = this.y - sourceY;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                // Bosses resist knockback heavily (only 15% effective)
                const kbMult = this.isBoss ? 0.15 : 1.0;
                this.vx = (dx / len) * knockback * kbMult;
                this.vy = (dy / len) * knockback * kbMult;
            }
        }

        if (this.hp <= 0) {
            this.die(attacker);
            return;
        }

        // Chain lightning (avoid recursion loops).
        const chainVisited = meta?.chainVisited || null;
        const chainRemaining = meta?.chainRemaining;
        const allowChain = fx?.chainJumps && fx?.chainRange && fx?.chainDamageMult;
        if (allowChain && (chainRemaining === undefined || chainRemaining > 0)) {
            const visited = chainVisited || new Set();
            if (!chainVisited) visited.add(this);

            const remaining = (chainRemaining === undefined) ? fx.chainJumps : chainRemaining;
            if (remaining > 0) {
                let best = null;
                let bestD = Infinity;
                for (const e of Game.enemies) {
                    if (!e || e.dead) continue;
                    if (visited.has(e)) continue;
                    const d = Math.hypot(e.x - this.x, e.y - this.y);
                    if (d <= fx.chainRange && d < bestD) {
                        bestD = d;
                        best = e;
                    }
                }
                if (best) {
                    visited.add(best);
                    best.takeDamage(finalAmount * fx.chainDamageMult, false, 0, this.x, this.y, attacker, {
                        chainVisited: visited,
                        chainRemaining: remaining - 1
                    });
                }
            }
        }
    }

    die(attacker) {
        if (this.dead) return;
        this.dead = true;

        if (typeof Game !== 'undefined' && Game?.stats?.onEnemyKilled) {
            Game.stats.onEnemyKilled(this);
        }

        if (attacker && attacker.gainXp) attacker.gainXp(this.xpValue);
        Game.particles.push(new Particle(this.x, this.y, this.color));

        if (this.isBoss && typeof Game !== 'undefined' && Game?.onBossDefeated) {
            Game.onBossDefeated(this);
        }

        const spawn = this.archetype.onDeathSpawn;
        if (spawn?.id && spawn.count) {
            for (let i = 0; i < spawn.count; i++) {
                const ang = Math.random() * Math.PI * 2;
                const r = 10 + Math.random() * 12;
                Game.enemies.push(new Enemy(spawn.id, { x: this.x + Math.cos(ang) * r, y: this.y + Math.sin(ang) * r }));
            }
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Suppress the tiny hp bar for bosses (they use the big HUD bar).
        if (!this.isBoss) {
            const hpPct = Math.max(0, this.hp / this.maxHp);
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x - 10, this.y - 20, 20, 4);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(this.x - 10, this.y - 20, 20 * hpPct, 4);
        }
    }
}

const EnemyFactory = {
    pickArchetype(level) {
        // Weighted table by level gates.
        const opts = [
            { id: 'basic', w: 65, min: 1 },
            { id: 'swarmer', w: 10, min: 1 },
            { id: 'runner', w: 12, min: 3 },
            { id: 'tank', w: 10, min: 6 },
            { id: 'charger', w: 10, min: 8 },
            { id: 'ranged', w: 12, min: 10 },
            { id: 'splitter', w: 8, min: 12 }
        ].filter(o => level >= o.min);

        const total = opts.reduce((a, c) => a + c.w, 0);
        let roll = Math.random() * total;
        for (const o of opts) {
            roll -= o.w;
            if (roll <= 0) return o.id;
        }
        return 'basic';
    },

    spawn(level) {
        const id = this.pickArchetype(level);
        // Elite chance: ramps with level and (lightly) with time.
        const runSecs = Math.max(0, (Game?.elapsedFrames || 0) / 60);
        const base = 0.015;
        const lvlBonus = Math.min(0.08, Math.max(0, level - 6) * 0.004);
        const timeBonus = Math.min(0.05, runSecs / 1800); // +5% by 30 min
        const eliteChance = Math.min(0.12, base + lvlBonus + timeBonus);
        const elite = (level >= 7) && (Math.random() < eliteChance);
        return new Enemy(id, { elite });
    }
};
