class Player extends Entity {
    constructor(classId = null, traitId = null) {
        // Use world dimensions for initial position
        const worldW = window.GameConstants?.WORLD_WIDTH || 2560;
        const worldH = window.GameConstants?.WORLD_HEIGHT || 1440;
        
        super(worldW / 2, worldH / 2, 16, '#3498db');
        
        // Load character class
        this.classId = classId;
        this.characterClass = classId && window.CharacterArchetypes ? window.CharacterArchetypes[classId] : null;
        if (this.characterClass?.color) {
            this.color = this.characterClass.color;
        }
        
        // Load starting trait
        this.traitId = traitId;
        this.startingTrait = traitId && window.TraitDefinitions ? window.TraitDefinitions[traitId] : null;
        
        this.equipment = { weapon: null, armor: null, accessory1: null, accessory2: null };
        this.artifacts = [];
        this.acquiredArtifactIds = new Set(); // Track all owned artifact archetype IDs for deduplication
        
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
            damageVariance: 0,
            critDamage: 2
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
        this.activeBeams = [];
        this.affixTokens = 0;
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
            critAscension: null
        };

        this.buffStates = {
            staticCharge: { distance: 0, charged: false },
            soulHarvest: { stacks: 0 },
            overdrive: { hits: 0, active: false, time: 0 },
            chaosEmbrace: { timer: 0, buffedStat: null, nerfedStat: null },
            livingArmor: { timer: 0 }
        };

        // Player debuffs from enemies (Inherited from Entity: slow, freeze)
        // Additional debuffs can be added here if needed

        // Overheal system (for the_colossus)
        this.overheal = 0;
        this.maxOverheal = 0;

        // Artifact cooldowns
        this.artifactCooldowns = {
            monolithCore: 0,
            overgrowthSeed: 0,
            shadowCloak: 0,
            aegisImmortal: 0
        };
        
        this.aegisAccumulatedDamage = 0;

        // Mortuary Plate tracking
        this.mortuaryPlateMaxHp = 0;
        this.soulKillCount = 0;

        // Turret system (Automata)
        this.turrets = [];
        this.turretAngle = 0;
        this.turretCooldowns = [0, 0];

        // Permanent stat boosts from "Consume Essence"
        this.essenceStats = {
            maxHp: 0,
            damage: 0
        };
        
        // Shop refresh stacks (for merchant_affinity trait)
        this.shopRefreshStacks = 0;
        
        // Blood Pact trait - permanent max HP gains (resets on death)
        this.bloodPactMaxHp = 0;

        // Count of revives consumed during this run
        this.revivesUsed = 0;
        
        // Initialize buff management system
        this.buffManager = new BuffManager(this);
        
        // Load buff definitions if available
        if (window.BuffDefinitions) {
            this.buffManager.registerBuffDefinitions(window.BuffDefinitions);
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

    hasPassive(passiveName) {
        return this.characterClass?.passives?.[passiveName] !== undefined;
    }

    getPassive(passiveName, defaultValue = 1) {
        return this.characterClass?.passives?.[passiveName] ?? defaultValue;
    }

    consumeEssence() {
        const prize = window.GameConstants?.ESSENCE_PRIZE || { maxHp: 5, damage: 0.02 };
        this.essenceStats.maxHp += prize.maxHp || 0;
        this.essenceStats.damage += prize.damage || 0;
        this.recalculateStats();
        
        if (window.Game?.ui) {
            const essenceMult = this.effects?.essenceBoostMult || 1;
            const hpGain = (prize.maxHp || 0) * essenceMult;
            const dmgGain = (prize.damage || 0) * essenceMult;
            console.log(`Essence Consumed: +${hpGain} HP, +${Math.round(dmgGain * 100)}% Damage`);

            if (window.Game.floatingTexts && typeof window.FloatingText === 'function') {
                const color = essenceMult > 1 ? '#f1c40f' : '#8e44ad';
                const prefix = essenceMult > 1 ? 'EMPOWERED: ' : '';
                window.Game.floatingTexts.push(new window.FloatingText(
                    `${prefix}+${hpGain} HP, +${Math.round(dmgGain * 100)}% DMG`,
                    this.x, this.y - 20, color, true
                ));
            }
        }
    }

    getEffectiveItemStat(   item, stat, def = 0) {
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
            this.stats = { ...this.baseStats };
            return;
        }

        const Stat = window.StatCalculator.Stat;
        const statObjs = {};
        for (const [k, v] of Object.entries(this.baseStats)) {
            statObjs[k] = new Stat(v);
        }
        
        // Ensure critical stats are initialized as Stat objects
        if (!statObjs.critChance) statObjs.critChance = new Stat(0);
        if (!statObjs.critDamage) {
            const weaponBaseCrit = this.getBaseCritDamageMult(this.equipment.weapon);
            statObjs.critDamage = new Stat(weaponBaseCrit);
        }

        // Apply Blood Pact permanent max HP gains
        if (this.bloodPactMaxHp > 0) {
            statObjs.maxHp.addModifier({ layer: 0, operation: 'add', value: this.bloodPactMaxHp, source: 'blood_pact', name: 'Blood Pact' });
        }

        // Apply Mortuary Plate permanent gains
        if (this.mortuaryPlateMaxHp > 0) {
            statObjs.maxHp.addModifier({ layer: 0, operation: 'add', value: this.mortuaryPlateMaxHp, source: 'mortuary_plate', name: 'Mortuary Plate' });
        }

        this.stats = { ...this.baseStats };
        this.statBreakdowns = {};
        const items = [...Object.values(this.equipment).filter(i => i !== null), ...this.artifacts];

        // Effects + special/global modifiers.
        this.effects = EffectUtils.createDefaultEffects();
        this.effects.aoeOnCrit = 0;

        // Merge innate character effects
        if (this.characterClass?.specialEffect) {
            EffectUtils.mergeEffects(this.effects, this.characterClass.specialEffect);
        }

        let bestCritMomentum = null;

        items.forEach(item => {
            const mods = Array.isArray(item?.modifiers) ? item.modifiers : [];
            const isWeapon = item?.type === ItemType.WEAPON;

            for (const mod of mods) {
                if (!mod) continue;

                // Modifiers and Passives filtering
                let modValue = mod.value;
                if (this.classId === 'shadow_stalker' && 
                    this.characterClass?.passives?.critChanceDoubling &&
                    (mod.stat === 'critChance' || mod.stat === 'critChanceBonus')) {
                    modValue = (Number(mod.value) || 0) * 2;
                }
                if (this.classId === 'the_colossus' &&
                    this.characterClass?.passives?.vitalityBoost &&
                    (mod.stat === 'maxHp' || mod.stat === 'regen') &&
                    mod.source !== 'base') {
                    modValue = (Number(mod.value) || 0) * this.characterClass.passives.vitalityBoost;
                }
                if (this.classId === 'the_hoarder' &&
                    this.characterClass?.passives?.gearSpecialist) {
                    modValue = (Number(mod.value) || 0) * (Number(this.characterClass.passives.gearSpecialist) || 1);
                }

                const layer = Player._defaultLayerForModifier(mod);

                // Check standard stats
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
                
                // Unified Stat Mapping
                if (mod.stat === 'critChance' || mod.stat === 'critChanceBonus') {
                    statObjs.critChance.addModifier({
                        layer,
                        operation: mod.operation || 'add',
                        value: modValue,
                        source: mod.source,
                        stat: 'critChance',
                        name: mod.name
                    });
                    continue;
                }
                
                let legacyKey = mod.stat;
                if (legacyKey === 'critDamageMult') legacyKey = 'critDamage';
                if (statObjs[legacyKey] !== undefined) {
                    statObjs[legacyKey].addModifier({
                        layer,
                        operation: mod.operation || 'add',
                        value: modValue,
                        source: mod.source,
                        stat: 'critDamage',
                        name: mod.name
                    });
                    continue;
                }

                // Effect keys (fallthrough)
                if (this.effects[mod.stat] !== undefined) {
                    if (mod.operation === 'add') {
                        this.effects[mod.stat] += (Number(modValue) || 0);
                    } else if (mod.operation === 'multiply') {
                        this.effects[mod.stat] *= Player._mult1p(modValue);
                    }
                    continue;
                }
                
                // Special Fallback for weapon effects (critChanceMult on non-weapons)
                if (!isWeapon) {
                     // If it's a multiplier for crit chance, we can map it to layer 2 (multiply) of critChance stat
                    if (mod.stat === 'critChanceMult') {
                        statObjs.critChance.addModifier({
                            layer: 2, 
                            operation: 'multiply', 
                            value: modValue, 
                            source: mod.source, 
                            stat: 'critChance', 
                            name: mod.name 
                        });
                    }
                }
            }

            // Weapon Effects, etc.
            if (item?.specialEffect) {
                const fx = item.specialEffect.effects || item.specialEffect;
                if (fx) EffectUtils.mergeEffects(this.effects, fx);
            }
            if (Array.isArray(item?.affixes)) {
                for (const affix of item.affixes) {
                    if (affix?.effect) EffectUtils.mergeEffects(this.effects, affix.effect);
                }
            }
            if (item?.enhancement) {
                if (item.enhancement.effects) EffectUtils.mergeEffects(this.effects, item.enhancement.effects);
                const kind = item.enhancement.kind;
                const cfg = item.enhancement.config;
                if (kind === 'critMomentum' && cfg) {
                     const c = {
                        damagePerStack: Number(cfg.damagePerStack) || 0.05,
                        duration: Math.max(1, Number(cfg.duration) || 600),
                        maxStacks: Math.max(1, Math.floor(Number(cfg.maxStacks) || 3))
                    };
                    if (!bestCritMomentum) bestCritMomentum = c;
                    else if ((c.damagePerStack || 0) > (bestCritMomentum.damagePerStack || 0)) bestCritMomentum.damagePerStack = c.damagePerStack;
                    // Store in enhancementConfigs so onCritEvent can find it
                    this.enhancementConfigs[kind] = c;
                } else if (kind && cfg) {
                    this.enhancementConfigs[kind] = cfg;
                    if (kind === 'executionerMark') {
                        this.effects.executeBelowPct = Number(cfg.hpThreshold) || 0.25;
                        this.effects.executeDamageMult = Number(cfg.damageMultiplier) || 1.5;
                    }
                }
            }
        });

        EffectUtils.clampEffects(this.effects);

        // --- Permanent Boosts & Traits ---

        // Essence
        const essenceMult = this.effects.essenceBoostMult || 1;
        if (this.essenceStats.maxHp > 0) {
            statObjs.maxHp.addModifier({ layer: 0, operation: 'add', value: this.essenceStats.maxHp * essenceMult, source: 'essence', name: essenceMult > 1 ? 'Empowered Essence' : 'Essence' });
        }
        if (this.essenceStats.damage > 0) {
            statObjs.damage.addModifier({ layer: 0, operation: 'multiply', value: this.essenceStats.damage * essenceMult, source: 'essence', name: essenceMult > 1 ? 'Empowered Essence' : 'Essence' });
        }

        // Apply starting trait modifiers
        if (this.startingTrait?.modifiers) {
            for (const mod of this.startingTrait.modifiers) {
                if (!mod || !mod.stat) continue;
                
                let target = statObjs[mod.stat];
                if (!target) {
                     if (mod.stat === 'critChance') target = statObjs.critChance;
                     else if (mod.stat === 'critDamage') target = statObjs.critDamage;
                }

                if (target) {
                    target.addModifier({
                        layer: mod.layer || 1,
                        operation: mod.operation || 'add',
                        value: mod.value || 0,
                        source: 'trait',
                        name: this.startingTrait.name
                    });
                }
            }
        }
        
        // --- Pass 3: Intermediate Calculation for Passives ---
        
        // Behemoth passive: Titan Might
        if (this.classId === 'the_colossus' && this.characterClass?.passives?.titanMight) {
            const currentMaxHp = statObjs.maxHp.calculate(); 
            const stacks = Math.floor(currentMaxHp / 100);
            
            if (stacks > 0) {
                statObjs.damage.addModifier({
                    layer: 3, operation: 'multiply', value: stacks * 0.10, source: 'passive', stat: 'damage', name: `Titan Might (x${stacks})`
                });
                const buff = this.buffManager.getBuff('titanMight');
                if (buff) buff.stacks = stacks;
                else this.buffManager.applyBuff('titanMight', { stacks: stacks });
                
            } else {
                this.buffManager.removeBuff('titanMight');
            }
        }
        
        // Plunderer passive: artifactSynergy
        if (this.classId === 'the_hoarder' && this.characterClass?.passives?.artifactSynergy) {
             const artifactCount = this.artifacts.length;
             const bonusTiers = Math.floor(artifactCount / 2);
             if (bonusTiers > 0) {
                 statObjs.rarityFind.addModifier({ layer: 3, operation: 'add', value: bonusTiers * 0.05, source: 'passive', name: 'Artifact Synergy' });
                 statObjs.xpGain.addModifier({ layer: 3, operation: 'multiply', value: bonusTiers * 0.10, source: 'passive', name: 'Artifact Synergy' });
             }
        }

        // --- Pass 4: Apply Buffs (Last) ---
        this.buffManager.applyModifiers(statObjs);

        // --- Finalize ---
        
        // Starting Trait Special (All Rounder)
        if (this.startingTrait?.specialEffect) {
            const effect = this.startingTrait.specialEffect;
            if (effect.type === 'flat_crit_bonus' && effect.critChance) {
                 statObjs.critChance.addModifier({
                     layer: 3, operation: 'add', value: Number(effect.critChance) || 0, source: 'trait', name: 'All Rounder'
                 });
            }
        }

        // Midas Scaling
        if (this.effects.damagePerLevel > 0) {
            const level = this.level || 1;
            statObjs.damage.addModifier({ layer: 3, operation: 'multiply', value: this.effects.damagePerLevel * level, source: 'midas_gilded_band', name: 'Midas Scaling' });
        }

        // Eye of the Duelist: Crit Damage to Crit Chance
        if (this.effects.critDamageToCritChance > 0) {
            const totalCritDmg = statObjs.critDamage.calculate();
            const bonusChance = totalCritDmg * this.effects.critDamageToCritChance;
            statObjs.critChance.addModifier({ layer: 3, operation: 'add', value: bonusChance, source: 'eye_of_duelist', name: 'Eye of the Duelist' });
        }

        // Finalize numeric stat values + breakdowns
        for (const [k, s] of Object.entries(statObjs)) {
            const breakdown = s.getBreakdown();
            this.stats[k] = breakdown.final;
            this.statBreakdowns[k] = breakdown;
        }

        // Apply player slow debuff from enemies
        if (this.slow && this.slow.time > 0) {
            this.stats.moveSpeed = (this.stats.moveSpeed || 0) * this.slow.mult;
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
        
        // Thorns Mastery: Double thorns damage
        if (this.enhancementConfigs.thornsMastery) {
            const mult = this.enhancementConfigs.thornsMastery.thornsMult || 2.0;
            this.stats.thornsDamage = (this.stats.thornsDamage || 0) * mult;
        }

        // Update max overheal capacity
        let overhealMult = this.getOverhealMultiplier();
        if (this.effects.healingToShieldConversion > 0) {
            // If shield conversion is active, ensure at least 100% Max HP as shield capacity
            if (overhealMult < 2) overhealMult = 2;
        }
        this.maxOverheal = this.stats.maxHp * (overhealMult - 1);

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
        
        // Update conditional buffs based on game state
        this.updateConditionalBuffs();
        
        // Legacy slow system (will be migrated to BuffManager later)
        if (this.slow && this.slow.time > 0) {
            this.slow.time--;
            if (this.slow.time <= 0) {
                this.slow.time = 0;
                this.slow.mult = 1;
                this.slow.stacks = 0;
                this.recalculateStats();
            }
        }
    }

    updateConditionalBuffs() {
        // Berserker Rage: active when HP < threshold
        if (this.enhancementConfigs.berserkerRage) {
            const cfg = this.enhancementConfigs.berserkerRage;
            const hpPercent = this.stats.maxHp > 0 ? (this.hp / this.stats.maxHp) : 1;
            const isActive = hpPercent < (cfg.hpThreshold || 0.30);
            
            if (isActive && !this.buffManager.getBuff('berserkerRage')) {
                this.buffManager.applyBuff('berserkerRage');
                this.recalculateStats();
            } else if (!isActive && this.buffManager.getBuff('berserkerRage')) {
                this.buffManager.removeBuff('berserkerRage');
                this.recalculateStats();
            }
        }
        
        // Last Stand: damage applied directly in fireWeapon() - no buff needed
        // Visual indicator still shown via getBuffsAsArray()
        
        // Living Armor Thorns: show when artifact is active
        const livingArmorArtifact = this.artifacts.find(a => a.id === 'living_armor' || a.archetypeId === 'living_armor');
        if (livingArmorArtifact?.specialEffect?.regenToThorns) {
            const conversionRate = livingArmorArtifact.specialEffect.thornConversionRate || 0.5;
            const thornsDamage = (this.stats.regen || 0) * conversionRate * 100;
            
            if (thornsDamage > 0 && !this.buffManager.getBuff('livingArmorThorns')) {
                this.buffManager.applyBuff('livingArmorThorns');
            } else if (thornsDamage <= 0 && this.buffManager.getBuff('livingArmorThorns')) {
                this.buffManager.removeBuff('livingArmorThorns');
            }
        } else if (this.buffManager.getBuff('livingArmorThorns')) {
            this.buffManager.removeBuff('livingArmorThorns');
        }
        
        // Slowed Prey: show when enhancement is active
        if (this.enhancementConfigs.slowedPrey || this.effects.damageVsSlowedMult > 1) {
            if (!this.buffManager.getBuff('slowedPrey')) {
                this.buffManager.applyBuff('slowedPrey');
            }
        } else if (this.buffManager.getBuff('slowedPrey')) {
            this.buffManager.removeBuff('slowedPrey');
        }
        
        // Executioner's Mark: show when enhancement is active
        if (this.enhancementConfigs.executionerMark) {
            if (!this.buffManager.getBuff('executionerMark')) {
                this.buffManager.applyBuff('executionerMark');
            }
        } else if (this.buffManager.getBuff('executionerMark')) {
            this.buffManager.removeBuff('executionerMark');
        }
        
        // Glass Soul: show when enhancement is active
        if (this.enhancementConfigs.glassSoul) {
            if (!this.buffManager.getBuff('glassSoul')) {
                const cfg = this.enhancementConfigs.glassSoul;
                this.buffManager.applyBuff('glassSoul', {
                    modifiers: [
                        {
                            stat: 'damage',
                            operation: 'multiply',
                            value: cfg.damageDealtMult || 0.60,
                            layer: 3
                        },
                        {
                            stat: 'damageTakenMult',
                            operation: 'multiply',
                            value: cfg.damageTakenMult || 0.30,
                            layer: 3
                        }
                    ]
                });
                this.recalculateStats();
            }
        } else if (this.buffManager.getBuff('glassSoul')) {
            this.buffManager.removeBuff('glassSoul');
            this.recalculateStats();
        }
        
        // Vampiric Aura: show when enhancement is active
        if (this.enhancementConfigs.vampiricAura) {
            if (!this.buffManager.getBuff('vampiricAura')) {
                this.buffManager.applyBuff('vampiricAura');
            }
        } else if (this.buffManager.getBuff('vampiricAura')) {
            this.buffManager.removeBuff('vampiricAura');
        }
        
        // Thorns Mastery: show when enhancement is active
        if (this.enhancementConfigs.thornsMastery) {
            if (!this.buffManager.getBuff('thornsMastery')) {
                this.buffManager.applyBuff('thornsMastery');
            }
        } else if (this.buffManager.getBuff('thornsMastery')) {
            this.buffManager.removeBuff('thornsMastery');
        }
        
        // Static Charge: Visual indicator managed dynamically in update() when charged
        
        // Overdrive: tick down timer
        if (this.buffStates.overdrive?.active && this.buffStates.overdrive.time > 0) {
            this.buffStates.overdrive.time--;
            if (this.buffStates.overdrive.time <= 0) {
                this.buffStates.overdrive.active = false;
                this.buffManager.removeBuff('overdrive');
                this.recalculateStats();
            }
        }
        
        // Chaos Embrace: tick timer and shuffle stats
        if (this.enhancementConfigs.chaosEmbrace && this.buffStates.chaosEmbrace) {
            this.buffStates.chaosEmbrace.timer++;
            const cfg = this.enhancementConfigs.chaosEmbrace;
            const interval = cfg.intervalFrames || 1800;
            
            if (this.buffStates.chaosEmbrace.timer >= interval) {
                this.buffStates.chaosEmbrace.timer = 0;
                this.shuffleChaosEmbraceStats();
            }
        }
    }

    shuffleChaosEmbraceStats() {
        const cfg = this.enhancementConfigs.chaosEmbrace;
        if (!cfg) return;
        
        const affectedStats = cfg.affectedStats || ['damage', 'moveSpeed', 'cooldownMult'];
        const buffedStat = affectedStats[Math.floor(Math.random() * affectedStats.length)];
        let nerfedStat = affectedStats[Math.floor(Math.random() * affectedStats.length)];
        while (nerfedStat === buffedStat && affectedStats.length > 1) {
            nerfedStat = affectedStats[Math.floor(Math.random() * affectedStats.length)];
        }
        
        this.buffStates.chaosEmbrace.buffedStat = buffedStat;
        this.buffStates.chaosEmbrace.nerfedStat = nerfedStat;
        
        if (this.buffManager.getBuff('chaosEmbrace')) {
            this.buffManager.removeBuff('chaosEmbrace');
        }
        
        // Apply buff with dynamic modifiers based on shuffled stats
        this.buffManager.applyBuff('chaosEmbrace', {
            modifiers: [
                {
                    stat: buffedStat,
                    operation: 'multiply',
                    value: 1.0, // +100% (doubles the stat)
                    layer: 3
                },
                {
                    stat: nerfedStat,
                    operation: 'multiply',
                    value: -0.5, // -50% (halves the stat)
                    layer: 3
                }
            ]
        });
        this.recalculateStats();
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
                        target.takeDamage(aoeDamage, false, 0, e.x, e.y, this, { isIndirect: true });
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
        // Get all buffs from BuffManager - centralized system handles everything now
        const out = this.buffManager.getBuffDisplayData();
        
        // Last Stand: Show current damage bonus from missing HP
        if (this.enhancementConfigs.lastStand) {
            const cfg = this.enhancementConfigs.lastStand;
            const hpPercent = this.stats.maxHp > 0 ? (this.hp / this.stats.maxHp) : 1;
            const missingHpPercent = Math.max(0, 1 - hpPercent);
            const damageBonus = missingHpPercent * (cfg.damagePerMissingHpPct || 0.5);
            
            if (damageBonus > 0.01) {
                const bonusPercent = Math.round(damageBonus * 100);
                out.push({
                    id: 'lastStand',
                    name: 'Last Stand',
                    stacks: 0,
                    time: -1,
                    maxTime: -1,
                    description: `+${bonusPercent}% damage`,
                    progress: 1,
                    showProgress: false
                });
            }
        }
        
        // Plunderer: Artifact Synergy
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

    /**
     * Helper for the Crit Tier system.
     * Returns the current tier, progress toward next tier, and visual info.
     */
    getCritTierInfo() {
        const critChance = this.getEffectiveCritChance();
        const baseTier = Math.floor(critChance);
        const chanceForNext = critChance % 1;
        
        // Tier 1 starts at 0-100%, Tier 2 at 100-200%, etc.
        // We display the "current potential" tier.
        const currentTierNum = Math.min(baseTier + 1, GameConstants.CRIT_TIERS.MAX);
        const nextTierNum = Math.min(currentTierNum + 1, GameConstants.CRIT_TIERS.MAX);
        
        const tierData = GameConstants.CRIT_TIERS[currentTierNum] || GameConstants.CRIT_TIERS[1];
        const nextTierData = GameConstants.CRIT_TIERS[nextTierNum] || GameConstants.CRIT_TIERS[GameConstants.CRIT_TIERS.MAX];

        return {
            critChance: critChance,
            baseTier: baseTier,
            chanceForNext: chanceForNext,
            currentTierNum: currentTierNum,
            nextTierNum: nextTierNum,
            tierData: tierData,
            nextTierData: nextTierData,
            isMax: baseTier >= GameConstants.CRIT_TIERS.MAX - 1
        };
    }

    getBaseCritDamageMult(weapon = null) {
        const w = weapon || this.equipment.weapon;
        if (!w) return 2;
        const mods = (w.modifiers || []).filter(m => m && m.stat === 'critDamageMultBase');
        const base = mods.reduce((acc, curr) => (curr.operation === 'add' ? acc + (curr.value || 0) : acc), 0);
        return (base > 0) ? base : 2;
    }

    getLastStandDamageMultiplier() {
        if (!this.enhancementConfigs.lastStand) return 1;
        
        const cfg = this.enhancementConfigs.lastStand;
        const hpPercent = this.stats.maxHp > 0 ? (this.hp / this.stats.maxHp) : 1;
        const missingHpPercent = Math.max(0, 1 - hpPercent);
        const damageBonus = missingHpPercent * (cfg.damagePerMissingHpPct || 0.5);
        
        return 1 + damageBonus;
    }

    heal(amount) {
        if (!amount || amount <= 0) return;
        
        // Behemoth passive: healing amplifier
        let healAmount = amount;
        if (this.classId === 'the_colossus' && this.characterClass?.passives?.healingAmplifier) {
            healAmount *= this.characterClass.passives.healingAmplifier;
        }

        // Aegis / Legendary Effect: Healing to Shield Conversion
        if (this.effects.healingToShieldConversion > 0) {
            // Ensure we have capacity for shields (at least equal to Max HP)
            if (this.maxOverheal < this.stats.maxHp) {
                this.maxOverheal = this.stats.maxHp;
            }
            
            const shieldAmt = healAmount * this.effects.healingToShieldConversion;
            this.overheal = Math.min(this.maxOverheal, this.overheal + shieldAmt);
            
            // Reduce the healing amount by the converted amount
            healAmount -= shieldAmt;
        }
        
        // Check for overheal conversion effects in merged effects
        const hasOvergrowth = this.effects.overhealConversion;
        const hasMortuary = this.effects.doubleOverheal;

        if ((hasOvergrowth || hasMortuary) && this.hp >= this.stats.maxHp) {
            // At max HP, convert healing to overheal
            // Mortuary Plate converts 100%, Overgrowth converts whatever its rate is (default 10%)
            const conversionRate = hasMortuary ? 1.0 : (this.effects.conversionRate || 0.10);
            const overhealAmount = healAmount * conversionRate;
            this.overheal = Math.min(this.maxOverheal, this.overheal + overhealAmount);
        } else {
            // Normal healing: heal HP first
            const oldHp = this.hp;
            this.hp = Math.min(this.stats.maxHp, this.hp + healAmount);
            
            // If overflow healing, convert some to overheal
            if (hasOvergrowth || hasMortuary) {
                const overflow = (oldHp + healAmount) - this.stats.maxHp;
                if (overflow > 0) {
                    const conversionRate = hasMortuary ? 1.0 : (this.effects.conversionRate || 0.10);
                    const overhealAmount = overflow * conversionRate;
                    this.overheal = Math.min(this.maxOverheal, this.overheal + overhealAmount);
                }
            }
        }
        
        Game.ui.updateBars(performance.now(), true);
    }

    getOverhealMultiplier() {
        if (this.effects.maxOverhealMultiplier) {
            return this.effects.maxOverhealMultiplier;
        }
        
        // Mortuary Plate effect from merged effects
        if (this.effects.doubleOverheal) {
            return 2.0;
        }

        return 1;
    }

    takeDamage(amount, attacker = null, meta = {}) {
        if (window.DevMode?.enabled && window.DevMode?.cheats?.godMode) return;
        
        // Shadow Cloak artifact: invulnerability on damage with cooldown
        const shadowCloakArtifact = this.artifacts.find(a => 
            a.id === 'shadow_cloak' || a.archetypeId === 'shadow_cloak'
        );
        if (shadowCloakArtifact?.specialEffect?.invulnerabilityOnHit) {
            if (!this.artifactCooldowns) this.artifactCooldowns = {};
            if (!this.artifactCooldowns.shadowCloak || this.artifactCooldowns.shadowCloak <= 0) {
                // Apply invulnerability buff
                this.buffManager.applyBuff('shadowCloak');
                this.recalculateStats();
                
                // Set cooldown
                this.artifactCooldowns.shadowCloak = shadowCloakArtifact.specialEffect.cooldown || 15000;
                
                // Visual effect
                if (Game?.effects && typeof AuraEffect !== 'undefined') {
                    Game.effects.push(new AuraEffect(this.x, this.y, 80, '#7c4dff'));
                }
                
                return; // Take no damage
            }
        }

        // Apply knockback to attacker (Retaliation)
        if (attacker && !attacker.dead && attacker.x !== undefined && attacker.y !== undefined) {
            const kbBase = 15;
            const kbBonus = this.stats.knockback || 0;
            const totalKb = kbBase + kbBonus;
            
            const dx = attacker.x - this.x;
            const dy = attacker.y - this.y;
            const dist = Math.hypot(dx, dy) || 1;
            
            // Apply velocity impulse
            attacker.vx += (dx / dist) * totalKb;
            attacker.vy += (dy / dist) * totalKb;
        }
        
        // Living Armor stacking damage reduction is handled by BuffManager via stats.damageTakenMult
        let mult = this.stats?.damageTakenMult ?? 1;
        
        const final = Math.max(0, amount * mult);

        // Aegis of the Immortal: cumulative damage trigger
        if (this.effects.aegisDamageThreshold > 0 && this.artifactCooldowns.aegisImmortal <= 0) {
            this.aegisAccumulatedDamage += final;
            if (this.aegisAccumulatedDamage >= this.effects.aegisDamageThreshold) {
                this.aegisAccumulatedDamage = 0;
                this.artifactCooldowns.aegisImmortal = this.effects.aegisCooldown || 45000;
                this.buffManager.applyBuff('aegisImmortal');
                this.recalculateStats();

                if (typeof FloatingText !== 'undefined' && Game.floatingTexts) {
                    Game.floatingTexts.push(new FloatingText('AEGIS IMMORTAL!', this.x, this.y - 40, '#f1c40f', true));
                }
                if (Game?.effects && typeof AuraEffect !== 'undefined') {
                    Game.effects.push(new AuraEffect(this.x, this.y, 100, '#f1c40f', 60));
                }
            }
        }
        
        // ONE-SHOT PROTECTION: Only applies if above 90% health
        const currentHp = this.hp + this.overheal;
        const maxHp = this.stats.maxHp;
        const hpPercent = maxHp > 0 ? (currentHp / maxHp) : 0;
        
        if (hpPercent > 0.9 && currentHp - final <= 0) {
            // Trigger one-shot protection (only when above 90% health and would die)
            this.buffManager.applyBuff('oneShotProtection');
            this.recalculateStats();
            
            // Set HP to 10% of max HP
            const targetHp = this.stats.maxHp * 0.1;
            this.hp = targetHp;
            this.overheal = 0;
            
            // Visual effect
            if (Game?.effects && typeof AuraEffect !== 'undefined') {
                Game.effects.push(new AuraEffect(this.x, this.y, 150, '#ffffff', 45));
                Game.effects.push(new AuraEffect(this.x, this.y, 100, '#00ffff', 60));
            }
            
            Game.ui.updateBars(performance.now(), true);
            return; // Prevent normal damage processing
        }
        
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
        if (monolithArtifact?.specialEffect?.shockwaveOnHit && this.artifactCooldowns.monolithCore <= 0 && !meta?.isIndirect) {
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
                        const dist = Math.hypot(e.x - this.x, e.y - this.y);
                        if (dist <= radius + e.radius) {
                            e.takeDamage(shockDmg, false, 0, this.x, this.y, this, { isIndirect: true });
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
        if (thornsDmg > 0 && Game?.enemies && !meta?.isIndirect) {
            const thornsDamageAmount = final * thornsDmg;
            
            // Thorns Mastery: Use config range if available
            let thornsRange = 60;
            if (this.enhancementConfigs.thornsMastery) {
                thornsRange = this.enhancementConfigs.thornsMastery.aoeRadius || 80;
            }
            
            for (const e of Game.enemies) {
                if (e.dead) continue;
                const dist = Math.hypot(e.x - this.x, e.y - this.y);
                if (dist <= thornsRange + e.radius) {
                    e.takeDamage(thornsDamageAmount, false, 0, this.x, this.y, this, { isIndirect: true });
                }
            }
            
            // Visual feedback for thorns
            if (this.enhancementConfigs.thornsMastery && Game?.effects && typeof AuraEffect !== 'undefined') {
                Game.effects.push(new AuraEffect(this.x, this.y, thornsRange, '#e74c3c', 20));
            }
        }
        
        if (this.hp <= 0) {
            if (this.effects.reviveOnDeath > 0) {
                this.effects.reviveOnDeath--;
                this.revivesUsed++;
                const healPct = this.effects.reviveHealthPct || 0.5;
                this.hp = this.stats.maxHp * healPct;
                
                // Visual effect for revive
                if (Game?.effects && typeof AuraEffect !== 'undefined') {
                    // Gold/White burst
                    Game.effects.push(new AuraEffect(this.x, this.y, 400, '#ffffff', 45));
                    Game.effects.push(new AuraEffect(this.x, this.y, 250, '#ffd700', 60));
                }
                
                // Optional: Knockback enemies on revive
                if (Game?.enemies) {
                    for (const e of Game.enemies) {
                        if (!e || e.dead) continue;
                        const dist = Math.hypot(e.x - this.x, e.y - this.y);
                        if (dist <= 400) {
                            const dx = e.x - this.x;
                            const dy = e.y - this.y;
                            const d = Math.hypot(dx, dy) || 1;
                            e.vx += (dx / d) * 20;
                            e.vy += (dy / d) * 20;
                        }
                    }
                }
                
                Game.ui.updateBars(performance.now(), true);
            } else {
                Game.over();
            }
        }
    }

    // Called when an enemy dies (for life on kill, soul harvest, etc.)
    onEnemyKill(enemy) {
        // Blood Pact trait
        if (this.startingTrait?.specialEffect?.type === 'blood_pact' && enemy?.maxHp) {
            const config = this.startingTrait.specialEffect;
            const healPercent = config.healPercent || 0.05;
            const maxHpGrowthPercent = config.maxHpGrowthPercent || 0.01;
            const enemyMaxHp = Number(enemy.maxHp) || 0;
            
            const currentHp = Number(this.hp) || 0;
            const maxHp = Number(this.stats.maxHp) || 1;
            const isFullHealth = currentHp >= maxHp;
            
            if (isFullHealth) {
                // At full health: increase max HP permanently
                const maxHpGain = enemyMaxHp * maxHpGrowthPercent;
                if (maxHpGain > 0) {
                    this.bloodPactMaxHp += maxHpGain;
                    this.recalculateStats();
                    // Heal for the new max HP difference (handled automatically in recalculateStats)
                }
            } else {
                // Not at full health: heal
                const healAmount = enemyMaxHp * healPercent;
                if (healAmount > 0) {
                    this.heal(healAmount);
                }
            }
        }

        // Mortuary Plate: Souls for permanent HP from merged effects
        if (this.effects.soulHpStacking && enemy?.killedBySoul) {
            this.soulKillCount++;
            if (this.soulKillCount >= 10) {
                this.soulKillCount = 0;
                this.mortuaryPlateMaxHp += 1;
                this.recalculateStats();
                
                if (typeof Game !== 'undefined' && Game.floatingTexts && typeof FloatingText !== 'undefined') {
                    Game.floatingTexts.push(new FloatingText('+1 MAX HP', enemy.x, enemy.y - 20, '#ecf0f1', true));
                }
            }
        }
        
        // Chrono-Anchor: Time Slow on Kill
        if (this.effects.timeSlowOnKill > 0) {
            const duration = this.effects.timeSlowDuration || 120;
            if (Game?.enemies) {
                for (const e of Game.enemies) {
                    if (!e || e.dead) continue;
                    if (!e.slow) e.slow = { mult: 1, time: 0, stacks: 0 };
                    e.slow.mult = 0.1; // 90% slow
                    e.slow.time = Math.max(e.slow.time, duration);
                }
            }
            
            // Visual effect for time slow
            if (Game?.effects && typeof AuraEffect !== 'undefined') {
                Game.effects.push(new AuraEffect(this.x, this.y, 800, '#00ffff', 30));
            }
        }

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
            const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (dist <= config.range) {
                this.heal(config.healAmount);
            }
        }
        
        // Soul Reaper artifact (Shadow Stalker)
        const soulReaperArtifact = this.artifacts.find(a => 
            a.id === 'soul_reaper' || a.archetypeId === 'soul_reaper'
        );
        if (soulReaperArtifact?.specialEffect?.healOnKill) {
            const healAmount = soulReaperArtifact.specialEffect.healOnKill || 8;
            this.heal(healAmount);
            
            // Apply stacking damage buff
            if (soulReaperArtifact.specialEffect.damageBuffOnKill) {
                this.buffManager.applyBuff('soulReaper');
                this.recalculateStats();
            }
        }
    }

    equip(item, opts = {}) {
        if (item.type === ItemType.ARTIFACT) {
            this.artifacts.push(item);
            // Track acquired artifact for deduplication
            if (item.archetypeId) {
                this.acquiredArtifactIds.add(item.archetypeId);
            }
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
        const moveX = input.x * this.stats.moveSpeed;
        const moveY = input.y * this.stats.moveSpeed;
        this.x += moveX;
        this.y += moveY;
        
        // Static Charge: Track distance moved
        if (this.enhancementConfigs.staticCharge) {
            const distMoved = Math.sqrt(moveX * moveX + moveY * moveY);
            const state = this.buffStates.staticCharge;
            const config = this.enhancementConfigs.staticCharge;
            
            if (distMoved > 0 && !state.charged) {
                state.distance += distMoved;
                if (state.distance >= (config.distanceToCharge || 400)) {
                    state.charged = true;
                    state.distance = 0;
                    this.buffManager.applyBuff('staticCharge');
                }
            }
        }
        
        // Use world dimensions for boundary clamping
        const worldW = window.GameConstants?.WORLD_WIDTH || 2560;
        const worldH = window.GameConstants?.WORLD_HEIGHT || 1440;
        this.x = Math.max(this.radius, Math.min(worldW - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(worldH - this.radius, this.y));

        if (this.classId === 'the_engineer') {
            this.updateTurrets();
        }

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
        if (this.artifactCooldowns.shadowCloak > 0) {
            this.artifactCooldowns.shadowCloak -= 16.67;
        }
        if (this.artifactCooldowns.aegisImmortal > 0) {
            this.artifactCooldowns.aegisImmortal -= 16.67;
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
        
        // Clean up lingering beams if we swapped weapon behavior.
        if (weapon.behavior !== BehaviorType.BEAM && this.activeBeams?.length) {
            this.activeBeams.forEach(b => b.dead = true);
            this.activeBeams = [];
        }

        const getMod = (stat, def) => this.getEffectiveItemStat(weapon, stat, def);

        let baseDmg = getMod('baseDamage', 5);
        let finalDmg = baseDmg * this.stats.damage;
        
        // Apply Last Stand enhancement (damage scales with missing HP)
        const lastStandMult = this.getLastStandDamageMultiplier();
        finalDmg *= lastStandMult;
        
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

        // Crit Tier System:
        // Tier 1 (0-100%): 1x critMultiplier
        // Tier 2 (100-200%): 2x critMultiplier
        // Tier 3 (200-300%): 3x critMultiplier
        const critChance = this.getEffectiveCritChance(weapon);
        const finalCritMult = this.stats.critDamage || 2;
        
        const baseTier = Math.floor(critChance);
        const chanceForNext = critChance % 1;
        let selectedTier = baseTier + (Math.random() < chanceForNext ? 1 : 0);
        
        // Crit Ascension Enhancement: 25% chance to bump tier if it's already a crit
        let ascendedCrit = false;
        if (selectedTier >= 1 && this.enhancementConfigs.critAscension) {
            const upgradeChance = this.enhancementConfigs.critAscension.ascendChance || window.GameConstants.CRIT_ASCENSION_CHANCE || 0.25;
            if (Math.random() < upgradeChance) {
                selectedTier++;
                ascendedCrit = true;
            }
        }

        if (selectedTier >= 1) {
            // Cap at actual defined tiers
            const cappedTier = Math.min(selectedTier, GameConstants.CRIT_TIERS.MAX);
            const tierData = GameConstants.CRIT_TIERS[cappedTier];
            
            // damage = base * (critMult * tierMult)
            // e.g. 250% chance, 3.5 mult -> Tier 3 (50%) -> 3.5 * 3
            finalDmg *= (finalCritMult * tierData.multiplier);
            isCrit = true;
            this.lastCritTier = cappedTier; // For visual feedback if needed
            this.lastCritAscended = ascendedCrit;
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
        
        // Track hits for Overdrive enhancement
        if (this.enhancementConfigs.overdrive && !this.buffStates.overdrive.active) {
            const cfg = this.enhancementConfigs.overdrive;
            this.buffStates.overdrive.hits++;
            
            if (this.buffStates.overdrive.hits >= (cfg.hitsToTrigger || 30)) {
                this.buffStates.overdrive.hits = 0;
                this.buffStates.overdrive.active = true;
                this.buffStates.overdrive.time = cfg.duration || 300;
                this.buffManager.applyBuff('overdrive');
                this.recalculateStats();
            }
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
            
            // Aura damage scales with projectile count
            const auraDmg = finalDmg * count;

            // Pull effect (Void Singularity)
            const pullStrength = (weapon.specialEffect?.pullStrength || 0) + (this.effects.pullStrength || 0);

            for (let i = 0, n = Game.enemies.length; i < n; i++) {
                const e = Game.enemies[i];
                if (!e || e.dead) continue;
                const dx = e.x - px;
                const dy = e.y - py;
                const rr = rrBase + (e.radius || 0);
                if ((dx * dx + dy * dy) < (rr * rr)) {
                    e.takeDamage(auraDmg, isCrit, kb, px, py, this, { critTier: selectedTier, ascendedCrit: ascendedCrit });
                    
                    // Echoing Strikes: Double damage on crit for non-projectiles
                    if (isCrit && this.startingTrait?.id === 'echoing_strikes') {
                        const rollChance = this.startingTrait.specialEffect?.doubleDamageChance || 0.5;
                        if (Math.random() < rollChance) {
                            e.takeDamage(auraDmg, false, 0, px, py, this);  // Second hit, no crit
                        }
                    }

                    if (pullStrength > 0 && !e.isBoss) {
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist > 10) {
                            const pullX = (dx / dist) * pullStrength;
                            const pullY = (dy / dist) * pullStrength;
                            e.x -= pullX;
                            e.y -= pullY;
                        }
                    }
                }
            }
        } else if (weapon.behavior === BehaviorType.ORBITAL) {
            // Recreate orbitals each swing so stats always match current rolls.
            if (this.activeOrbitals?.length) {
                this.activeOrbitals.forEach(o => o.dead = true);
                this.activeOrbitals = [];
            }

            const baseCd = getMod('cooldown', 60);
            const finalCd = Math.max(10, baseCd * (this.stats.cooldownMult || 1));
            
            // Orbit speed determined by cooldown (one full rotation per cooldown cycle)
            const angularSpeed = (Math.PI * 2) / finalCd;

            // Orbit distance is inherent to the weapon, modified by AoE
            const baseOrbitDist = getMod('orbitDistance', 60);
            const aoe = (this.stats.areaOfEffect || 0);
            const orbitRadius = Math.max(22, baseOrbitDist + aoe);

            const lifeMult = (this.effects.orbitalLifeMult && this.effects.orbitalLifeMult > 0) ? this.effects.orbitalLifeMult : 1;
            const life = Math.max(20, Math.floor(finalCd * lifeMult));

            const kb = knockback + (this.effects.knockbackOnHitBonus || 0);
            const hitEvery = 12;

            const n = Math.max(1, count + (this.effects.orbitalCountBonus || 0));
            for (let i = 0; i < n; i++) {
                const ang = (i / n) * Math.PI * 2;
                const styleId = weapon?.legendaryId || weapon?.archetypeId || weapon?.name || 'default';
                const o = new OrbitalProjectile(this, orbitRadius, ang, angularSpeed, finalDmg, isCrit, kb, life, hitEvery, { styleId, critTier: selectedTier, ascendedCrit: ascendedCrit });
                Game.projectiles.push(o);
                this.activeOrbitals.push(o);
            }
        } else if (weapon.behavior === BehaviorType.PROJECTILE || weapon.behavior === BehaviorType.PROJECTILE_AOE) {
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

                const isAoE = weapon.behavior === BehaviorType.PROJECTILE_AOE;
                const aoeRadius = isAoE ? (getMod('areaOfEffect', 80) + this.stats.areaOfEffect) : 0;

                for (let i = 0; i < count; i++) {
                    let spreadAngle = 0;
                    if (count > 1) {
                        spreadAngle = (i - (count-1)/2) * 0.2; 
                    }
                    const vx = Math.cos(angle + spreadAngle) * speed;
                    const vy = Math.sin(angle + spreadAngle) * speed;
                    const styleId = weapon?.legendaryId || weapon?.archetypeId || weapon?.name || 'default';
                    
                    // Static Charge: Discharge on first projectile if charged
                    let extraMeta = {};
                    if (this.enhancementConfigs.staticCharge && this.buffStates.staticCharge.charged) {
                        const cfg = this.enhancementConfigs.staticCharge;
                        extraMeta.chainJumps = cfg.chainTargets || 3;
                        extraMeta.chainRange = cfg.chainRange || 150;
                        extraMeta.chainDamageMult = cfg.chainDamagePct || 0.5;
                        this.buffStates.staticCharge.charged = false;
                        this.buffManager.removeBuff('staticCharge');
                        
                        // Visual feedback
                        if (Game?.effects && typeof FloatingText !== 'undefined') {
                            Game.effects.push(new FloatingText('⚡ Static Discharge!', this.x, this.y - 30, '#ffeb3b', false));
                        }
                    }
                    
                    Game.projectiles.push(new Projectile(this.x, this.y, vx, vy, finalDmg, isCrit, pierce, knockback, this, 'enemy', { styleId, critTier: selectedTier, ascendedCrit: ascendedCrit, aoeRadius, ...extraMeta }));
                }
            }
        } else if (weapon.behavior === BehaviorType.BEAM) {
            // Beam weapons are long-lived objects that chain between enemies
            // Create a beam if we don't have one, or if the weapon changed
            if (this.activeBeams.length === 0) {
                const beam = new Beam(this, weapon);
                this.activeBeams.push(beam);
            } else {
                // Update existing beam with new weapon stats
                const beam = this.activeBeams[0];
                beam.weapon = weapon;
                beam.baseDamage = getMod('baseDamage', 5);
                beam.cooldownFrames = getMod('cooldown', 10);
                beam.maxChainCount = Math.floor(getMod('pierce', 3));
                beam.knockback = getMod('knockback', 0.5);
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
        
        // Tapered XP scaling: 1.4x early, decreasing as level increases to prevent extreme late-game requirements
        let multiplier = 1.4;
        if (this.level > 10) multiplier = 1.25;
        if (this.level > 20) multiplier = 1.15;
        if (this.level > 40) multiplier = 1.1;
        if (this.level > 60) multiplier = 1.05;

        this.nextLevelXp = Math.floor(this.nextLevelXp * multiplier);
        
        // Add shop refresh if player has merchant_affinity trait
        if (this.startingTrait?.specialEffect?.type === 'shop_refresh') {
            const refreshesPerLevel = this.startingTrait.specialEffect.refreshesPerLevel || 1;
            this.shopRefreshStacks += refreshesPerLevel;
        }

        // Add affix token if player has transmuter trait
        if (this.startingTrait?.specialEffect?.type === 'affix_token_gain') {
            this.affixTokens = (this.affixTokens || 0) + 1;
        }
        
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

    updateTurrets() {
        // Rotation
        this.turretAngle += 0.02; 

        // Check for artifacts
        const overclock = this.artifacts.find(a => a.id === 'overclock_module');
        const tesla = this.artifacts.find(a => a.id === 'tesla_coil');
        const nanobot = this.artifacts.find(a => a.id === 'nanobot_swarm');

        // Calculate turret stats
        let inheritance = 0.5;
        if (nanobot) inheritance = 0.75; 

        const turretStats = window.StatCalculator.calculateTurretStats(this, inheritance);
        
        // Apply Overclock Module effects
        if (overclock) {
            turretStats.cooldownMult *= (1 / 1.5); 
        }

        // Update cooldowns
        for (let i = 0; i < 2; i++) {
            if (this.turretCooldowns[i] > 0) {
                this.turretCooldowns[i]--;
            } else {
                // Try to fire
                const angle = this.turretAngle + (i * Math.PI);
                const orbitRadius = 60;
                const tx = this.x + Math.cos(angle) * orbitRadius;
                const ty = this.y + Math.sin(angle) * orbitRadius;

                if (this.fireTurret(tx, ty, turretStats, overclock, tesla, nanobot)) {
                    const baseCooldown = 60;
                    this.turretCooldowns[i] = baseCooldown * turretStats.cooldownMult;
                }
            }
        }
    }

    fireTurret(x, y, stats, overclock, tesla, nanobot) {
        let nearest = null;
        let minDst2 = Infinity;
        
        if (typeof Game !== 'undefined' && Game.enemies) {
            for (const e of Game.enemies) {
                if (!e || e.dead) continue;
                const dx = e.x - x;
                const dy = e.y - y;
                const d2 = dx * dx + dy * dy;
                if (d2 < minDst2) {
                    minDst2 = d2;
                    nearest = e;
                }
            }
        }

        if (!nearest) return false;

        const dx = nearest.x - x;
        const dy = nearest.y - y;
        const angle = Math.atan2(dy, dx);
        
        let speed = 8; 
        if (overclock) speed *= 1.3; 

        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        const baseTier = Math.floor(stats.critChance || 0);
        const chanceForNext = (stats.critChance || 0) % 1;
        let selectedTier = baseTier + (Math.random() < chanceForNext ? 1 : 0);

        // Crit Ascension Enhancement
        let ascendedCrit = false;
        if (selectedTier >= 1 && this.enhancementConfigs.critAscension) {
            const upgradeChance = this.enhancementConfigs.critAscension.ascendChance || window.GameConstants.CRIT_ASCENSION_CHANCE || 0.25;
            if (Math.random() < upgradeChance) {
                selectedTier++;
                ascendedCrit = true;
            }
        }

        let isCrit = false;
        let damage = stats.damage;
        
        const options = {
            styleId: 'turret_projectile', 
            isTurret: true,
            tesla: !!tesla,
            nanobot: !!nanobot,
            engineer: this,
            ascendedCrit: ascendedCrit
        };

        if (selectedTier >= 1) {
            isCrit = true;
            const cappedTier = Math.min(selectedTier, GameConstants.CRIT_TIERS.MAX || 5);
            damage *= ((stats.critDamage || 2) * GameConstants.CRIT_TIERS[cappedTier].multiplier);
            options.critTier = cappedTier;
        }
        
        // Spawn the turret projectile (fixed missing logic)
        Game.projectiles.push(new Projectile(x, y, vx, vy, damage, isCrit, stats.pierce || 0, stats.knockback || 0, this, 'enemy', options));
        
        return true;
    }

    draw() {
        // Draw Turrets for Automata
        if (this.classId === 'the_engineer') {
            const orbitRadius = 60;
            for (let i = 0; i < 2; i++) {
                const angle = this.turretAngle + (i * Math.PI);
                const tx = this.x + Math.cos(angle) * orbitRadius;
                const ty = this.y + Math.sin(angle) * orbitRadius;
                
                // Turret body
                ctx.beginPath();
                ctx.arc(tx, ty, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#95a5a6';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#2c3e50';
                ctx.stroke();

                // Inner light
                ctx.beginPath();
                ctx.arc(tx, ty, 4, 0, Math.PI * 2);
                ctx.fillStyle = this.color; // Matches player color (orange)
                ctx.fill();
            }
        }

        // One-Shot Protection Shield Indicator
        if (this.buffManager && this.buffManager.getBuff('oneShotProtection')) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00ffff';
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
}
