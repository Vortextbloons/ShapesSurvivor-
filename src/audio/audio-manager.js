// AudioManager: procedural WebAudio SFX + adaptive generative music.
// No external assets — all sounds synthesized. Defensive: never throws if
// AudioContext is unavailable; all public methods no-op safely.
(function () {
    'use strict';

    const STORE = {
        master: 'ss_audio_master',
        music: 'ss_audio_music',
        sfx: 'ss_audio_sfx',
        muted: 'ss_audio_muted'
    };

    const DEFAULTS = { master: 0.7, music: 0.55, sfx: 0.8, muted: false };

    // Min interval (ms) per high-frequency SFX to avoid overload.
    const THROTTLE = {
        shoot: 60,
        enemyHit: 45,
        enemyDie: 70,
        xp: 90,
        explosion: 120,
        crit: 90,
        playerHurt: 350,
        hit: 45,
        uiClick: 50
    };

    function clamp01(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(1, n));
    }

    function midiToFreq(m) {
        return 440 * Math.pow(2, (m - 69) / 12);
    }

    class AudioManager {
        constructor() {
            this.ctx = null;
            this.masterGain = null;
            this.musicGain = null;
            this.sfxGain = null;
            this.delaySend = null;
            this.noiseBuffer = null;
            this.unlocked = false;
            this._lastPlay = Object.create(null);
            this.settings = { ...DEFAULTS };
            this._loadSettings();

            // Music sequencer state
            this._music = { mode: null, step: 0, nextTime: 0, timer: null, bar: 0 };
            this._wantsMusic = null; // requested mode before unlock
        }

        // ---------- persistence ----------
        _loadSettings() {
            try {
                const m = Number(localStorage.getItem(STORE.master));
                const mu = Number(localStorage.getItem(STORE.music));
                const s = Number(localStorage.getItem(STORE.sfx));
                const muted = localStorage.getItem(STORE.muted);
                if (Number.isFinite(m)) this.settings.master = clamp01(m);
                if (Number.isFinite(mu)) this.settings.music = clamp01(mu);
                if (Number.isFinite(s)) this.settings.sfx = clamp01(s);
                this.settings.muted = muted === 'true';
            } catch { /* ignore */ }
        }

        _persist() {
            try {
                localStorage.setItem(STORE.master, String(this.settings.master));
                localStorage.setItem(STORE.music, String(this.settings.music));
                localStorage.setItem(STORE.sfx, String(this.settings.sfx));
                localStorage.setItem(STORE.muted, String(!!this.settings.muted));
            } catch { /* ignore */ }
        }

        getSettings() {
            return { ...this.settings };
        }

        // ---------- lifecycle ----------
        init() {
            this._bindUnlockGestures();
            this._bindGlobalClickSounds();
            // If context already allowed (rare), unlock now.
            return this;
        }

        _bindUnlockGestures() {
            if (this._gesturesBound) return;
            this._gesturesBound = true;
            const unlock = () => this.unlock();
            window.addEventListener('pointerdown', unlock, { passive: true });
            window.addEventListener('keydown', unlock);
            window.addEventListener('touchstart', unlock, { passive: true });
            document.addEventListener('visibilitychange', () => {
                if (!this.ctx) return;
                try {
                    if (document.hidden) this.ctx.suspend();
                    else if (!this.settings.muted) this.ctx.resume();
                } catch { /* ignore */ }
            });
        }

        _bindGlobalClickSounds() {
            if (this._clickBound) return;
            this._clickBound = true;
            // UI click blips for all buttons (delegated, low volume, no per-button wiring).
            document.addEventListener('pointerdown', (e) => {
                const t = e.target && e.target.closest
                    ? e.target.closest('button, select, .character-card, .item-card')
                    : null;
                if (t) this.uiClick();
            }, { passive: true });
        }

        unlock() {
            if (this.unlocked && this.ctx) {
                try {
                    if (this.ctx.state === 'suspended' && !this.settings.muted) this.ctx.resume();
                } catch { /* ignore */ }
                this._flushWantedMusic();
                return true;
            }
            try {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return false;
                if (!this.ctx) {
                    this.ctx = new AC();
                    this.masterGain = this.ctx.createGain();
                    this.musicGain = this.ctx.createGain();
                    this.sfxGain = this.ctx.createGain();
                    // Music bus gets a gentle lowpass-safe delay for space.
                    this.delaySend = this.ctx.createDelay(1.0);
                    this.delaySend.delayTime.value = 0.28;
                    const fb = this.ctx.createGain();
                    fb.gain.value = 0.28;
                    const wet = this.ctx.createGain();
                    wet.gain.value = 0.22;
                    this.delaySend.connect(fb);
                    fb.connect(this.delaySend);
                    this.delaySend.connect(wet);
                    wet.connect(this.musicGain);
                    this.musicGain.connect(this.masterGain);
                    this.sfxGain.connect(this.masterGain);
                    this.masterGain.connect(this.ctx.destination);
                    this._buildNoiseBuffer();
                    this._applyGains();
                }
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }
                this.unlocked = true;
                this._flushWantedMusic();
                return true;
            } catch {
                return false;
            }
        }

        ensure() {
            if (!this.ctx) return this.unlock();
            if (this.ctx.state === 'suspended' && !this.settings.muted) {
                try { this.ctx.resume(); } catch { /* ignore */ }
            }
            return !!this.ctx;
        }

        _buildNoiseBuffer() {
            try {
                const len = Math.floor(this.ctx.sampleRate * 1.0);
                this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
                const d = this.noiseBuffer.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            } catch { this.noiseBuffer = null; }
        }

        _applyGains() {
            if (!this.ctx) return;
            const t = this.ctx.currentTime;
            const muted = !!this.settings.muted;
            try {
                this.masterGain.gain.setTargetAtTime(muted ? 0 : this.settings.master, t, 0.02);
                this.musicGain.gain.setTargetAtTime(this.settings.music, t, 0.05);
                this.sfxGain.gain.setTargetAtTime(this.settings.sfx, t, 0.02);
            } catch { /* ignore */ }
        }

        setMasterVolume(v) {
            this.settings.master = clamp01(v);
            this._persist();
            this._applyGains();
        }

        setMusicVolume(v) {
            this.settings.music = clamp01(v);
            this._persist();
            this._applyGains();
        }

        setSfxVolume(v) {
            this.settings.sfx = clamp01(v);
            this._persist();
            this._applyGains();
        }

        setMuted(m) {
            this.settings.muted = !!m;
            this._persist();
            if (!this.ctx) return;
            try {
                if (this.settings.muted) this.ctx.suspend();
                else this.ctx.resume();
            } catch { /* ignore */ }
            this._applyGains();
            this._updateMuteButtons();
        }

        toggleMute() {
            this.setMuted(!this.settings.muted);
            return this.settings.muted;
        }

        isMuted() {
            return !!this.settings.muted;
        }

        _updateMuteButtons() {
            const muted = !!this.settings.muted;
            document.querySelectorAll('[data-audio-mute-label]').forEach((el) => {
                el.textContent = muted ? '🔇' : '🔊';
            });
            const btn = document.getElementById('audio-mute-btn');
            if (btn) {
                btn.setAttribute('aria-pressed', String(muted));
                btn.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
                const icon = btn.querySelector('[data-audio-mute-label]');
                if (icon) icon.textContent = muted ? '🔇' : '🔊';
                btn.classList.toggle('muted', muted);
            }
        }

        // ---------- throttling + distance ----------
        _throttled(name) {
            const min = THROTTLE[name];
            if (!min) return false;
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            const last = this._lastPlay[name] || 0;
            if (now - last < min) return true;
            this._lastPlay[name] = now;
            return false;
        }

        _distanceGain(opts) {
            if (!opts || !Number.isFinite(opts.x) || !Number.isFinite(opts.y)) return 1;
            try {
                const p = window.Game && window.Game.player;
                if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return 1;
                const d = Math.hypot(opts.x - p.x, opts.y - p.y);
                if (d < 350) return 1;
                if (d > 1100) return 0.15;
                return 1 - ((d - 350) / 750) * 0.85;
            } catch { return 1; }
        }

        // ---------- primitives ----------
        _tone({ type = 'sine', from = 440, to = null, dur = 0.15, vol = 0.2, at = 0, bus = null, curve = 'exp' }) {
            if (!this.ensure()) return;
            try {
                const t0 = this.ctx.currentTime + Math.max(0, at);
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(Math.max(20, from), t0);
                if (to && to !== from) {
                    if (curve === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(20, to), t0 + dur);
                    else osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
                }
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
                osc.connect(g);
                g.connect(bus || this.sfxGain);
                // Small echo send for music bus tones.
                if (bus === this.musicGain && this.delaySend) {
                    const send = this.ctx.createGain();
                    send.gain.value = 0.35;
                    g.connect(send);
                    send.connect(this.delaySend);
                }
                osc.start(t0);
                osc.stop(t0 + dur + 0.05);
            } catch { /* ignore */ }
        }

        _noise({ dur = 0.2, vol = 0.2, at = 0, filterType = 'lowpass', from = 1200, to = null, q = 0.8, bus = null }) {
            if (!this.ensure() || !this.noiseBuffer) return;
            try {
                const t0 = this.ctx.currentTime + Math.max(0, at);
                const src = this.ctx.createBufferSource();
                src.buffer = this.noiseBuffer;
                src.loop = true;
                const f = this.ctx.createBiquadFilter();
                f.type = filterType;
                f.frequency.setValueAtTime(Math.max(40, from), t0);
                if (to && to !== from) f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
                f.Q.value = q;
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.01);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
                src.connect(f);
                f.connect(g);
                g.connect(bus || this.sfxGain);
                src.start(t0);
                src.stop(t0 + dur + 0.05);
            } catch { /* ignore */ }
        }

        // ---------- SFX dispatch ----------
        play(name, opts = {}) {
            if (this.settings.muted) return;
            switch (name) {
                case 'shoot': return this.shoot(opts.behavior, opts);
                case 'enemyHit': return this.enemyHit(opts);
                case 'enemyDie': return this.enemyDie(opts.kind, opts);
                case 'playerHurt': return this.playerHurt(opts);
                case 'xp': return this.xp(opts);
                case 'levelUp': return this.levelUp();
                case 'itemPickup': return this.itemPickup(opts.rarity, opts);
                case 'uiClick': return this.uiClick();
                case 'uiHover': return this.uiHover();
                case 'bossWarn': return this.bossWarn();
                case 'bossDie': return this.bossDie();
                case 'chestOpen': return this.chestOpen();
                case 'gameStart': return this.gameStart();
                case 'gameOver': return this.gameOver();
                case 'explosion': return this.explosion(opts);
                case 'crit': return this.crit(opts);
                case 'heal': return this.heal(opts);
                case 'revive': return this.revive();
                case 'essence': return this.essence();
                case 'select': return this.select();
                default: return;
            }
        }

        shoot(behavior, opts = {}) {
            if (this._throttled('shoot')) return;
            const d = this._distanceGain(opts);
            if (d <= 0.01) return;
            const v = 0.10 * d;
            const jitter = () => (Math.random() - 0.5) * 60;
            switch (String(behavior || '').toLowerCase()) {
                case 'orbital':
                    this._tone({ type: 'triangle', from: 300 + jitter(), to: 180, dur: 0.09, vol: v });
                    break;
                case 'beam':
                    this._tone({ type: 'sawtooth', from: 180 + jitter() * 0.4, to: 240, dur: 0.07, vol: v * 0.7 });
                    break;
                case 'wave':
                    this._tone({ type: 'square', from: 420 + jitter(), to: 160, dur: 0.11, vol: v * 0.9 });
                    break;
                case 'aura':
                    this._tone({ type: 'sine', from: 240, to: 320, dur: 0.12, vol: v * 0.6 });
                    break;
                default:
                    this._tone({ type: 'square', from: 640 + jitter(), to: 220, dur: 0.07, vol: v });
                    break;
            }
        }

        enemyHit(opts = {}) {
            if (this._throttled(opts.crit ? 'crit' : 'enemyHit')) return;
            const d = this._distanceGain(opts);
            if (d <= 0.01) return;
            if (opts.crit) return this.crit(opts);
            const v = 0.12 * d;
            this._noise({ dur: 0.05, vol: v * 0.7, filterType: 'bandpass', from: 1100, q: 1.2 });
            this._tone({ type: 'triangle', from: 320 + Math.random() * 80, to: 150, dur: 0.06, vol: v });
        }

        crit(opts = {}) {
            if (this._throttled('crit')) return;
            const d = this._distanceGain(opts);
            if (d <= 0.01) return;
            const v = 0.16 * d;
            this._tone({ type: 'square', from: 1500, to: 750, dur: 0.08, vol: v });
            this._noise({ dur: 0.06, vol: v * 0.5, filterType: 'highpass', from: 2800 });
        }

        enemyDie(kind, opts = {}) {
            if (this._throttled('enemyDie')) return;
            const d = this._distanceGain(opts);
            if (d <= 0.01) return;
            const k = String(kind || 'enemy').toLowerCase();
            if (k === 'boss') return this.bossDie();
            if (k === 'elite') {
                this._tone({ type: 'square', from: 320, to: 55, dur: 0.28, vol: 0.22 * d });
                this._noise({ dur: 0.25, vol: 0.18 * d, filterType: 'lowpass', from: 1400, to: 180 });
                this._tone({ type: 'sine', from: 220, to: 440, dur: 0.12, vol: 0.10 * d, at: 0.05 });
                return;
            }
            const v = 0.15 * d;
            this._tone({ type: 'square', from: 300 + Math.random() * 120, to: 60, dur: 0.14, vol: v });
            this._noise({ dur: 0.12, vol: v * 0.8, filterType: 'lowpass', from: 1100, to: 220 });
        }

        explosion(opts = {}) {
            if (this._throttled('explosion')) return;
            const d = this._distanceGain(opts);
            if (d <= 0.01) return;
            const v = (opts.big ? 0.4 : 0.28) * d;
            this._noise({ dur: opts.big ? 0.6 : 0.4, vol: v, filterType: 'lowpass', from: 900, to: 90 });
            this._tone({ type: 'sine', from: 110, to: 30, dur: opts.big ? 0.55 : 0.35, vol: v });
        }

        playerHurt(opts = {}) {
            if (this._throttled('playerHurt')) return;
            this._tone({ type: 'sawtooth', from: 210, to: 70, dur: 0.22, vol: 0.28 });
            this._noise({ dur: 0.15, vol: 0.14, filterType: 'lowpass', from: 800, to: 200 });
        }

        heal(opts = {}) {
            if (this._throttled('xp')) return;
            this._tone({ type: 'sine', from: 480, to: 760, dur: 0.14, vol: 0.10 });
        }

        xp(opts = {}) {
            if (this._throttled('xp')) return;
            const d = this._distanceGain(opts);
            this._tone({ type: 'sine', from: 950 + Math.random() * 250, to: 1500, dur: 0.045, vol: 0.05 * d });
        }

        levelUp() {
            const notes = [523.25, 659.25, 783.99, 1046.5];
            notes.forEach((f, i) => {
                this._tone({ type: 'triangle', from: f, to: f, dur: 0.14, vol: 0.20, at: i * 0.09 });
            });
            this._noise({ dur: 0.3, vol: 0.06, at: 0.1, filterType: 'highpass', from: 4000 });
        }

        itemPickup(rarity, opts = {}) {
            const r = String(rarity || 'common').toLowerCase();
            const base = { common: 420, uncommon: 520, rare: 620, epic: 760, legendary: 880, character: 990 }[r] || 440;
            this._tone({ type: 'triangle', from: base, to: base * 1.5, dur: 0.12, vol: 0.18 });
            if (r === 'epic' || r === 'legendary' || r === 'character') {
                this._tone({ type: 'triangle', from: base * 1.5, to: base * 2, dur: 0.16, vol: 0.16, at: 0.09 });
                this._noise({ dur: 0.25, vol: 0.06, at: 0.05, filterType: 'highpass', from: 5000 });
            }
        }

        uiClick() {
            if (!this.ctx || this.settings.muted) return;
            if (this._throttled('uiClick')) return;
            // Ultra-quiet blip; skip full ensure() cost when tab hidden.
            this._tone({ type: 'square', from: 760, to: 660, dur: 0.035, vol: 0.05 });
        }

        uiHover() {
            if (this._throttled('uiClick')) return;
            this._tone({ type: 'sine', from: 1200, to: 1200, dur: 0.02, vol: 0.02 });
        }

        select() {
            this._tone({ type: 'triangle', from: 520, to: 780, dur: 0.09, vol: 0.14 });
        }

        essence() {
            this._tone({ type: 'sine', from: 700, to: 1400, dur: 0.09, vol: 0.14 });
            this._tone({ type: 'sine', from: 1050, to: 1750, dur: 0.10, vol: 0.10, at: 0.06 });
        }

        revive() {
            [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
                this._tone({ type: 'sawtooth', from: f, to: f, dur: 0.35, vol: 0.10, at: i * 0.07 });
            });
            this._noise({ dur: 0.6, vol: 0.10, filterType: 'highpass', from: 2000 });
        }

        bossWarn() {
            for (let i = 0; i < 2; i++) {
                this._tone({ type: 'sawtooth', from: 110, to: 82, dur: 0.42, vol: 0.30, at: i * 0.5 });
                this._tone({ type: 'square', from: 55, to: 55, dur: 0.42, vol: 0.18, at: i * 0.5 });
            }
            this._noise({ dur: 0.9, vol: 0.10, filterType: 'lowpass', from: 500, to: 120 });
        }

        bossDie() {
            this.explosion({ big: true });
            [220, 277, 330, 440].forEach((f, i) => {
                this._tone({ type: 'triangle', from: f, to: f * 2, dur: 0.25, vol: 0.14, at: 0.15 + i * 0.08 });
            });
        }

        chestOpen() {
            this._tone({ type: 'sine', from: 520, to: 1040, dur: 0.12, vol: 0.18 });
            this._tone({ type: 'sine', from: 780, to: 1560, dur: 0.14, vol: 0.15, at: 0.08 });
            this._tone({ type: 'triangle', from: 1040, to: 2080, dur: 0.2, vol: 0.12, at: 0.16 });
        }

        gameStart() {
            this._tone({ type: 'sawtooth', from: 180, to: 720, dur: 0.4, vol: 0.16 });
            this._tone({ type: 'triangle', from: 360, to: 1440, dur: 0.4, vol: 0.10, at: 0.05 });
        }

        gameOver() {
            this._tone({ type: 'sawtooth', from: 380, to: 90, dur: 0.9, vol: 0.22 });
            this._tone({ type: 'triangle', from: 190, to: 60, dur: 1.0, vol: 0.16, at: 0.05 });
            this._noise({ dur: 0.8, vol: 0.08, filterType: 'lowpass', from: 700, to: 100 });
        }

        // ---------- adaptive music ----------
        _flushWantedMusic() {
            if (this._wantsMusic && this.unlocked) {
                const m = this._wantsMusic;
                this._wantsMusic = null;
                this.startMusic(m);
            }
        }

        getMusicMode() {
            return this._music.mode;
        }

        setMusicMode(mode) {
            if (mode === this._music.mode) return;
            this.startMusic(mode);
        }

        startMusic(mode) {
            const m = String(mode || 'menu').toLowerCase();
            if (!['menu', 'playing', 'boss', 'gameover', 'off'].includes(m)) return;
            if (!this.unlocked || !this.ensure()) {
                // Defer until first gesture unlocks audio.
                this._wantsMusic = m === 'off' ? null : m;
                return;
            }
            this._stopSequencer();
            this._music.mode = m;
            if (m === 'off') return;
            this._music.step = 0;
            this._music.bar = 0;
            this._music.nextTime = this.ctx.currentTime + 0.1;
            const interval = 80;
            this._music.timer = setInterval(() => this._schedule(), interval);
            this._schedule();
        }

        stopMusic() {
            this._wantsMusic = null;
            this._stopSequencer();
            this._music.mode = null;
        }

        _stopSequencer() {
            if (this._music.timer) {
                clearInterval(this._music.timer);
                this._music.timer = null;
            }
        }

        _bpm() {
            switch (this._music.mode) {
                case 'playing': return 112;
                case 'boss': return 142;
                case 'gameover': return 62;
                case 'menu': return 72;
                default: return 90;
            }
        }

        _schedule() {
            if (!this.ctx || !this._music.mode || this._music.mode === 'off') return;
            if (this.settings.muted) {
                // Keep step position advancing cheaply without emitting.
                this._music.nextTime = Math.max(this._music.nextTime, this.ctx.currentTime + 0.1);
                return;
            }
            const bpm = this._bpm();
            const stepDur = 60 / bpm / 4; // 16th notes
            // Schedule ~250ms ahead.
            while (this._music.nextTime < this.ctx.currentTime + 0.28) {
                this._playStep(this._music.step, this._music.nextTime, stepDur);
                this._music.nextTime += stepDur;
                this._music.step = (this._music.step + 1) % 64; // 4 bars of 16
                if (this._music.step === 0) this._music.bar++;
            }
        }

        _mtone({ midi, at, dur, type = 'triangle', vol = 0.1, cutoff = null }) {
            try {
                const t0 = Math.max(at, this.ctx.currentTime);
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = type;
                osc.frequency.value = midiToFreq(midi);
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + Math.min(0.03, dur * 0.3));
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
                let head = osc;
                if (cutoff) {
                    const f = this.ctx.createBiquadFilter();
                    f.type = 'lowpass';
                    f.frequency.value = cutoff;
                    osc.connect(f);
                    head = f;
                }
                head.connect(g);
                g.connect(this.musicGain);
                const send = this.ctx.createGain();
                send.gain.value = 0.3;
                g.connect(send);
                send.connect(this.delaySend);
                osc.start(t0);
                osc.stop(t0 + dur + 0.05);
            } catch { /* ignore */ }
        }

        _mdrum({ at, kind }) {
            try {
                const t0 = Math.max(at, this.ctx.currentTime);
                if (kind === 'kick') {
                    const osc = this.ctx.createOscillator();
                    const g = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(150, t0);
                    osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.11);
                    g.gain.setValueAtTime(0.5, t0);
                    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
                    osc.connect(g);
                    g.connect(this.musicGain);
                    osc.start(t0);
                    osc.stop(t0 + 0.2);
                } else if (kind === 'hat' && this.noiseBuffer) {
                    const src = this.ctx.createBufferSource();
                    src.buffer = this.noiseBuffer;
                    src.loop = true;
                    const f = this.ctx.createBiquadFilter();
                    f.type = 'highpass';
                    f.frequency.value = 7000;
                    const g = this.ctx.createGain();
                    g.gain.setValueAtTime(0.08, t0);
                    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
                    src.connect(f);
                    f.connect(g);
                    g.connect(this.musicGain);
                    src.start(t0);
                    src.stop(t0 + 0.08);
                } else if (kind === 'snare' && this.noiseBuffer) {
                    const src = this.ctx.createBufferSource();
                    src.buffer = this.noiseBuffer;
                    src.loop = true;
                    const f = this.ctx.createBiquadFilter();
                    f.type = 'bandpass';
                    f.frequency.value = 1900;
                    const g = this.ctx.createGain();
                    g.gain.setValueAtTime(0.16, t0);
                    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
                    src.connect(f);
                    f.connect(g);
                    g.connect(this.musicGain);
                    src.start(t0);
                    src.stop(t0 + 0.15);
                }
            } catch { /* ignore */ }
        }

        _playStep(step, at, stepDur) {
            const mode = this._music.mode;
            const s16 = step % 16;
            const bar = Math.floor(step / 16) % 4;

            // Chord roots (midi): Am - F - C - G progression, darker for boss.
            let roots;
            if (mode === 'boss') roots = [45, 44, 43, 41]; // A2 Ab2 G2 F2 — tense chromatic descent
            else if (mode === 'gameover') roots = [45, 41, 48, 43];
            else roots = [45, 41, 48, 43]; // A2 F2 C3 G2
            const root = roots[bar];

            if (mode === 'menu') {
                // Sparse pads + gentle arp, no drums.
                if (s16 === 0) {
                    [0, 3, 7, 12].forEach((iv) => {
                        this._mtone({ midi: root + 12 + iv, at, dur: stepDur * 14, type: 'sawtooth', vol: 0.035, cutoff: 900 });
                    });
                }
                if (s16 % 4 === 2) {
                    const arpNotes = [0, 3, 7, 12, 7, 3];
                    const n = arpNotes[(Math.floor(step / 2) + bar) % arpNotes.length];
                    this._mtone({ midi: root + 24 + n, at, dur: stepDur * 2, type: 'triangle', vol: 0.06 });
                }
                return;
            }

            if (mode === 'gameover') {
                if (s16 === 0) {
                    [0, 3, 7].forEach((iv) => {
                        this._mtone({ midi: root + 12 + iv, at, dur: stepDur * 15, type: 'triangle', vol: 0.06 });
                    });
                }
                if (s16 === 8) {
                    this._mtone({ midi: root + 24, at, dur: stepDur * 4, type: 'sine', vol: 0.07 });
                }
                return;
            }

            // playing + boss: driving sequencer.
            const isBoss = mode === 'boss';
            // Kick: four on the floor (boss adds extra 8th punch).
            if (s16 % 4 === 0) this._mdrum({ at, kind: 'kick' });
            if (isBoss && s16 % 4 === 2) this._mdrum({ at, kind: 'kick' });
            // Hats offbeat, snare on 2/4 for boss.
            if (s16 % 4 === 2) this._mdrum({ at, kind: 'hat' });
            if (s16 % 2 === 1) this._mdrum({ at: at + stepDur * 0.0, kind: 'hat' });
            if (isBoss && (s16 === 4 || s16 === 12)) this._mdrum({ at, kind: 'snare' });

            // Bass: root 8ths with octave hops.
            if (s16 % 2 === 0) {
                const oct = (s16 % 8 === 6) ? 12 : 0;
                this._mtone({ midi: root + oct, at, dur: stepDur * 1.6, type: 'sawtooth', vol: isBoss ? 0.11 : 0.085, cutoff: isBoss ? 700 : 520 });
            }
            // Arp lead: minor pentatonic-ish pattern, denser on boss.
            const pattern = isBoss ? [0, 3, 7, 12, 15, 12, 7, 3] : [0, 7, 12, 7, 3, 7, 12, 15];
            if (s16 % (isBoss ? 1 : 2) === 0) {
                const n = pattern[(step + bar * 3) % pattern.length];
                this._mtone({ midi: root + 24 + n, at, dur: stepDur * 1.2, type: 'square', vol: isBoss ? 0.035 : 0.028 });
            }
            // Pad wash at bar start.
            if (s16 === 0) {
                [0, 3, 7].forEach((iv) => {
                    this._mtone({ midi: root + 12 + iv, at, dur: stepDur * 15, type: 'sawtooth', vol: 0.028, cutoff: 800 });
                });
            }
        }
    }

    window.AudioManager = new AudioManager();
})();
