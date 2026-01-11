const rollRange = ([min, max]) => min + Math.random() * (max - min);

function spawnAtEdge() {
    const camX = window.Game?.camera?.x ?? 0;
    const camY = window.Game?.camera?.y ?? 0;
    const zoom = window.Game?._getCameraZoom?.() ?? 1;
    const viewW = canvas.width / zoom;
    const viewH = canvas.height / zoom;

    const edges = [
        () => ({ x: camX + Math.random() * viewW, y: camY - 30 }),
        () => ({ x: camX + viewW + 30, y: camY + Math.random() * viewH }),
        () => ({ x: camX + Math.random() * viewW, y: camY + viewH + 30 }),
        () => ({ x: camX - 30, y: camY + Math.random() * viewH })
    ];

    return edges[Math.floor(Math.random() * edges.length)]();
}

class Enemy extends Entity {
    constructor(archetypeId = 'basic', opts = {}) {
        const archetype = window.EnemyArchetypes[archetypeId] || window.EnemyArchetypes?.basic;
        const pos = (opts.x !== undefined && opts.y !== undefined) ? { x: opts.x, y: opts.y } : spawnAtEdge();

        super(pos.x, pos.y, archetype?.radius || 10, archetype?.color || '#f00');

        this.archetypeId = archetypeId;
        this.archetype = archetype;

        const lvl = Math.max(1, Game?.player?.level || 1);
        const runSecs = Math.max(0, (Game?.elapsedFrames || 0) / 60);
        const diffSettings = window.GameConstants?.DIFFICULTY_SETTINGS?.[Game?.selectedDifficulty || 'normal'] || {};

        this.baseSpeed = rollRange(this.archetype.speed) * (diffSettings.enemySpeedMult || 1);
        this.speed = this.baseSpeed;

        const levelHpScale = Math.pow(1.06, lvl - 1);
        const timeHpScale = 1 + Math.min(0.60, runSecs / 900);
        this.hp = (this.archetype.hpBase + lvl * this.archetype.hpPerLevel) * levelHpScale * timeHpScale * (diffSettings.enemyHpMult || 1);
        this.maxHp = this.hp;
        this.vx = this.vy = 0;

        const resBase = rollRange(this.archetype.resistance);
        this.resistance = Math.max(0, Math.min(0.55, resBase + lvl * 0.004 + runSecs * 0.00015));

        const xpMult = 1 + Math.min(0.35, (lvl - 1) * 0.012);
        const levelDmgScale = Math.pow(1.035, lvl - 1);
        const timeDmgScale = 1 + Math.min(0.50, runSecs / 720);
        const dmgMult = levelDmgScale * timeDmgScale * (diffSettings.enemyDmgMult || 1);

        this.contactDamage = this.archetype.contactDamage * dmgMult;
        this.xpValue = this.archetype.xp * xpMult;
        this.rangedDamage = (this.archetype.ranged?.damage || 0) * dmgMult;

        this.isBoss = !!this.archetype.isBoss || !!opts.boss;
        if (this.isBoss) {
            const bossCfg = this.archetype.boss || {};
            this.hp *= bossCfg.hpMult ?? 6;
            this.maxHp = this.hp;
            this.contactDamage *= bossCfg.dmgMult ?? 1.2;
            this.rangedDamage *= bossCfg.dmgMult ?? 1.2;
        }

        this.isElite = !!opts.elite;
        this.eliteModifiers = opts.eliteModifiers || [];
        if (this.isElite) {
            this.radius = Math.ceil(this.radius * 1.15);
            this.hp *= 2.75;
            this.maxHp = this.hp;
            this.contactDamage *= 1.45;
            this.rangedDamage *= 1.45;
            this.xpValue *= 3;

            for (const mod of this.eliteModifiers) {
                const { statMultipliers } = mod;
                if (statMultipliers) {
                    if (statMultipliers.speed) this.baseSpeed *= statMultipliers.speed;
                    if (statMultipliers.hp) {
                        this.hp *= statMultipliers.hp;
                        this.maxHp = this.hp;
                    }
                    if (statMultipliers.damage) {
                        this.contactDamage *= statMultipliers.damage;
                        this.rangedDamage *= statMultipliers.damage;
                    }
                    if (mod.statMultipliers.resistance) {
                        this.resistance = Math.min(0.75, this.resistance * mod.statMultipliers.resistance);
                    }
                }
            }
            
            // Initialize ability-specific state
            this.eliteState = {
                fireTrailParticles: [],
                summonCd: 0,
                summonedCount: 0,
                phaseShiftCd: 0,
                regenTimer: 0
            };
        }

        // Contact damage should not tick every frame.
        // 60fps => 6 frames ~= 0.10s.
        this.lastContactDamageFrame = -999999;

        this.lastAttacker = null;

        // Timers / states
        // Inherited from Entity: slow, freeze, stun, fear
        this.burnStacks = StatusEffects.createDotStack();
        this.poisonStacks = StatusEffects.createDotStack();
        this.shock = StatusEffects.createShock();
        this.vulnerability = StatusEffects.createVulnerability();

        // Aura damage multiplier from player armor (e.g., Singularity Mantle)
        this.auraDamageTakenMult = 1;

        this.charge = { cd: 0, time: 0, dirX: 0, dirY: 0 };
        if (this.archetype.charge) this.charge.cd = Math.floor(this.archetype.charge.cooldown * (0.6 + Math.random() * 0.7));

        this.ranged = { cd: 0 };
        if (this.archetype.ranged) this.ranged.cd = Math.floor(this.archetype.ranged.cooldown * (0.5 + Math.random() * 0.8));

        // Blink state for void_walker
        this.blink = { cd: 0 };
        if (this.archetype.blink) this.blink.cd = Math.floor(this.archetype.blink.cooldown * (0.6 + Math.random() * 0.8));

        // Shield bash state for shield_bearer
        this.shieldBash = { cd: 0, time: 0, dirX: 0, dirY: 0 };
        if (this.archetype.shieldBash) this.shieldBash.cd = Math.floor(this.archetype.shieldBash.cooldown * (0.6 + Math.random() * 0.7));

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

        // Elite debuff timer
        this.eliteDebuffCd = 0;
        this.bossSpawnTime = Game?.elapsedFrames || 0;
        this.strengthPhase = 0;
        this.bossCooldownReduction = 0;
    }

    tickBossAI({ dirX, dirY, distToP, incapacitated }) {
        if (!this.isBoss || !this.bossAI) return;

        // Mild enrage: below 40% HP, skills fire slightly more often.
        const enrageMult = ((this.hp / Math.max(1, this.maxHp)) < 0.40) ? 0.75 : 1;
        const dec = (incapacitated ? 0 : 1);

        const type = this.bossAI.type;
        switch (type) {
            case 'radialBurst': {
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

                    this.bossState.cd = Math.floor((this.bossAI.cooldown || 150) * enrageMult) - this.bossCooldownReduction;
                }
                break;
            }
            case 'summonMinions': {
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
                    this.bossState.cd = Math.floor((this.bossAI.cooldown || 210) * enrageMult) - this.bossCooldownReduction;
                }
                break;
            }
            case 'shockwaveSlam': {
                this.bossState.cd -= dec;
                if (this.bossState.cd <= 0) {
                    const range = this.bossAI.range || 200;
                    const dmg = this.bossAI.damage || (this.contactDamage * 1.5);
                    Game.effects.push(new AuraEffect(this.x, this.y, range));
                    if (distToP <= (range + Game.player.radius)) {
                        Game.player.takeDamage(dmg, this);
                    }
                    this.bossState.cd = Math.floor((this.bossAI.cooldown || 280) * enrageMult) - this.bossCooldownReduction;
                }
                break;
            }
            case 'blinkStrike': {
                this.bossState.cd -= dec;
                if (this.bossState.cd <= 0) {
                    const blinkRange = this.bossAI.blinkRange || 150;
                    const dmg = this.bossAI.damage || (this.contactDamage * 1.5);
                    const slowDuration = this.bossAI.slowDuration || 120;
                    const slowAmount = this.bossAI.slowAmount || 0.6;

                    // Teleport near player with slight offset
                    const offsetAngle = Math.random() * Math.PI * 2;
                    const offsetDist = 30 + Math.random() * 20;
                    this.x = Game.player.x + Math.cos(offsetAngle) * offsetDist;
                    this.y = Game.player.y + Math.sin(offsetAngle) * offsetDist;

                    // Visual effect at teleport location
                    Game.effects.push(new AuraEffect(this.x, this.y, this.radius + 35, '#a29bfe'));

                    // Deal damage if close enough
                    if (distToP <= (blinkRange + Game.player.radius)) {
                        Game.player.takeDamage(dmg, this);
                        
                        // Apply slow debuff to player
                        if (Game.player.slow) {
                            Game.player.slow.mult = Math.min(Game.player.slow.mult || 1, slowAmount);
                            Game.player.slow.time = Math.max(Game.player.slow.time || 0, slowDuration);
                            Game.player.recalculateStats();
                        }
                    }

                    this.bossState.cd = Math.floor((this.bossAI.cooldown || 200) * enrageMult) - this.bossCooldownReduction;
                }
                break;
            }
        }
    }

    tickEliteModifiers() {
        if (!this.isElite || !this.eliteModifiers || this.eliteModifiers.length === 0) return;

        for (const mod of this.eliteModifiers) {
            if (!mod.ability) continue;

            switch (mod.ability.type) {
                case 'fireTrail': {
                    // Leave burning particles that damage player
                    if ((Game.elapsedFrames % mod.ability.tickEvery) === 0) {
                        this.eliteState.fireTrailParticles.push({
                            x: this.x,
                            y: this.y,
                            life: mod.ability.trailDuration,
                            radius: mod.ability.radius,
                            damage: mod.ability.damagePerTick
                        });
                    }
                    // Update and check collision with player
                    this.eliteState.fireTrailParticles = this.eliteState.fireTrailParticles.filter(p => {
                        p.life--;
                        if (p.life <= 0) return false;
                        
                        const dist = Math.hypot(Game.player.x - p.x, Game.player.y - p.y);
                        if (dist < p.radius + Game.player.radius) {
                            if ((Game.elapsedFrames % 30) === 0) { // Damage every 0.5s
                                Game.player.takeDamage(p.damage, this);
                            }
                        }
                        return true;
                    });
                    break;
                }
                case 'slowAura': {
                    // Slow player if in range
                    const dist = Math.hypot(Game.player.x - this.x, Game.player.y - this.y);
                    if (dist <= mod.ability.range) {
                        if (Game.player.slow) {
                            Game.player.slow.mult = Math.min(Game.player.slow.mult || 1, mod.ability.slowMult);
                            Game.player.slow.time = Math.max(Game.player.slow.time || 0, mod.ability.slowDuration);
                            Game.player.recalculateStats();
                        }
                    }
                    break;
                }
                case 'regeneration': {
                    this.eliteState.regenTimer++;
                    if (this.eliteState.regenTimer >= mod.ability.tickEvery) {
                        this.eliteState.regenTimer = 0;
                        const healAmount = this.maxHp * mod.ability.percentPerSecond;
                        this.hp = Math.min(this.maxHp, this.hp + healAmount);
                    }
                    break;
                }
                case 'summonMinions': {
                    if (this.eliteState.summonCd > 0) {
                        this.eliteState.summonCd--;
                    } else if (this.eliteState.summonedCount < mod.ability.maxMinions) {
                        const count = Math.min(mod.ability.count, mod.ability.maxMinions - this.eliteState.summonedCount);
                        for (let i = 0; i < count; i++) {
                            const ang = Math.random() * Math.PI * 2;
                            const r = this.radius + 30;
                            Game.enemies.push(new Enemy(mod.ability.minionArchetype, {
                                x: this.x + Math.cos(ang) * r,
                                y: this.y + Math.sin(ang) * r
                            }));
                            this.eliteState.summonedCount++;
                        }
                        this.eliteState.summonCd = mod.ability.cooldown;
                        if (Game.effects && typeof AuraEffect !== 'undefined') {
                            Game.effects.push(new AuraEffect(this.x, this.y, this.radius + 25, mod.color));
                        }
                    }
                    break;
                }
            }
        }
    }

    update() {
        // Status effects
        StatusEffects.tickSlow(this.slow);
        StatusEffects.tickTimer(this.freeze);
        StatusEffects.tickTimer(this.stun);
        StatusEffects.tickShock(this.shock);
        StatusEffects.tickFear(this.fear);
        StatusEffects.tickVulnerability(this.vulnerability);

        const incapacitated = (this.freeze.time > 0) || (this.stun.time > 0);
        const isFeared = StatusEffects.isFeared(this.fear) && !this.isBoss; // Bosses immune to fear
        this.speed = incapacitated ? 0 : (this.baseSpeed * (this.slow.mult || 1));

        if (StatusEffects.tickDotStacks(this, this.burnStacks, '#ff8c00', this.lastAttacker)) return;
        if (StatusEffects.tickDotStacks(this, this.poisonStacks, '#2ecc71', this.lastAttacker)) return;

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

        // Boss strengthening mechanic
        if (this.isBoss) {
            const aliveSeconds = ((Game?.elapsedFrames || 0) - this.bossSpawnTime) / 60;
            let targetPhase = 0;
            if (aliveSeconds >= 30) {
                targetPhase = 1 + Math.floor((aliveSeconds - 30) / 20);
            }
            if (targetPhase > this.strengthPhase) {
                this.contactDamage += 10;
                this.rangedDamage += 10;
                this.baseSpeed += 0.25;
                this.bossCooldownReduction += 15;
                this.strengthPhase = targetPhase;
                
                if (typeof Game !== 'undefined' && Game.floatingTexts && typeof FloatingText !== 'undefined') {
                    Game.floatingTexts.push(new FloatingText("BOSS STRENGTHENED!", this.x, this.y - 40, "red", true));
                }
            }
        }

        // Elite modifiers tick
        this.tickEliteModifiers();

        // Void Walker blink ability
        if (this.archetype.blink && !incapacitated) {
            this.blink.cd--;
            if (this.blink.cd <= 0 && distToP >= this.archetype.blink.minRange && distToP <= this.archetype.blink.maxRange) {
                const blinkDist = this.archetype.blink.blinkDistance;
                const blinkAngle = Math.atan2(dyToP, dxToP);
                this.x += Math.cos(blinkAngle) * blinkDist;
                this.y += Math.sin(blinkAngle) * blinkDist;
                
                // Visual effect
                if (typeof Game !== 'undefined' && Game.effects && typeof AuraEffect !== 'undefined') {
                    Game.effects.push(new AuraEffect(this.x, this.y, this.radius + 20, '#6c5ce7'));
                }
                
                this.blink.cd = this.archetype.blink.cooldown;
            }
        }

        // Shield Bearer shield bash
        if (this.archetype.shieldBash) {
            if (this.shieldBash.time > 0) {
                this.shieldBash.time--;
                this.x += this.shieldBash.dirX * this.archetype.shieldBash.speed;
                this.y += this.shieldBash.dirY * this.archetype.shieldBash.speed;
                
                // Check if hit player during bash
                if (distToP < this.radius + Game.player.radius) {
                    const nowFrame = Game?.elapsedFrames ?? 0;
                    if ((nowFrame - this.lastContactDamageFrame) >= 6) {
                        this.lastContactDamageFrame = nowFrame;
                        Game.player.takeDamage(this.contactDamage, this);
                        
                        // Apply slow debuff
                        if (Game.player.slow) {
                            Game.player.slow.mult = Math.min(Game.player.slow.mult || 1, this.archetype.shieldBash.slowAmount);
                            Game.player.slow.time = Math.max(Game.player.slow.time || 0, this.archetype.shieldBash.slowDuration);
                            Game.player.recalculateStats();
                        }
                    }
                }
            } else {
                if (!incapacitated) this.shieldBash.cd--;
                if (this.shieldBash.cd <= 0 && distToP >= this.archetype.shieldBash.minRange && distToP <= this.archetype.shieldBash.maxRange) {
                    this.shieldBash.time = this.archetype.shieldBash.duration;
                    this.shieldBash.dirX = dirX;
                    this.shieldBash.dirY = dirY;
                    this.shieldBash.cd = this.archetype.shieldBash.cooldown;
                }
            }
        }

        // Elite debuff: periodically apply slow to player on contact
        if (this.isElite && !incapacitated) {
            this.eliteDebuffCd--;
            if (this.eliteDebuffCd <= 0 && distToP < this.radius + Game.player.radius) {
                if (Game.player.slow) {
                    Game.player.slow.mult = Math.min(Game.player.slow.mult || 1, 0.7);
                    Game.player.slow.time = Math.max(Game.player.slow.time || 0, 90);
                    Game.player.recalculateStats();
                }
                this.eliteDebuffCd = 180; // 3 second cooldown
            }
        }

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

        // Default chase movement if not charging, shield bashing, and not being knocked
        if (!this.archetype.ranged && (!this.archetype.charge || this.charge.time <= 0) && (!this.archetype.shieldBash || this.shieldBash.time <= 0)) {
            if (incapacitated) {
                // Still drift from knockback.
                this.x += this.vx;
                this.y += this.vy;
            } else if (isFeared) {
                // Feared enemies flee from player
                const fearDir = StatusEffects.getFearDirection(this.x, this.y, Game.player.x, Game.player.y);
                this.x += fearDir.x * this.speed;
                this.y += fearDir.y * this.speed;
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
                Game.player.takeDamage(this.contactDamage, this);
            }
        }
    }

    applyOnHitStatuses(finalAmount, attacker) {
        const fx = attacker?.effects;
        if (!fx) return;

        // Standardized status effects
        const statuses = ['burn', 'slow', 'poison', 'freeze', 'stun', 'shock', 'fear', 'vulnerability'];
        const context = { finalAmount };
        
        for (const statusId of statuses) {
            StatusEffects.apply(this, statusId, fx, context);
        }

        // Maelstrom: Pull nearby enemies toward this target
        if (fx.maelstromChance && fx.maelstromRange && fx.maelstromPullStrength) {
            if (Math.random() < fx.maelstromChance) {
                const range = fx.maelstromRange;
                const pullStr = fx.maelstromPullStrength;
                if (typeof Game !== 'undefined' && Game.enemies) {
                    for (const e of Game.enemies) {
                        if (!e || e.dead || e === this) continue;
                        const dist = Math.hypot(e.x - this.x, e.y - this.y);
                        if (dist > 0 && dist <= range) {
                            const dirX = (this.x - e.x) / dist;
                            const dirY = (this.y - e.y) / dist;
                            e.vx += dirX * pullStr;
                            e.vy += dirY * pullStr;
                        }
                    }
                    // Visual feedback
                    if (typeof Game !== 'undefined' && Game.effects && typeof AuraEffect !== 'undefined') {
                        Game.effects.push(new AuraEffect(this.x, this.y, range * 0.6, '#3498db'));
                    }
                }
            }
        }
    }

    takeDamage(amount, isCrit, knockback = 0, sourceX, sourceY, attacker = null, meta = {}) {
        if (this.dead) return;

        // Ensure meta is an object
        meta = meta || {};

        // Phase Shifter dodge
        if (this.isElite && this.eliteModifiers) {
            for (const mod of this.eliteModifiers) {
                if (mod.ability?.type === 'phaseShift' && this.eliteState.phaseShiftCd <= 0) {
                    if (Math.random() < mod.ability.dodgeChance) {
                        this.eliteState.phaseShiftCd = mod.ability.cooldown;
                        if (Game.effects && typeof AuraEffect !== 'undefined') {
                            Game.effects.push(new AuraEffect(this.x, this.y, this.radius + 15, mod.color));
                        }
                        return; // Dodged the attack
                    }
                }
            }
        }
        if (this.eliteState?.phaseShiftCd > 0) this.eliteState.phaseShiftCd--;

        if (attacker) this.lastAttacker = attacker;

        // Execute window (based on current hp).
        const fx = attacker?.effects;
        let finalAmount = amount;

        // --- Elementalist Artifacts Logic ---
        // Elemental Convergence: Damage Amp vs multi-status
        if (fx?.multiStatusDmgAmp && fx.statusThreshold) {
            let statusCount = 0;
            if ((this.burnStacks?.stacks || 0) > 0) statusCount++;
            if ((this.poisonStacks?.stacks || 0) > 0) statusCount++;
            if ((this.slow?.time || 0) > 0) statusCount++;
            if ((this.freeze?.time || 0) > 0) statusCount++;
            if ((this.stun?.time || 0) > 0) statusCount++;
            if ((this.shock?.time || 0) > 0) statusCount++;
            if ((this.fear?.time || 0) > 0) statusCount++;
            if ((this.vulnerability?.time || 0) > 0) statusCount++;
            
            if (statusCount >= fx.statusThreshold) {
                finalAmount *= fx.multiStatusDmgAmp;
            }
        }

        // Prismatic Core: Damage per unique DoT type
        if (fx?.dotStatScaling && fx.dmgPerDot) {
            let dotCount = 0;
            if ((this.burnStacks?.stacks || 0) > 0) dotCount++;
            if ((this.poisonStacks?.stacks || 0) > 0) dotCount++;
            if (dotCount > 0) {
                finalAmount *= (1 + (dotCount * fx.dmgPerDot));
            }
        }

        // Chaos Prism: Apply random element on crit
        if (isCrit && fx?.randomElementOnCrit) {
            const elements = ['burn', 'poison', 'shock', 'slow']; 
            const picked = elements[Math.floor(Math.random() * elements.length)];
            const tempFx = { ...fx }; 
            // Default params if not present, but usually apply() handles defaults or passed params
            if (picked === 'burn') { tempFx.burnOnHitPctPerTick = 0.10; tempFx.burnDuration = 160; }
            if (picked === 'poison') { tempFx.poisonOnHitPctPerTick = 0.05; tempFx.poisonDuration = 160; }
            if (picked === 'shock') { tempFx.shockOnHitChance = 1.0; tempFx.shockDuration = 120; }
            if (picked === 'slow') { tempFx.slowOnHitMult = 0.5; tempFx.slowDuration = 120; }
            
            // Apply immediately
            StatusEffects.apply(this, picked, tempFx, { finalAmount: finalAmount });
        }
        // ----------------------------------------
        
        // Apply shock damage multiplier (enemy takes more damage when shocked)
        finalAmount *= StatusEffects.getShockDamageMult(this.shock);
        
        // Shatter: Bonus damage vs frozen enemies
        if (fx?.damageVsFrozenMult && (this.freeze?.time || 0) > 0) {
            finalAmount *= fx.damageVsFrozenMult;
        }
        
        // Debuffs should not stack: these are boolean checks for "is poisoned" / "is burning".
        if (fx?.damageVsPoisonedMult && (this.poisonStacks?.length || 0) > 0) finalAmount *= fx.damageVsPoisonedMult;
        if (fx?.damageVsBurningMult && (this.burnStacks?.length || 0) > 0) finalAmount *= fx.damageVsBurningMult;
        if (fx?.damageVsSlowedMult && this.slow?.time > 0) finalAmount *= fx.damageVsSlowedMult;
        if (fx?.damageVsStunnedMult && this.stun?.time > 0) finalAmount *= fx.damageVsStunnedMult;
        if (fx?.executeBelowPct && fx?.executeDamageMult && (this.hp / this.maxHp) <= fx.executeBelowPct) {
            finalAmount *= fx.executeDamageMult;
        }

        // Apply aura damage multiplier from armor effects (e.g., Singularity Mantle)
        if (this.auraDamageTakenMult && this.auraDamageTakenMult !== 1) {
            finalAmount = finalAmount * this.auraDamageTakenMult;
        }

        // Apply vulnerability (reduces effective resistance)
        const vulnReduction = StatusEffects.getVulnerabilityReduction(this.vulnerability);
        const effectiveResistance = Math.max(0, (this.resistance || 0) - vulnReduction);
        
        if (!fx?.ignoreResistance) {
            finalAmount = finalAmount * (1 - effectiveResistance);
        }

        // Cull: Instant-kill non-boss enemies below threshold
        if (fx?.cullThresholdPct && !this.isBoss) {
            const hpPctAfter = (this.hp - finalAmount) / this.maxHp;
            if (hpPctAfter > 0 && hpPctAfter <= fx.cullThresholdPct) {
                this.hp = 0;
                if (typeof Game !== 'undefined' && Game.floatingTexts && typeof FloatingText !== 'undefined') {
                    Game.floatingTexts.push(new FloatingText('CULLED', this.x, this.y - 10, '#e74c3c', true));
                }
                this.die(attacker);
                return;
            }
        }

        this.hp -= finalAmount;

        // Thorned elite reflects damage
        if (this.isElite && this.eliteModifiers && attacker === Game.player && !meta?.isIndirect) {
            for (const mod of this.eliteModifiers) {
                if (mod.ability?.type === 'thornsDamage') {
                    const reflectDmg = finalAmount * mod.ability.reflectPercent;
                    Game.player.takeDamage(reflectDmg, this, { isIndirect: true });
                    if (Game.floatingTexts) {
                        Game.floatingTexts.push(new FloatingText(
                            Math.ceil(reflectDmg).toString(),
                            Game.player.x,
                            Game.player.y,
                            '#27ae60',
                            false
                        ));
                    }
                }
            }
        }

        // Vampiric elite heals from damage dealt
        if (this.isElite && this.eliteModifiers) {
            for (const mod of this.eliteModifiers) {
                if (mod.ability?.type === 'lifeSteal') {
                    const healAmount = this.contactDamage * mod.ability.percent;
                    this.hp = Math.min(this.maxHp, this.hp + healAmount);
                }
            }
        }
        
        // Leech: Heal attacker for a percentage of damage dealt
        if (fx?.leechPct && attacker && typeof attacker.heal === 'function') {
            const healAmount = finalAmount * fx.leechPct;
            attacker.heal(healAmount);
        }
        
        let dmgColor = '#fff';
        let dmgBig = isCrit;
        let text = Math.round(finalAmount).toString();

        if (isCrit) {
            const tier = meta?.critTier || 1;
            const tData = GameConstants.CRIT_TIERS[Math.min(tier, GameConstants.CRIT_TIERS.MAX)] || GameConstants.CRIT_TIERS[1];
            dmgColor = tData.color;
            if (tier > 1) dmgBig = true;
            
            // Add tier symbols
            if (tData.symbol) text += ' ' + tData.symbol;
            
            // Visual indicator for ascended crit (ascended from lower tier)
            if (meta?.ascendedCrit) {
                text += ' ▲'; // Ascension symbol
            }
        }

        Game.floatingTexts.push(new FloatingText(text, this.x, this.y, dmgColor, dmgBig));

        if (fx?.healOnHitPct || fx?.healOnHitFlat) {
            const healAmt = (finalAmount * (fx.healOnHitPct || 0)) + (fx.healOnHitFlat || 0);
            attacker?.heal?.(healAmt);
        }

        this.applyOnHitStatuses(finalAmount, attacker);

        // Echo affix: Chance to trigger a second delayed hit
        if (fx?.echoChance && fx?.echoDamageMult && !meta?.isEcho) {
            if (Math.random() < fx.echoChance) {
                const echoDamage = amount * fx.echoDamageMult;
                setTimeout(() => {
                    if (!this.dead && typeof this.takeDamage === 'function') {
                        this.takeDamage(echoDamage, false, 0, sourceX, sourceY, attacker, { isEcho: true });
                        if (typeof Game !== 'undefined' && Game.floatingTexts && typeof FloatingText !== 'undefined') {
                            Game.floatingTexts.push(new FloatingText('ECHO', this.x, this.y - 15, '#9b59b6', false));
                        }
                    }
                }, 300); // 300ms delay for echo hit
            }
        }

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

        // Berserker enrage when below HP threshold
        if (this.isElite && this.eliteModifiers && !this.dead) {
            for (const mod of this.eliteModifiers) {
                if (mod.ability?.type === 'berserker') {
                    const hpPct = this.hp / this.maxHp;
                    if (hpPct < mod.ability.hpThreshold) {
                        if (!this.eliteState.berserkerActive) {
                            this.eliteState.berserkerActive = true;
                            this.baseSpeed *= mod.ability.speedMultBelow;
                            this.contactDamage *= mod.ability.damageMultBelow;
                            this.rangedDamage *= mod.ability.damageMultBelow;
                        }
                    }
                }
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
                    // Visual lightning
                    if (typeof Game !== 'undefined' && Game.effects && typeof LightningEffect !== 'undefined') {
                        Game.effects.push(new LightningEffect(this.x, this.y, best.x, best.y, '#00ffff'));
                    }
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

        // Explosive elite death
        if (this.isElite && this.eliteModifiers) {
            for (const mod of this.eliteModifiers) {
                if (mod.ability?.type === 'deathExplosion') {
                    const dist = Math.hypot(Game.player.x - this.x, Game.player.y - this.y);
                    if (dist <= mod.ability.radius + Game.player.radius) {
                        const explosionDmg = this.maxHp * mod.ability.damagePercent;
                        Game.player.takeDamage(explosionDmg, this, { isIndirect: true });
                    }
                    if (Game.effects && typeof AuraEffect !== 'undefined') {
                        Game.effects.push(new AuraEffect(this.x, this.y, mod.ability.radius, mod.color));
                    }
                }
            }
        }

        if (typeof Game !== 'undefined' && Game?.stats?.onEnemyKilled) {
            Game.stats.onEnemyKilled(this);
        }

        // Notify player of kill for life on kill, soul harvest, etc.
        if (attacker && typeof attacker.onEnemyKill === 'function') {
            attacker.onEnemyKill(this);
        } else if (Game?.player && typeof Game.player.onEnemyKill === 'function') {
            Game.player.onEnemyKill(this);
        }

        const fx = attacker?.effects;

        // Elemental Convergence: Explode if multi-status threshold met
        if (fx?.explodeOnDeath && fx?.statusThreshold) {
            let statusCount = 0;
            if ((this.burnStacks?.stacks || 0) > 0) statusCount++;
            if ((this.poisonStacks?.stacks || 0) > 0) statusCount++;
            if ((this.slow?.time || 0) > 0) statusCount++;
            if ((this.freeze?.time || 0) > 0) statusCount++;
            if ((this.stun?.time || 0) > 0) statusCount++;
            if ((this.shock?.time || 0) > 0) statusCount++;
            if ((this.fear?.time || 0) > 0) statusCount++;
            
            if (statusCount >= fx.statusThreshold) {
                const radius = (fx.explosionRadius || 2.0) * 100; // Base unit assumed 100 unless defined
                const damage = this.maxHp * (fx.explosionDamagePct || 1.0);
                
                if (typeof Game !== 'undefined' && Game.enemies) {
                    for (const e of Game.enemies) {
                        if (!e || e.dead || e === this) continue;
                        if (Math.hypot(e.x - this.x, e.y - this.y) <= radius) {
                            e.takeDamage(damage, false, 5, this.x, this.y, attacker);
                        }
                    }
                }
                if (typeof Game !== 'undefined' && Game.effects && typeof AuraEffect !== 'undefined') {
                    Game.effects.push(new AuraEffect(this.x, this.y, radius, '#9b59b6'));
                }
            }
        }

        // Shatter: Explode if killed while frozen
        if (fx?.shatterExplosionRadius && fx?.shatterExplosionDamage && (this.freeze?.time || 0) > 0) {
            const explosionRadius = fx.shatterExplosionRadius;
            const explosionDmgPct = fx.shatterExplosionDamage;
            const explosionDamage = this.maxHp * explosionDmgPct;
            
            if (typeof Game !== 'undefined' && Game.enemies) {
                for (const e of Game.enemies) {
                    if (!e || e.dead || e === this) continue;
                    const dist = Math.hypot(e.x - this.x, e.y - this.y);
                    if (dist <= explosionRadius) {
                        e.takeDamage(explosionDamage, false, 3, this.x, this.y, attacker);
                    }
                }
            }
            
            // Visual feedback for shatter explosion
            if (typeof Game !== 'undefined' && Game.effects && typeof AuraEffect !== 'undefined') {
                Game.effects.push(new AuraEffect(this.x, this.y, explosionRadius, '#81ecec'));
            }
            if (typeof Game !== 'undefined' && Game.floatingTexts && typeof FloatingText !== 'undefined') {
                Game.floatingTexts.push(new FloatingText('SHATTER!', this.x, this.y - 20, '#81ecec', true));
            }
        }

        if (attacker && attacker.gainXp) {
            // Check for Midas' Greed artifact: greater XP gems
            let xpAmount = this.xpValue;
            const hasMidasGreed = attacker.artifacts?.some(a => 
                (a.id === 'midas_greed' || a.archetypeId === 'midas_greed') && 
                a.specialEffect?.greaterGemChance
            );
            
            if (hasMidasGreed) {
                const midasArtifact = attacker.artifacts.find(a => 
                    a.id === 'midas_greed' || a.archetypeId === 'midas_greed'
                );
                const greaterChance = midasArtifact.specialEffect.greaterGemChance || 0.20;
                const greaterMultiplier = midasArtifact.specialEffect.greaterGemMultiplier || 5.0;
                
                if (Math.random() < greaterChance) {
                    xpAmount *= greaterMultiplier;
                    // Visual feedback for greater gem
                    if (typeof Game !== 'undefined' && Game.floatingTexts && typeof FloatingText !== 'undefined') {
                        Game.floatingTexts.push(new FloatingText('GREATER GEM!', this.x, this.y - 30, '#f39c12', true));
                    }
                }
            }
            
            attacker.gainXp(xpAmount);
        }
        
        if (!window.GameConstants?.SETTINGS?.LOW_QUALITY) {
            Game.particles.push(new Particle(this.x, this.y, this.color));
        }

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
        // Elite glow effect
        if (this.isElite && this.eliteModifiers && this.eliteModifiers.length > 0) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(this.x, this.y, this.radius, this.x, this.y, this.radius + 5);
            gradient.addColorStop(0, this.eliteModifiers[0].color || '#ffd700');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Elite border
        if (this.isElite && this.eliteModifiers && this.eliteModifiers.length > 0) {
            ctx.strokeStyle = this.eliteModifiers[0].color || '#ffd700';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Draw fire trail particles for Firebrand
        if (this.isElite && this.eliteState?.fireTrailParticles) {
            ctx.save();
            for (const p of this.eliteState.fireTrailParticles) {
                const alpha = p.life / 180;
                ctx.globalAlpha = alpha * 0.5;
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Status / debuff indicators
        const burnCount = this.burnStacks?.stacks || 0;
        const poisonCount = this.poisonStacks?.stacks || 0;
        const slowActive = (this.slow?.time || 0) > 0 && (this.slow?.mult || 1) < 1;
        const freezeActive = (this.freeze?.time || 0) > 0;
        const stunActive = (this.stun?.time || 0) > 0;

        if (burnCount > 0 || poisonCount > 0 || slowActive || freezeActive || stunActive) {
            ctx.save();
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'black';

            let icons = [];
            if (burnCount > 0) icons.push({ text: `B${burnCount > 1 ? burnCount : ''}`, color: '#ff8c00' });
            if (poisonCount > 0) icons.push({ text: `P${poisonCount > 1 ? poisonCount : ''}`, color: '#2ecc71' });
            if (slowActive) icons.push({ text: 'S', color: '#74b9ff' });
            if (freezeActive) icons.push({ text: 'F', color: '#81ecec' });
            if (stunActive) icons.push({ text: 'T', color: '#f1c40f' });
            if ((this.shock?.time || 0) > 0) icons.push({ text: '⚡', color: '#e1b12c' });
            if ((this.fear?.time || 0) > 0) icons.push({ text: '!', color: '#9b59b6' });
            if ((this.vulnerability?.time || 0) > 0) icons.push({ text: 'V', color: '#e74c3c' });

            const y = this.y - this.radius - 10;
            const startX = this.x - ((icons.length - 1) * 12) / 2;
            for (let i = 0; i < icons.length; i++) {
                const x = startX + (i * 12);
                ctx.fillStyle = icons[i].color;
                ctx.strokeText(icons[i].text, x, y);
                ctx.fillText(icons[i].text, x, y);
            }
            ctx.restore();
        }

        // Elite modifier name display
        if (this.isElite && this.eliteModifiers && this.eliteModifiers.length > 0 && !this.isBoss) {
            ctx.save();
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const modNames = this.eliteModifiers.map(m => m.name).join(' ');
            const yPos = this.y - this.radius - 25;
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(modNames, this.x, yPos);
            ctx.fillStyle = this.eliteModifiers[0].color || '#ffd700';
            ctx.fillText(modNames, this.x, yPos);
            ctx.restore();
        }

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
            { id: 'splitter', w: 8, min: 12 },
            { id: 'void_walker', w: 10, min: 5 },
            { id: 'shield_bearer', w: 8, min: 5 }
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
        const lvlBonus = Math.min(0.08, Math.max(0, level - 4) * 0.004);
        const timeBonus = Math.min(0.05, runSecs / 1800); // +5% by 30 min
        const eliteChance = Math.min(0.12, base + lvlBonus + timeBonus);
        const elite = (level >= 5) && (Math.random() < eliteChance);
        
        let eliteModifiers = [];
        if (elite && window.EliteModifierPool && window.EliteModifierPool.length > 0) {
            // Pick 1-2 random modifiers based on level
            const modCount = (level >= 15) ? (Math.random() < 0.5 ? 2 : 1) : 1;
            const availableMods = [...window.EliteModifierPool];
            
            for (let i = 0; i < modCount && availableMods.length > 0; i++) {
                const idx = Math.floor(Math.random() * availableMods.length);
                eliteModifiers.push(availableMods[idx]);
                availableMods.splice(idx, 1); // Prevent duplicate modifiers
            }
        }
        
        return new Enemy(id, { elite, eliteModifiers });
    }
};

// Expose EnemyFactory globally
window.EnemyFactory = EnemyFactory;
