class Player {
    constructor(classId = null) {
        // Use world dimensions for initial position
        const worldW = window.GameConstants?.WORLD_WIDTH || 2560;
        const worldH = window.GameConstants?.WORLD_HEIGHT || 1440;
        this.x = worldW / 2;
        this.y = worldH / 2;
        this.radius = 16;
        
        // Load character class
        this.classId = classId;
        this.characterClass = classId && window.CharacterArchetypes ? window.CharacterArchetypes[classId] : null;
        this.color = this.characterClass?.color || '#3498db';
        
        this.equipment = { weapon: null, armor: null, accessory1: null, accessory2: null };
        this.artifacts = [];
        
        const defaultStats = {
            maxHp: 80,
            moveSpeed: 3,
            damage: 1,
            areaOfEffect: 0,
            cooldownMult: 1,
            regen: 0,
            damageTakenMult: 1,
            rarityFind: 0,
            xpGain: 1,
            thornsDamage: 0,
            lifeOnKill: 0,
            damageVariance: 0
        };
        
        // Apply character class base stats
        this.baseStats = this.characterClass?.baseStats ? { ...this.characterClass.baseStats } : { ...defaultStats };
        
        this.stats = { ...this.baseStats };
        this.statBreakdowns = {};
        this.hp = this.stats.maxHp;
        this.xp = 0;
        this.level = 1;
        this.nextLevelXp = 50;
        this.weaponCooldown = 0;
        this.activeOrbitals = [];
        this.effects = EffectUtils.createDefaultEffects();
        this.effects.aoeOnCrit = 0;

        this.enhancementConfigs = {
            critMomentum: null,
            lastStand: null,
            staticCharge: null,
            soulHarvest: null,
            overdrive: null,
            berserkerRage: null,
            glassSoul: null,
            executionerMark: null,
            thornsMastery: null,
            vampiricAura: null,
            chaosEmbrace: null,
            slowedPrey: null
        };

        this.buffStates = {
            staticCharge: { distance: 0, charged: false },
            soulHarvest: { stacks: 0 },
            overdrive: { hits: 0, active: false, time: 0 },
            chaosEmbrace: { timer: 0, buffedStat: null, nerfedStat: null },
            livingArmor: { timer: 0 }
        };

        // Player debuffs from enemies
        this.slow = { mult: 1, time: 0 };

        // Overheal system (for the_colossus)
        this.overheal = 0;
        this.maxOverheal = 0;

        // Artifact cooldowns
        this.artifactCooldowns = {
            monolithCore: 0,
            overgrowthSeed: 0
        };

        // Engineer turret system (v0.9.0)
        this.turrets = [];
        this.maxTurrets = 0;
        this.turretStatInheritance = 0.5;

        // Chronomancer time abilities (v0.9.0)
        this.timeReverseAvailable = false;
        this.timeReverseSnapshot = null;
        this.timeDilationActive = false;
        this.timeDilationTimer = 0;

        // Elementalist status tracking (v0.9.0)
        this.recentStatusEffects = new Set(); // Track different status types applied to enemies

        // Phoenix Blade resurrection tracking
        this.phoenixUsed = false;

        // Ouroboros Ring survival stacking
        this.ouroborosStacks = 0;
        this.lastOuroborosStackTime = 0;
        
        // Initialize buff management system
        this.buffManager = new BuffManager(this);
        
        // Load buff definitions if available
        if (window.BuffDefinitions) {
            this.buffManager.registerBuffDefinitions(window.BuffDefinitions);
        }

        // Initialize class-specific passives
        if (this.classId === 'engineer' && this.characterClass?.passives) {
            this.maxTurrets = this.characterClass.passives.maxTurrets || 3;
            this.turretStatInheritance = this.characterClass.passives.turretStatInheritance || 0.5;
        }
        if (this.classId === 'chronomancer' && this.characterClass?.passives?.timeReverseAvailable) {
            this.timeReverseAvailable = true;
        }
    }

    static _mult1p(value) {
        const v = Number(value) || 0;
        return 1 + v;
    }

    static _defaultLayerForModifier(mod) {
        // Layer 0 is reserved for the player's base.
        // For everything else, we intentionally avoid naming layers.
        // Default policy:
        // - explicit mod.layer wins
        // - buffs go to layer 3
        // - item adds go to layer 1
        // - item multiplies go to layer 2
        if (!mod) return 1;
        if (mod.layer != null) return Math.max(0, Math.floor(Number(mod.layer) || 0));
        if (mod.source === 'buff') return 3;
        if (mod.operation === 'multiply') return 2;
        return 1;
    }

    getEffectiveItemStat(item, stat, def = 0) {
        const mods = Array.isArray(item?.modifiers) ? item.modifiers : [];

        let add = 0;
        let hasAdd = false;
        let mult = 1;

        for (const m of mods) {
            if (!m || m.stat !== stat) continue;
            if (m.operation === 'add') {
                hasAdd = true;
                add += (Number(m.value) || 0);
            } else if (m.operation === 'multiply') {
                mult *= Player._mult1p(m.value);
            }
        }

        const base = hasAdd ? add : def;
        return base * mult;
    }

    recalculateStats() {
        const prevMaxHp = (this.stats && this.stats.maxHp !== undefined)
            ? (Number(this.stats.maxHp) || 0)
            : (Number(this.baseStats.maxHp) || 0);

        if (!window.StatCalculator?.Stat) {
            // Fallback: keep old behavior if the calculator wasn't loaded.
            this.stats = { ...this.baseStats };
            return;
        }

        const Stat = window.StatCalculator.Stat;
        const statObjs = {};
        for (const [k, v] of Object.entries(this.baseStats)) {
            statObjs[k] = new Stat(v);
        }

        this.stats = { ...this.baseStats };
        this.statBreakdowns = {};
        const items = [...Object.values(this.equipment).filter(i => i !== null), ...this.artifacts];

        // Effects + special/global modifiers.
        this.effects = EffectUtils.createDefaultEffects();
        this.effects.aoeOnCrit = 0;

        // Reset all enhancement configs before processing items
        this.enhancementConfigs = {
            critMomentum: null,
            lastStand: null,
            staticCharge: null,
            soulHarvest: null,
            overdrive: null,
            berserkerRage: null,
            glassSoul: null,
            executionerMark: null,
            thornsMastery: null,
            vampiricAura: null,
            chaosEmbrace: null,
            slowedPrey: null
        };

        let bestCritMomentum = null;

        items.forEach(item => {
            const mods = Array.isArray(item?.modifiers) ? item.modifiers : [];
            const isWeapon = item?.type === ItemType.WEAPON;

            for (const mod of mods) {
                if (!mod) continue;

                const layer = Player._defaultLayerForModifier(mod);
                
                // Shadow Stalker passive: double crit chance bonuses
                let modValue = mod.value;
                if (this.classId === 'shadow_stalker' && 
                    this.characterClass?.passives?.critChanceDoubling &&
                    (mod.stat === 'critChance' || mod.stat === 'critChanceBonus') &&
                    mod.operation === 'add') {
                    modValue = (Number(mod.value) || 0) * 2;
                }

                // The Colossus passive: boost maxHp and regen from gear
                if (this.classId === 'the_colossus' &&
                    this.characterClass?.passives?.vitalityBoost &&
                    (mod.stat === 'maxHp' || mod.stat === 'regen') &&
                    mod.source !== 'base') {
                    modValue = (Number(mod.value) || 0) * this.characterClass.passives.vitalityBoost;
                }

                // The Hoarder passive: gearSpecialist - boost ALL stats from gear by 25%
                if (this.classId === 'the_hoarder' &&
                    this.characterClass?.passives?.gearSpecialist &&
                    item?.source === 'item' &&
                    !item?.characterExclusive) {
                    const gearBoost = Number(this.characterClass.passives.gearSpecialist) || 1;
                    modValue = (Number(mod.value) || 0) * gearBoost;
                }

                // Player stat keys
                if (statObjs[mod.stat] !== undefined) {
                    statObjs[mod.stat].addModifier({
                        layer,
                        operation: mod.operation || 'add',
                        value: modValue,
                        source: mod.source,
                        stat: mod.stat,
                        name: mod.name
                    });
                    continue;
                }

                // Effect keys (critChanceBonus, etc.)
                if (this.effects[mod.stat] !== undefined) {
                    if (mod.operation === 'add') {
                        this.effects[mod.stat] += (Number(modValue) || 0);
                    } else if (mod.operation === 'multiply') {
                        this.effects[mod.stat] *= Player._mult1p(modValue);
                    }
                    continue;
                }

                // Weapon-based crit scaling: non-weapon items can contribute as global
                // multipliers/bonuses to the weapon's critChance.
                if (!isWeapon) {
                    if (mod.stat === 'critChance') {
                        if (mod.operation === 'multiply') this.effects.critChanceMult *= Player._mult1p(modValue);
                        else if (mod.operation === 'add') this.effects.critChanceBonus += (Number(modValue) || 0);
                    } else if (mod.stat === 'critChanceMult') {
                        // Some generators may encode the multiplier stat as additive (0.15 => +15%).
                        this.effects.critChanceMult *= Player._mult1p(modValue);
                    }
                }
            }

            // Weapon Effects are stored on the weapon item as a specialEffect payload.
            if (isWeapon && item?.specialEffect?.effects) {
                EffectUtils.mergeEffects(this.effects, item.specialEffect.effects);
            }

            // Enhancements are stored on accessories as enhancement payload.
            if (item?.enhancement) {
                if (item.enhancement.effects) {
                    EffectUtils.mergeEffects(this.effects, item.enhancement.effects);
                }
                const kind = item.enhancement.kind;
                const cfg = item.enhancement.config;
                
                if (kind && cfg) {
                    switch (kind) {
                        case 'critMomentum': {
                            const c = {
                                damagePerStack: Number(cfg.damagePerStack) || 0.05,
                                duration: Math.max(1, Number(cfg.duration) || 600),
                                maxStacks: Math.max(1, Math.floor(Number(cfg.maxStacks) || 3))
                            };
                            if (!bestCritMomentum) bestCritMomentum = c;
                            else {
                                // Prefer stronger configs if multiple accessories roll it.
                                if ((c.damagePerStack || 0) > (bestCritMomentum.damagePerStack || 0)) bestCritMomentum.damagePerStack = c.damagePerStack;
                                if ((c.duration || 0) > (bestCritMomentum.duration || 0)) bestCritMomentum.duration = c.duration;
                                if ((c.maxStacks || 0) > (bestCritMomentum.maxStacks || 0)) bestCritMomentum.maxStacks = c.maxStacks;
                            }
                            break;
                        }
                        case 'lastStand': {
                            this.enhancementConfigs.lastStand = {
                                damagePerMissingHpPct: Number(cfg.damagePerMissingHpPct) || 0.5
                            };
                            break;
                        }
                        case 'staticCharge': {
                            this.enhancementConfigs.staticCharge = {
                                distanceToCharge: Number(cfg.distanceToCharge) || 400,
                                chainTargets: Number(cfg.chainTargets) || 3,
                                chainDamagePct: Number(cfg.chainDamagePct) || 0.50,
                                chainRange: Number(cfg.chainRange) || 150
                            };
                            break;
                        }
                        case 'soulHarvest': {
                            this.enhancementConfigs.soulHarvest = {
                                xpPerStack: Number(cfg.xpPerStack) || 0.005,
                                maxStacks: Number(cfg.maxStacks) || 50
                            };
                            break;
                        }
                        case 'overdrive': {
                            this.enhancementConfigs.overdrive = {
                                hitsToTrigger: Number(cfg.hitsToTrigger) || 50,
                                duration: Number(cfg.duration) || 300,
                                cooldownReduction: Number(cfg.cooldownReduction) || 0.50,
                                damageTakenIncrease: Number(cfg.damageTakenIncrease) || 0.10
                            };
                            break;
                        }
                        case 'berserkerRage': {
                            this.enhancementConfigs.berserkerRage = {
                                hpThreshold: Number(cfg.hpThreshold) || 0.30,
                                damageBonus: Number(cfg.damageBonus) || 0.40,
                                speedBonus: Number(cfg.speedBonus) || 0.20
                            };
                            break;
                        }
                        case 'glassSoul': {
                            this.enhancementConfigs.glassSoul = {
                                damageDealtMult: Number(cfg.damageDealtMult) || 0.60,
                                damageTakenMult: Number(cfg.damageTakenMult) || 0.30
                            };
                            break;
                        }
                        case 'executionerMark': {
                            this.enhancementConfigs.executionerMark = {
                                hpThreshold: Number(cfg.hpThreshold) || 0.20,
                                damageMultiplier: Number(cfg.damageMultiplier) || 1.50
                            };
                            break;
                        }
                        case 'thornsMastery': {
                            this.enhancementConfigs.thornsMastery = {
                                thornsMult: Number(cfg.thornsMult) || 2.0,
                                aoeRadius: Number(cfg.aoeRadius) || 80
                            };
                            break;
                        }
                        case 'vampiricAura': {
                            this.enhancementConfigs.vampiricAura = {
                                healAmount: Number(cfg.healAmount) || 1,
                                range: Number(cfg.range) || 120
                            };
                            break;
                        }
                        case 'chaosEmbrace': {
                            this.enhancementConfigs.chaosEmbrace = {
                                intervalFrames: Number(cfg.intervalFrames) || 1800,
                                affectedStats: Array.isArray(cfg.affectedStats) ? cfg.affectedStats : ['damage', 'moveSpeed', 'cooldownMult']
                            };
                            break;
                        }
                    }
                }
            }
        });

        this.enhancementConfigs.critMomentum = bestCritMomentum;


        // The Colossus passive: Titan Might - 10% damage per 100 max HP (Layer 3)
        if (this.classId === 'the_colossus' && this.characterClass?.passives?.titanMight) {
            // Calculate current maxHp before finalizing
            const currentMaxHp = statObjs.maxHp ? statObjs.maxHp.calculate() : (this.baseStats.maxHp || 0);
            const stacks = Math.floor(currentMaxHp / 100);
            
            if (stacks > 0) {
                // Update or apply the buff with correct stacks
                const buff = this.buffManager.getBuff('titanMight');
                if (buff) {
                    buff.stacks = stacks;
                } else {
                    this.buffManager.applyBuff('titanMight', { stacks: stacks });
                }
            } else {
                this.buffManager.removeBuff('titanMight');
            }
        }

        // The Hoarder passive: artifactSynergy - +5% rarityFind and +10% xpGain per 2 artifacts (Layer 3)
        if (this.classId === 'the_hoarder' && this.characterClass?.passives?.artifactSynergy) {
            const artifactCount = this.artifacts.length;
            const bonusTiers = Math.floor(artifactCount / 2);
            if (bonusTiers > 0) {
                const rarityFindBonus = bonusTiers * 0.05;
                const xpGainBonus = bonusTiers * 0.10;
                
                statObjs.rarityFind.addModifier({
                    layer: 3,
                    operation: 'add',
                    value: rarityFindBonus,
                    source: 'passive',
                    stat: 'rarityFind',
                    name: 'Artifact Synergy'
                });
                
                statObjs.xpGain.addModifier({
                    layer: 3,
                    operation: 'multiply',
                    value: xpGainBonus,
                    source: 'passive',
                    stat: 'xpGain',
                    name: 'Artifact Synergy'
                });
            }
        }

        // Ouroboros Ring: Apply survival stacking bonus
        const ouroborosArtifact = this.artifacts.find(a => 
            (a.id === 'ouroboros_ring' || a.archetypeId === 'ouroboros_ring') && a.specialEffect?.survivalStacking
        );
        if (ouroborosArtifact && this.ouroborosStacks > 0) {
            const bonusPerStack = ouroborosArtifact.specialEffect.statBonusPerStack || 0.05;
            const totalBonus = this.ouroborosStacks * bonusPerStack;
            
            // Apply to all main stats
            const affectedStats = ['damage', 'maxHp', 'moveSpeed', 'regen'];
            for (const statName of affectedStats) {
                if (statObjs[statName]) {
                    statObjs[statName].addModifier({
                        layer: 3,
                        operation: 'multiply',
                        value: totalBonus,
                        source: 'artifact',
                        stat: statName,
                        name: 'Ouroboros'
                    });
                }
            }
        }

        // Finalize numeric stat values + breakdowns
        for (const [k, s] of Object.entries(statObjs)) {
            const breakdown = s.getBreakdown();
            this.stats[k] = breakdown.final;
            this.statBreakdowns[k] = breakdown;
        }
        
        // Apply all active buff modifiers through BuffManager
        this.buffManager.applyModifiers(statObjs);
        
        // Re-finalize stats after buff modifiers
        for (const [k, s] of Object.entries(statObjs)) {
            const breakdown = s.getBreakdown();
            this.stats[k] = breakdown.final;
            this.statBreakdowns[k] = breakdown;
        }

        // Apply player slow debuff from enemies (after all normal stat calculation)
        if (this.slow && this.slow.time > 0) {
            this.stats.moveSpeed *= this.slow.mult;
        }

        // Greed's Echo artifact: +1 projectile per 0.2 rarityFind
        const greedsEchoArtifact = this.artifacts.find(a => a.id === 'greeds_echo' || a.archetypeId === 'greeds_echo');
        if (greedsEchoArtifact?.specialEffect?.projectilesFromLuck) {
            const luckPerProjectile = greedsEchoArtifact.specialEffect.luckPerProjectile || 0.2;
            const currentRarityFind = this.stats.rarityFind || 0;
            const bonusProjectiles = Math.floor(currentRarityFind / luckPerProjectile);
            if (bonusProjectiles > 0) {
                this.effects.projectileCount = (this.effects.projectileCount || 1) + bonusProjectiles;
            }
        }

        // Living Armor artifact: convert regen to thorns
        const livingArmorArtifact = this.artifacts.find(a => a.id === 'living_armor' || a.archetypeId === 'living_armor');
        if (livingArmorArtifact?.specialEffect?.regenToThorns) {
            const conversionRate = livingArmorArtifact.specialEffect.thornConversionRate || 0.5;
            const thornsDamageFromRegen = (this.stats.regen || 0) * conversionRate * 100;
            this.stats.thornsDamage = (this.stats.thornsDamage || 0) + thornsDamageFromRegen;
        }

        // Update max overheal capacity
        this.maxOverheal = this.stats.maxHp * (this.getOverhealMultiplier() - 1);

        // If max HP increased (e.g., from an item), heal for the amount gained.
        const newMaxHp = Number(this.stats.maxHp) || 0;
        if (newMaxHp > prevMaxHp) {
            this.heal(newMaxHp - prevMaxHp);
        }

        if (this.hp > newMaxHp) this.hp = newMaxHp;
        Game.ui.updateStatsPanel();
    }

    tickBuffs() {
        // Tick all buffs managed by BuffManager
        const anyExpired = this.buffManager.tick();
        
        // If any buffs expired, recalculate stats
        if (anyExpired) {
            this.recalculateStats();
        }
        
        // Legacy slow system (will be migrated to BuffManager later)
        if (this.slow && this.slow.time > 0) {
            this.slow.time--;
            if (this.slow.time <= 0) {
                this.slow.time = 0;
                this.slow.mult = 1;
                this.recalculateStats();
            }
        }
        

    }

    // Called when player hits an enemy (for Chronomancer Time Dilation, etc.)
    onHitEnemy(enemy) {
        // Chronomancer passive: Time Dilation chance per hit
        if (this.classId === 'chronomancer' && this.characterClass?.passives?.timeDilationChance) {
            let dilationChance = this.characterClass.passives.timeDilationChance;
            
            // Paradox Engine artifact: doubles time dilation chance
            const paradoxArtifact = this.artifacts.find(a => 
                (a.id === 'paradox_engine' || a.archetypeId === 'paradox_engine') && a.specialEffect?.timeDilationChanceBonus
            );
            if (paradoxArtifact) {
                dilationChance *= (1 + paradoxArtifact.specialEffect.timeDilationChanceBonus);
            }
            
            if (!this.timeDilationActive && Math.random() < dilationChance) {
                this.triggerTimeDilation();
            }
        }
    }

    // Chronomancer: Trigger Time Dilation - slow all enemies
    triggerTimeDilation() {
        const duration = this.characterClass?.passives?.timeDilationDuration || 3000;
        const durationFrames = Math.floor(duration / 16.67); // Convert ms to frames
        
        this.timeDilationActive = true;
        this.timeDilationTimer = durationFrames;
        
        // Slow all enemies
        for (const enemy of Game.enemies) {
            if (!enemy || enemy.dead) continue;
            enemy.slow.mult = Math.min(enemy.slow.mult || 1, 0.3);
            enemy.slow.time = Math.max(enemy.slow.time || 0, durationFrames);
        }
        
        // Visual effect
        if (Game?.effects && typeof AuraEffect !== 'undefined') {
            Game.effects.push(new AuraEffect(this.x, this.y, 400, '#00bcd4'));
        }
        if (Game?.floatingTexts && typeof FloatingText !== 'undefined') {
            Game.floatingTexts.push(new FloatingText('TIME DILATION!', this.x, this.y - 30, '#00bcd4', true));
        }
    }

    // Chronomancer: Time Reverse ability (once per run)
    triggerTimeReverse() {
        if (!this.timeReverseAvailable || !this.timeReverseSnapshot) return false;
        
        // Restore player state from snapshot
        this.hp = this.timeReverseSnapshot.hp;
        this.x = this.timeReverseSnapshot.x;
        this.y = this.timeReverseSnapshot.y;
        
        // Temporal Anchor artifact: heal bonus and invulnerability
        const anchorArtifact = this.artifacts.find(a => 
            (a.id === 'temporal_anchor' || a.archetypeId === 'temporal_anchor')
        );
        if (anchorArtifact?.specialEffect) {
            const healBonus = anchorArtifact.specialEffect.timeReverseHealBonus || 0.5;
            this.heal(this.stats.maxHp * healBonus);
            // TODO: Add invulnerability buff
        }
        
        this.timeReverseAvailable = false;
        
        // Visual effect
        if (Game?.effects && typeof AuraEffect !== 'undefined') {
            Game.effects.push(new AuraEffect(this.x, this.y, 200, '#00bcd4'));
        }
        if (Game?.floatingTexts && typeof FloatingText !== 'undefined') {
            Game.floatingTexts.push(new FloatingText('TIME REVERSED!', this.x, this.y - 30, '#00bcd4', true));
        }
        
        return true;
    }

    // Save state snapshot for Time Reverse
    saveTimeReverseSnapshot() {
        if (this.classId === 'chronomancer' && this.timeReverseAvailable) {
            this.timeReverseSnapshot = {
                hp: this.hp,
                x: this.x,
                y: this.y
            };
        }
    }

    onCritEvent() {
        // Critical Momentum: Stacking damage buff on crit
        if (this.enhancementConfigs.critMomentum) {
            this.buffManager.applyBuff('criticalMomentum');
            this.recalculateStats();
        }
        
        // AOE on crit artifact effect
        if (this.effects.aoeOnCrit > 0) {
            this.triggerAoeCrit();
        }
    }
    
    triggerAoeCrit() {
        // Find the last enemy hit by examining recent projectiles or current combat
        // For now, trigger AOE around all nearby enemies that were recently hit
        const aoePercent = this.effects.aoeOnCrit;
        if (aoePercent <= 0) return;
        
        const weapon = this.equipment.weapon;
        if (!weapon) return;
        
        const getMod = (stat, def) => this.getEffectiveItemStat(weapon, stat, def);
        let baseDmg = getMod('baseDamage', 5);
        let aoeDamage = baseDmg * this.stats.damage * aoePercent;
        
        // Find all enemies within a moderate range and deal AOE damage
        const aoeRange = 80;
        const px = this.x;
        const py = this.y;
        
        for (let i = 0, n = Game.enemies.length; i < n; i++) {
            const e = Game.enemies[i];
            if (!e || e.dead) continue;
            
            const dx = e.x - px;
            const dy = e.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist <= aoeRange + e.radius) {
                // Deal AOE damage to surrounding enemies
                for (let j = 0; j < Game.enemies.length; j++) {
                    const target = Game.enemies[j];
                    if (!target || target.dead || target === e) continue;
                    
                    const tdx = target.x - e.x;
                    const tdy = target.y - e.y;
                    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
                    
                    if (tdist <= 60 + target.radius) {
                        target.takeDamage(aoeDamage, false, 0, e.x, e.y, this);
                    }
                }
                
                // Visual effect for AOE
                if (typeof Game !== 'undefined' && Game.effects) {
                    Game.effects.push(new VoidShardAoeEffect(e.x, e.y));
                }
                
                // Only trigger once per crit event
                break;
            }
        }
    }

    getActiveBuffs() {
        // Get all buffs from BuffManager
        const out = this.buffManager.getBuffDisplayData();
        
        // Add legacy buffs that haven't been migrated yet
        
        // Living Armor: Regen to Thorns conversion
        const livingArmorArtifact = this.artifacts.find(a => a.id === 'living_armor' || a.archetypeId === 'living_armor');
        if (livingArmorArtifact?.specialEffect?.regenToThorns) {
            const conversionRate = livingArmorArtifact.specialEffect.thornConversionRate || 0.5;
            const thornsDamage = Math.round((this.stats.regen || 0) * conversionRate * 100);
            if (thornsDamage > 0) {
                out.push({
                    id: 'livingArmorThorns',
                    name: 'Living Thorns',
                    stacks: 0,
                    time: -1,
                    maxTime: -1,
                    description: `+${thornsDamage} thorns from regen`,
                    progress: 1,
                    showProgress: false
                });
            }
        }
        
        // Overdrive enhancement
        if (this.enhancementConfigs.overdrive && this.buffStates.overdrive?.active && this.buffStates.overdrive.time > 0) {
            const cfg = this.enhancementConfigs.overdrive;
            const cooldownBonus = Math.round((cfg.cooldownReduction || 0.5) * 100);
            const damageTaken = Math.round((cfg.damageTakenIncrease || 0.1) * 100);
            out.push({
                id: 'overdrive',
                name: 'Overdrive',
                stacks: 0,
                time: this.buffStates.overdrive.time,
                maxTime: cfg.duration || 300,
                description: `+${cooldownBonus}% CDR, +${damageTaken}% damage taken`,
                progress: this.buffStates.overdrive.time / (cfg.duration || 300)
            });
        }
        

        
        // Berserker Rage
        if (this.enhancementConfigs.berserkerRage) {
            const cfg = this.enhancementConfigs.berserkerRage;
            const hpPercent = this.stats.maxHp > 0 ? (this.hp / this.stats.maxHp) : 1;
            if (hpPercent < (cfg.hpThreshold || 0.3)) {
                const damageBonus = Math.round((cfg.damageBonus || 0.4) * 100);
                const speedBonus = Math.round((cfg.speedBonus || 0.2) * 100);
                out.push({
                    id: 'berserkerRage',
                    name: 'Berserker Rage',
                    stacks: 0,
                    time: -1,
                    maxTime: -1,
                    description: `+${damageBonus}% damage, +${speedBonus}% speed`,
                    progress: 1,
                    showProgress: false
                });
            }
        }
        
        // Last Stand
        if (this.enhancementConfigs.lastStand) {
            const cfg = this.enhancementConfigs.lastStand;
            const hpPercent = this.stats.maxHp > 0 ? (this.hp / this.stats.maxHp) : 1;
            const missingHpPercent = Math.max(0, 100 - (hpPercent * 100));
            const damageBonus = Math.floor(missingHpPercent * (cfg.damagePerMissingHpPct || 0.5));
            if (damageBonus > 0) {
                out.push({
                    id: 'lastStand',
                    name: 'Last Stand',
                    stacks: 0,
                    time: -1,
                    maxTime: -1,
                    description: `+${damageBonus}% damage from missing HP`,
                    progress: 1,
                    showProgress: false
                });
            }
        }
        
        // Chaos Embrace
        if (this.enhancementConfigs.chaosEmbrace && this.buffStates.chaosEmbrace) {
            const state = this.buffStates.chaosEmbrace;
            if (state.buffedStat && state.nerfedStat) {
                out.push({
                    id: 'chaosEmbrace',
                    name: 'Chaos Embrace',
                    stacks: 0,
                    time: -1,
                    maxTime: -1,
                    description: `${state.buffedStat} ↑↑, ${state.nerfedStat} ↓↓`,
                    progress: 1,
                    showProgress: false
                });
            }
        }
        
        // The Hoarder: Artifact Synergy
        if (this.classId === 'the_hoarder' && this.characterClass?.passives?.artifactSynergy) {
            const artifactCount = this.artifacts.length;
            const bonusTiers = Math.floor(artifactCount / 2);
            if (bonusTiers > 0) {
                const rarityBonus = Math.round(bonusTiers * 5);
                const xpBonus = Math.round(bonusTiers * 10);
                out.push({
                    id: 'artifactSynergy',
                    name: 'Artifact Synergy',
                    stacks: bonusTiers,
                    time: -1,
                    maxTime: -1,
                    description: `+${rarityBonus}% rarity, +${xpBonus}% XP`,
                    progress: 1,
                    showProgress: false
                });
            }
        }
        
        // Greed's Echo: Projectiles from Luck
        const greedsEchoArtifact = this.artifacts.find(a => a.id === 'greeds_echo' || a.archetypeId === 'greeds_echo');
        if (greedsEchoArtifact?.specialEffect?.projectilesFromLuck) {
            const luckPerProjectile = greedsEchoArtifact.specialEffect.luckPerProjectile || 0.4;
            const currentRarityFind = this.stats.rarityFind || 0;
            const bonusProjectiles = Math.floor(currentRarityFind / luckPerProjectile);
            if (bonusProjectiles > 0) {
                out.push({
                    id: 'greedsEcho',
                    name: "Greed's Echo",
                    stacks: bonusProjectiles,
                    time: -1,
                    maxTime: -1,
                    description: `+${bonusProjectiles} projectiles from luck`,
                    progress: 1,
                    showProgress: false
                });
            }
        }
        
        // Slowed Prey enhancement
        if (this.enhancementConfigs.slowedPrey || this.effects.damageVsSlowedMult > 1) {
            const mult = this.effects.damageVsSlowedMult || 1;
            if (mult > 1) {
                const bonus = Math.round((mult - 1) * 100);
                out.push({
                    id: 'slowedPrey',
                    name: 'Slowed Prey',
                    stacks: 0,
                    time: -1,
                    maxTime: -1,
                    description: `+${bonus}% vs slowed enemies`,
                    progress: 1,
                    showProgress: false
                });
            }
        }
        
        // Executioner's Mark enhancement
        if (this.enhancementConfigs.executionerMark) {
            const cfg = this.enhancementConfigs.executionerMark;
            const thresholdPercent = Math.round((cfg.hpThreshold || 0.2) * 100);
            const damageBonus = Math.round(((cfg.damageMultiplier || 1.5) - 1) * 100);
            out.push({
                id: 'executionerMark',
                name: "Executioner's Mark",
                stacks: 0,
                time: -1,
                maxTime: -1,
                description: `+${damageBonus}% vs enemies <${thresholdPercent}% HP`,
                progress: 1,
                showProgress: false
            });
        }
        
        // Player Slow debuff from enemies
        if (this.slow && this.slow.time > 0 && this.slow.mult < 1) {
            const slowPercent = Math.round((1 - this.slow.mult) * 100);
            out.push({
                id: 'playerSlow',
                name: 'Slowed',
                stacks: 0,
                time: this.slow.time,
                maxTime: this.slow.time,
                description: `-${slowPercent}% move speed`
            });
        }
        
        return out;
    }

    // Debug helper: returns the full breakdown object for a stat key.
    // Layer 0 is base; higher layers are numeric and intentionally unlabeled.
    getStatBreakdown(statKey) {
        if (!statKey) return null;
        return this.statBreakdowns ? (this.statBreakdowns[statKey] || null) : null;
    }

    getEffectiveCritChance(weapon = null) {
        const w = weapon || this.equipment.weapon;
        
        let base = 0;
        let localMult = 1;

        if (w) {
            const mods = Array.isArray(w.modifiers) ? w.modifiers : [];
            for (const m of mods) {
                if (!m || m.stat !== 'critChance') continue;
                if (m.operation === 'add') base += (Number(m.value) || 0);
                else if (m.operation === 'multiply') localMult *= Player._mult1p(m.value);
            }
        }

        const globalMult = (Number(this.effects.critChanceMult) || 1);
        const bonus = (Number(this.effects.critChanceBonus) || 0);

        // Crit chance is weapon-based: scale weapon crit chance by global multipliers,
        // then apply any remaining additive bonus.
        return Math.max(0, (base * localMult * globalMult) + bonus);
    }

    getBaseCritDamageMult(weapon = null) {
        const w = weapon || this.equipment.weapon;
        if (!w) return 2;
        const mods = (w.modifiers || []).filter(m => m && m.stat === 'critDamageMultBase');
        const base = mods.reduce((acc, curr) => (curr.operation === 'add' ? acc + (curr.value || 0) : acc), 0);
        return (base > 0) ? base : 2;
    }

    heal(amount) {
        if (!amount || amount <= 0) return;
        
        // The Colossus passive: healing amplifier
        let healAmount = amount;
        if (this.classId === 'the_colossus' && this.characterClass?.passives?.healingAmplifier) {
            healAmount *= this.characterClass.passives.healingAmplifier;
        }
        
        // Check for overgrowth seed overheal conversion
        const overgrowthArtifact = this.artifacts.find(a => a.id === 'overgrowth_seed' || a.archetypeId === 'overgrowth_seed');
        if (overgrowthArtifact?.specialEffect?.overhealConversion && this.hp >= this.stats.maxHp) {
            // At max HP, convert 10% of healing to overheal
            const conversionRate = overgrowthArtifact.specialEffect.conversionRate || 0.10;
            const overhealAmount = healAmount * conversionRate;
            this.overheal = Math.min(this.maxOverheal, this.overheal + overhealAmount);
        } else {
            // Normal healing: heal HP first
            const oldHp = this.hp;
            this.hp = Math.min(this.stats.maxHp, this.hp + healAmount);
            
            // If we have overgrowth seed and there's overflow healing, convert some to overheal
            if (overgrowthArtifact?.specialEffect?.overhealConversion) {
                const overflow = (oldHp + healAmount) - this.stats.maxHp;
                if (overflow > 0) {
                    const conversionRate = overgrowthArtifact.specialEffect.conversionRate || 0.10;
                    const overhealAmount = overflow * conversionRate;
                    this.overheal = Math.min(this.maxOverheal, this.overheal + overhealAmount);
                }
            }
        }
        
        Game.ui.updateBars(performance.now(), true);
    }

    getOverhealMultiplier() {
        const overgrowthArtifact = this.artifacts.find(a => a.id === 'overgrowth_seed' || a.archetypeId === 'overgrowth_seed');
        if (overgrowthArtifact?.specialEffect?.maxOverhealMultiplier) {
            return overgrowthArtifact.specialEffect.maxOverhealMultiplier;
        }
        return 1;
    }

    takeDamage(amount) {
        if (window.DevMode?.enabled && window.DevMode?.cheats?.godMode) return;
        
        // Living Armor stacking damage reduction is handled by BuffManager via stats.damageTakenMult
        let mult = this.stats?.damageTakenMult ?? 1;
        
        const final = Math.max(0, amount * mult);
        
        // Deplete overheal first, then HP
        if (this.overheal > 0) {
            if (final >= this.overheal) {
                const remaining = final - this.overheal;
                this.overheal = 0;
                this.hp -= remaining;
            } else {
                this.overheal -= final;
            }
        } else {
            this.hp -= final;
        }
        
        Game.ui.updateBars(performance.now(), true);
        
        // Monolith Core artifact: shockwave on heavy damage
        const monolithArtifact = this.artifacts.find(a => a.id === 'monolith_core' || a.archetypeId === 'monolith_core');
        if (monolithArtifact?.specialEffect?.shockwaveOnHit && this.artifactCooldowns.monolithCore <= 0) {
            const threshold = monolithArtifact.specialEffect.damageThreshold || 500;
            if (final >= threshold) {
                const shockDmg = (this.stats.maxHp || 0) * (monolithArtifact.specialEffect.shockwaveDamagePercent || 2.0);
                const radius = monolithArtifact.specialEffect.shockwaveRadius || 200;
                const healPct = monolithArtifact.specialEffect.healPercent || 0.05;
                
                // Visual shockwave
                if (Game?.effects && typeof AuraEffect !== 'undefined') {
                    Game.effects.push(new AuraEffect(this.x, this.y, radius, '#2ecc71'));
                }
                
                // Damage enemies
                if (Game?.enemies) {
                    for (const e of Game.enemies) {
                        if (!e || e.dead) continue;
                        const dist = RandomUtils.distanceBetween(this.x, this.y, e.x, e.y);
                        if (dist <= radius + e.radius) {
                            e.takeDamage(shockDmg, false, 0, this.x, this.y, this);
                        }
                    }
                }
                
                // Heal player
                this.heal((this.stats.maxHp || 0) * healPct);
                
                // Set cooldown
                this.artifactCooldowns.monolithCore = monolithArtifact.specialEffect.cooldown || 8000;
            }
        }
        
        // Apply thorns damage to nearby enemies
        const thornsDmg = this.stats?.thornsDamage || 0;
        if (thornsDmg > 0 && Game?.enemies) {
            const thornsDamageAmount = final * thornsDmg;
            const thornsRange = 60; // Fixed range for thorns
            for (const e of Game.enemies) {
                if (e.dead) continue;
                const dist = RandomUtils.distanceBetween(this.x, this.y, e.x, e.y);
                if (dist <= thornsRange + e.radius) {
                    e.takeDamage(thornsDamageAmount, false, 0, this.x, this.y, this);
                }
            }
        }
        
        if (this.hp <= 0) {
            // Check for Phoenix Blade resurrection
            const phoenixWeapon = this.equipment.weapon;
            if (phoenixWeapon?.legendaryId === 'phoenix_blade' && phoenixWeapon?.specialEffect?.phoenixRebirth && !this.phoenixUsed) {
                this.phoenixUsed = true;
                this.hp = this.stats.maxHp;
                this.overheal = 0;
                
                // Visual effect
                if (Game?.effects && typeof AuraEffect !== 'undefined') {
                    Game.effects.push(new AuraEffect(this.x, this.y, 150, '#ff6b00'));
                }
                if (Game?.floatingTexts && typeof FloatingText !== 'undefined') {
                    Game.floatingTexts.push(new FloatingText('PHOENIX REBIRTH!', this.x, this.y - 30, '#ff6b00', true));
                }
                
                Game.ui.updateBars(performance.now(), true);
                return;
            }
            
            // Chronomancer: Try Time Reverse before dying
            if (this.classId === 'chronomancer' && this.timeReverseAvailable && this.triggerTimeReverse()) {
                return;
            }
            
            Game.over();
        }
    }

    // Called when an enemy dies (for life on kill, soul harvest, etc.)
    onEnemyKill(enemy) {
        // Life on kill
        const lifeOnKill = this.stats?.lifeOnKill || 0;
        if (lifeOnKill > 0) {
            this.heal(lifeOnKill);
        }
        
        // Soul Harvest enhancement (if active)
        if (this.enhancementConfigs.soulHarvest) {
            const config = this.enhancementConfigs.soulHarvest;
            const buff = this.buffManager.getBuff('soulHarvest');
            const currentStacks = buff ? buff.stacks : 0;
            
            if (currentStacks < config.maxStacks) {
                if (buff) {
                    buff.addStacks(1);
                } else {
                    this.buffManager.applyBuff('soulHarvest');
                }
                this.recalculateStats();
            }
        }
        
        // Vampiric Aura enhancement
        if (this.enhancementConfigs.vampiricAura) {
            const config = this.enhancementConfigs.vampiricAura;
            const dist = RandomUtils.distanceBetween(this.x, this.y, enemy.x, enemy.y);
            if (dist <= config.range) {
                this.heal(config.healAmount);
            }
        }
    }

    equip(item, opts = {}) {
        if (item.type === ItemType.ARTIFACT) {
            this.artifacts.push(item);
            this.recalculateStats();
            Game.ui.updateInventory();
            if (typeof opts.onAfterEquip === 'function') opts.onAfterEquip();
            return;
        }

        let slot = ({
            [ItemType.WEAPON]: 'weapon',
            [ItemType.ARMOR]: 'armor'
        })[item.type] || null;

        if (item.type === ItemType.ACCESSORY) {
            if (!this.equipment.accessory1) slot = 'accessory1';
            else if (!this.equipment.accessory2) slot = 'accessory2';
            else {
                // Player choice for replacement once both slots are filled.
                if (Game?.ui?.promptAccessoryReplace) {
                    Game.ui.promptAccessoryReplace(
                        item,
                        (pickedSlot) => {
                            this.equipment[pickedSlot] = item;
                            this.recalculateStats();
                            Game.ui.updateInventory();
                            if (typeof opts.onAfterEquip === 'function') opts.onAfterEquip();
                        },
                        () => {
                            if (typeof opts.onCancel === 'function') opts.onCancel();
                        }
                    );
                    return;
                }
                // Fallback.
                slot = 'accessory1';
            }
        }

        if (slot) {
            this.equipment[slot] = item;
            this.recalculateStats();
            Game.ui.updateInventory();
            if (typeof opts.onAfterEquip === 'function') opts.onAfterEquip();
        }
    }

    update() {
        const input = Input.getAxis();
        this.x += input.x * this.stats.moveSpeed;
        this.y += input.y * this.stats.moveSpeed;
        
        // Use world dimensions for boundary clamping
        const worldW = window.GameConstants?.WORLD_WIDTH || 2560;
        const worldH = window.GameConstants?.WORLD_HEIGHT || 1440;
        this.x = Math.max(this.radius, Math.min(worldW - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(worldH - this.radius, this.y));

        // Apply regeneration using heal() to support overheal conversion
        let regenAmount = this.stats.regen * 0.25;
        if (this.classId === 'the_colossus' && this.characterClass?.passives?.healingAmplifier) {
            regenAmount *= this.characterClass.passives.healingAmplifier;
        }
        
        // Check if we have overgrowth seed - if so, always apply regen (even at max HP for overheal)
        const hasOvergrowth = this.artifacts.find(a => a.id === 'overgrowth_seed' || a.archetypeId === 'overgrowth_seed');
        if (this.hp < this.stats.maxHp || hasOvergrowth) {
            this.heal(regenAmount);
        }

        // Tick artifact cooldowns (convert ms to frames, assuming 60fps)
        if (this.artifactCooldowns.monolithCore > 0) {
            this.artifactCooldowns.monolithCore -= 16.67; // ~1 frame at 60fps
        }
        if (this.artifactCooldowns.overgrowthSeed > 0) {
            this.artifactCooldowns.overgrowthSeed -= 16.67;
        }

        // Living Armor: gain armor stacks over time
        const livingArmorArtifact = this.artifacts.find(a => a.id === 'living_armor' || a.archetypeId === 'living_armor');
        if (livingArmorArtifact?.specialEffect?.armorStacking) {
            const interval = livingArmorArtifact.specialEffect.armorStackInterval || 1000;
            const maxStacks = livingArmorArtifact.specialEffect.maxArmorStacks || 10;
            this.buffStates.livingArmor.timer += 16.67;
            if (this.buffStates.livingArmor.timer >= interval) {
                this.buffStates.livingArmor.timer = 0;
                
                // Apply via BuffManager
                const buff = this.buffManager.getBuff('livingArmor');
                if (buff) {
                    if (buff.stacks < maxStacks) {
                        buff.addStacks(1);
                        this.recalculateStats();
                    }
                } else {
                    this.buffManager.applyBuff('livingArmor');
                    this.recalculateStats();
                }
            }
        }

        // Overgrowth Seed: permanent HP gain when at max overheal
        const overgrowthArtifact = this.artifacts.find(a => a.id === 'overgrowth_seed' || a.archetypeId === 'overgrowth_seed');
        if (overgrowthArtifact?.specialEffect?.permanentHpGain && this.artifactCooldowns.overgrowthSeed <= 0) {
            if (this.overheal >= this.maxOverheal && this.maxOverheal > 0) {
                const hpGain = overgrowthArtifact.specialEffect.hpGainAmount || 1;
                this.baseStats.maxHp += hpGain;
                this.recalculateStats();
                this.artifactCooldowns.overgrowthSeed = overgrowthArtifact.specialEffect.hpGainInterval || 5000;
                
                // Visual feedback
                if (Game?.effects && typeof FloatingText !== 'undefined') {
                    Game.effects.push(new FloatingText(`+${hpGain} Max HP!`, this.x, this.y - 20, '#2ecc71', false));
                }
            }
        }

        // Chronomancer: Tick time dilation timer
        if (this.timeDilationActive && this.timeDilationTimer > 0) {
            this.timeDilationTimer--;
            if (this.timeDilationTimer <= 0) {
                this.timeDilationActive = false;
            }
        }

        // Chronomancer: Save snapshot every 5 seconds for Time Reverse
        if (this.classId === 'chronomancer' && this.timeReverseAvailable) {
            if ((Game.elapsedFrames % 300) === 0) { // Every 5 seconds
                this.saveTimeReverseSnapshot();
            }
        }

        // Eternity Loop artifact: auto Time Dilation every 60 seconds
        const eternityArtifact = this.artifacts.find(a => 
            (a.id === 'eternity_loop' || a.archetypeId === 'eternity_loop') && a.specialEffect?.autoTimeDilationInterval
        );
        if (eternityArtifact && !this.timeDilationActive) {
            const interval = eternityArtifact.specialEffect.autoTimeDilationInterval;
            const intervalFrames = Math.floor(interval / 16.67);
            if ((Game.elapsedFrames % intervalFrames) === 0 && Game.elapsedFrames > 0) {
                // Trigger mini time dilation
                const miniDuration = eternityArtifact.specialEffect.autoTimeDilationDuration || 1500;
                const durationFrames = Math.floor(miniDuration / 16.67);
                
                this.timeDilationActive = true;
                this.timeDilationTimer = durationFrames;
                
                for (const enemy of Game.enemies) {
                    if (!enemy || enemy.dead) continue;
                    enemy.slow.mult = Math.min(enemy.slow.mult || 1, 0.3);
                    enemy.slow.time = Math.max(enemy.slow.time || 0, durationFrames);
                }
                
                if (Game?.floatingTexts && typeof FloatingText !== 'undefined') {
                    Game.floatingTexts.push(new FloatingText('AUTO DILATION!', this.x, this.y - 30, '#00bcd4', false));
                }
            }
        }

        // Ouroboros Ring: gain stacking buff every minute survived
        const ouroborosArtifact = this.artifacts.find(a => 
            (a.id === 'ouroboros_ring' || a.archetypeId === 'ouroboros_ring') && a.specialEffect?.survivalStacking
        );
        if (ouroborosArtifact) {
            const interval = ouroborosArtifact.specialEffect.stackInterval || 60000;
            const intervalFrames = Math.floor(interval / 16.67);
            const elapsedSeconds = Math.floor(Game.elapsedFrames / 60);
            const expectedStacks = Math.floor(elapsedSeconds / 60); // One stack per minute
            
            if (expectedStacks > this.ouroborosStacks) {
                this.ouroborosStacks = expectedStacks;
                this.recalculateStats();
                
                if (Game?.floatingTexts && typeof FloatingText !== 'undefined') {
                    Game.floatingTexts.push(new FloatingText(`+5% ALL STATS! (x${this.ouroborosStacks})`, this.x, this.y - 30, '#9b59b6', false));
                }
            }
        }

        this.tickBuffs();

        const weapon = this.equipment.weapon;
        if (weapon) {
            this.weaponCooldown--;
            if (this.weaponCooldown <= 0) {
                this.fireWeapon(weapon);
                let baseCd = this.getEffectiveItemStat(weapon, 'cooldown', 60);
                this.weaponCooldown = Math.max(1, baseCd * this.stats.cooldownMult); 
            }
        }
    }

    fireWeapon(weapon) {
        // Clean up lingering orbitals if we swapped weapon behavior.
        if (weapon.behavior !== BehaviorType.ORBITAL && this.activeOrbitals?.length) {
            this.activeOrbitals.forEach(o => o.dead = true);
            this.activeOrbitals = [];
        }

        const getMod = (stat, def) => this.getEffectiveItemStat(weapon, stat, def);

        let baseDmg = getMod('baseDamage', 5);
        let finalDmg = baseDmg * this.stats.damage;
        // Use global projectile count from effects (aggregates weapon base + all item bonuses)
        let count = Math.max(1, Math.floor(this.effects.projectileCount || 1));
        let pierce = Math.floor(getMod('pierce', 0));
        let knockback = getMod('knockback', 0);

        // Greed's Echo artifact: apply damage penalty to projectiles
        const greedsEchoArtifact = this.artifacts.find(a => a.id === 'greeds_echo' || a.archetypeId === 'greeds_echo');
        if (greedsEchoArtifact?.specialEffect?.projectilesFromLuck) {
            const damagePenalty = greedsEchoArtifact.specialEffect.projectileDamagePenalty || 0.15;
            finalDmg *= (1 - damagePenalty);
        }

        let isCrit = false;

        // Crit is weapon-based.
        // Over-crit: critChance > 100% guarantees crit and scales crit damage further.
        const critChance = this.getEffectiveCritChance(weapon);

        let baseCritMult = this.getBaseCritDamageMult(weapon);
        if (this.effects.critDamageMult && this.effects.critDamageMult > 0) {
            baseCritMult = Math.max(baseCritMult, this.effects.critDamageMult);
        }

        // Over-crit: guarantee crit at 100%+, but apply diminishing returns beyond that.
        // This keeps crit stacking fun while preventing infinite runaway scaling.
        const overCrit = Math.max(0, critChance - 1);
        const overCritEffective = overCrit / (1 + overCrit);
        const critMult = baseCritMult * (1 + overCritEffective);

        if (critChance >= 1 || Math.random() < critChance) {
            finalDmg *= critMult;
            isCrit = true;
        }
        
        // Shadow Stalker passive: damage multipliers based on crit success
        if (this.classId === 'shadow_stalker' && this.characterClass?.passives) {
            if (isCrit && this.characterClass.passives.critDamageBonus) {
                finalDmg *= this.characterClass.passives.critDamageBonus;
            } else if (!isCrit && this.characterClass.passives.nonCritDamagePenalty) {
                finalDmg *= this.characterClass.passives.nonCritDamagePenalty;
            }
        }

        if (isCrit) {
            this.onCritEvent();
        }

        if (weapon.behavior === BehaviorType.AURA) {
            let range = getMod('areaOfEffect', 50) + this.stats.areaOfEffect;
            const wid = weapon?.legendaryId || weapon?.archetypeId || '';
            const auraColor = ({
                ember_lantern: '#e67e22',
                frost_censer: '#85c1e9',
                storm_totem: '#f4d03f'
            })[wid] ?? '#ffffff';
            Game.effects.push(new AuraEffect(this.x, this.y, range, auraColor));
            const kb = knockback + (this.effects.knockbackOnHitBonus || 0);
            const rrBase = range;
            const px = this.x;
            const py = this.y;
            for (let i = 0, n = Game.enemies.length; i < n; i++) {
                const e = Game.enemies[i];
                if (!e || e.dead) continue;
                const dx = e.x - px;
                const dy = e.y - py;
                const rr = rrBase + (e.radius || 0);
                if ((dx * dx + dy * dy) < (rr * rr)) {
                    e.takeDamage(finalDmg, isCrit, kb, px, py, this);
                }
            }
        } else if (weapon.behavior === BehaviorType.ORBITAL) {
            // Recreate orbitals each swing so stats always match current rolls.
            if (this.activeOrbitals?.length) {
                this.activeOrbitals.forEach(o => o.dead = true);
                this.activeOrbitals = [];
            }

            const projSpeed = getMod('projSpeed', 8);
            const angularSpeed = Math.max(0.02, Math.min(0.12, 0.04 + (projSpeed - 6) * 0.006));

            const aoe = getMod('areaOfEffect', 50) + (this.stats.areaOfEffect || 0);
            const orbitRadius = Math.max(22, Math.round(aoe * 0.65));

            const baseCd = getMod('cooldown', 60);
            const lifeMult = (this.effects.orbitalLifeMult && this.effects.orbitalLifeMult > 0) ? this.effects.orbitalLifeMult : 1;
            const life = Math.max(20, Math.floor(baseCd * (this.stats.cooldownMult || 1) * lifeMult));

            const kb = knockback + (this.effects.knockbackOnHitBonus || 0);
            const hitEvery = 12;

            const n = Math.max(1, count + (this.effects.orbitalCountBonus || 0));
            for (let i = 0; i < n; i++) {
                const ang = (i / n) * Math.PI * 2;
                const styleId = weapon?.legendaryId || weapon?.archetypeId || weapon?.name || 'default';
                const o = new OrbitalProjectile(this, orbitRadius, ang, angularSpeed, finalDmg, isCrit, kb, life, hitEvery, { styleId });
                Game.projectiles.push(o);
                this.activeOrbitals.push(o);
            }
        } else if (weapon.behavior === BehaviorType.PROJECTILE) {
            let nearest = null;
            let minDst2 = Infinity;
            const px = this.x;
            const py = this.y;
            for (let i = 0, n = Game.enemies.length; i < n; i++) {
                const e = Game.enemies[i];
                if (!e || e.dead) continue;
                const dx = e.x - px;
                const dy = e.y - py;
                const d2 = dx * dx + dy * dy;
                if (d2 < minDst2) { minDst2 = d2; nearest = e; }
            }

            if (nearest) {
                let speed = getMod('projSpeed', 8);
                const dx = nearest.x - this.x;
                const dy = nearest.y - this.y;
                const angle = Math.atan2(dy, dx);

                for (let i = 0; i < count; i++) {
                    let spreadAngle = 0;
                    if (count > 1) {
                        spreadAngle = (i - (count-1)/2) * 0.2; 
                    }
                    const vx = Math.cos(angle + spreadAngle) * speed;
                    const vy = Math.sin(angle + spreadAngle) * speed;
                    const styleId = weapon?.legendaryId || weapon?.archetypeId || weapon?.name || 'default';
                    Game.projectiles.push(new Projectile(this.x, this.y, vx, vy, finalDmg, isCrit, pierce, knockback, this, 'enemy', { styleId }));
                }
            }
        }
    }

    gainXp(amount) {
        const mult = this.stats?.xpGain ?? 1;
        this.xp += amount * 1.25 * mult;
        if (this.xp >= this.nextLevelXp) this.levelUp();
        Game.ui.updateBars(performance.now(), true);
    }

    levelUp() {
        this.level++;
        this.xp = 0;
        this.nextLevelXp = Math.floor(this.nextLevelXp * 1.4);
        
        // Reset Soul Harvest stacks on level up
        if (this.enhancementConfigs.soulHarvest) {
            this.buffManager.removeBuff('soulHarvest');
            this.recalculateStats();
        }

        if (typeof Game !== 'undefined' && Game?.onPlayerLevelUp) {
            Game.onPlayerLevelUp(this.level);
        }
        Game.triggerLevelUp();
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
}
