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

        const FLAT_PICKUP_RANGE = 80;
        const d = Math.hypot(p.x - this.x, p.y - this.y);

        // Auto-open when in range to keep UX minimal.
        if (d <= (FLAT_PICKUP_RANGE + this.radius)) {
            this.open();
        }
    }

    open() {
        if (this.dead) return;
        this.dead = true;

        // Boss chest loot: 3 items with special rules
        // Slot 1: Guaranteed character-exclusive artifact (if player has a class) or Legendary artifact
        // Slots 2-3: Epic (75%) or Legendary (25%) gear of any type
        const rollEpicOrLegendary = () => {
            const r = Math.random();
            if (r < 0.25) return Rarity.LEGENDARY;
            return Rarity.EPIC;
        };

        const items = [];
        
        // First item: guaranteed character-exclusive artifact if player has a class
        const player = Game.player;
        const playerClass = player?.characterClass;
        
        if (playerClass && playerClass.exclusiveArtifacts && playerClass.exclusiveArtifacts.length > 0) {
            // Pick a random exclusive artifact for this character (duplicates allowed)
            const exclusiveArtifactId = playerClass.exclusiveArtifacts[Math.floor(Math.random() * playerClass.exclusiveArtifacts.length)];
            const exclusiveArtifact = LootSystem.generateItem({ 
                forceType: ItemType.ARTIFACT,
                forceArchetypeId: exclusiveArtifactId
            });
            items.push(exclusiveArtifact);
        } else {
            // No character class, give a Legendary artifact
            items.push(LootSystem.generateItem({ forceRarity: Rarity.LEGENDARY, forceType: ItemType.ARTIFACT }));
        }
        
        // Remaining 2 items: Epic (75%) or Legendary (25%) gear, all types allowed
        items.push(LootSystem.generateItem({ forceRarity: rollEpicOrLegendary() }));
        items.push(LootSystem.generateItem({ forceRarity: rollEpicOrLegendary() }));

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
