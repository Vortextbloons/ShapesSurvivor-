// Input handling - moved to new location
const Input = {
    keys: {},
    _axis: { x: 0, y: 0 },
    _touchAxis: { x: 0, y: 0 },
    _touchActive: false,
    _joyPointerId: null,
    _joyCenter: null,
    _joyRadius: 34,
    _joyEl: null,
    _joyKnobEl: null,
    init() {
        // Mobile joystick (Pointer Events, works for touch + mouse)
        this._joyEl = document.getElementById('mobile-joystick');
        this._joyKnobEl = document.getElementById('mobile-joystick-knob');
        this._touchAxis = { x: 0, y: 0 };
        this._touchActive = false;
        this._joyPointerId = null;
        this._joyCenter = null;

        const setKnob = (dx, dy) => {
            const r = this._joyRadius || 34;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0;
            let ndx = dx;
            let ndy = dy;
            if (dist > r) {
                const s = r / dist;
                ndx *= s;
                ndy *= s;
            }
            this._touchAxis.x = (r > 0) ? (ndx / r) : 0;
            this._touchAxis.y = (r > 0) ? (ndy / r) : 0;

            if (this._joyKnobEl) {
                this._joyKnobEl.style.transform = `translate(${ndx}px, ${ndy}px)`;
            }
        };

        const resetJoy = () => {
            this._touchActive = false;
            this._joyPointerId = null;
            this._joyCenter = null;
            this._touchAxis.x = 0;
            this._touchAxis.y = 0;
            if (this._joyKnobEl) {
                this._joyKnobEl.style.transform = 'translate(0px, 0px)';
            }
        };

        if (this._joyEl) {
            this._joyEl.addEventListener('pointerdown', (e) => {
                // Only left-side movement control.
                e.preventDefault();
                try { this._joyEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                this._joyPointerId = e.pointerId;
                this._touchActive = true;
                const rect = this._joyEl.getBoundingClientRect();
                this._joyCenter = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };
                setKnob(e.clientX - this._joyCenter.x, e.clientY - this._joyCenter.y);
            }, { passive: false });

            this._joyEl.addEventListener('pointermove', (e) => {
                if (!this._touchActive) return;
                if (this._joyPointerId !== null && e.pointerId !== this._joyPointerId) return;
                if (!this._joyCenter) return;
                e.preventDefault();
                setKnob(e.clientX - this._joyCenter.x, e.clientY - this._joyCenter.y);
            }, { passive: false });

            const onUp = (e) => {
                if (this._joyPointerId !== null && e.pointerId !== this._joyPointerId) return;
                e.preventDefault();
                try { this._joyEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
                resetJoy();
            };

            this._joyEl.addEventListener('pointerup', onUp, { passive: false });
            this._joyEl.addEventListener('pointercancel', onUp, { passive: false });
            this._joyEl.addEventListener('lostpointercapture', () => resetJoy());
        }

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
        // Prefer joystick movement if active.
        const tx = Number(this._touchAxis?.x) || 0;
        const ty = Number(this._touchAxis?.y) || 0;
        if (this._touchActive || Math.abs(tx) > 0.01 || Math.abs(ty) > 0.01) {
            this._axis.x = tx;
            this._axis.y = ty;
            return this._axis;
        }

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
