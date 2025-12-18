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
    constructor(x, y, radius) {
        this.x = x; this.y = y; this.radius = radius; this.life = 10;
    }
    update() { this.life--; }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255, 255, 255, ${this.life / 30})`;
        ctx.fill();
    }
}
