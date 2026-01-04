// Item name generation by type

const NameGenerator = {
    adjectives: {
        [ItemType.WEAPON]: ['Crimson', 'Glacial', 'Spectral', 'Vicious', 'Arcane', 'Jagged', 'Searing', 'Thunderous','Vorpal'],
        [ItemType.ARMOR]: ['Fortified', 'Gilded', 'Stalwart', 'Ironbound', 'Blessed', 'Hardened', 'Umbral', 'Radiant'],
        [ItemType.ACCESSORY]: ['Swift', 'Keen', 'Lucky', 'Savage', 'Silent', 'Eternal', 'Feral', 'Celestial', 'Mystic', 'Vigilant', 'Nimble'],
        [ItemType.ARTIFACT]: ['Ancient', 'Forgotten', 'Enchanted', 'Hollow', 'Astral', 'Runed', 'Whispering']
    },
    nouns: {
        [ItemType.WEAPON]: ['Wand', 'Hatchet', 'Axe', 'Scepter', 'Dagger', 'Talisman', 'Relic', 'Blade', 'Mace', 'Staff', 'Flail'],
        [ItemType.ARMOR]: ['Plate', 'Hauberk', 'Carapace', 'Vest', 'Mail', 'Aegis', 'Cuirass', 'Brigandine'],
        [ItemType.ACCESSORY]: ['Boots', 'Ring', 'Charm', 'Amulet', 'Band', 'Pendant', 'Brooch', 'Cloak'],
        [ItemType.ARTIFACT]: ['Tome', 'Idol', 'Sigil', 'Censer', 'Stone', 'Coin', 'Mask', 'Relic', 'Figurine']
    },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    generate(type, archetypeNoun = null) {
        const adj = this.pick(this.adjectives[type] || ['Odd']);
        const noun = archetypeNoun || this.pick(this.nouns[type] || ['Thing']);
        return `${adj} ${noun}`;
    }
};
