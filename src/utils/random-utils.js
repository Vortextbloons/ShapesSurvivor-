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

/**
 * Math and number validation utilities.
 * Centralizes number conversion, clamping, and validation operations.
 */
const MathUtils = {
    /**
     * Convert a value to a number with a fallback default.
     * @param {*} value - Value to convert
     * @param {number} defaultValue - Default if conversion fails
     * @returns {number} The converted number or default
     */
    toNumber(value, defaultValue = 0) {
        const num = Number(value);
        return Number.isFinite(num) ? num : defaultValue;
    },

    /**
     * Clamp a value between min and max.
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Clamp a value between 0 and 1.
     * @param {number} value - Value to clamp
     * @returns {number} Clamped value
     */
    clamp01(value) {
        return Math.max(0, Math.min(1, value));
    },

    /**
     * Convert a value to an integer with a fallback default.
     * @param {*} value - Value to convert
     * @param {number} defaultValue - Default if conversion fails
     * @returns {number} The converted integer or default
     */
    toInt(value, defaultValue = 0) {
        const num = Math.floor(Number(value));
        return Number.isFinite(num) ? num : defaultValue;
    },

    /**
     * Ensure a value is an array.
     * @param {*} value - Value to convert
     * @returns {Array} Array version of the value
     */
    ensureArray(value) {
        return Array.isArray(value) ? value : (value ? [value] : []);
    }
};

