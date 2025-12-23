// Random generation utility functions

const RandomUtils = {
    // Roll a random value in range [min, max)
    rollRange([min, max], integer = false) {
        const val = min + Math.random() * (max - min);
        return integer ? Math.round(val) : val;
    },

    // Pick random element from array
    pickRandom(array) {
        if (!array || !array.length) return null;
        return array[Math.floor(Math.random() * array.length)];
    },

    // Weighted random selection: array of [value, weight] pairs
    weightedRandom(items) {
        if (!items || !items.length) return null;
        const totalWeight = items.reduce((sum, [_, w]) => sum + w, 0);
        let roll = Math.random() * totalWeight;
        for (const [value, weight] of items) {
            roll -= weight;
            if (roll <= 0) return value;
        }
        return items[items.length - 1][0];
    },

    // Weighted random selection from array using a weight function
    weightedPick(arr, weightFn) {
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
    },

    // Random integer in range [min, max]
    randomInt(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    }
};
