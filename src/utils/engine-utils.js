/**
 * Spatial grid for fast proximity lookups.
 */
class SpatialGrid {
    constructor(cellSize = 120) {
        this.cellSize = cellSize;
        this.cells = new Map();
        this.usedKeys = [];
    }

    _cellKey(cx, cy) {
        return ((cx & 0xffff) << 16) ^ (cy & 0xffff);
    }

    clear() {
        for (let i = 0; i < this.usedKeys.length; i++) {
            const bucket = this.cells.get(this.usedKeys[i]);
            if (bucket) bucket.length = 0;
        }
        this.usedKeys.length = 0;
    }

    build(entities) {
        this.clear();
        const cs = this.cellSize;
        for (let i = 0, n = entities.length; i < n; i++) {
            const e = entities[i];
            if (!e || e.dead) continue;
            const cx = (e.x / cs) | 0;
            const cy = (e.y / cs) | 0;
            const key = this._cellKey(cx, cy);
            let bucket = this.cells.get(key);
            if (!bucket) {
                bucket = [];
                this.cells.set(key, bucket);
            }
            if (bucket.length === 0) {
                this.usedKeys.push(key);
            }
            bucket.push(e);
        }
    }

    forEachNear(x, y, r, fn) {
        const cs = this.cellSize;
        const minCx = ((x - r) / cs) | 0;
        const maxCx = ((x + r) / cs) | 0;
        const minCy = ((y - r) / cs) | 0;
        const maxCy = ((y + r) / cs) | 0;

        for (let cy = minCy; cy <= maxCy; cy++) {
            for (let cx = minCx; cx <= maxCx; cx++) {
                const bucket = this.cells.get(this._cellKey(cx, cy));
                if (!bucket || bucket.length === 0) continue;
                for (let i = 0; i < bucket.length; i++) {
                    if (fn(bucket[i]) === false) return false;
                }
            }
        }
        return true;
    }
}

/**
 * Performance monitoring and overlay management.
 */
class PerformanceMonitor {
    constructor(overlayId = 'dev-perf-overlay') {
        this.overlayId = overlayId;
        this.overlayEl = null;
        this.metrics = {
            fps: 0, frameMs: 0, backdropMs: 0, playerMs: 0,
            spawnMs: 0, updateMs: 0, compactMs: 0, drawMs: 0, uiMs: 0,
            nextOverlayUpdateAt: 0
        };
    }

    record(metric, start) {
        const duration = performance.now() - start;
        this.metrics[metric] = this.metrics[metric] * 0.9 + duration * 0.1;
        return performance.now();
    }

    update(dt, counts) {
        const perfOn = !!(window.DevMode?.enabled && window.DevMode?.cheats?.perfHud);
        if (!perfOn) {
            if (this.overlayEl) this.overlayEl.textContent = '';
            return;
        }

        if (!this.overlayEl) this.overlayEl = document.getElementById(this.overlayId);
        if (!this.overlayEl) return;

        const frameMs = Math.max(0.0001, dt || 0.0001);
        this.metrics.fps = this.metrics.fps * 0.9 + (1000 / frameMs) * 0.1;
        this.metrics.frameMs = this.metrics.frameMs * 0.9 + frameMs * 0.1;

        const now = performance.now();
        if (now >= (this.metrics.nextOverlayUpdateAt || 0)) {
            this.metrics.nextOverlayUpdateAt = now + 250;
            const m = this.metrics;
            const fmt = (v) => (Number(v) || 0).toFixed(2);
            
            this.overlayEl.textContent =
                `FPS ${Math.round(m.fps)}  (${fmt(m.frameMs)}ms)\n` +
                `Back ${fmt(m.backdropMs)}  Ply ${fmt(m.playerMs)}  Spw ${fmt(m.spawnMs)}\n` +
                `Upd ${fmt(m.updateMs)}  Cmp ${fmt(m.compactMs)}  Drw ${fmt(m.drawMs)}  UI ${fmt(m.uiMs)}\n` +
                `E ${counts.e}  P ${counts.pr}  Pick ${counts.pk}  Fx ${counts.fx}  Part ${counts.pt}  Txt ${counts.tx}`;
        }
    }
}

window.SpatialGrid = SpatialGrid;
window.PerformanceMonitor = PerformanceMonitor;
