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

// Families/tags/synergies have been removed; item generation is purely stat-based.

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

function fillStatsFromPool(item, pool, rarity, requiredStats, extraStatRoll) {
    let generatedStats = 0;
    
    requiredStats.forEach(stat => {
        const entry = pool.find(p => p.stat === stat);
        if (entry) {
            LootSystem.addGeneratedModifier(item, entry, rarity);
            generatedStats++;
        }
    });

    const targetStats = Math.max(generatedStats, Math.min(generatedStats + extraStatRoll, pool.length));
    const already = new Set(item.modifiers.map(m => m.stat));
    const candidates = pool.filter(p => !already.has(p.stat));
    
    while (generatedStats < targetStats && candidates.length) {
        const idx = Math.floor(Math.random() * candidates.length);
        const entry = candidates.splice(idx, 1)[0];
        LootSystem.addGeneratedModifier(item, entry, rarity);
        generatedStats++;
    }
}

function normalizeItemTypeArray(types) {
    const arr = Array.isArray(types) ? types : [];
    return arr.map(t => (typeof t === 'string' ? (ItemType[t.toUpperCase()] || t) : t));
}

function rarityIdOf(r) {
    return r?.id || (typeof r === 'string' ? r : null);
}

function isEntryEligibleForRarity(entry, rarity) {
    if (!entry) return false;
    const min = entry.minRarity || 'common';
    return rarityAtLeast(rarity, min);
}

function pickWeightedEntryFromPool(pool, rarity, usedIds) {
    const eligible = (pool || []).filter(e => {
        if (!isEntryEligibleForRarity(e, rarity)) return false;
        const id = e.id || e.name;
        if (usedIds?.has(id)) return false;
        return true;
    });
    if (!eligible.length) return null;
    return weightedRandomFrom(eligible, (e) => Number(e.weight) || 1);
}

function isAffixEligibleForItem(affix, itemType, rarity) {
    if (!affix) return false;
    const min = affix.minRarity || 'common';
    if (!rarityAtLeast(rarity, min)) return false;
    const types = normalizeItemTypeArray(affix.types);
    if (types.length && !types.includes(itemType)) return false;
    return true;
}

function pickAffixFromPool(pool, itemType, rarity, usedIds) {
    const eligible = (pool || []).filter(a => {
        if (!isAffixEligibleForItem(a, itemType, rarity)) return false;
        const id = a.id || a.name;
        if (usedIds?.has(id)) return false;
        return true;
    });
    if (!eligible.length) return null;
    return randomFrom(eligible);
}

function affixToModifiers(affix) {
    const mods = [];
    const list = Array.isArray(affix?.modifiers) ? affix.modifiers : [];
    for (const entry of list) {
        if (!entry?.stat) continue;
        const operation = entry.operation || entry.op || 'add';
        let value = 0;
        if (typeof entry.value === 'number') value = entry.value;
        else if (Array.isArray(entry.range)) value = rollInRange(entry.range, !!entry.integer);
        else continue;

        mods.push({
            stat: entry.stat,
            value,
            operation,
            source: entry.source || 'affix',
            name: entry.label || entry.name || affix?.name,
            affixId: affix.id || affix.name,
            integer: !!entry.integer
        });
    }
    return mods;
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

    static formatStat(stat, value, operation = 'add') {
        const v = Number(value) || 0;
        const sign = v >= 0 ? '+' : '';

        // Multipliers are generally displayed as percentages (+15% / -10%).
        if (operation === 'multiply') {
            if (['critDamageMultBase'].includes(stat)) {
                return `x${Number(v).toFixed(2)}`;
            }
            return `${sign}${Math.round(v * 100)}%`;
        }

        if (['moveSpeed', 'damage', 'xpGain', 'rarityFind'].includes(stat)) {
            return `${sign}${Math.round(v * 100)}%`;
        }
        if (['critChance', 'critChanceBonus'].includes(stat)) {
            return `${sign}${Math.round(v * 100)}%`;
        }
        if (['damageTakenMult'].includes(stat)) {
            return `${Math.round(v * 100)}%`;
        }
        if (['cooldownMult'].includes(stat)) {
            return `${Math.round(v * 100)}%`;
        }
        if (['critDamageMultBase'].includes(stat)) {
            return `x${Number(v).toFixed(2)}`;
        }
        if (v % 1 !== 0) return `${sign}${v.toFixed(2)}`;
        return `${sign}${Math.round(v)}`;
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

        const archetypeConfig = {
            [ItemType.WEAPON]: { picker: () => pickWeaponArchetype(), defaultBehavior: null },
            [ItemType.ARMOR]: { picker: pickArmorArchetype, defaultBehavior: BehaviorType.NONE },
            [ItemType.ACCESSORY]: { picker: pickAccessoryArchetype, defaultBehavior: BehaviorType.NONE },
            [ItemType.ARTIFACT]: { picker: pickArtifactArchetype, defaultBehavior: BehaviorType.NONE }
        };

        const config = archetypeConfig[type] || { picker: () => null, defaultBehavior: BehaviorType.NONE };
        let archetype = config.picker();
        let behavior = forceBehavior || config.defaultBehavior;

        if (type === ItemType.WEAPON && (!behavior || behavior === BehaviorType.NONE)) {
            const weights = { ...(archetype?.weights || {}) };
            if (weights[BehaviorType.ORBITAL] === undefined) weights[BehaviorType.ORBITAL] = 0.06;
            behavior = rollBehaviorFromWeights(weights);
        }

        const item = {
            uid: Math.random().toString(36),
            name: NameGenerator.generate(type, archetype?.noun),
            type,
            icon: type === ItemType.ARTIFACT ? randomFrom(['💎', '🗿', '🧿', '🔮', '📿', '🪬']) : '',
            behavior: behavior || BehaviorType.NONE,
            description: this.generateDescription(type, behavior),
            rarity,
            modifiers: [],
            legendaryId: null,
            specialEffect: null,
            enhancement: null,
            affixes: [],
            archetypeId: archetype?.id || null,
            archetypeNoun: archetype?.noun || null
        };

        // Determine the stat pool based on archetype (removed global fallback)
        const weaponMode = (item.behavior === BehaviorType.AURA) ? 'aura' : (item.behavior === BehaviorType.ORBITAL ? 'orbital' : 'projectile');
        let pool = [];
        if (type === ItemType.WEAPON) {
            pool = archetype?.[weaponMode]?.pool || [];
        } else {
            pool = archetype?.pool || [];
        }

        if (type === ItemType.WEAPON) {
            const a = archetype?.[weaponMode];
            const baseCritChance = Math.max(0, Number(archetype?.baseCritChance) || 0);
            const baseCritDamageMult = Math.max(1, Number(archetype?.baseCritDamageMult) || 2);
            item.modifiers.push(modAdd('critChance', baseCritChance, 'Crit Chance'));
            item.modifiers.push(modAdd('critDamageMultBase', baseCritDamageMult, 'Crit Damage'));

            fillStatsFromPool(item, pool, rarity, a?.required || ['baseDamage', 'cooldown'], 1 + Math.floor(Math.random() * 2));
        } else if (archetype) {
            fillStatsFromPool(item, pool, rarity, archetype.required || [], Math.floor(Math.random() * 2));
        }

        let affixesAdded = 0;
        const attempts = rarity.affixes + 2;
        const affixPool = (typeof window !== 'undefined' && Array.isArray(window.AffixPool)) ? window.AffixPool : [];
        const usedAffixIds = new Set();

        for (let i = 0; i < attempts; i++) {
            if (affixesAdded >= rarity.affixes) break;
            if (!affixPool.length) break;

            const chosen = pickAffixFromPool(affixPool, item.type, rarity, usedAffixIds);
            if (!chosen) break;

            const chosenId = chosen.id || chosen.name;
            usedAffixIds.add(chosenId);

            const mods = affixToModifiers(chosen);
            if (mods.length) item.modifiers.push(...mods);

            item.affixes.push({
                id: chosenId,
                name: chosen.name,
                modifiers: mods.map(m => ({
                    stat: m.stat,
                    value: m.value,
                    operation: m.operation,
                    name: m.name
                }))
            });

            // First two affixes can prefix the name (keeps names readable).
            if (affixesAdded < 2 && chosen.name) {
                item.name = `${chosen.name} ${item.name}`;
            }

            affixesAdded++;
        }

        // Apply rarity scaling AFTER base rolls and affix attachment.
        // Only scales additive modifiers and never scales non-scaling stats.
        LootSystem.applyRarityScaling(item);

        // --- Weapon Effects (weapons only, Rare+; higher rarity => higher chance + larger pool via minRarity gates)
        if (item.type === ItemType.WEAPON && rarityAtLeast(rarity, 'rare')) {
            const rid = rarityIdOf(rarity);
            const effectChance = (rid === 'rare') ? 0.25 : (rid === 'epic') ? 0.50 : 0.75;
            const effectPool = (typeof window !== 'undefined' && Array.isArray(window.WeaponEffectPool)) ? window.WeaponEffectPool : [];

            if (effectPool.length && Math.random() < effectChance) {
                const picked = pickWeightedEntryFromPool(effectPool, rarity);
                if (picked) {
                    item.specialEffect = {
                        id: picked.id || picked.name,
                        name: picked.name,
                        description: picked.description || '',
                        effects: picked.effects || null
                    };
                }
            }
        }

        // --- Accessory Enhancements (accessories only, guaranteed on Rare+; max 1 per item)
        if (item.type === ItemType.ACCESSORY && rarityAtLeast(rarity, 'rare')) {
            const enhPool = (typeof window !== 'undefined' && Array.isArray(window.EnhancementPool)) ? window.EnhancementPool : [];
            if (enhPool.length) {
                const picked = pickWeightedEntryFromPool(enhPool, rarity);
                if (picked) {
                    item.enhancement = {
                        id: picked.id || picked.name,
                        name: picked.name,
                        description: picked.description || '',
                        kind: picked.kind || null,
                        effects: picked.effects || null,
                        config: picked.config || null
                    };
                }
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
                item.isCursed = true;
                item.name = `${c.name} ${item.name}`;
                item.description = `${item.description} (Cursed)`;
            }
        }

        return item;
    }

    static generateRewardChoices(player, count = 3) {
        return Array.from({ length: count }, () => this.generateItem());
    }

    static addGeneratedModifier(item, entry, rarity) {
        const val = rollInRange(entry.range, !!entry.integer);
        const mod = baseMod(entry.stat, val, entry.op || 'add', undefined, 'base');
        if (entry.integer) mod.integer = true;
        item.modifiers.push(mod);
    }

    static applyRarityScaling(item) {
        const rarity = item?.rarity;
        const multiplier = Number(rarity?.multiplier) || 1;
        if (!item || !Array.isArray(item.modifiers) || multiplier === 1) return;

        const noScaleStats = new Set(['projectileCount', 'pierce', 'projSpeed', 'orbitalSpeed', 'cooldownMult']);

        for (const mod of item.modifiers) {
            if (!mod) continue;
            if (mod.source !== 'base' && mod.source !== 'affix') continue;
            if (mod.operation !== 'add') continue; // never scale percentage/multiply affixes
            if (!mod.stat || noScaleStats.has(mod.stat)) continue;

            const poolEntry = (typeof ItemUtils !== 'undefined') ? ItemUtils.getPoolEntryForItemStat(item, mod.stat) : null;
            if (poolEntry?.noRarityScale) continue;

            let value = Number(mod.value) || 0;
            if (mod.stat === 'cooldown') value = value / Math.max(0.01, multiplier);
            else value = value * multiplier;

            if (poolEntry?.integer || mod.integer) value = Math.round(value);
            mod.value = value;
        }
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
            specialEffect: null
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
