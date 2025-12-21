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
        if (slowObj.time <= 0) slowObj.mult = 1;
    },

    applySlow(slowObj, mult, duration) {
        if (!slowObj || !mult || !duration) return;
        slowObj.mult = Math.min(slowObj.mult || 1, mult);
        slowObj.time = Math.max(slowObj.time || 0, duration);
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
    applyStackDot(dotStackObj, hitDamage, pctPerTick) {
        if (!dotStackObj || !pctPerTick) return;

        const perTick = Math.max(0, (hitDamage || 0) * pctPerTick);
        if (perTick <= 0) return;

        dotStackObj.stacks = (dotStackObj.stacks || 0) + 1;
        dotStackObj.dmgPerTick = (dotStackObj.dmgPerTick || 0) + perTick;

        dotStackObj.time = this.STACK_DOT_DEFAULT_DURATION;
        dotStackObj.tickEvery = this.STACK_DOT_DEFAULT_TICK_EVERY;

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
    }
};
