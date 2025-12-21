class BossChest {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 14;
        this.dead = false;
        this.bob = Math.random() * Math.PI * 2;
    }

    update() {
        if (this.dead) return;

        this.bob += 0.08;

        const p = Game.player;
        if (!p) return;

        const pickupRange = Math.max(10, p.stats?.pickupRange || 80);
        const d = Math.hypot(p.x - this.x, p.y - this.y);

        // Auto-open when in range to keep UX minimal.
        if (d <= (pickupRange + this.radius)) {
            this.open();
        }
    }

    open() {
        if (this.dead) return;
        this.dead = true;

        // Boss chest loot: 3 options, biased to Rare+.
        const rollRarity = () => {
            const r = Math.random();
            if (r < 0.10) return Rarity.LEGENDARY;
            if (r < 0.40) return Rarity.EPIC;
            return Rarity.RARE;
        };

        const items = Array.from({ length: 3 }, () => LootSystem.generateItem({ forceRarity: rollRarity() }));
        Game.openRewardModal({
            title: 'Boss Chest',
            items
        });
    }

    draw() {
        if (this.dead) return;

        const y = this.y + Math.sin(this.bob) * 3;

        // Simple chest icon (no new assets): gold box + latch.
        ctx.save();
        ctx.fillStyle = '#d4a017';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.rect(this.x - 14, y - 10, 28, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9b6b00';
        ctx.beginPath();
        ctx.rect(this.x - 14, y - 2, 28, 4);
        ctx.fill();

        ctx.fillStyle = '#2b2b2b';
        ctx.beginPath();
        ctx.arc(this.x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
