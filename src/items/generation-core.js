// Core item generation logic and LootSystem class

const LootConstants = {
    rarityRollThresholds: {
        uncommon: 0.50,
        rare: 0.75,
        epic: 0.90,
        legendary: 0.98
    },
    curseChance: 0.12
};

function nextRarity(r) {
    if (r === Rarity.COMMON) return Rarity.UNCOMMON;
    if (r === Rarity.UNCOMMON) return Rarity.RARE;
    if (r === Rarity.RARE) return Rarity.EPIC;
    if (r === Rarity.EPIC) return Rarity.LEGENDARY;
    return Rarity.LEGENDARY;
}

function getRunSeconds() {
    const frames = (typeof Game !== 'undefined' && Game?.elapsedFrames !== undefined) ? Game.elapsedFrames : 0;
    return Math.max(0, frames / 60);
}

function getRarityRollThresholdsWithTime() {
    const base = LootConstants.rarityRollThresholds;
    const secs = getRunSeconds();
    const t = Math.min(1, secs / 600);

    const uncommon = base.uncommon - (0.04 * t);
    const rare = base.rare - (0.04 * t);
    const epic = base.epic - (0.025 * t);
    const legendary = base.legendary - (0.010 * t);

    return {
        uncommon: Math.max(0.05, Math.min(0.90, uncommon)),
        rare: Math.max(0.10, Math.min(0.95, Math.max(uncommon + 0.05, rare))),
        epic: Math.max(0.20, Math.min(0.98, Math.max(rare + 0.05, epic))),
        legendary: Math.max(0.40, Math.min(0.995, Math.max(epic + 0.03, legendary)))
    };
}

function pickItemTypeWeightedForPlayer(player) {
    const types = [ItemType.WEAPON, ItemType.ARMOR, ItemType.ACCESSORY, ItemType.ARTIFACT];
    const eq = player?.equipment || {};

    return weightedRandomFrom(types, (type) => {
        let w = 1;
        if (type === ItemType.ARTIFACT) w *= 0.85;
        if (type === ItemType.WEAPON && !eq.weapon) w *= 3.0;
        if (type === ItemType.ARMOR && !eq.armor) w *= 2.6;
        if (type === ItemType.ACCESSORY) {
            const a1 = !!eq.accessory1;
            const a2 = !!eq.accessory2;
            if (!a1 && !a2) w *= 3.0;
            else if (!a1 || !a2) w *= 2.0;
        }
        return w;
    }) || randomFrom(types);
}

function rollInRange(range, integer = false) {
    const v = range[0] + Math.random() * (range[1] - range[0]);
    return integer ? Math.round(v) : v;
}

function shouldScaleWithRarity(poolEntry) {
    if (poolEntry.noRarityScale) return false;
    if (poolEntry.op === 'multiply') return false;
    if (['projectileCount', 'pierce', 'projSpeed', 'orbitalSpeed', 'cooldownMult'].includes(poolEntry.stat)) return false;
    return true;
}

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function weightedRandomFrom(arr, weightFn) {
    if (!arr || !arr.length) return null;
    let total = 0;
    const weights = arr.map(a => {
        const w = Math.max(0.001, Number(weightFn?.(a)) || 1);
        total += w;
        return w;
    });
    let r = Math.random() * total;
    for (let i = 0; i < arr.length; i++) {
        r -= weights[i];
        if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
}

// Modifier helpers
function baseMod(stat, value, operation = 'add', name = undefined, source = 'base') {
    const m = { stat, value, operation, source };
    if (name) m.name = name;
    return m;
}

function modAdd(stat, value, name = undefined, source = 'base') {
    return baseMod(stat, value, 'add', name, source);
}

function modMul(stat, value, name = undefined, source = 'base') {
    return baseMod(stat, value, 'multiply', name, source);
}

function modList(...mods) {
    const out = [];
    for (const m of mods) {
        if (!m) continue;
        if (Array.isArray(m)) out.push(...m);
        else out.push(m);
    }
    return out;
}

function weaponProjectileMods({ baseDamage, cooldown, projectileCount = 1, pierce = 0, knockback = 0, projSpeed = 8 }) {
    return [
        modAdd('baseDamage', baseDamage),
        modAdd('cooldown', cooldown),
        modAdd('projectileCount', projectileCount),
        modAdd('pierce', pierce),
        modAdd('knockback', knockback),
        modAdd('projSpeed', projSpeed)
    ];
}

function weaponAuraMods({ baseDamage, cooldown, areaOfEffect, knockback = 0 }) {
    const mods = [
        modAdd('baseDamage', baseDamage),
        modAdd('cooldown', cooldown),
        modAdd('areaOfEffect', areaOfEffect)
    ];
    if (knockback !== undefined && knockback !== null) mods.push(modAdd('knockback', knockback));
    return mods;
}

class LootSystem {
    static LegendaryTemplates = {};

    static async loadLegendaryTemplates() {
        try {
            const response = await fetch('data/legendary-items.json');
            const items = await response.json();
            items.forEach(item => {
                this.LegendaryTemplates[item.id] = item;
            });
        } catch (e) {
            console.warn('Failed to load legendary items:', e);
        }
    }

    static async loadCurseAffixes() {
        try {
            const response = await fetch('data/curse-affixes.json');
            window.CurseAffixPool = await response.json();
        } catch (e) {
            console.warn('Failed to load curse affixes:', e);
            window.CurseAffixPool = [];
        }
    }

    static formatStat(stat, value) {
        if (['moveSpeed', 'damage'].includes(stat)) return `+${Math.round(value*100)}%`;
        if (['critChance', 'critChanceBonus'].includes(stat)) return `+${Math.round(value*100)}%`;
        if (['critDamageMultBase'].includes(stat)) return `x${Number(value).toFixed(2)}`;
        if (['cooldownMult'].includes(stat)) return `${Math.round(value*100)}%`;
        if (['rarityFind'].includes(stat)) return `+${Math.round(value*100)}%`;
        if (['xpGain'].includes(stat)) return `+${Math.round(value*100)}%`;
        if (['damageTakenMult'].includes(stat)) return `${Math.round(value*100)}%`;
        if (value % 1 !== 0) return `+${value.toFixed(1)}`;
        return `+${Math.round(value)}`;
    }

    static generateStarterWeapon() {
        return {
            uid: `starter_${Math.random().toString(36)}`,
            name: 'Apprentice Wand',
            type: ItemType.WEAPON,
            icon: '',
            behavior: BehaviorType.PROJECTILE,
            description: 'Starter: Fires a quick bolt at nearby enemies.',
            rarity: Rarity.COMMON,
            modifiers: weaponProjectileMods({
                baseDamage: 10,
                cooldown: 50,
                projectileCount: 1,
                pierce: 0,
                knockback: 0.8,
                projSpeed: 10
            }).concat([
                modAdd('critChance', .10, 'Crit Chance'),
                modAdd('critDamageMultBase', 2.00, 'Crit Damage')
            ]),
            legendaryId: null,
            specialEffect: null,
            archetypeId: 'starter_wand',
            archetypeNoun: 'Wand'
        };
    }

    static generateItem(options = null) {
        if (typeof options === 'string') {
            if (this.LegendaryTemplates[options]) {
                return this.generateLegendary(options);
            }
            options = { forceType: ItemType.WEAPON };
        }

        const forceType = options?.forceType || null;
        const forceRarity = options?.forceRarity || null;
        const forceLegendaryId = options?.forceLegendaryId || null;
        const forceBehavior = options?.forceBehavior || null;

        const type = forceType || pickItemTypeWeightedForPlayer(Game?.player);

        let rarity = forceRarity;
        if (!rarity) {
            const roll = Math.random();
            rarity = Rarity.COMMON;
            const thr = getRarityRollThresholdsWithTime();
            if (roll > thr.legendary) rarity = Rarity.LEGENDARY;
            else if (roll > thr.epic) rarity = Rarity.EPIC;
            else if (roll > thr.rare) rarity = Rarity.RARE;
            else if (roll > thr.uncommon) rarity = Rarity.UNCOMMON;

            const rf = Math.max(0, Game?.player?.stats?.rarityFind || 0);
            let upgradeChance = Math.min(0.25, rf);
            while (rarity !== Rarity.LEGENDARY && Math.random() < upgradeChance) {
                rarity = nextRarity(rarity);
                upgradeChance *= 0.5;
            }
        }

        if (rarity === Rarity.LEGENDARY || forceLegendaryId) {
            const legendaryId = forceLegendaryId || this.pickLegendaryForType(type);
            return this.generateLegendary(legendaryId);
        }

        let behavior = (forceBehavior ?? null);
        let weaponArchetype = null;
        if (type === ItemType.WEAPON) {
            weaponArchetype = pickWeaponArchetype();
            if (!behavior || behavior === BehaviorType.NONE) {
                const weights = { ...(weaponArchetype.weights || {}) };
                if (weights[BehaviorType.ORBITAL] === undefined) weights[BehaviorType.ORBITAL] = 0.06;
                behavior = rollBehaviorFromWeights(weights);
            }
        } else {
            behavior = behavior || BehaviorType.NONE;
        }

        const item = {
            uid: Math.random().toString(36),
            name: type === ItemType.WEAPON ? NameGenerator.generateWeapon(weaponArchetype?.noun) : NameGenerator.generate(type),
            type,
            icon: type === ItemType.ARTIFACT ? randomFrom(['💎', '🗿', '🧿', '🔮', '📿', '🪬']) : '',
            behavior: behavior || BehaviorType.NONE,
            description: this.generateDescription(type, behavior),
            rarity,
            modifiers: [],
            legendaryId: null,
            specialEffect: null,
            archetypeId: type === ItemType.WEAPON ? (weaponArchetype?.id || null) : null,
            archetypeNoun: type === ItemType.WEAPON ? (weaponArchetype?.noun || null) : null
        };

        const pool = StatPoolsByType[type] || [];
        let baseCount = 1 + Math.floor(Math.random() * 3);

        if (type === ItemType.WEAPON) {
            const mode = (item.behavior === BehaviorType.AURA) ? 'aura' : (item.behavior === BehaviorType.ORBITAL ? 'orbital' : 'projectile');
            const a = weaponArchetype?.[mode];
            const weaponPool = a?.pool || pool;

            const baseCritChance = Math.max(0, Number(weaponArchetype?.baseCritChance) || 0);
            const baseCritDamageMult = Math.max(1, Number(weaponArchetype?.baseCritDamageMult) || 2);
            item.modifiers.push(modAdd('critChance', baseCritChance, 'Crit Chance'));
            item.modifiers.push(modAdd('critDamageMultBase', baseCritDamageMult, 'Crit Damage'));

            const requiredStats = a?.required || ['baseDamage', 'cooldown'];
            let generatedWeaponStats = 0;
            requiredStats.forEach(stat => {
                const entry = weaponPool.find(p => p.stat === stat) || pool.find(p => p.stat === stat);
                if (entry) {
                    this.addGeneratedModifier(item, entry, rarity);
                    generatedWeaponStats++;
                }
            });

            const extraWeaponStats = 1 + Math.floor(Math.random() * 2);
            const weaponPoolSize = Array.isArray(weaponPool) ? weaponPool.length : 0;
            const targetWeaponStats = Math.max(generatedWeaponStats, Math.min(generatedWeaponStats + extraWeaponStats, weaponPoolSize));

            const already = new Set(item.modifiers.map(m => m.stat));
            const candidates = weaponPool.filter(p => !already.has(p.stat));
            while (generatedWeaponStats < targetWeaponStats && candidates.length) {
                const idx = Math.floor(Math.random() * candidates.length);
                const entry = candidates.splice(idx, 1)[0];
                this.addGeneratedModifier(item, entry, rarity);
                generatedWeaponStats++;
            }
        } else {
            const already = new Set(item.modifiers.map(m => m.stat));
            const candidates = pool.filter(p => !already.has(p.stat));
            while (item.modifiers.length < baseCount && candidates.length) {
                const idx = Math.floor(Math.random() * candidates.length);
                const entry = candidates.splice(idx, 1)[0];
                this.addGeneratedModifier(item, entry, rarity);
            }
        }

        let affixesAdded = 0;
        const attempts = rarity.affixes + 1;

        for (let i = 0; i < attempts; i++) {
            if (affixesAdded >= rarity.affixes) break;

            let useSpecial = false;
            if (item.type === ItemType.WEAPON && rarity === Rarity.EPIC && Math.random() < 0.5) useSpecial = true;

            if (useSpecial) {
                const validSpecials = window.SpecialAffixPool.filter(s => {
                    if (s.minRarity === 'legendary') return false;
                    if (s.minRarity === 'epic' && rarity !== Rarity.EPIC) return false;
                    if (s.minRarity === 'rare' && (rarity !== Rarity.RARE && rarity !== Rarity.EPIC)) return false;
                    if (s.minRarity === 'uncommon' && (rarity === Rarity.COMMON)) return false;
                    return true;
                });
                if (validSpecials.length > 0) {
                    const s = randomFrom(validSpecials);
                    item.modifiers.push(baseMod(s.stat, s.value, s.op, s.name, 'special'));
                    item.name = `${s.name} ${item.name}`;
                    affixesAdded++;
                    continue;
                }
            }

            const s = randomFrom(window.StatAffixPool);
            const val = s.range[0] + Math.random() * (s.range[1] - s.range[0]);
            if (val > 0.01) {
                item.modifiers.push(baseMod(s.stat, val, s.op, s.name, 'stat'));
                affixesAdded++;
            }
        }

        if (rarityAtLeast(rarity, 'rare') && Math.random() < LootConstants.curseChance) {
            const validCurses = window.CurseAffixPool.filter(c => c.types.includes(item.type) && rarityAtLeast(rarity, c.minRarity));
            if (validCurses.length) {
                const c = randomFrom(validCurses);
                (c.negative || []).forEach(n => item.modifiers.push(baseMod(
                    n.stat,
                    n.value,
                    n.operation || 'add',
                    n.name,
                    n.source || 'curse'
                )));
                item.specialEffect = item.specialEffect || {};
                EffectUtils.mergeEffects(item.specialEffect, c.effect);
                item.isCursed = true;
                item.name = `${c.name} ${item.name}`;
                item.description = `${item.description} (Cursed)`;
            }
        }

        const effectSlots = getEffectSlotsForRarity(rarity);
        if (effectSlots > 0) {
            const valid = window.EffectAffixPool.filter(e => {
                if (!e.types.includes(item.type)) return false;
                return rarityAtLeast(rarity, e.minRarity);
            });
            if (valid.length) {
                item.specialEffect = item.specialEffect || {};
                const used = new Set();

                const playerHas = getPlayerHasForEffectSteering(Game?.player);
                const weightFor = makeEffectWeightFor(playerHas);

                for (let s = 0; s < effectSlots; s++) {
                    const candidates = valid.filter(v => !used.has(v.id));
                    if (!candidates.length) break;
                    const chosen = weightedRandomFrom(candidates, weightFor) || randomFrom(candidates);
                    used.add(chosen.id);
                    EffectUtils.mergeEffects(item.specialEffect, chosen.effect);
                    if (s === 0) item.name = `${chosen.name} ${item.name}`;
                }
            }
        }

        return item;
    }

    static addGeneratedModifier(item, entry, rarity) {
        let val = rollInRange(entry.range, !!entry.integer);
        if (shouldScaleWithRarity(entry)) {
            if (entry.stat === 'cooldown') val = val / Math.max(0.01, rarity.multiplier);
            else val = val * rarity.multiplier;

            if (entry.integer) val = Math.round(val);
        }

        item.modifiers.push(baseMod(entry.stat, val, entry.op || 'add', undefined, 'base'));
    }

    static pickLegendaryForType(type) {
        const all = Object.values(this.LegendaryTemplates);
        const filtered = all.filter(l => l.type === type);
        const lvl = Math.max(1, Game?.player?.level || 1);

        const eligible = (filtered.length ? filtered : all).filter(l => {
            const min = l.minLevel || 1;
            const max = l.maxLevel || 999;
            return lvl >= min && lvl <= max;
        });

        return (eligible.length ? randomFrom(eligible) : (filtered.length ? randomFrom(filtered) : randomFrom(all))).id;
    }

    static generateLegendary(id) {
        const t = this.LegendaryTemplates[id];
        if (!t) {
            return this.generateItem({ forceType: ItemType.WEAPON, forceRarity: Rarity.EPIC });
        }
        return {
            uid: Math.random().toString(36),
            name: t.name,
            type: t.type,
            icon: t.icon || '',
            behavior: t.behavior || BehaviorType.NONE,
            description: t.description,
            rarity: Rarity.LEGENDARY,
            modifiers: t.modifiers.map(m => ({
                stat: m.stat,
                value: m.value,
                operation: m.operation || 'add',
                source: m.source || 'base',
                name: m.name
            })),
            legendaryId: t.id,
            specialEffect: { ...(t.specialEffect || {}) }
        };
    }

    static generateDescription(type, behavior) {
        if (type === ItemType.WEAPON) {
            if (behavior === BehaviorType.AURA) return 'Radiates damage around you.';
            if (behavior === BehaviorType.ORBITAL) return 'Orbits you and strikes nearby foes.';
            return 'Strikes the nearest foe.';
        }
        if (type === ItemType.ARMOR) return 'Protective gear.';
        if (type === ItemType.ACCESSORY) return 'A curious trinket.';
        if (type === ItemType.ARTIFACT) return 'An ancient passive relic.';
        return 'Mysterious item.';
    }
}
