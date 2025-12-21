class Player {
    constructor() {
        const worldW = window.Game?.world?.width ?? canvas.width;
        const worldH = window.Game?.world?.height ?? canvas.height;
        this.x = worldW / 2;
        this.y = worldH / 2;
        this.radius = 16;
        this.color = '#3498db';
        
        this.equipment = { weapon: null, armor: null, accessory1: null, accessory2: null };
        this.artifacts = [];
        
        this.baseStats = {
            maxHp: 80,
            moveSpeed: 3,
            damage: 1,
            areaOfEffect: 0,
            cooldownMult: 1,
            regen: 0,
            pickupRange: 80,
            damageTakenMult: 1,
            rarityFind: 0,
            xpGain: 1
        };
        
        this.stats = { ...this.baseStats };
        this.statBreakdowns = {};
        this.hp = this.stats.maxHp;
        this.xp = 0;
        this.level = 1;
        this.nextLevelXp = 50;
        this.weaponCooldown = 0;
        this.activeOrbitals = [];
        this.effects = EffectUtils.createDefaultEffects();

        this.enhancementConfigs = {
            critMomentum: null
        };

        this.buffStates = {
            critMomentum: { stacks: 0, time: 0 }
        };
    }

    static _mult1p(value) {
        const v = Number(value) || 0;
        return 1 + v;
    }

    static _defaultLayerForModifier(mod) {
        // Layer 0 is reserved for the player's base.
        // For everything else, we intentionally avoid naming layers.
        // Default policy:
        // - explicit mod.layer wins
        // - buffs go to layer 3
        // - item adds go to layer 1
        // - item multiplies go to layer 2
        if (!mod) return 1;
        if (mod.layer != null) return Math.max(0, Math.floor(Number(mod.layer) || 0));
        if (mod.source === 'buff') return 3;
        if (mod.operation === 'multiply') return 2;
        return 1;
    }

    getEffectiveItemStat(item, stat, def = 0) {
        const mods = Array.isArray(item?.modifiers) ? item.modifiers : [];

        let add = 0;
        let hasAdd = false;
        let mult = 1;

        for (const m of mods) {
            if (!m || m.stat !== stat) continue;
            if (m.operation === 'add') {
                hasAdd = true;
                add += (Number(m.value) || 0);
            } else if (m.operation === 'multiply') {
                mult *= Player._mult1p(m.value);
            }
        }

        const base = hasAdd ? add : def;
        return base * mult;
    }

    recalculateStats() {
        const prevMaxHp = (this.stats && this.stats.maxHp !== undefined)
            ? (Number(this.stats.maxHp) || 0)
            : (Number(this.baseStats.maxHp) || 0);

        if (!window.StatCalculator?.Stat) {
            // Fallback: keep old behavior if the calculator wasn't loaded.
            this.stats = { ...this.baseStats };
            return;
        }

        const Stat = window.StatCalculator.Stat;
        const statObjs = {};
        for (const [k, v] of Object.entries(this.baseStats)) {
            statObjs[k] = new Stat(v);
        }

        this.stats = { ...this.baseStats };
        this.statBreakdowns = {};
        const items = [...Object.values(this.equipment).filter(i => i !== null), ...this.artifacts];

        // Effects + special/global modifiers.
        this.effects = EffectUtils.createDefaultEffects();

        let bestCritMomentum = null;

        items.forEach(item => {
            const mods = Array.isArray(item?.modifiers) ? item.modifiers : [];
            const isWeapon = item?.type === ItemType.WEAPON;

            for (const mod of mods) {
                if (!mod) continue;

                const layer = Player._defaultLayerForModifier(mod);

                // Player stat keys
                if (statObjs[mod.stat] !== undefined) {
                    statObjs[mod.stat].addModifier({
                        layer,
                        operation: mod.operation || 'add',
                        value: mod.value,
                        source: mod.source,
                        stat: mod.stat,
                        name: mod.name
                    });
                    continue;
                }

                // Effect keys (critChanceBonus, etc.)
                if (this.effects[mod.stat] !== undefined) {
                    if (mod.operation === 'add') {
                        this.effects[mod.stat] += (Number(mod.value) || 0);
                    } else if (mod.operation === 'multiply') {
                        this.effects[mod.stat] *= Player._mult1p(mod.value);
                    }
                    continue;
                }

                // Weapon-based crit scaling: non-weapon items can contribute as global
                // multipliers/bonuses to the weapon's critChance.
                if (!isWeapon) {
                    if (mod.stat === 'critChance') {
                        if (mod.operation === 'multiply') this.effects.critChanceMult *= Player._mult1p(mod.value);
                        else if (mod.operation === 'add') this.effects.critChanceBonus += (Number(mod.value) || 0);
                    } else if (mod.stat === 'critChanceMult') {
                        // Some generators may encode the multiplier stat as additive (0.15 => +15%).
                        this.effects.critChanceMult *= Player._mult1p(mod.value);
                    }
                }
            }

            // Weapon Effects are stored on the weapon item as a specialEffect payload.
            if (isWeapon && item?.specialEffect?.effects) {
                EffectUtils.mergeEffects(this.effects, item.specialEffect.effects);
            }

            // Enhancements are stored on accessories as enhancement payload.
            if (item?.enhancement) {
                if (item.enhancement.effects) {
                    EffectUtils.mergeEffects(this.effects, item.enhancement.effects);
                }
                if (item.enhancement.kind === 'critMomentum' && item.enhancement.config) {
                    const cfg = item.enhancement.config;
                    const c = {
                        damagePerStack: Number(cfg.damagePerStack) || 0.05,
                        duration: Math.max(1, Number(cfg.duration) || 600),
                        maxStacks: Math.max(1, Math.floor(Number(cfg.maxStacks) || 3))
                    };

                    if (!bestCritMomentum) bestCritMomentum = c;
                    else {
                        // Prefer stronger configs if multiple accessories roll it.
                        if ((c.damagePerStack || 0) > (bestCritMomentum.damagePerStack || 0)) bestCritMomentum.damagePerStack = c.damagePerStack;
                        if ((c.duration || 0) > (bestCritMomentum.duration || 0)) bestCritMomentum.duration = c.duration;
                        if ((c.maxStacks || 0) > (bestCritMomentum.maxStacks || 0)) bestCritMomentum.maxStacks = c.maxStacks;
                    }
                }
            }
        });

        this.enhancementConfigs.critMomentum = bestCritMomentum;
        // Clamp existing stacks if config changed (or got removed).
        if (!this.enhancementConfigs.critMomentum) {
            this.buffStates.critMomentum.stacks = 0;
            this.buffStates.critMomentum.time = 0;
        } else {
            const maxStacks = this.enhancementConfigs.critMomentum.maxStacks;
            this.buffStates.critMomentum.stacks = Math.min(this.buffStates.critMomentum.stacks || 0, maxStacks);
        }

        // Temporary buffs should be applied on the final layer.
        // (We do not name it; it is just a higher-numbered layer.)
        const cfg = this.enhancementConfigs.critMomentum;
        const cm = this.buffStates.critMomentum;
        if (cfg && cm && cm.time > 0 && (cm.stacks || 0) > 0) {
            const bonus = (cm.stacks || 0) * (Number(cfg.damagePerStack) || 0);
            statObjs.damage.addModifier({
                layer: 3,
                operation: 'multiply',
                value: bonus,
                source: 'buff',
                stat: 'damage',
                name: 'Critical Momentum'
            });
        }

        // Finalize numeric stat values + breakdowns
        for (const [k, s] of Object.entries(statObjs)) {
            const breakdown = s.getBreakdown();
            this.stats[k] = breakdown.final;
            this.statBreakdowns[k] = breakdown;
        }

        // If max HP increased (e.g., from an item), heal for the amount gained.
        const newMaxHp = Number(this.stats.maxHp) || 0;
        if (newMaxHp > prevMaxHp) {
            this.heal(newMaxHp - prevMaxHp);
        }

        if (this.hp > newMaxHp) this.hp = newMaxHp;
        Game.ui.updateStatsPanel();
    }

    tickBuffs() {
        const cm = this.buffStates.critMomentum;
        if (cm && cm.time > 0) {
            cm.time--;
            if (cm.time <= 0) {
                cm.time = 0;
                cm.stacks = 0;
                // Buff ended; stats changed.
                this.recalculateStats();
            }
        }
    }

    onCritEvent() {
        const cfg = this.enhancementConfigs.critMomentum;
        if (!cfg) return;

        const cm = this.buffStates.critMomentum;
        const nextStacks = Math.min(cfg.maxStacks || 3, (cm.stacks || 0) + 1);
        cm.stacks = nextStacks;
        cm.time = Math.max(cm.time || 0, cfg.duration || 600);

        // Buff state changed; stats changed.
        this.recalculateStats();
    }

    getActiveBuffs() {
        const out = [];
        const cmCfg = this.enhancementConfigs.critMomentum;
        const cm = this.buffStates.critMomentum;
        if (cmCfg && cm && cm.time > 0 && (cm.stacks || 0) > 0) {
            out.push({
                id: 'critMomentum',
                name: 'Critical Momentum',
                stacks: cm.stacks,
                time: cm.time,
                maxTime: cmCfg.duration,
                description: `+${Math.round((cmCfg.damagePerStack || 0.05) * 100)}% damage per stack`
            });
        }
        return out;
    }

    // Debug helper: returns the full breakdown object for a stat key.
    // Layer 0 is base; higher layers are numeric and intentionally unlabeled.
    getStatBreakdown(statKey) {
        if (!statKey) return null;
        return this.statBreakdowns ? (this.statBreakdowns[statKey] || null) : null;
    }

    getEffectiveCritChance(weapon = null) {
        const w = weapon || this.equipment.weapon;
        if (!w) return 0;

        const mods = Array.isArray(w.modifiers) ? w.modifiers : [];
        let base = 0;
        let localMult = 1;

        for (const m of mods) {
            if (!m || m.stat !== 'critChance') continue;
            if (m.operation === 'add') base += (Number(m.value) || 0);
            else if (m.operation === 'multiply') localMult *= Player._mult1p(m.value);
        }

        const globalMult = (Number(this.effects.critChanceMult) || 1);
        const bonus = (Number(this.effects.critChanceBonus) || 0);

        // Crit chance is weapon-based: scale weapon crit chance by global multipliers,
        // then apply any remaining additive bonus.
        return Math.max(0, (base * localMult * globalMult) + bonus);
    }

    getBaseCritDamageMult(weapon = null) {
        const w = weapon || this.equipment.weapon;
        if (!w) return 2;
        const mods = (w.modifiers || []).filter(m => m && m.stat === 'critDamageMultBase');
        const base = mods.reduce((acc, curr) => (curr.operation === 'add' ? acc + (curr.value || 0) : acc), 0);
        return (base > 0) ? base : 2;
    }

    heal(amount) {
        if (!amount || amount <= 0) return;
        this.hp = Math.min(this.stats.maxHp, this.hp + amount);
        Game.ui.updateBars(performance.now(), true);
    }

    takeDamage(amount) {
        if (window.DevMode?.enabled && window.DevMode?.cheats?.godMode) return;
        const mult = this.stats?.damageTakenMult ?? 1;
        const final = Math.max(0, amount * mult);
        this.hp -= final;
        Game.ui.updateBars(performance.now(), true);
        if (this.hp <= 0) Game.over();
    }

    equip(item, opts = {}) {
        if (item.type === ItemType.ARTIFACT) {
            this.artifacts.push(item);
            this.recalculateStats();
            Game.ui.updateInventory();
            if (typeof opts.onAfterEquip === 'function') opts.onAfterEquip();
            return;
        }

        let slot = ({
            [ItemType.WEAPON]: 'weapon',
            [ItemType.ARMOR]: 'armor'
        })[item.type] || null;

        if (item.type === ItemType.ACCESSORY) {
            if (!this.equipment.accessory1) slot = 'accessory1';
            else if (!this.equipment.accessory2) slot = 'accessory2';
            else {
                // Player choice for replacement once both slots are filled.
                if (Game?.ui?.promptAccessoryReplace) {
                    Game.ui.promptAccessoryReplace(
                        item,
                        (pickedSlot) => {
                            this.equipment[pickedSlot] = item;
                            this.recalculateStats();
                            Game.ui.updateInventory();
                            if (typeof opts.onAfterEquip === 'function') opts.onAfterEquip();
                        },
                        () => {
                            if (typeof opts.onCancel === 'function') opts.onCancel();
                        }
                    );
                    return;
                }
                // Fallback.
                slot = 'accessory1';
            }
        }

        if (slot) {
            this.equipment[slot] = item;
            this.recalculateStats();
            Game.ui.updateInventory();
            if (typeof opts.onAfterEquip === 'function') opts.onAfterEquip();
        }
    }

    update() {
        const input = Input.getAxis();
        this.x += input.x * this.stats.moveSpeed;
        this.y += input.y * this.stats.moveSpeed;
        const worldW = window.Game?.world?.width ?? canvas.width;
        const worldH = window.Game?.world?.height ?? canvas.height;
        this.x = Math.max(this.radius, Math.min(worldW - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(worldH - this.radius, this.y));

        if (this.hp < this.stats.maxHp) {
            // Regen is nerfed by half
            this.hp += this.stats.regen * 0.25;
            if(this.hp > this.stats.maxHp) this.hp = this.stats.maxHp;
        }

        this.tickBuffs();

        const weapon = this.equipment.weapon;
        if (weapon) {
            this.weaponCooldown--;
            if (this.weaponCooldown <= 0) {
                this.fireWeapon(weapon);
                let baseCd = this.getEffectiveItemStat(weapon, 'cooldown', 60);
                this.weaponCooldown = Math.max(1, baseCd * this.stats.cooldownMult); 
            }
        }
    }

    fireWeapon(weapon) {
        // Clean up lingering orbitals if we swapped weapon behavior.
        if (weapon.behavior !== BehaviorType.ORBITAL && this.activeOrbitals?.length) {
            this.activeOrbitals.forEach(o => o.dead = true);
            this.activeOrbitals = [];
        }

        const getMod = (stat, def) => this.getEffectiveItemStat(weapon, stat, def);

        let baseDmg = getMod('baseDamage', 5);
        let finalDmg = baseDmg * this.stats.damage;
        // Use global projectile count from effects (aggregates weapon base + all item bonuses)
        let count = Math.max(1, Math.floor(this.effects.projectileCount || 1));
        let pierce = Math.floor(getMod('pierce', 0));
        let knockback = getMod('knockback', 0);

        let isCrit = false;

        // Crit is weapon-based.
        // Over-crit: critChance > 100% guarantees crit and scales crit damage further.
        const critChance = this.getEffectiveCritChance(weapon);

        let baseCritMult = this.getBaseCritDamageMult(weapon);
        if (this.effects.critDamageMult && this.effects.critDamageMult > 0) {
            baseCritMult = Math.max(baseCritMult, this.effects.critDamageMult);
        }

        // Over-crit: guarantee crit at 100%+, but apply diminishing returns beyond that.
        // This keeps crit stacking fun while preventing infinite runaway scaling.
        const overCrit = Math.max(0, critChance - 1);
        const overCritEffective = overCrit / (1 + overCrit);
        const critMult = baseCritMult * (1 + overCritEffective);

        if (critChance >= 1 || Math.random() < critChance) {
            finalDmg *= critMult;
            isCrit = true;
        }

        if (isCrit) {
            this.onCritEvent();
        }

        if (weapon.behavior === BehaviorType.AURA) {
            let range = getMod('areaOfEffect', 50) + this.stats.areaOfEffect;
            const wid = weapon?.legendaryId || weapon?.archetypeId || '';
            const auraColor = ({
                ember_lantern: '#e67e22',
                frost_censer: '#85c1e9',
                storm_totem: '#f4d03f'
            })[wid] ?? '#ffffff';
            Game.effects.push(new AuraEffect(this.x, this.y, range, auraColor));
            const kb = knockback + (this.effects.knockbackOnHitBonus || 0);
            const rrBase = range;
            const px = this.x;
            const py = this.y;
            for (let i = 0, n = Game.enemies.length; i < n; i++) {
                const e = Game.enemies[i];
                if (!e || e.dead) continue;
                const dx = e.x - px;
                const dy = e.y - py;
                const rr = rrBase + (e.radius || 0);
                if ((dx * dx + dy * dy) < (rr * rr)) {
                    e.takeDamage(finalDmg, isCrit, kb, px, py, this);
                }
            }
        } else if (weapon.behavior === BehaviorType.ORBITAL) {
            // Recreate orbitals each swing so stats always match current rolls.
            if (this.activeOrbitals?.length) {
                this.activeOrbitals.forEach(o => o.dead = true);
                this.activeOrbitals = [];
            }

            const projSpeed = getMod('projSpeed', 8);
            const angularSpeed = Math.max(0.02, Math.min(0.12, 0.04 + (projSpeed - 6) * 0.006));

            const aoe = getMod('areaOfEffect', 50) + (this.stats.areaOfEffect || 0);
            const orbitRadius = Math.max(22, Math.round(aoe * 0.65));

            const baseCd = getMod('cooldown', 60);
            const lifeMult = (this.effects.orbitalLifeMult && this.effects.orbitalLifeMult > 0) ? this.effects.orbitalLifeMult : 1;
            const life = Math.max(20, Math.floor(baseCd * (this.stats.cooldownMult || 1) * lifeMult));

            const kb = knockback + (this.effects.knockbackOnHitBonus || 0);
            const hitEvery = 12;

            const n = Math.max(1, count + (this.effects.orbitalCountBonus || 0));
            for (let i = 0; i < n; i++) {
                const ang = (i / n) * Math.PI * 2;
                const styleId = weapon?.legendaryId || weapon?.archetypeId || weapon?.name || 'default';
                const o = new OrbitalProjectile(this, orbitRadius, ang, angularSpeed, finalDmg, isCrit, kb, life, hitEvery, { styleId });
                Game.projectiles.push(o);
                this.activeOrbitals.push(o);
            }
        } else if (weapon.behavior === BehaviorType.PROJECTILE) {
            let nearest = null;
            let minDst2 = Infinity;
            const px = this.x;
            const py = this.y;
            for (let i = 0, n = Game.enemies.length; i < n; i++) {
                const e = Game.enemies[i];
                if (!e || e.dead) continue;
                const dx = e.x - px;
                const dy = e.y - py;
                const d2 = dx * dx + dy * dy;
                if (d2 < minDst2) { minDst2 = d2; nearest = e; }
            }

            if (nearest) {
                let speed = getMod('projSpeed', 8);
                const dx = nearest.x - this.x;
                const dy = nearest.y - this.y;
                const angle = Math.atan2(dy, dx);

                for (let i = 0; i < count; i++) {
                    let spreadAngle = 0;
                    if (count > 1) {
                        spreadAngle = (i - (count-1)/2) * 0.2; 
                    }
                    const vx = Math.cos(angle + spreadAngle) * speed;
                    const vy = Math.sin(angle + spreadAngle) * speed;
                    const styleId = weapon?.legendaryId || weapon?.archetypeId || weapon?.name || 'default';
                    Game.projectiles.push(new Projectile(this.x, this.y, vx, vy, finalDmg, isCrit, pierce, knockback, this, 'enemy', { styleId }));
                }
            }
        }
    }

    gainXp(amount) {
        const mult = this.stats?.xpGain ?? 1;
        this.xp += amount * 1.25 * mult;
        if (this.xp >= this.nextLevelXp) this.levelUp();
        Game.ui.updateBars(performance.now(), true);
    }

    levelUp() {
        this.level++;
        this.xp = 0;
        this.nextLevelXp = Math.floor(this.nextLevelXp * 1.4);
        if (typeof Game !== 'undefined' && Game?.onPlayerLevelUp) {
            Game.onPlayerLevelUp(this.level);
        }
        Game.triggerLevelUp();
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
}
