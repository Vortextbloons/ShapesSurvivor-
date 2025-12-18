// Random generation utility functions

const RandomUtils = {
    // Roll a random value in range [min, max)
    rollRange([min, max]) {
        return min + Math.random() * (max - min);
    },

    // Pick random element from array
    pickRandom(array) {
        return array[Math.floor(Math.random() * array.length)];
    },

    // Weighted random selection: array of [value, weight] pairs
    weightedRandom(items) {
        const totalWeight = items.reduce((sum, [_, w]) => sum + w, 0);
        let roll = Math.random() * totalWeight;
        for (const [value, weight] of items) {
            roll -= weight;
            if (roll <= 0) return value;
        }
        return items[items.length - 1][0];
    },

    // Random integer in range [min, max]
    randomInt(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    }
};
