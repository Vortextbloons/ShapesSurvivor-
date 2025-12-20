class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
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
        this.hp = this.stats.maxHp;
        this.xp = 0;
        this.level = 1;
        this.nextLevelXp = 50;
        this.weaponCooldown = 0;
        this.activeOrbitals = [];
        this.activeSynergyIds = new Set();
        this.activeSynergyNames = [];
        this.effects = EffectUtils.createDefaultEffects();

        // Build crafting state (computed during recalc, used for reward shaping + UI).
        this.build = {
            dominantFamily: null,
            familyCounts: {},
            tagCounts: {},
            // "Friction" against pivoting: starts at 0 and rises as you keep taking on-family rewards.
            commitment: 0
        };
    }

    computeBuildIdentity(items) {
        const weapon = this.equipment.weapon;
        const familyCounts = {};
        const tagCounts = {};

        const bump = (map, key, amt = 1) => {
            if (!key) return;
            map[key] = (map[key] || 0) + amt;
        };

        // Weapon archetype identity is the "root" of a run.
        const wArchId = weapon?.archetypeId || null;
        const wArch = (wArchId && typeof WeaponArchetypes !== 'undefined') ? WeaponArchetypes[wArchId] : null;
        const wFamily = weapon?.legendaryId ? 'legendary' : (wArch?.family || null);
        if (wFamily) bump(familyCounts, wFamily, weapon?.legendaryId ? 2 : 1);

        // Behavior is part of identity (projectile/orbital/aura).
        if (weapon?.behavior === BehaviorType.AURA) bump(tagCounts, 'aura');
        else if (weapon?.behavior === BehaviorType.ORBITAL) bump(tagCounts, 'orbital');
        else if (weapon?.behavior === BehaviorType.PROJECTILE) bump(tagCounts, 'projectile');

        // Archetype tags.
        (wArch?.tags || []).forEach(t => bump(tagCounts, t));

        // Effects present on the build contribute tags/family intent.
        // (We infer tags from numeric effect fields so we don't have to rewrite all items.)
        const fx = this.effects || {};
        if ((fx.burnOnHitPctTotal || 0) > 0) bump(tagCounts, 'burn');
        if ((fx.poisonOnHitPctTotal || 0) > 0) bump(tagCounts, 'poison');
        if ((fx.freezeOnHitChance || 0) > 0) bump(tagCounts, 'freeze');
        if ((fx.stunOnHitChance || 0) > 0) bump(tagCounts, 'stun');
        if ((fx.slowOnHitMult || 0) > 0) bump(tagCounts, 'slow');
        if ((fx.chainJumps || 0) > 0) bump(tagCounts, 'chain');
        if ((fx.shatterVsFrozenMult || 0) > 0) bump(tagCounts, 'shatter');
        if ((fx.healOnHitPct || 0) > 0 || (fx.healOnHitFlat || 0) > 0) bump(tagCounts, 'leech');
        if ((fx.executeBelowPct || 0) > 0) bump(tagCounts, 'execute');
        if ((fx.critChanceBonus || 0) > 0 || (fx.critDamageMult || 0) > 0) bump(tagCounts, 'crit');

        // Also count families/tags directly from tagged effect affixes chosen on items.
        (items || []).forEach(it => {
            const ids = it?.effectAffixIds || [];
            if (!ids || !ids.length) return;
            const pool = (typeof window !== 'undefined' && window.EffectAffixPool) ? window.EffectAffixPool : [];
            ids.forEach(id => {
                const found = pool.find(a => a && a.id === id);
                if (!found) return;
                if (found.family) bump(familyCounts, found.family);
                (found.tags || []).forEach(t => bump(tagCounts, t));
            });
        });

        // Choose dominant family.
        let dominantFamily = null;
        let best = 0;
        for (const [fam, n] of Object.entries(familyCounts)) {
            if (n > best) {
                best = n;
                dominantFamily = fam;
            }
        }

        this.build = {
            ...this.build,
            dominantFamily,
            familyCounts,
            tagCounts
        };
    }

    applySynergies(items) {
        const weapon = this.equipment.weapon;
        const cursedCount = (items || []).filter(i => i && i.isCursed).length;
        const artifactCount = this.artifacts.length;

        const weaponModSum = (stat, def = 0) => {
            if (!weapon) return def;
            const mods = (weapon.modifiers || []).filter(m => m.stat === stat);
            if (!mods.length) return def;
            return mods.reduce((acc, curr) => (curr.operation === 'add' ? acc + (curr.value || 0) : acc), 0);
        };

        const weaponProjectileCount = Math.max(1, Math.floor(weaponModSum('projectileCount', 1)));
        const weaponCooldown = Math.max(5, weaponModSum('cooldown', 60));

        const hasBurn = (this.effects.burnOnHitPctTotal || 0) > 0;
        const hasPoison = (this.effects.poisonOnHitPctTotal || 0) > 0;
        const hasFreeze = (this.effects.freezeOnHitChance || 0) > 0;
        const hasStun = (this.effects.stunOnHitChance || 0) > 0;
        const hasSlow = (this.effects.slowOnHitMult || 0) > 0;
        const hasChain = (this.effects.chainJumps || 0) > 0;
        const hasShatter = (this.effects.shatterVsFrozenMult || 0) > 0;
        const hasLeech = (this.effects.healOnHitPct || 0) > 0 || (this.effects.healOnHitFlat || 0) > 0;
        const hasExecute = (this.effects.executeBelowPct || 0) > 0;
        const isOrbitalWeapon = weapon && weapon.behavior === BehaviorType.ORBITAL;

        const newlyActive = new Set();
        const activeNames = [];

        const activate = (id, name) => {
            newlyActive.add(id);
            activeNames.push(name);
            if (!this.activeSynergyIds.has(id)) {
                Game.floatingTexts.push(new FloatingText(`Synergy: ${name}`, this.x, this.y, '#7dd3fc', true));
            }
        };

        // Data-driven synergies (preserves ordering and stacking semantics).
        SynergyRegistry.apply({
            player: this,
            weapon,
            cursedCount,
            artifactCount,
            weaponProjectileCount,
            weaponCooldown,
            flags: {
                hasBurn,
                hasPoison,
                hasFreeze,
                hasStun,
                hasSlow,
                hasChain,
                hasShatter,
                hasLeech,
                hasExecute,
                isOrbitalWeapon
            },
            activate
        });

        // Persist active list
        this.activeSynergyIds = newlyActive;
        this.activeSynergyNames = activeNames;
    }

    recalculateStats() {
        this.stats = { ...this.baseStats };
        const items = [...Object.values(this.equipment).filter(i => i !== null), ...this.artifacts];

        // Stats + effects aggregation in one pass.
        this.effects = EffectUtils.createDefaultEffects();

        items.forEach(item => {
            (item?.modifiers || []).forEach(mod => {
                if (!mod) return;

                // Stat modifiers (classic)
                if (this.stats[mod.stat] !== undefined) {
                    if (mod.operation === 'add') this.stats[mod.stat] += mod.value;
                    else if (mod.operation === 'multiply') this.stats[mod.stat] *= (1 + mod.value);
                    return;
                }

                // Effect modifiers (lets items roll effect bonuses without putting them in specialEffect)
                if (this.effects && this.effects[mod.stat] !== undefined) {
                    if (mod.operation === 'add') this.effects[mod.stat] += mod.value;
                    else if (mod.operation === 'multiply') this.effects[mod.stat] *= (1 + mod.value);
                }
            });

            const fx = item?.specialEffect;
            if (!fx) return;

            EffectUtils.mergeEffects(this.effects, fx);
        });

        // Build identity is derived from the final aggregated effects + weapon archetype.
        this.computeBuildIdentity(items);

        // Apply build synergies after base stat/effect aggregation.
        this.applySynergies(items);

        if (this.hp > this.stats.maxHp) this.hp = this.stats.maxHp;
        Game.ui.updateStatsPanel();
    }

    getEffectiveCritChance(weapon = null) {
        const w = weapon || this.equipment.weapon;
        if (!w) return 0;

        const mods = (w.modifiers || []).filter(m => m && m.stat === 'critChance');
        const base = mods.reduce((acc, curr) => (curr.operation === 'add' ? acc + (curr.value || 0) : acc), 0);
        const bonus = (this.effects.critChanceBonus || 0);
        return Math.max(0, base + bonus);
    }

    getBaseCritDamageMult(weapon = null) {
        const w = weapon || this.equipment.weapon;
        if (!w) return 2;
        const mods = (w.modifiers || []).filter(m => m && m.stat === 'critDamageMultBase');
        const base = mods.reduce((acc, curr) => (curr.operation === 'add' ? acc + (curr.value || 0) : acc), 0);
        return (base > 0) ? base : 2;
    }

    getEquippedItemForType(type) {
        if (type === ItemType.WEAPON) return this.equipment.weapon;
        if (type === ItemType.ARMOR) return this.equipment.armor;
        if (type === ItemType.ACCESSORY) return this.equipment.accessory1 || this.equipment.accessory2;
        return null;
    }

    upgradeEquippedOneStatForType(type, upgradeRarity) {
        const slot = ItemUtils.getSlotForType(type, this);
        if (!slot) return false;
        const item = this.equipment[slot];
        if (!item) return false;

        const result = ItemUpgrader.upgradeOneStat(item, upgradeRarity);
        if (!result) return false;

        this.recalculateStats();
        return true;
    }

    heal(amount) {
        if (!amount || amount <= 0) return;
        this.hp = Math.min(this.stats.maxHp, this.hp + amount);
        Game.ui.updateBars();
    }

    takeDamage(amount) {
        if (window.DevMode?.enabled && window.DevMode?.cheats?.godMode) return;
        const mult = (this.stats.damageTakenMult !== undefined) ? this.stats.damageTakenMult : 1;
        const final = Math.max(0, amount * mult);
        this.hp -= final;
        Game.ui.updateBars();
        if (this.hp <= 0) Game.over();
    }

    equip(item, opts = {}) {
        const applyCommitment = () => {
            const role = item?.offerRole || null;
            if (!role) return;
            if (!this.build) this.build = { dominantFamily: null, familyCounts: {}, tagCounts: {}, commitment: 0 };
            let c = Math.max(0, Number(this.build.commitment || 0));

            if (role === 'On-Path') c += 1;
            else if (role === 'Wildcard') c = Math.max(0, c - 1);
            else if (role === 'Pivot') c = Math.max(0, c - 2);

            this.build.commitment = Math.min(10, c);
        };

        if (item.type === ItemType.ARTIFACT) {
            applyCommitment();
            this.artifacts.push(item);
            this.recalculateStats();
            Game.ui.updateInventory();
            if (typeof opts.onAfterEquip === 'function') opts.onAfterEquip();
            return;
        }

        let slot = null;
        if (item.type === ItemType.WEAPON) slot = 'weapon';
        else if (item.type === ItemType.ARMOR) slot = 'armor';
        else if (item.type === ItemType.ACCESSORY) {
            if (!this.equipment.accessory1) slot = 'accessory1';
            else if (!this.equipment.accessory2) slot = 'accessory2';
            else {
                // Player choice for replacement once both slots are filled.
                if (Game?.ui?.promptAccessoryReplace) {
                    Game.ui.promptAccessoryReplace(
                        item,
                        (pickedSlot) => {
                            applyCommitment();
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
            applyCommitment();
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
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        if (this.hp < this.stats.maxHp) {
            this.hp += this.stats.regen;
            if(this.hp > this.stats.maxHp) this.hp = this.stats.maxHp;
        }

        const weapon = this.equipment.weapon;
        if (weapon) {
            this.weaponCooldown--;
            if (this.weaponCooldown <= 0) {
                this.fireWeapon(weapon);
                let baseCd = weapon.modifiers.find(m => m.stat === 'cooldown')?.value || 60;
                this.weaponCooldown = Math.max(5, baseCd * this.stats.cooldownMult); 
            }
        }
    }

    fireWeapon(weapon) {
        // Clean up lingering orbitals if we swapped weapon behavior.
        if (weapon.behavior !== BehaviorType.ORBITAL && this.activeOrbitals?.length) {
            this.activeOrbitals.forEach(o => o.dead = true);
            this.activeOrbitals = [];
        }

        const getMod = (stat, def) => {
            const m = weapon.modifiers.filter(m => m.stat === stat);
            if (!m.length) return def;
            return m.reduce((acc, curr) => curr.operation==='add' ? acc+curr.value : acc, 0); 
        };

        let baseDmg = getMod('baseDamage', 5);
        let finalDmg = baseDmg * this.stats.damage;
        let count = Math.max(1, Math.floor(getMod('projectileCount', 1)));
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

        if (weapon.behavior === BehaviorType.AURA) {
            let range = getMod('areaOfEffect', 50) + this.stats.areaOfEffect;
            const wid = weapon?.legendaryId || weapon?.archetypeId || '';
            const auraColor = (wid === 'ember_lantern') ? '#e67e22'
                : (wid === 'frost_censer') ? '#85c1e9'
                : (wid === 'storm_totem') ? '#f4d03f'
                : '#ffffff';
            Game.effects.push(new AuraEffect(this.x, this.y, range, auraColor));
            const kb = knockback + (this.effects.knockbackOnHitBonus || 0);
            Game.enemies.forEach(e => {
                if (Math.hypot(e.x - this.x, e.y - this.y) < range + e.radius) {
                    e.takeDamage(finalDmg, isCrit, kb, this.x, this.y, this);
                }
            });
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

            const baseCd = weapon.modifiers.find(m => m.stat === 'cooldown')?.value || 60;
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
            let nearest = null, minDst = Infinity;
            Game.enemies.forEach(e => {
                const d = Math.hypot(e.x - this.x, e.y - this.y);
                if (d < minDst) { minDst = d; nearest = e; }
            });

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
        const mult = (this.stats.xpGain !== undefined) ? this.stats.xpGain : 1;
        this.xp += amount * 1.25 * mult;
        if (this.xp >= this.nextLevelXp) this.levelUp();
        Game.ui.updateBars();
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
