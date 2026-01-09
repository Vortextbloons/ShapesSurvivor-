// ================================================
// Test Suite - Main Controller
// ================================================

class TestSuite {
    constructor() {
        this.activeTab = 'loot';
        this.gameData = {};
        
        this.init();
    }

    async init() {
        await this.loadGameData();
        this.setupTabNavigation();
        this.setupGlobalDebug();
        this.initializeTabs();
    }

    async loadGameData() {
        try {
            // Load all required game data using global DataLoader
            await DataLoader.loadAll();
            
            // Get data from window globals
            this.gameData = {
                enemies: window.EnemyArchetypes || {},
                weaponPool: window.WeaponPool || [],
                armorArchetypes: window.ArmorArchetypes || {},
                accessoryArchetypes: window.AccessoryArchetypes || {},
                artifactArchetypes: window.ArtifactArchetypes || {},
                projectileStyles: window.ProjectileStyles || {},
                eliteModifiers: window.EliteModifierPool || [],
                affixes: window.AffixPool || [],
                weaponEffects: window.WeaponEffectPool || [],
                enhancements: window.EnhancementPool || [],
                legendaryWeapons: window.LegendaryWeapons || [],
                legendaryArmor: window.LegendaryArmor || [],
                legendaryAccessories: window.LegendaryAccessories || [],
                legendaryArtifacts: window.LegendaryArtifacts || []
            };
            
            // Setup mock Game object for item generation context
            this.setupMockGame();
            
            console.log('✅ Game data loaded successfully', this.gameData);
        } catch (error) {
            console.error('❌ Failed to load game data:', error);
        }
    }

    setupMockGame() {
        // Create a minimal Game object for testing
        if (typeof window.Game === 'undefined') {
            window.Game = {
                elapsedFrames: 0,
                player: {
                    equipment: {
                        weapon: null,
                        armor: null,
                        accessory1: null,
                        accessory2: null
                    },
                    artifacts: [],
                    stats: {
                        rarityFind: 0
                    },
                    characterArchetype: null
                }
            };
        }
    }

    // ================================================
    // Tab Navigation
    // ================================================
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Update active button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update active pane
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });

        this.activeTab = tabName;
    }

    // ================================================
    // Global Debug Toggle
    // ================================================
    setupGlobalDebug() {
        const debugToggle = document.getElementById('globalDebug');
        debugToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            console.log(`🔧 Global Debug: ${enabled ? 'ON' : 'OFF'}`);
            // This could enable/disable dev-mode features
        });
    }

    // ================================================
    // Initialize All Tabs
    // ================================================
    initializeTabs() {
        this.initLootTab();
        this.initInputTab();
        this.initStatsTab();
        this.initEntitiesTab();
        this.initVFXTab();
    }

    // ================================================
    // LOOT TAB - Item Generation
    // ================================================
    initLootTab() {
        const generateBtn = document.getElementById('loot-generate-btn');
        const clearBtn = document.getElementById('loot-clear-btn');
        
        // View Mode Toggles
        const viewModeBtns = document.querySelectorAll('#loot-view-mode .toggle-btn');
        viewModeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                viewModeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.viewMode = e.target.dataset.mode;
                
                // Refresh view if we have data
                if (this.currentAnalysisData) {
                    this.displayStatAnalysis(this.currentAnalysisData, this.currentAnalysisData.total);
                }
            });
        });

        this.viewMode = 'rarity'; // Default
        this.currentAnalysisData = null;

        generateBtn.addEventListener('click', () => this.generateItems());
        clearBtn.addEventListener('click', () => this.clearLootResults());
    }

    generateItems() {
        const itemType = document.getElementById('loot-item-type').value;
        const playerLevel = parseInt(document.getElementById('loot-player-level').value);
        const count = parseInt(document.getElementById('loot-count').value);
        const rarityFind = parseFloat(document.getElementById('loot-rarity-find').value) || 0;

        console.log(`🎲 Generating ${count} items (Level ${playerLevel}, RarityFind ${rarityFind})...`);

        // Check if LootSystem is available
        if (typeof LootSystem === 'undefined') {
            console.error('LootSystem not loaded');
            return;
        }

        // Update mock player stats
        if (window.Game?.player?.stats) {
            window.Game.player.stats.rarityFind = rarityFind;
        }

        const startTime = performance.now();
        const items = [];
        const errors = [];
        const rarityCount = {
            common: 0,
            uncommon: 0,
            rare: 0,
            epic: 0,
            legendary: 0,
            character: 0
        };

        // Stats tracking (Updated Structure)
        const statsData = {
            byRarity: {},
            combined: {}
        };

        const affixData = {
            totalAffixes: 0,
            affixesByRarity: {},
            affixDistribution: {},
            itemsWithAffixes: 0,
            sourceCounts: {} // Track where modifiers come from
        };
        const behaviorData = {
            totalWeapons: 0,
            invalidBehaviors: 0,
            behaviorCounts: {}
        };
        const legendaryData = {
            count: 0,
            byType: {}
        };
        const nameData = {
            withPrefixes: 0,
            totalPrefixes: 0
        };

        // Generate items
        for (let i = 0; i < count; i++) {
            try {
                const forceType = itemType === 'all' ? null : ItemType[itemType.toUpperCase()];
                const item = LootSystem.generateItem({ forceType });
                items.push(item);
                
                const rarityKey = item.rarity?.id || 'common';
                if (rarityCount.hasOwnProperty(rarityKey)) {
                    rarityCount[rarityKey]++;
                }

                // Analyze stats
                this.analyzeItemStats(item, statsData);

                // Analyze affixes
                this.analyzeAffixes(item, affixData);

                // Analyze weapon behavior
                if (item.type === ItemType.WEAPON) {
                    this.analyzeBehavior(item, behaviorData);
                }

                // Track legendary items
                if (rarityKey === 'legendary') {
                    legendaryData.count++;
                    legendaryData.byType[item.type] = (legendaryData.byType[item.type] || 0) + 1;
                }

                // Analyze name generation
                this.analyzeItemName(item, nameData);

            } catch (error) {
                console.error('Failed to generate item:', error);
                errors.push({ index: i, error: error.message });
            }
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Store for view switching
        this.currentAnalysisData = {
            stats: statsData,
            total: count
        };

        // Display all results
        this.displayRarityChart(rarityCount, count);
        this.displayGenerationInfo(affixData, rarityCount, count);
        this.displayStatAnalysis(this.currentAnalysisData, count);
        this.displayAffixAnalysis(affixData, count);
        this.displayBehaviorAnalysis(behaviorData);
        this.displayLegendaryAnalysis(legendaryData);
        this.displayNameAnalysis(nameData, count);
        this.displayPerformanceMetrics(duration, count, errors);
        this.displayItemsList(items.slice(0, 100)); // Show first 100 items

        console.log('✅ Generation complete:', { rarityCount, duration: `${duration.toFixed(2)}ms`, errors: errors.length });
    }

    analyzeItemStats(item, statsData) {
        const rarityKey = item.rarity?.id || 'common';
        
        // Ensure container exists
        if (!statsData.byRarity[rarityKey]) {
            statsData.byRarity[rarityKey] = {};
        }

        // Collect all values from modifiers and properties
        const collected = {};

        // 1. From Modifiers (Primary Source)
        if (item.modifiers) {
            item.modifiers.forEach(mod => {
                let statName = mod.stat;
                
                // Distinguish percentage/multiplicative modifiers
                const isMult = mod.operation === 'multiply' || mod.op === 'multiply';
                if (isMult) {
                     statName += ' (%)'; 
                }

                if (!collected[statName]) collected[statName] = 0;
                collected[statName] += (Number(mod.value) || 0);
            });
        }
        
        // 2. From direct properties (Legacy/Fallback)
        // Some older logic or special items might still use these
        const relevantProps = [
            'baseDamage', 'cooldown', 'projSpeed', 'critChance', 
            'knockback', 'areaOfEffect', 'penetration', 'pierce', 'range', 'duration',
            'critDamageMult', 'critDamageMultBase', 'projectileCount'
        ];
        
        relevantProps.forEach(prop => {
            if (typeof item[prop] === 'number') {
                // Only add if not already captured from modifiers (avoid double counting if duplicative)
                // But usually these don't duplicate. We can merge.
                if (!collected[prop]) collected[prop] = 0;
                collected[prop] += item[prop];
            }
        });

        // 3. Store Data
        for (const [statName, statValue] of Object.entries(collected)) {
            // Add to Rarity bucket
            if (!statsData.byRarity[rarityKey][statName]) {
                statsData.byRarity[rarityKey][statName] = [];
            }
            statsData.byRarity[rarityKey][statName].push(statValue);

            // Add to Combined bucket
            if (!statsData.combined[statName]) {
                statsData.combined[statName] = [];
            }
            statsData.combined[statName].push(statValue);
        }
    }

    analyzeAffixes(item, affixData) {
        const rarityKey = item.rarity?.id || 'common';
        const affixCount = item.affixes?.length || 0;

        if (affixCount > 0) {
            affixData.itemsWithAffixes++;
            affixData.totalAffixes += affixCount;
            
            if (!affixData.affixesByRarity[rarityKey]) {
                affixData.affixesByRarity[rarityKey] = { count: 0, items: 0 };
            }
            affixData.affixesByRarity[rarityKey].count += affixCount;
            affixData.affixesByRarity[rarityKey].items++;

            item.affixes.forEach(affix => {
                const affixId = affix.id || 'unknown';
                affixData.affixDistribution[affixId] = (affixData.affixDistribution[affixId] || 0) + 1;
            });
        }
        
        // Analyze modifier sources
        if (item.modifiers) {
            item.modifiers.forEach(mod => {
                const source = mod.source || 'unknown';
                affixData.sourceCounts[source] = (affixData.sourceCounts[source] || 0) + 1;
            });
        }
    }

    analyzeBehavior(item, behaviorData) {
        behaviorData.totalWeapons++;
        const behavior = item.behavior || 'none';
        
        if (behavior === 'none' || behavior === BehaviorType.NONE) {
            behaviorData.invalidBehaviors++;
        }

        behaviorData.behaviorCounts[behavior] = (behaviorData.behaviorCounts[behavior] || 0) + 1;
    }

    analyzeItemName(item, nameData) {
        if (item.affixes && item.affixes.length > 0) {
            // Check if first 2 affixes appear in name
            const firstTwoAffixes = item.affixes.slice(0, 2);
            let prefixesInName = 0;
            
            firstTwoAffixes.forEach(affix => {
                if (affix.prefix && item.name.includes(affix.prefix)) {
                    prefixesInName++;
                }
            });

            if (prefixesInName > 0) {
                nameData.withPrefixes++;
                nameData.totalPrefixes += prefixesInName;
            }
        }
    }

    displayRarityChart(rarityCount, total) {
        const chartContainer = document.getElementById('loot-rarity-chart');
        chartContainer.innerHTML = '';

        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'character'];
        
        rarities.forEach(rarity => {
            const count = rarityCount[rarity] || 0;
            const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
            
            const barWrapper = document.createElement('div');
            barWrapper.className = 'chart-bar';
            
            const label = document.createElement('div');
            label.className = 'chart-label';
            label.textContent = rarity.charAt(0).toUpperCase() + rarity.slice(1);
            
            const fill = document.createElement('div');
            fill.className = `chart-bar-fill ${rarity}`;
            fill.style.width = `${percentage}%`;
            fill.textContent = `${count} (${percentage}%)`;
            
            barWrapper.appendChild(label);
            barWrapper.appendChild(fill);
            chartContainer.appendChild(barWrapper);
        });
    }

    displayItemsList(items) {
        const listContainer = document.getElementById('loot-items-list');
        listContainer.innerHTML = '';

        if (items.length === 0) {
            listContainer.innerHTML = '<p style="color: var(--text-secondary);">No items generated yet.</p>';
            return;
        }

        items.forEach((item, index) => {
            const rarityId = item.rarity?.id || 'common';
            const card = document.createElement('div');
            card.className = `item-card ${rarityId}`;
            
            const affixCount = item.affixes?.length || 0;
            const behavior = item.behavior || '';
            const behaviorText = behavior ? ` • ${behavior}` : '';
            
            card.innerHTML = `
                <div class="item-name">${item.name}</div>
                <div class="item-type">${item.type} • ${item.rarity?.name || 'Unknown'}${behaviorText}</div>
                <div class="item-details">Affixes: ${affixCount} • Archetype: ${item.archetypeId || 'Unknown'}</div>
            `;
            
            // Add click to expand details
            card.addEventListener('click', () => {
                console.log(`Item #${index + 1}:`, item);
            });
            
            listContainer.appendChild(card);
        });
    }

    displayGenerationInfo(affixData, rarityCount, total) {
        const container = document.getElementById('loot-generation-info');
        if (!container) return;

        container.innerHTML = '<h3>Generation Metrics</h3>';

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gap = '20px';

        // Modifier Sources Panel
        const sourcesDiv = document.createElement('div');
        sourcesDiv.innerHTML = '<h4>Modifier Sources</h4>';
        if (affixData.sourceCounts) {
             for (const [source, count] of Object.entries(affixData.sourceCounts)) {
                 sourcesDiv.innerHTML += `<div><strong>${source}:</strong> ${count}</div>`;
             }
        }
        grid.appendChild(sourcesDiv);

        // General Stats Panel
        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = '<h4>General Stats</h4>';
        infoDiv.innerHTML += `<div><strong>Generated:</strong> ${total} items</div>`;
        infoDiv.innerHTML += `<div><strong>Items w/ Affixes:</strong> ${affixData.itemsWithAffixes} (${total > 0 ? (affixData.itemsWithAffixes/total*100).toFixed(1) : 0}%)</div>`;
        infoDiv.innerHTML += `<div><strong>Total Affixes:</strong> ${affixData.totalAffixes}</div>`;
        grid.appendChild(infoDiv);

        container.appendChild(grid);
    }

    displayStatAnalysis(analysisData, total) {
        const container = document.getElementById('loot-stat-analysis');
        if (!container) return;

        container.innerHTML = '<h3>Stat Analysis</h3>';
        
        if (!analysisData || (!analysisData.stats && !analysisData.combined)) {
             container.innerHTML += '<p>No data available</p>';
             return;
        }

        const statsData = analysisData.stats || analysisData; 

        if (this.viewMode === 'combined') {
            this.renderStatTable(container, 'All Items (Combined)', statsData.combined, 'combined');
        } else {
            const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'character'];
            rarities.forEach(rarity => {
                if (statsData.byRarity && statsData.byRarity[rarity]) {
                    this.renderStatTable(container, rarity.toUpperCase(), statsData.byRarity[rarity], rarity);
                }
            });
        }
        
        container.innerHTML += '<p style="margin-top:10px; font-size:0.8rem; opacity:0.7">Note: Hidden stats like cooldown and range are included.</p>';
    }

    renderStatTable(container, title, stats, cssClass) {
        if (!stats || Object.keys(stats).length === 0) return;

        const section = document.createElement('div');
        section.className = 'stat-section';
        section.innerHTML = `<h4 class="${cssClass}">${title}</h4>`;

        const grid = document.createElement('div');
        grid.className = 'stat-table-grid';
        
        // Table Header
        const headers = ['Stat', 'Min', 'Mean', 'Median', 'Max'];
        const headerRow = document.createElement('div');
        headerRow.className = 'stat-grid-row header';
        headers.forEach(h => {
            const div = document.createElement('div');
            div.textContent = h;
            div.className = h === 'Stat' ? 'stat-col-name' : 'stat-col-val';
            headerRow.appendChild(div);
        });
        grid.appendChild(headerRow);

        // Table Rows
        const sortedStatNames = Object.keys(stats).sort();
        for (const statName of sortedStatNames) {
            const metrics = this.calculateStatMetrics(stats[statName]);
            if (!metrics) continue;

            const row = document.createElement('div');
            row.className = 'stat-grid-row';
            
            row.innerHTML = `
                <div class="stat-col-name">${statName}</div>
                <div class="stat-col-val">${metrics.min.toFixed(2)}</div>
                <div class="stat-col-val">${metrics.mean.toFixed(2)}</div>
                <div class="stat-col-val">${metrics.median.toFixed(2)}</div>
                <div class="stat-col-val">${metrics.max.toFixed(2)}</div>
            `;
            grid.appendChild(row);
        }

        section.appendChild(grid);
        container.appendChild(section);
    }

    calculateStatMetrics(values) {
        if (!values || values.length === 0) return null;
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

        return { min, max, mean, median, count: values.length };
    }

    displayAffixAnalysis(affixData, total) {
        const container = document.getElementById('loot-affix-analysis');
        if (!container) return;

        container.innerHTML = '<h3>Affix Analysis</h3>';

        const summary = document.createElement('div');
        summary.className = 'analysis-summary';
        summary.innerHTML = `
            <p><strong>Items with Affixes:</strong> ${affixData.itemsWithAffixes} (${(affixData.itemsWithAffixes / total * 100).toFixed(1)}%)</p>
            <p><strong>Total Affixes Applied:</strong> ${affixData.totalAffixes}</p>
            <p><strong>Average per Item:</strong> ${(affixData.totalAffixes / Math.max(1, affixData.itemsWithAffixes)).toFixed(2)}</p>
        `;
        container.appendChild(summary);

        // By rarity
        const byRarity = document.createElement('div');
        byRarity.innerHTML = '<h4>By Rarity</h4>';
        for (const [rarity, data] of Object.entries(affixData.affixesByRarity)) {
            const avg = (data.count / data.items).toFixed(2);
            const p = document.createElement('p');
            p.innerHTML = `<span class="${rarity}">${rarity.toUpperCase()}:</span> ${data.count} affixes on ${data.items} items (avg: ${avg})`;
            byRarity.appendChild(p);
        }
        container.appendChild(byRarity);

        // Top affixes
        const topAffixes = Object.entries(affixData.affixDistribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (topAffixes.length > 0) {
            const topSection = document.createElement('div');
            topSection.innerHTML = '<h4>Top 10 Affixes</h4>';
            topAffixes.forEach(([affixId, count]) => {
                const p = document.createElement('p');
                p.textContent = `${affixId}: ${count}`;
                topSection.appendChild(p);
            });
            container.appendChild(topSection);
        }
    }

    displayBehaviorAnalysis(behaviorData) {
        const container = document.getElementById('loot-behavior-analysis');
        if (!container) return;

        container.innerHTML = '<h3>Weapon Behavior Analysis</h3>';

        const summary = document.createElement('div');
        summary.className = 'analysis-summary';
        summary.innerHTML = `
            <p><strong>Total Weapons:</strong> ${behaviorData.totalWeapons}</p>
            <p class="${behaviorData.invalidBehaviors > 0 ? 'error' : 'success'}">
                <strong>Invalid Behaviors (none):</strong> ${behaviorData.invalidBehaviors}
                ${behaviorData.invalidBehaviors > 0 ? ' ⚠️ ISSUE!' : ' ✅'}
            </p>
        `;
        container.appendChild(summary);

        const distribution = document.createElement('div');
        distribution.innerHTML = '<h4>Behavior Distribution</h4>';
        for (const [behavior, count] of Object.entries(behaviorData.behaviorCounts)) {
            const percentage = ((count / behaviorData.totalWeapons) * 100).toFixed(1);
            const p = document.createElement('p');
            p.textContent = `${behavior}: ${count} (${percentage}%)`;
            distribution.appendChild(p);
        }
        container.appendChild(distribution);
    }

    displayLegendaryAnalysis(legendaryData) {
        const container = document.getElementById('loot-legendary-analysis');
        if (!container) return;

        container.innerHTML = '<h3>Legendary Item Analysis</h3>';

        const summary = document.createElement('div');
        summary.className = 'analysis-summary';
        summary.innerHTML = `<p><strong>Total Legendary Items:</strong> ${legendaryData.count}</p>`;
        container.appendChild(summary);

        if (Object.keys(legendaryData.byType).length > 0) {
            const byType = document.createElement('div');
            byType.innerHTML = '<h4>By Type</h4>';
            for (const [type, count] of Object.entries(legendaryData.byType)) {
                const p = document.createElement('p');
                p.textContent = `${type}: ${count}`;
                byType.appendChild(p);
            }
            container.appendChild(byType);
        }
    }

    displayNameAnalysis(nameData, total) {
        const container = document.getElementById('loot-name-analysis');
        if (!container) return;

        container.innerHTML = '<h3>Item Name Analysis</h3>';

        const summary = document.createElement('div');
        summary.className = 'analysis-summary';
        const prefixRate = total > 0 ? (nameData.withPrefixes / total * 100).toFixed(1) : 0;
        const avgPrefixes = nameData.withPrefixes > 0 ? (nameData.totalPrefixes / nameData.withPrefixes).toFixed(2) : 0;
        
        summary.innerHTML = `
            <p><strong>Items with Affix Prefixes:</strong> ${nameData.withPrefixes} (${prefixRate}%)</p>
            <p><strong>Average Prefixes per Named Item:</strong> ${avgPrefixes}</p>
        `;
        container.appendChild(summary);
    }

    displayPerformanceMetrics(duration, count, errors) {
        const container = document.getElementById('loot-performance');
        if (!container) return;

        container.innerHTML = '<h3>Performance Metrics</h3>';

        const avgTime = count > 0 ? (duration / count).toFixed(3) : 0;
        const itemsPerSec = duration > 0 ? (count / (duration / 1000)).toFixed(0) : 0;

        const metrics = document.createElement('div');
        metrics.className = 'analysis-summary';
        metrics.innerHTML = `
            <p><strong>Total Time:</strong> ${duration.toFixed(2)}ms</p>
            <p><strong>Average per Item:</strong> ${avgTime}ms</p>
            <p><strong>Items per Second:</strong> ${itemsPerSec}</p>
            <p class="${errors.length > 0 ? 'error' : 'success'}">
                <strong>Errors:</strong> ${errors.length} ${errors.length > 0 ? '⚠️' : '✅'}
            </p>
        `;
        container.appendChild(metrics);

        if (errors.length > 0) {
            const errorList = document.createElement('div');
            errorList.innerHTML = '<h4>Errors</h4>';
            errors.slice(0, 10).forEach(err => {
                const p = document.createElement('p');
                p.className = 'error';
                p.textContent = `Item #${err.index}: ${err.error}`;
                errorList.appendChild(p);
            });
            container.appendChild(errorList);
        }
    }

    clearLootResults() {
        document.getElementById('loot-rarity-chart').innerHTML = '<p style="color: var(--text-secondary);">Generate items to see distribution.</p>';
        document.getElementById('loot-items-list').innerHTML = '<p style="color: var(--text-secondary);">No items generated yet.</p>';
        
        // Clear analysis panels
        const analysisContainers = [
            'loot-stat-analysis',
            'loot-affix-analysis',
            'loot-behavior-analysis',
            'loot-legendary-analysis',
            'loot-name-analysis',
            'loot-performance'
        ];
        
        analysisContainers.forEach(id => {
            const container = document.getElementById(id);
            if (container) container.innerHTML = '';
        });
    }

    // ================================================
    // INPUT TAB - Joystick Testing
    // ================================================
    initInputTab() {
        const joystickArea = document.getElementById('joystick-area');
        const joystickStick = document.getElementById('joystick-stick');
        
        let activeTouch = null;
        let baseCenter = { x: 0, y: 0 };
        const maxDistance = 60; // Max pixels from center

        const updateDebugInfo = (x, y, active, touchId = null) => {
            const distance = Math.sqrt(x * x + y * y);
            const angle = Math.atan2(y, x) * (180 / Math.PI);
            const distancePercent = Math.min((distance / maxDistance) * 100, 100);

            document.getElementById('input-axis-x').textContent = x.toFixed(2);
            document.getElementById('input-axis-y').textContent = y.toFixed(2);
            document.getElementById('input-angle').textContent = angle.toFixed(0) + '°';
            document.getElementById('input-distance').textContent = distancePercent.toFixed(0) + '%';
            document.getElementById('input-active').textContent = active;
            document.getElementById('input-touch-id').textContent = touchId !== null ? touchId : 'null';
        };

        const handleStart = (clientX, clientY, touchId) => {
            const rect = joystickArea.getBoundingClientRect();
            baseCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            activeTouch = touchId;
        };

        const handleMove = (clientX, clientY) => {
            if (activeTouch === null) return;

            let dx = clientX - baseCenter.x;
            let dy = clientY - baseCenter.y;
            
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Clamp to max distance
            if (distance > maxDistance) {
                const angle = Math.atan2(dy, dx);
                dx = Math.cos(angle) * maxDistance;
                dy = Math.sin(angle) * maxDistance;
            }

            // Update stick position
            joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            
            // Normalize to -1 to 1 range
            const normalizedX = dx / maxDistance;
            const normalizedY = dy / maxDistance;
            
            updateDebugInfo(normalizedX, normalizedY, true, activeTouch);
        };

        const handleEnd = () => {
            activeTouch = null;
            joystickStick.style.transform = 'translate(-50%, -50%)';
            updateDebugInfo(0, 0, false);
        };

        // Touch events
        joystickArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleStart(touch.clientX, touch.clientY, touch.identifier);
        });

        joystickArea.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (activeTouch === null) return;
            
            for (let touch of e.touches) {
                if (touch.identifier === activeTouch) {
                    handleMove(touch.clientX, touch.clientY);
                    break;
                }
            }
        });

        joystickArea.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleEnd();
        });

        // Mouse events (for desktop testing)
        let mouseDown = false;
        joystickArea.addEventListener('mousedown', (e) => {
            mouseDown = true;
            handleStart(e.clientX, e.clientY, 'mouse');
        });

        joystickArea.addEventListener('mousemove', (e) => {
            if (!mouseDown) return;
            handleMove(e.clientX, e.clientY);
        });

        joystickArea.addEventListener('mouseup', () => {
            mouseDown = false;
            handleEnd();
        });

        joystickArea.addEventListener('mouseleave', () => {
            if (mouseDown) {
                mouseDown = false;
                handleEnd();
            }
        });

        // Button testing
        const inventoryBtn = document.getElementById('test-inventory-btn');
        const pauseBtn = document.getElementById('test-pause-btn');
        const inventoryState = document.getElementById('inventory-state');
        const pauseState = document.getElementById('pause-state');

        inventoryBtn.addEventListener('mousedown', () => {
            inventoryState.textContent = 'Pressed';
            inventoryState.style.color = 'var(--success)';
        });
        
        inventoryBtn.addEventListener('mouseup', () => {
            inventoryState.textContent = 'Released';
            inventoryState.style.color = 'var(--text-primary)';
        });

        pauseBtn.addEventListener('mousedown', () => {
            pauseState.textContent = 'Pressed';
            pauseState.style.color = 'var(--success)';
        });
        
        pauseBtn.addEventListener('mouseup', () => {
            pauseState.textContent = 'Released';
            pauseState.style.color = 'var(--text-primary)';
        });

        // Initialize debug info
        updateDebugInfo(0, 0, false);
    }

    // ================================================
    // STATS TAB - Calculation Sandbox
    // ================================================
    initStatsTab() {
        const calculateBtn = document.getElementById('stats-calculate-btn');
        const resetBtn = document.getElementById('stats-reset-btn');
        const addAdditiveBtn = document.getElementById('stats-add-additive');
        const addMultiplicativeBtn = document.getElementById('stats-add-multiplicative');

        this.additiveModifiers = [];
        this.multiplicativeModifiers = [];

        addAdditiveBtn.addEventListener('click', () => {
            const input = document.getElementById('stats-additive-input');
            const value = parseFloat(input.value);
            if (!isNaN(value)) {
                this.additiveModifiers.push(value);
                this.renderModifiers();
                input.value = '';
            }
        });

        addMultiplicativeBtn.addEventListener('click', () => {
            const input = document.getElementById('stats-multiplicative-input');
            const value = parseFloat(input.value);
            if (!isNaN(value)) {
                this.multiplicativeModifiers.push(value / 100); // Convert percentage to decimal
                this.renderModifiers();
                input.value = '';
            }
        });

        calculateBtn.addEventListener('click', () => this.calculateStats());
        resetBtn.addEventListener('click', () => this.resetStats());

        this.renderModifiers();
    }

    renderModifiers() {
        const additiveList = document.getElementById('stats-additive-list');
        const multiplicativeList = document.getElementById('stats-multiplicative-list');

        additiveList.innerHTML = this.additiveModifiers.length === 0 
            ? '<p style="color: var(--text-secondary); padding: 10px;">No modifiers</p>'
            : '';
        
        this.additiveModifiers.forEach((value, index) => {
            const item = document.createElement('div');
            item.className = 'modifier-item';
            item.innerHTML = `
                <span>+${value}</span>
                <button onclick="testSuite.removeAdditive(${index})">Remove</button>
            `;
            additiveList.appendChild(item);
        });

        multiplicativeList.innerHTML = this.multiplicativeModifiers.length === 0
            ? '<p style="color: var(--text-secondary); padding: 10px;">No modifiers</p>'
            : '';
        
        this.multiplicativeModifiers.forEach((value, index) => {
            const item = document.createElement('div');
            item.className = 'modifier-item';
            item.innerHTML = `
                <span>×${(1 + value).toFixed(2)} (${(value * 100).toFixed(1)}%)</span>
                <button onclick="testSuite.removeMultiplicative(${index})">Remove</button>
            `;
            multiplicativeList.appendChild(item);
        });
    }

    removeAdditive(index) {
        this.additiveModifiers.splice(index, 1);
        this.renderModifiers();
    }

    removeMultiplicative(index) {
        this.multiplicativeModifiers.splice(index, 1);
        this.renderModifiers();
    }

    calculateStats() {
        const baseValue = parseFloat(document.getElementById('stats-base-value').value) || 0;
        const breakdown = document.getElementById('stats-breakdown');
        
        let steps = [];
        let currentValue = baseValue;

        steps.push(`Base Value: ${baseValue}`);

        // Apply additive modifiers
        if (this.additiveModifiers.length > 0) {
            const additiveSum = this.additiveModifiers.reduce((sum, val) => sum + val, 0);
            currentValue += additiveSum;
            steps.push(`After Additive (+${additiveSum}): ${currentValue.toFixed(2)}`);
        }

        // Apply multiplicative modifiers
        if (this.multiplicativeModifiers.length > 0) {
            this.multiplicativeModifiers.forEach((mult, i) => {
                const before = currentValue;
                currentValue *= (1 + mult);
                steps.push(`After Mult ${i + 1} (×${(1 + mult).toFixed(2)}): ${currentValue.toFixed(2)}`);
            });
        }

        // Display breakdown
        breakdown.innerHTML = steps.map(step => 
            `<div class="breakdown-step">${step}</div>`
        ).join('');

        // Display final result
        document.getElementById('stats-final-value').textContent = currentValue.toFixed(2);
    }

    resetStats() {
        this.additiveModifiers = [];
        this.multiplicativeModifiers = [];
        this.renderModifiers();
        document.getElementById('stats-breakdown').innerHTML = '<p style="color: var(--text-secondary);">Add modifiers and calculate to see breakdown.</p>';
        document.getElementById('stats-final-value').textContent = '0';
    }

    // ================================================
    // ENTITIES TAB - Enemy & Projectile Testing
    // ================================================
    initEntitiesTab() {
        const spawnBtn = document.getElementById('entity-spawn-btn');
        const testProjectileBtn = document.getElementById('entity-test-projectile-btn');

        // Populate enemy types
        if (this.gameData.enemies) {
            const enemySelect = document.getElementById('entity-enemy-type');
            enemySelect.innerHTML = '<option value="">Select Enemy</option>';
            Object.keys(this.gameData.enemies).forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = this.gameData.enemies[key].name || key;
                enemySelect.appendChild(option);
            });
        }

        // Populate elite modifiers
        if (this.gameData.eliteModifiers) {
            const modifierSelect = document.getElementById('entity-elite-modifier');
            Object.keys(this.gameData.eliteModifiers).forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = this.gameData.eliteModifiers[key].name || key;
                modifierSelect.appendChild(option);
            });
        }

        // Populate projectile styles
        if (this.gameData.projectileStyles) {
            const projectileSelect = document.getElementById('entity-projectile-style');
            projectileSelect.innerHTML = '<option value="">Select Style</option>';
            Object.keys(this.gameData.projectileStyles).forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = key;
                projectileSelect.appendChild(option);
            });
        }

        spawnBtn.addEventListener('click', () => this.spawnEnemy());
        testProjectileBtn.addEventListener('click', () => this.testProjectile());
    }

    spawnEnemy() {
        const enemyType = document.getElementById('entity-enemy-type').value;
        const eliteModifier = document.getElementById('entity-elite-modifier').value;
        const infoContainer = document.getElementById('entity-info');

        if (!enemyType) {
            infoContainer.innerHTML = '<p style="color: var(--warning);">Please select an enemy type.</p>';
            return;
        }

        const enemyData = this.gameData.enemies[enemyType];
        const modifierData = eliteModifier !== 'none' ? this.gameData.eliteModifiers[eliteModifier] : null;

        let info = `<h4>${enemyData.name}</h4>`;
        info += `<p>Base Health: ${enemyData.health}</p>`;
        info += `<p>Base Speed: ${enemyData.speed}</p>`;
        info += `<p>Base Damage: ${enemyData.damage}</p>`;
        
        if (modifierData) {
            info += `<hr style="margin: 10px 0; border-color: var(--border-color);">`;
            info += `<h4 style="color: var(--accent-primary);">${modifierData.name}</h4>`;
            info += `<p>${modifierData.description || 'No description'}</p>`;
        }

        infoContainer.innerHTML = info;
    }

    testProjectile() {
        const style = document.getElementById('entity-projectile-style').value;
        if (!style) return;

        const canvas = document.getElementById('projectile-canvas');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw simple projectile visualization
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 10, 0, Math.PI * 2);
        ctx.fill();

        console.log(`🚀 Testing projectile style: ${style}`);
    }

    // ================================================
    // VFX TAB - Visual Effects Preview
    // ================================================
    initVFXTab() {
        const triggerBtn = document.getElementById('vfx-trigger-btn');
        const clearBtn = document.getElementById('vfx-clear-btn');
        const typeSelect = document.getElementById('vfx-type');

        triggerBtn.addEventListener('click', () => this.triggerVFX());
        clearBtn.addEventListener('click', () => this.clearVFX());

        typeSelect.addEventListener('change', () => {
            // Update style options based on type
            const styleSelect = document.getElementById('vfx-style');
            styleSelect.innerHTML = '<option value="">Coming soon...</option>';
        });
    }

    triggerVFX() {
        const canvas = document.getElementById('vfx-canvas');
        const ctx = canvas.getContext('2d');
        
        // Simple particle effect for demonstration
        ctx.fillStyle = '#e94560';
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    clearVFX() {
        const canvas = document.getElementById('vfx-canvas');
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// Initialize test suite
const testSuite = new TestSuite();
window.testSuite = testSuite; // Make accessible for inline onclick handlers

console.log('🧪 Test Suite initialized');
