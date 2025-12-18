// Math utility functions

const MathUtils = {
    // Calculate distance between two points
    distance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    },

    // Check collision between two circular objects
    circleCollision(x1, y1, r1, x2, y2, r2) {
        return this.distance(x1, y1, x2, y2) < r1 + r2;
    },

    // Normalize a direction vector
    normalize(dx, dy) {
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return { x: 0, y: 0 };
        return { x: dx / len, y: dy / len };
    },

    // Clamp value between min and max
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    // Linear interpolation
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
};
