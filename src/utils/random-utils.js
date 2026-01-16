const RandomUtils = {
    rollRange(range, integer = false) {
        if (!range) return 0;
        let val;
        if (typeof range === 'number') {
            val = range;
        } else if (Array.isArray(range)) {
            if (range.length >= 2) {
                val = range[0] + Math.random() * (range[1] - range[0]);
            } else if (range.length === 1) {
                val = range[0];
            } else {
                val = 0;
            }
        } else {
            val = 0;
        }
        return integer ? Math.round(val) : val;
    },

    pickRandom(array) {
        return array?.length ? array[Math.floor(Math.random() * array.length)] : null;
    },

    weightedRandom(items) {
        if (!items?.length) return null;
        const totalWeight = items.reduce((sum, [_, w]) => sum + w, 0);
        let roll = Math.random() * totalWeight;
        for (const [value, weight] of items) {
            if ((roll -= weight) <= 0) return value;
        }
        return items[items.length - 1][0];
    },

    weightedPick(arr, weightFn) {
        if (!arr?.length) return null;
        let total = 0;
        const weights = arr.map(a => {
            const w = Math.max(0.001, Number(weightFn?.(a)) || 1);
            total += w;
            return w;
        });
        let r = Math.random() * total;
        for (let i = 0; i < arr.length; i++) {
            if ((r -= weights[i]) <= 0) return arr[i];
        }
        return arr[arr.length - 1];
    },

    randomInt(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    }
};



