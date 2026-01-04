// Visual effects: floating text, particles, aura effects

class FloatingText {
    constructor(text, x, y, color, isBig) {
        this.text = text; this.x = x; this.y = y; this.color = color;
        this.life = 40; this.vy = -1; this.isBig = isBig;
    }
    update() { this.y += this.vy; this.life--; }
    draw() {
        ctx.globalAlpha = this.life / 40;
        ctx.fillStyle = this.color;
        ctx.font = this.isBig ? 'bold 20px Arial' : '14px Arial';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.life = 20;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
    }
    update() { this.x+=this.vx; this.y+=this.vy; this.life--; }
    draw() {
        ctx.globalAlpha = this.life/20;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class AuraEffect {
    constructor(x, y, radius, color = '#ffffff') {
        this.x = x; this.y = y; this.radius = radius; this.life = 10;
        this.color = color;
    }
    update() { this.life--; }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / 30;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = this.color || '#ffffff';
        ctx.fill();
        ctx.restore();
    }
}

class VoidShardAoeEffect {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.maxRadius = 60;
        this.life = 20;
        this.maxLife = 20;
    }
    update() {
        this.life--;
        this.radius += (this.maxRadius - this.radius) * 0.3;
    }
    draw() {
        ctx.save();
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha * 0.6;
        
        // Purple expanding ring
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Inner purple fill
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = '#9b59b6';
        ctx.fill();
        
        // Shadow particles
        ctx.globalAlpha = alpha;
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + (this.maxLife - this.life) * 0.2;
            const dist = this.radius * 0.7;
            const px = this.x + Math.cos(angle) * dist;
            const py = this.y + Math.sin(angle) * dist;
            ctx.fillStyle = '#6a0dad';
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}
