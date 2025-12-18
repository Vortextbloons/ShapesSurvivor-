// Status effects utilities - moved to new location
const StatusEffects = {
    createDot() {
        return { time: 0, tickEvery: 0, tickIn: 0, dmgPerTick: 0 };
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
    }
};
