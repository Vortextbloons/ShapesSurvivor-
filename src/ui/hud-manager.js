class HUDManager {
    constructor() {
        this._els = null;
        this._barsState = {
            hpWidth: '',
            xpWidth: '',
            hpText: '',
            xpText: '',
            lvlText: '',
            buffsHtml: '',
            runInfoHtml: '',
            hpColor: '',
            bossWarningVisible: false
        };
        this._nextUpdateAt = 0;
    }

    init() {
        this.cacheEls();
    }

    cacheEls() {
        this._els = {
            hpFill: document.getElementById('hp-fill'),
            xpFill: document.getElementById('xp-fill'),
            hpText: document.getElementById('hp-text'),
            xpText: document.getElementById('xp-text'),
            lvlEl: document.getElementById('lvl-display'),
            buffsPanel: document.getElementById('buffs-panel'),
            runInfo: document.getElementById('run-info'),
            runTime: document.getElementById('run-time'),
            runKills: document.getElementById('run-kills'),
            bossWarning: document.getElementById('boss-warning')
        };
    }

    update(now = performance.now(), force = false) {
        if (!force && now < (this._nextUpdateAt || 0)) return;
        this._nextUpdateAt = now + 100; // ~10Hz update rate

        const p = window.Game?.player;
        if (!this._els) this.cacheEls();
        
        const { hpFill, xpFill, hpText, xpText, lvlEl, buffsPanel, runTime, runKills, bossWarning } = this._els;
        const st = this._barsState;

        // Boss warning indicator
        const shouldShowWarning = !!(window.Game?.bossQueuedLevel && window.Game?.enemies?.length > 0);
        if (bossWarning && st.bossWarningVisible !== shouldShowWarning) {
            bossWarning.style.display = shouldShowWarning ? 'block' : 'none';
            st.bossWarningVisible = shouldShowWarning;
        }

        // Run info
        const timeSec = Math.max(0, Math.floor((window.Game?.elapsedFrames || 0) / 60));
        const mins = Math.floor(timeSec / 60);
        const secs = timeSec % 60;
        const timeText = `${mins}:${String(secs).padStart(2, '0')}`;
        const killsText = String(window.Game?.stats?.kills || 0);

        if (runTime && runTime.textContent !== timeText) runTime.textContent = timeText;
        if (runKills && runKills.textContent !== killsText) runKills.textContent = killsText;

        if (!p) {
            this._resetBars(st, hpFill, xpFill, hpText, xpText, lvlEl, buffsPanel);
            return;
        }

        this._updatePlayerBars(p, st, hpFill, xpFill, hpText, xpText, lvlEl);
        this._updateBuffs(p, st, buffsPanel);
    }

    _resetBars(st, hpFill, xpFill, hpText, xpText, lvlEl, buffsPanel) {
        if (hpFill && st.hpWidth !== '0%') { hpFill.style.width = '0%'; st.hpWidth = '0%'; }
        if (xpFill && st.xpWidth !== '0%') { xpFill.style.width = '0%'; st.xpWidth = '0%'; }
        if (hpText && st.hpText !== '0/0') { hpText.textContent = '0/0'; st.hpText = '0/0'; }
        if (xpText && st.xpText !== '0/0') { xpText.textContent = '0/0'; st.xpText = '0/0'; }
        if (lvlEl && st.lvlText !== '1') { lvlEl.textContent = '1'; st.lvlText = '1'; }
        const emptyHtml = '<div class="buff-empty">None</div>';
        if (buffsPanel && st.buffsHtml !== emptyHtml) { buffsPanel.innerHTML = emptyHtml; st.buffsHtml = emptyHtml; }
    }

    _updatePlayerBars(p, st, hpFill, xpFill, hpText, xpText, lvlEl) {
        const clamp01 = (v) => Math.max(0, Math.min(1, v));

        const hpPct = clamp01((p.hp || 0) / Math.max(1, p.stats.maxHp || 1));
        const xpPct = clamp01((p.xp || 0) / Math.max(1, p.nextLevelXp || 1));

        const overheal = p.overheal || 0;
        const totalHp = (p.hp || 0) + overheal;
        const displayMaxHp = Math.ceil(p.stats.maxHp || 0);
        
        const effectivePct = clamp01(totalHp / Math.max(1, displayMaxHp));
        const hpWidth = `${(effectivePct * 100).toFixed(2)}%`;
        const xpWidth = `${(xpPct * 100).toFixed(2)}%`;

        const hpTextStr = `${Math.ceil(totalHp)}/${displayMaxHp}`;
        const xpTextStr = `${Math.floor(p.xp || 0)}/${Math.floor(p.nextLevelXp || 0)}`;
        const lvlTextStr = String(p.level || 1);

        const hpColor = overheal > 1 ? '#9b59b6' : '#e74c3c';
        
        if (hpFill && st.hpColor !== hpColor) { 
            hpFill.style.backgroundColor = hpColor; 
            st.hpColor = hpColor; 
        }

        if (hpFill && st.hpWidth !== hpWidth) { hpFill.style.width = hpWidth; st.hpWidth = hpWidth; }
        if (xpFill && st.xpWidth !== xpWidth) { xpFill.style.width = xpWidth; st.xpWidth = xpWidth; }
        if (hpText && st.hpText !== hpTextStr) { hpText.textContent = hpTextStr; st.hpText = hpTextStr; }
        if (xpText && st.xpText !== xpTextStr) { xpText.textContent = xpTextStr; st.xpText = xpTextStr; }
        if (lvlEl && st.lvlText !== lvlTextStr) { lvlEl.textContent = lvlTextStr; st.lvlText = lvlTextStr; }
    }

    _updateBuffs(p, st, buffsPanel) {
        if (!buffsPanel) return;

        const buffs = (p.buffManager?.getActiveBuffs ? p.buffManager.getActiveBuffs() : []) || [];
        if (!buffs.length) {
            const emptyHtml = '<div class="buff-empty">None</div>';
            if (st.buffsHtml !== emptyHtml) {
                buffsPanel.innerHTML = emptyHtml;
                st.buffsHtml = emptyHtml;
            }
            return;
        }

        const html = buffs.map(b => {
            const progress = b.progress !== undefined ? b.progress : 
                           (b.maxTime > 0 ? Math.max(0, Math.min(1, b.time / b.maxTime)) : 1);
            
            const initials = String(b.name || 'Buff').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
            const stacks = (b.stacks && b.stacks > 1) ? `x${b.stacks}` : '';
            const color = b.color || null;
            const colorStyle = color ? `background: ${color};` : '';
            
            return `
                <div class="buff-icon" style="--p:${progress.toFixed(4)}; ${colorStyle}" aria-label="${b.name}${b.description ? ': ' + b.description : ''}">
                    <div class="buff-icon-inner">${initials || 'B'}</div>
                    ${stacks ? `<div class="buff-stack">${stacks}</div>` : ''}
                </div>
            `;
        }).join('');

        if (st.buffsHtml !== html) {
            buffsPanel.innerHTML = html;
            st.buffsHtml = html;
        }
    }
}

window.HUDManager = HUDManager;
