// Visual effects: floating text, particles, aura effects

class FloatingText {
    constructor(text, x, y, color, isBig, isCritical = false) {
        this.text = text; 
        this.x = x; 
        this.y = y; 
        this.startY = y;
        this.color = color;
        this.isBig = isBig;
        this.isCritical = isCritical;
        
        // Use config for parameters
        const typeKey = isCritical ? 'critical' : (isBig ? 'big' : 'normal');
        const config = window.EffectsConfig?.floatingText?.[typeKey] || {
            life: isBig ? 50 : 40,
            fontSize: isBig ? 20 : 14,
            velocity: isBig ? -1.5 : -1,
            fadeStart: isBig ? 35 : 30,
            bounce: false,
            scale: 1
        };
        
        this.life = config.life;
        this.maxLife = config.life;
        this.vy = config.velocity;
        this.fontSize = config.fontSize;
        this.fadeStart = config.fadeStart;
        this.bounce = config.bounce || false;
        this.scale = config.scale || 1;
        this.bouncePhase = 0;
    }
    
    update() { 
        this.y += this.vy; 
        this.life--;
        
        if (this.bounce) {
            this.bouncePhase += 0.15;
        }
    }
    
    draw() {
        const alpha = this.life > this.fadeStart ? 1 : (this.life / this.fadeStart);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        
        let displayScale = this.scale;
        if (this.bounce) {
            displayScale += Math.sin(this.bouncePhase) * 0.2;
        }
        
        const fontSize = this.fontSize * displayScale;
        ctx.font = this.isBig ? `bold ${fontSize}px Arial` : `${fontSize}px Arial`;
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

class LightningEffect {
    constructor(x1, y1, x2, y2, color = '#00ffff') {
        this.x1 = x1; this.y1 = y1;
        this.x2 = x2; this.y2 = y2;
        this.color = color;
        this.life = 10;
        this.segments = [];
        this.generateSegments();
    }
    generateSegments() {
        if (window.GameConstants?.SETTINGS?.LOW_QUALITY) {
            this.segments.push({x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2});
            return;
        }

        const dist = Math.hypot(this.x2 - this.x1, this.y2 - this.y1);
        const steps = Math.max(3, Math.floor(dist / 20));
        let currX = this.x1;
        let currY = this.y1;
        
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const targetX = this.x1 + (this.x2 - this.x1) * t;
            const targetY = this.y1 + (this.y2 - this.y1) * t;
            const jitter = 15;
            const nextX = targetX + (Math.random() - 0.5) * jitter;
            const nextY = targetY + (Math.random() - 0.5) * jitter;
            this.segments.push({x1: currX, y1: currY, x2: nextX, y2: nextY});
            currX = nextX;
            currY = nextY;
        }
        this.segments.push({x1: currX, y1: currY, x2: this.x2, y2: this.y2});
    }
    update() { this.life--; }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / 10;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const seg of this.segments) {
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
        }
        ctx.stroke();
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
        if (!window.GameConstants?.SETTINGS?.LOW_QUALITY) {
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
        }
        
        ctx.restore();
    }
}

// Object Pool for Particles
class ParticlePool {
    constructor(size = 500) {
        this.pool = [];
        this.active = [];
        this.size = size;
        
        // Pre-allocate particles
        for (let i = 0; i < size; i++) {
            this.pool.push(new PooledParticle());
        }
    }
    
    spawn(x, y, color, type = 'damage', config = null) {
        let particle;
        if (this.pool.length > 0) {
            particle = this.pool.pop();
        } else if (this.active.length < this.size) {
            particle = new PooledParticle();
        } else {
            return null; // Pool exhausted
        }
        
        particle.init(x, y, color, type, config);
        this.active.push(particle);
        return particle;
    }
    
    update() {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const particle = this.active[i];
            particle.update();
            
            if (particle.life <= 0) {
                this.active.splice(i, 1);
                this.pool.push(particle);
            }
        }
    }
    
    draw() {
        for (const particle of this.active) {
            particle.draw();
        }
    }
    
    clear() {
        this.pool.push(...this.active);
        this.active.length = 0;
    }
}

class PooledParticle {
    constructor() {
        this.x = 0; this.y = 0; this.color = '#fff';
        this.vx = 0; this.vy = 0;
        this.life = 0; this.maxLife = 0;
        this.size = 4; this.gravity = 0; this.friction = 1;
    }
    
    init(x, y, color, type = 'damage', config = null) {
        this.x = x;
        this.y = y;
        this.color = color;
        
        // Use config if provided, otherwise fallback to type defaults
        const effectConfig = config || (window.EffectsConfig?.particles?.types?.[type] || {
            life: 20, speed: 4, size: 4, gravity: 0, friction: 0.95, randomVelocity: true
        });
        
        this.life = effectConfig.life;
        this.maxLife = effectConfig.life;
        this.size = effectConfig.size;
        this.gravity = effectConfig.gravity;
        this.friction = effectConfig.friction;
        
        if (effectConfig.randomVelocity) {
            const angle = Math.random() * Math.PI * 2;
            const speed = effectConfig.speed * (0.5 + Math.random() * 0.5);
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
        } else {
            this.vx = (Math.random() - 0.5) * effectConfig.speed;
            this.vy = (Math.random() - 0.5) * effectConfig.speed;
        }
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.life--;
    }
    
    draw() {
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Screen Shake Manager
class ScreenShakeManager {
    constructor() {
        this.offsetX = 0;
        this.offsetY = 0;
        this.intensity = 0;
        this.duration = 0;
        this.maxDuration = 0;
    }
    
    shake(type = 'damage') {
        const config = window.EffectsConfig?.screenShake?.[type] || { intensity: 3, duration: 8 };
        
        // If already shaking, only replace if new shake is stronger
        if (this.duration > 0 && config.intensity <= this.intensity) {
            return;
        }
        
        this.intensity = config.intensity;
        this.duration = config.duration;
        this.maxDuration = config.duration;
    }
    
    update() {
        if (this.duration <= 0) {
            this.offsetX = 0;
            this.offsetY = 0;
            return;
        }
        
        const falloff = this.duration / this.maxDuration;
        const currentIntensity = this.intensity * falloff;
        
        this.offsetX = (Math.random() - 0.5) * currentIntensity * 2;
        this.offsetY = (Math.random() - 0.5) * currentIntensity * 2;
        
        this.duration--;
    }
    
    apply(ctx) {
        if (this.duration > 0) {
            ctx.translate(this.offsetX, this.offsetY);
        }
    }
    
    reset() {
        this.duration = 0;
        this.offsetX = 0;
        this.offsetY = 0;
    }
}

// Enhanced Death Effect
class DeathBurstEffect {
    constructor(x, y, color, type = 'enemy') {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type;
        
        const config = window.EffectsConfig?.deathEffects?.[type] || {
            particleCount: 12,
            burstRadius: 30,
            flashDuration: 8
        };
        
        this.flashDuration = config.flashDuration;
        this.life = this.flashDuration;
        this.ringExpansion = config.ringExpansion || false;
        this.multiRing = config.multiRing || false;
        this.radius = 5;
        this.maxRadius = config.burstRadius;
    }
    
    update() {
        this.life--;
        if (this.ringExpansion) {
            this.radius += (this.maxRadius - this.radius) * 0.2;
        }
    }
    
    draw() {
        if (this.life <= 0) return;
        
        const alpha = this.life / this.flashDuration;
        ctx.save();
        
        // Flash
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Ring expansion
        if (this.ringExpansion) {
            ctx.globalAlpha = alpha * 0.8;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
            
            if (this.multiRing) {
                ctx.globalAlpha = alpha * 0.5;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }
}
