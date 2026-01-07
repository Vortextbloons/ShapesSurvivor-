// Status effects utilities - moved to new location
const StatusEffects = {
    STACK_DOT_DEFAULT_DURATION: 160,
    STACK_DOT_DEFAULT_TICK_EVERY: 20,

    createDot() {
        return { time: 0, tickEvery: 0, tickIn: 0, dmgPerTick: 0 };
    },

    createDotStack() {
        return {
            time: 0,
            tickEvery: this.STACK_DOT_DEFAULT_TICK_EVERY,
            tickIn: this.STACK_DOT_DEFAULT_TICK_EVERY,
            stacks: 0,
            dmgPerTick: 0
        };
    },

    tickTimer(timerObj) {
        if (!timerObj || timerObj.time <= 0) return false;
        timerObj.time--;
        return timerObj.time > 0;
    },

    tickSlow(slowObj) {
        if (!slowObj || slowObj.time <= 0) return;
        slowObj.time--;
        if (slowObj.time <= 0) {
            slowObj.mult = 1;
            slowObj.stacks = 0;
        }
    },

    applySlow(slowObj, mult, duration) {
        if (!slowObj || !mult || !duration) return;
        slowObj.mult = Math.min(slowObj.mult || 1, mult);
        slowObj.time = Math.max(slowObj.time || 0, duration);
        slowObj.stacks = (slowObj.stacks || 0) + 1;
    },

    // Best-of dot: keep whichever DOT has the highest per-tick damage.
    // Extends duration if the new one is stronger.
    applyBestDot(dotObj, hitDamage, pctTotal, duration, tickEvery) {
        if (!dotObj || !pctTotal || !duration || !tickEvery) return;

        const total = Math.max(0, (hitDamage || 0) * pctTotal);
        const ticks = Math.max(1, Math.floor(duration / tickEvery));
        const perTick = total / ticks;

        if (perTick < (dotObj.dmgPerTick || 0)) return;

        dotObj.time = Math.max(dotObj.time || 0, duration);
        dotObj.tickEvery = tickEvery;

        const currentTickIn = (dotObj.tickIn || tickEvery);
        dotObj.tickIn = Math.min(currentTickIn, tickEvery);

        dotObj.dmgPerTick = perTick;
    },

    // Stack dot: adds an independent DOT instance to an array.
    // - Stacks refresh the shared duration.
    // - Total per-tick damage increases with each stack.
    applyStackDot(dotStackObj, hitDamage, pctPerTick, durationOverride = null, tickEveryOverride = null) {
        if (!dotStackObj || !pctPerTick) return;

        const perTick = Math.max(0, (hitDamage || 0) * pctPerTick);
        if (perTick <= 0) return;

        dotStackObj.stacks = (dotStackObj.stacks || 0) + 1;
        dotStackObj.dmgPerTick = (dotStackObj.dmgPerTick || 0) + perTick;

        dotStackObj.time = durationOverride || this.STACK_DOT_DEFAULT_DURATION;
        dotStackObj.tickEvery = tickEveryOverride || this.STACK_DOT_DEFAULT_TICK_EVERY;

        const currentTickIn = (dotStackObj.tickIn || dotStackObj.tickEvery);
        dotStackObj.tickIn = Math.min(currentTickIn, dotStackObj.tickEvery);
    },

    // Returns true if target died.
    tickDot(target, dotObj, floatingTextColor, attackerForKillCredit) {
        if (!target || !dotObj || dotObj.time <= 0) return false;

        dotObj.time--;
        if (dotObj.tickIn > 0) dotObj.tickIn--;

        if (dotObj.tickIn <= 0 && dotObj.tickEvery > 0) {
            dotObj.tickIn = dotObj.tickEvery;

            const dmg = dotObj.dmgPerTick || 0;
            if (dmg > 0) {
                target.hp -= dmg;
                if (typeof Game !== 'undefined' && Game.floatingTexts && typeof FloatingText !== 'undefined') {
                    Game.floatingTexts.push(new FloatingText(Math.round(dmg), target.x, target.y, floatingTextColor, false));
                }
            }

            if (target.hp <= 0 && typeof target.die === 'function') {
                target.die(attackerForKillCredit);
                return true;
            }
        }

        return false;
    },

    // Returns true if target died.
    tickDotStacks(target, dotStackObj, floatingTextColor, attackerForKillCredit) {
        if (!target || !dotStackObj || (dotStackObj.time || 0) <= 0) return false;

        dotStackObj.time--;
        if (dotStackObj.tickIn > 0) dotStackObj.tickIn--;

        if (dotStackObj.tickIn <= 0 && dotStackObj.tickEvery > 0) {
            dotStackObj.tickIn = dotStackObj.tickEvery;

            const dmg = dotStackObj.dmgPerTick || 0;
            if (dmg > 0) {
                target.hp -= dmg;
                if (typeof Game !== 'undefined' && Game.floatingTexts && typeof FloatingText !== 'undefined') {
                    Game.floatingTexts.push(new FloatingText(Math.round(dmg), target.x, target.y, floatingTextColor, false));
                }
            }

            if (target.hp <= 0 && typeof target.die === 'function') {
                target.die(attackerForKillCredit);
                return true;
            }
        }

        if (dotStackObj.time <= 0) {
            dotStackObj.time = 0;
            dotStackObj.stacks = 0;
            dotStackObj.dmgPerTick = 0;
            dotStackObj.tickEvery = this.STACK_DOT_DEFAULT_TICK_EVERY;
            dotStackObj.tickIn = this.STACK_DOT_DEFAULT_TICK_EVERY;
        }

        return false;
    },

    pctPerTickFromTotal(pctTotal, duration, tickEvery) {
        if (!pctTotal) return 0;
        const d = Number(duration) || 0;
        const t = Number(tickEvery) || 0;
        if (d > 0 && t > 0) {
            const ticks = Math.max(1, Math.floor(d / t));
            return pctTotal / ticks;
        }
        const ticks = Math.max(1, Math.floor(this.STACK_DOT_DEFAULT_DURATION / this.STACK_DOT_DEFAULT_TICK_EVERY));
        return pctTotal / ticks;
    },

    // ========== NEW STATUS EFFECTS ==========

    // Create default shock object
    createShock() {
        return { time: 0, damageTakenMult: 0 };
    },

    // Apply shock: enemy takes increased damage from all sources
    applyShock(shockObj, duration, damageTakenMult) {
        if (!shockObj || !duration) return;
        shockObj.time = Math.max(shockObj.time || 0, duration);
        shockObj.damageTakenMult = Math.max(shockObj.damageTakenMult || 0, damageTakenMult || 0.15);
    },

    tickShock(shockObj) {
        if (!shockObj || shockObj.time <= 0) return;
        shockObj.time--;
        if (shockObj.time <= 0) {
            shockObj.damageTakenMult = 0;
        }
    },

    getShockDamageMult(shockObj) {
        if (!shockObj || shockObj.time <= 0) return 1;
        return 1 + (shockObj.damageTakenMult || 0);
    },

    // Create default fear object
    createFear() {
        return { time: 0 };
    },

    // Apply fear: enemy flees from player
    applyFear(fearObj, duration) {
        if (!fearObj || !duration) return;
        fearObj.time = Math.max(fearObj.time || 0, duration);
    },

    tickFear(fearObj) {
        if (!fearObj || fearObj.time <= 0) return;
        fearObj.time--;
    },

    isFeared(fearObj) {
        return fearObj && fearObj.time > 0;
    },

    // Get fear movement direction (away from player)
    getFearDirection(enemyX, enemyY, playerX, playerY) {
        const dx = enemyX - playerX;
        const dy = enemyY - playerY;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.01) return { x: Math.random() - 0.5, y: Math.random() - 0.5 };
        return { x: dx / dist, y: dy / dist };
    },

    // Create default vulnerability object
    createVulnerability() {
        return { time: 0, resistanceReduction: 0 };
    },

    // Apply vulnerability: reduces enemy resistance
    applyVulnerability(vulnObj, duration, resistanceReduction) {
        if (!vulnObj || !duration) return;
        vulnObj.time = Math.max(vulnObj.time || 0, duration);
        vulnObj.resistanceReduction = Math.max(vulnObj.resistanceReduction || 0, resistanceReduction || 0.10);
    },

    tickVulnerability(vulnObj) {
        if (!vulnObj || vulnObj.time <= 0) return;
        vulnObj.time--;
        if (vulnObj.time <= 0) {
            vulnObj.resistanceReduction = 0;
        }
    },

    getVulnerabilityReduction(vulnObj) {
        if (!vulnObj || vulnObj.time <= 0) return 0;
        return vulnObj.resistanceReduction || 0;
    },

    // Standardized Application System
    apply(target, effectId, params, context = {}) {
        const handler = this.registry[effectId];
        if (handler) {
            handler(target, params, context);
        }
    },

    registry: {
        burn: (target, params, context) => {
            let pct = (Number(params.burnOnHitPctPerTick) || 0) || 
                       StatusEffects.pctPerTickFromTotal(params.burnOnHitPctTotal, params.burnDuration, params.burnTickEvery);
            
            // Elemental Mastery: Boost elemental damage
            if (params.elementalMastery) pct *= params.elementalMastery;

            if (pct > 0) {
                const duration = (params.burnDuration || StatusEffects.STACK_DOT_DEFAULT_DURATION) * (1 + (params.statusDurationBonus || 0));
                let tickEvery = params.burnTickEvery || StatusEffects.STACK_DOT_DEFAULT_TICK_EVERY;
                
                // Prismatic Core: Accelerated DoTs
                if (params.acceleratedDots) tickEvery = Math.max(1, Math.round(tickEvery / params.acceleratedDots));
                
                StatusEffects.applyStackDot(target.burnStacks, context.finalAmount, pct, duration, tickEvery);
            }
        },
        poison: (target, params, context) => {
            let pct = (Number(params.poisonOnHitPctPerTick) || 0) || 
                       StatusEffects.pctPerTickFromTotal(params.poisonOnHitPctTotal, params.poisonDuration, params.poisonTickEvery);
            
            // Elemental Mastery: Boost elemental damage
            if (params.elementalMastery) pct *= params.elementalMastery;

            if (pct > 0) {
                const duration = (params.poisonDuration || StatusEffects.STACK_DOT_DEFAULT_DURATION) * (1 + (params.statusDurationBonus || 0));
                let tickEvery = params.poisonTickEvery || StatusEffects.STACK_DOT_DEFAULT_TICK_EVERY;
                
                // Prismatic Core: Accelerated DoTs
                if (params.acceleratedDots) tickEvery = Math.max(1, Math.round(tickEvery / params.acceleratedDots));

                StatusEffects.applyStackDot(target.poisonStacks, context.finalAmount, pct, duration, tickEvery);
            }
        },
        slow: (target, params, context) => {
            if (params.slowOnHitMult && params.slowDuration) {
                const duration = params.slowDuration * (1 + (params.statusDurationBonus || 0));
                
                // Reduce effectiveness on bosses (50% less effective)
                let mult = params.slowOnHitMult;
                if (target.isBoss) {
                    mult = 1 - (1 - mult) * 0.5;
                }

                StatusEffects.applySlow(target.slow, mult, duration);
                
                // Check for freeze trigger (3 stacks) - Prevent freeze conversion for bosses
                if (!target.isBoss && target.slow.stacks >= 3) {
                    // Apply freeze for 5 seconds (300 frames)
                    if (target.freeze) {
                        target.freeze.time = 300 * (1 + (params.statusDurationBonus || 0));
                        
                        // Reset slow stacks and timer
                        target.slow.stacks = 0;
                        target.slow.time = 0;
                        target.slow.mult = 1;
                    }
                }
            }
        },
        freeze: (target, params, context) => {
            if (params.freezeOnHitChance && params.freezeDuration) {
                if (Math.random() < params.freezeOnHitChance) {
                    const duration = params.freezeDuration * (1 + (params.statusDurationBonus || 0));

                    if (target.isBoss) {
                        // Bosses are immune to freeze, apply slow instead (0.5 mult)
                        StatusEffects.applySlow(target.slow, 0.5, duration);
                    } else {
                        target.freeze.time = Math.max(target.freeze.time || 0, duration);
                    }
                }
            }
        },
        stun: (target, params, context) => {
            if (params.stunOnHitChance && params.stunDuration) {
                if (Math.random() < params.stunOnHitChance) {
                    const duration = params.stunDuration * (1 + (params.statusDurationBonus || 0));
                    
                    if (target.isBoss) {
                        // Bosses are immune to stun, apply slow instead (0.4 mult)
                        StatusEffects.applySlow(target.slow, 0.4, duration);
                    } else {
                        target.stun.time = Math.max(target.stun.time || 0, duration);
                    }
                }
            }
        },
        shock: (target, params, context) => {
            if (params.shockOnHitChance && params.shockDuration) {
                if (Math.random() < params.shockOnHitChance) {
                    const duration = params.shockDuration * (1 + (params.statusDurationBonus || 0));
                    StatusEffects.applyShock(target.shock, duration, params.shockDamageTakenMult || 0.15);
                }
            }
        },
        fear: (target, params, context) => {
            if (params.fearOnHitChance && params.fearDuration && !target.isBoss) {
                if (Math.random() < params.fearOnHitChance) {
                    const duration = params.fearDuration * (1 + (params.statusDurationBonus || 0));
                    StatusEffects.applyFear(target.fear, duration);
                }
            }
        },
        vulnerability: (target, params, context) => {
            if (params.vulnerabilityOnHitChance && params.vulnerabilityDuration) {
                if (Math.random() < params.vulnerabilityOnHitChance) {
                    const duration = params.vulnerabilityDuration * (1 + (params.statusDurationBonus || 0));
                    StatusEffects.applyVulnerability(target.vulnerability, duration, params.vulnerabilityReduction || 0.10);
                }
            }
        }
    }
};
