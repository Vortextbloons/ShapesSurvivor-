/**
 * Geometry and spatial calculation utilities.
 * Centralizes distance, collision, and vector operations.
 */
window.GeometryUtils = {
    /**
     * Calculate the distance between two points using Pythagorean theorem.
     * @param {number} x1 - First point x coordinate
     * @param {number} y1 - First point y coordinate
     * @param {number} x2 - Second point x coordinate
     * @param {number} y2 - Second point y coordinate
     * @returns {number} The distance between the two points
     */
    distanceBetween(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    },

    /**
     * Calculate the squared distance between two points.
     * More performant than distanceBetween when you only need to compare distances.
     * @param {number} x1 - First point x coordinate
     * @param {number} y1 - First point y coordinate
     * @param {number} x2 - Second point x coordinate
     * @param {number} y2 - Second point y coordinate
     * @returns {number} The squared distance between the two points
     */
    distanceSquared(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    },

    /**
     * Normalize a direction vector to unit length.
     * @param {number} dx - X component of the direction
     * @param {number} dy - Y component of the direction
     * @returns {{x: number, y: number}} Normalized direction vector
     */
    normalize(dx, dy) {
        const len = Math.hypot(dx, dy) || 1;
        return { x: dx / len, y: dy / len };
    },

    /**
     * Check if two circles are colliding.
     * @param {number} x1 - First circle x coordinate
     * @param {number} y1 - First circle y coordinate
     * @param {number} r1 - First circle radius
     * @param {number} x2 - Second circle x coordinate
     * @param {number} y2 - Second circle y coordinate
     * @param {number} r2 - Second circle radius
     * @returns {boolean} True if circles are colliding
     */
    circleCollision(x1, y1, r1, x2, y2, r2) {
        const combinedRadius = r1 + r2;
        return this.distanceSquared(x1, y1, x2, y2) < combinedRadius * combinedRadius;
    },

    /**
     * Calculate direction angle in radians from point 1 to point 2.
     * @param {number} x1 - Starting point x coordinate
     * @param {number} y1 - Starting point y coordinate
     * @param {number} x2 - Target point x coordinate
     * @param {number} y2 - Target point y coordinate
     * @returns {number} Angle in radians
     */
    angleBetween(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    /**
     * Check if a point is within a given range of another point.
     * @param {number} x1 - First point x coordinate
     * @param {number} y1 - First point y coordinate
     * @param {number} x2 - Second point x coordinate
     * @param {number} y2 - Second point y coordinate
     * @param {number} range - The range to check
     * @returns {boolean} True if points are within range
     */
    isInRange(x1, y1, x2, y2, range) {
        return this.distanceSquared(x1, y1, x2, y2) <= range * range;
    }
};
