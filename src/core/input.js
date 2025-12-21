// Input handling - moved to new location
const Input = {
    keys: {},
    _axis: { x: 0, y: 0 },
    init() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (!e.repeat && window.DevMode?.handleKeyDown) {
                window.DevMode.handleKeyDown(e);
            }

            // Avoid rapid toggling due to key repeat.
            if (e.code === 'KeyI' && !e.repeat) {
                if (typeof Game !== 'undefined' && (Game.state === 'playing' || Game.state === 'paused')) {
                    Game.toggleInventory();
                }
            }

            if (e.code === 'Enter' && !e.repeat) {
                if (typeof Game !== 'undefined' && Game.state === 'mainmenu') {
                    Game.startNewRun();
                } else if (typeof Game !== 'undefined' && Game.state === 'gameover') {
                    Game.startNewRun();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    },
    getAxis() {
        let dx = 0, dy = 0;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) dy -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) dy += 1;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;
        if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx*dx + dy*dy);
            dx /= len; dy /= len;
        }
        this._axis.x = dx;
        this._axis.y = dy;
        return this._axis;
    }
};
