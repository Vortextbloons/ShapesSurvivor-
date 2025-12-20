// Item utility and analysis functions

class ItemUtils {
    static getSlotForType(type, player) {
        if (!player) return null;
        if (type === ItemType.WEAPON) return 'weapon';
        if (type === ItemType.ARMOR) return 'armor';
        if (type === ItemType.ACCESSORY) {
            return player.equipment.accessory1 ? 'accessory1' : (player.equipment.accessory2 ? 'accessory2' : 'accessory1');
        }
        return null;
    }

    static getPoolEntryForItemStat(item, stat) {
        if (!item) return null;
        if (item.type === ItemType.WEAPON) {
            const mode = item.behavior === BehaviorType.AURA ? 'aura' : (item.behavior === BehaviorType.ORBITAL ? 'orbital' : 'projectile');
            const archetype = item.archetypeId ? WeaponArchetypes[item.archetypeId] : null;
            const pool = archetype?.[mode]?.pool || [];
            return pool.find(p => p.stat === stat) || null;
        }
        if (item.type === ItemType.ARMOR && item.archetypeId && typeof ArmorArchetypes !== 'undefined') {
            const archetype = ArmorArchetypes[item.archetypeId];
            const pool = archetype?.pool || [];
            return pool.find(p => p.stat === stat) || null;
        }
        if (item.type === ItemType.ACCESSORY && item.archetypeId && typeof AccessoryArchetypes !== 'undefined') {
            const archetype = AccessoryArchetypes[item.archetypeId];
            const pool = archetype?.pool || [];
            return pool.find(p => p.stat === stat) || null;
        }
        if (item.type === ItemType.ARTIFACT && item.archetypeId && typeof ArtifactArchetypes !== 'undefined') {
            const archetype = ArtifactArchetypes[item.archetypeId];
            const pool = archetype?.pool || [];
            return pool.find(p => p.stat === stat) || null;
        }
        return null;
    }

    static isLowerBetter(stat) {
        return stat === 'cooldown' || stat === 'cooldownMult' || stat === 'damageTakenMult';
    }
}

class ItemComparator {
    static getItemStatTotals(item) {
        const totals = {};
        (item?.modifiers || []).forEach(m => {
            totals[m.stat] = (totals[m.stat] || 0) + (m.value || 0);
        });
        return totals;
    }

    static diff(newItem, equippedItem) {
        if (!equippedItem) return null;
        const a = this.getItemStatTotals(newItem);
        const b = this.getItemStatTotals(equippedItem);
        const out = {};
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        keys.forEach(k => out[k] = (a[k] || 0) - (b[k] || 0));
        return out;
    }
}

class ItemUpgrader {
    static upgradeOneStat(item, upgradeRarity) {
        if (!item || !item.modifiers?.length) return null;

        const candidates = item.modifiers
            .map((m, i) => ({ m, i }))
            .filter(({ m }) => m && m.operation !== 'multiply' ? true : true)
            .filter(({ m }) => m.source !== 'special');

        if (!candidates.length) return null;

        const baseCandidates = candidates.filter(({ m }) => m.source === 'base');
        const pickFrom = baseCandidates.length ? baseCandidates : candidates;
        const chosen = randomFrom(pickFrom);

        const entry = ItemUtils.getPoolEntryForItemStat(item, chosen.m.stat);
        if (!entry) return null;

        let rolled = rollInRange(entry.range, !!entry.integer);
        const rarityToUse = upgradeRarity || item.rarity;
        if (shouldScaleWithRarity(entry)) rolled = rolled * (rarityToUse?.multiplier || 1);

        const current = chosen.m.value;
        const lowerBetter = ItemUtils.isLowerBetter(chosen.m.stat);

        let upgraded = lowerBetter ? Math.min(current, rolled) : Math.max(current, rolled);

        if (upgraded === current) {
            const span = (entry.range[1] - entry.range[0]);
            const bump = Math.max(0.01, span * 0.08);
            upgraded = lowerBetter ? (current - bump) : (current + bump);
            if (entry.integer) upgraded = Math.round(upgraded);
        }

        if (chosen.m.stat === 'cooldown') upgraded = Math.max(5, Math.round(upgraded));

        chosen.m.value = upgraded;
        return { stat: chosen.m.stat, newValue: upgraded };
    }
}
