const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- World & Camera ---
var world = { width: 3000, height: 3000 };
var camera = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };

// --- Game State (Global) ---
var resources = 0;
var lastUpdate = Date.now();
var minerLevel = 0;
var engineLevel = 0;
var critLevel = 0;
var isMuted = false;

// --- Multiverse Dimension System ---
var currentDimension = 1;
var dimensionThemes = {
    1: { name: "Material Universe", color: "lightgray", rare: "gold" },
    2: { name: "Antimatter Nebula", color: "#00ffff", rare: "#ff0077" },
    3: { name: "Quantum Realm", color: "#39ff14", rare: "#bc13fe" },
    4: { name: "Singularity Void", color: "#4d4dff", rare: "#ff4500" }
};

// --- Stage System ---
var currentStage = 1;
var oresMinedInStage = 0;
var oresRequiredForNextStage = 30;
var totalOresMined = 0; 
var bgColor = '#000000';

// --- Prestige System ---
var darkMatter = 0;
var darkEnergyLevel = 0;
const BASE_DARK_ENERGY_COST = 10;

// --- Procedural Sound System (Web Audio API) ---
var audioCtx = null;
var bgmOsc = null;
var bgmGain = null;

function initAudio() {
    if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        bgmOsc = audioCtx.createOscillator();
        bgmGain = audioCtx.createGain();
        bgmOsc.type = 'sine'; bgmOsc.frequency.setValueAtTime(60, audioCtx.currentTime); 
        bgmGain.gain.setValueAtTime(isMuted ? 0 : 0.05, audioCtx.currentTime); 
        bgmOsc.connect(bgmGain); bgmGain.connect(audioCtx.destination);
        bgmOsc.start();
    } catch (e) { console.warn("Audio init failed", e); }
}

function playSynthSFX(type) {
    if (isMuted || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'crit') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.3); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.3); osc.start(); osc.stop(now + 0.3); }
    else if (type === 'break') { osc.type = 'square'; osc.frequency.setValueAtTime(1000, now); osc.frequency.exponentialRampToValueAtTime(400, now + 0.1); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); osc.start(); osc.stop(now + 0.1); }
    else if (type === 'upgrade') { osc.type = 'sine'; osc.frequency.setValueAtTime(500, now); osc.frequency.linearRampToValueAtTime(1000, now + 0.2); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.2); osc.start(); osc.stop(now + 0.2); }
}

function toggleMute() {
    isMuted = !isMuted;
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) muteBtn.textContent = isMuted ? '🔇' : '🔈';
    if (audioCtx && bgmGain) { bgmGain.gain.linearRampToValueAtTime(isMuted ? 0 : 0.05, audioCtx.currentTime + 0.1); }
}

// --- Evolution & Comet ---
var shipTier = 1;
var thrustColor = '#00ffff';
var tierImages = { 1: new Image() }; tierImages[1].src = 'images/spaceship_animation.png';
var comet = null, isFeverTime = false, feverTimer = 0;
const FEVER_DURATION = 30, numStars = 200;
var currentStarSpeed = 0.8;
const maxMiningNodes = 100, miningNodeSize = 10, rareMineralChance = 0.1, rareMineralMultiplier = 5;
const rotationSpeed = 0.15, orbitRadius = 30, orbitSpeed = 0.05, cameraLerpFactor = 0.05, TWO_PI = Math.PI * 2;
var screenShakeMagnitude = 0, screenShakeDuration = 0, isResetting = false, isStatsWindowOpen = false;

// --- Game Objects ---
var spaceship = { x: 1500, y: 1500, speed: 1, dps: 10, critChance: 0.05, critMultiplier: 3, target: null, isMining: false, floatAngle: 0, currentAngle: 0, targetAngle: 0, orbitAngle: 0, productionMultiplier: 1, width: 40, height: 40, miningTickTimer: 0 };
var miningNodes = [], particles = [], floatingTexts = [], damageTexts = [], stars = [];

// --- UI Elements ---
const resourceCountElement = document.getElementById('resource-count');
const darkMatterCountElement = document.getElementById('dark-matter-count');
const dimensionNameElement = document.getElementById('dimension-name');
const upgradeButton1 = document.getElementById('upgrade-button-1');
const upgradeButton2 = document.getElementById('upgrade-button-2');
const stageTextElement = document.getElementById('stage-text');
const uiBottom = document.getElementById('ui-bottom');
const muteBtnElement = document.getElementById('mute-btn');
const viewStatsBtn = document.getElementById('view-stats-btn');
const statsWindow = document.getElementById('stats-window');
const tabStatsBtn = document.getElementById('tab-stats-btn');
const tabAchBtn = document.getElementById('tab-achievements-btn');
const statList = document.getElementById('stat-list');
const achList = document.getElementById('achievement-list');
const statDps = document.getElementById('stat-dps'), statCritChance = document.getElementById('stat-crit-chance'), statCritMult = document.getElementById('stat-crit-mult'), statStage = document.getElementById('stat-stage'), statTotalMined = document.getElementById('stat-total-mined'), statAchBonus = document.getElementById('stat-ach-bonus');
const gameInfoElement = document.getElementById('game-info');

function ensureButton(id, cls) { let b = document.getElementById(id); if (!b) { b = document.createElement('button'); b.id = id; if (cls) b.className = cls; uiBottom.appendChild(b); } return b; }
const upgradeButton3 = ensureButton('upgrade-button-3');
const upgradeButtonPerm = ensureButton('upgrade-button-perm', 'perm-upgrade');
const prestigeButton = ensureButton('prestige-button', 'prestige-btn');
const dimensionJumpButton = ensureButton('dimension-jump-button', 'dimension-btn hidden');

var achievements = [ { id: 'ores_100', name: 'Novice Miner', target: 100, type: 'ores', achieved: false, bonus: 0.1, desc: 'Mine 100 ores (+10% Gems)' }, { id: 'ores_1000', name: 'Master Driller', target: 1000, type: 'ores', achieved: false, bonus: 0.2, desc: 'Mine 1,000 ores (+20% Gems)' }, { id: 'stage_10', name: 'Interstellar Voyager', target: 10, type: 'stage', achieved: false, bonus: 0.3, desc: 'Reach Stage 10 (+30% Gems)' }, { id: 'dm_50', name: 'Dark Matter Collector', target: 50, type: 'dm', achieved: false, bonus: 0.5, desc: 'Have 50 Dark Matter (+50% Gems)' } ];
var achievementMultiplier = 1.0;

const BASE_MINER_COST = 10, BASE_ENGINE_COST = 50, BASE_CRIT_COST = 100, GROWTH_RATE = 1.15;

// --- Core Logic ---
function lerp(s, e, a) { return (1 - a) * s + a * e; }
function formatNumber(v) {
    if (v < 1000) return Math.floor(v).toString();
    const standardUnits = ["", "K", "M", "B", "T"];
    const exp = Math.floor(Math.log10(v) / 3);
    if (exp < standardUnits.length) return (v / Math.pow(1000, exp)).toFixed(2) + standardUnits[exp];
    const ai = exp - standardUnits.length; const c = 97 + (ai % 26); const unit = String.fromCharCode(c) + String.fromCharCode(c);
    return (v / Math.pow(1000, exp)).toFixed(2) + unit;
}

function getMinerCost() { return Math.floor(BASE_MINER_COST * Math.pow(GROWTH_RATE, minerLevel)); }
function getEngineCost() { return Math.floor(BASE_ENGINE_COST * Math.pow(GROWTH_RATE, engineLevel)); }
function getCritCost() { return Math.floor(BASE_CRIT_COST * Math.pow(1.2, critLevel)); }
function getDarkEnergyCost() { return Math.floor(BASE_DARK_ENERGY_COST * Math.pow(1.5, darkEnergyLevel)); }
function getPendingDarkMatter() { return currentStage < 5 ? 0 : Math.floor(Math.pow(currentStage - 4, 1.5) * Math.pow(5, currentDimension - 1)); }

function calculateStats() {
    const dimMult = Math.pow(5, currentDimension - 1), deMult = 1 + (darkEnergyLevel * 0.5);
    let dpsBase = (10 + (minerLevel * 10 * Math.pow(1.1, minerLevel / 5))) * deMult * dimMult;
    if (isFeverTime) { spaceship.dps = dpsBase * 2; spaceship.critChance = 1.0; currentStarSpeed = (1.2 + (engineLevel * 0.005)) * 1.5; }
    else { spaceship.dps = dpsBase; spaceship.critChance = 0.05 + (critLevel * 0.01); currentStarSpeed = 0.8 + (engineLevel * 0.005); }
    spaceship.speed = 1 + (engineLevel * 0.015); spaceship.productionMultiplier = (1 + (engineLevel * 2.0 * Math.pow(1.2, engineLevel / 10))) * dimMult;
    spaceship.critMultiplier = 3 + (critLevel * 0.1); shipTier = darkEnergyLevel >= 10 ? 3 : (darkEnergyLevel >= 5 ? 2 : 1);
    thrustColor = shipTier === 3 ? '#ff00ff' : (shipTier === 2 ? '#ff8c00' : '#00ffff');
    achievementMultiplier = 1.0; achievements.forEach(ach => { if (ach.achieved) achievementMultiplier += ach.bonus; });
}

function generateMiningNode() {
    if (miningNodes.length < maxMiningNodes) {
        const isRare = Math.random() < rareMineralChance; const theme = dimensionThemes[currentDimension] || { color: "lightgray", rare: "gold" };
        const resAmt = (isRare ? 10 * rareMineralMultiplier : 10) * Math.pow(1.2, currentStage - 1) * Math.pow(5, currentDimension - 1);
        const hpAmt = (isRare ? 100 * rareMineralMultiplier : 100) * Math.pow(1.3, currentStage - 1);
        miningNodes.push({ x: Math.random() * world.width, y: Math.random() * world.height, initialSize: miningNodeSize, currentSize: miningNodeSize, resources: resAmt, hp: hpAmt, maxHp: hpAmt, id: Date.now() + Math.random(), isRare: isRare, orbitAngle: Math.random() * TWO_PI, color: isRare ? theme.rare : theme.color });
    }
}

function update(deltaTime) {
    if (isFeverTime) { feverTimer -= deltaTime; if (feverTimer <= 0) { isFeverTime = false; calculateStats(); updateBackground(); } }
    moveSpaceship(); applyDamageToMineral(deltaTime); updateParticles(); updateFloatingTexts(); updateComet(); updateStatsWindow();
    camera.x = lerp(camera.x, spaceship.x - camera.width / 2, cameraLerpFactor); camera.y = lerp(camera.y, spaceship.y - camera.height / 2, cameraLerpFactor);
    camera.x = Math.max(0, Math.min(camera.x, world.width - camera.width)); camera.y = Math.max(0, Math.min(camera.y, world.height - camera.height));
    if (screenShakeDuration > 0) screenShakeDuration--;
    achievements.forEach(ach => { if (!ach.achieved) { let v = ach.type==='ores'?totalOresMined:(ach.type==='stage'?currentStage:darkMatter); if (v >= ach.target) { ach.achieved = true; calculateStats(); renderAchievements(); saveGame(); } } });
}

function moveSpaceship() {
    if (!spaceship.target || !miningNodes.some(n => n.id === spaceship.target.id)) { findNearestMiningNode(); return; }
    const target = spaceship.target; const dx = target.x - spaceship.x, dy = target.y - spaceship.y;
    spaceship.targetAngle = Math.atan2(dy, dx); let angleDiff = spaceship.targetAngle - spaceship.currentAngle;
    while (angleDiff > Math.PI) angleDiff -= TWO_PI; while (angleDiff < -Math.PI) angleDiff += TWO_PI; spaceship.currentAngle += angleDiff * rotationSpeed;
    if (Math.sqrt(dx*dx+dy*dy) > orbitRadius) { spaceship.x = lerp(spaceship.x, target.x, 0.05 * spaceship.speed); spaceship.y = lerp(spaceship.y, target.y, 0.05 * spaceship.speed); spaceship.isMining = false; if (Math.random() < 0.3) particles.push({ x: spaceship.x, y: spaceship.y, vx: -Math.cos(spaceship.currentAngle-Math.PI/2)*2, vy: -Math.sin(spaceship.currentAngle-Math.PI/2)*2, life: 15, color: thrustColor, size: shipTier + 1 }); }
    else { spaceship.isMining = true; spaceship.orbitAngle += orbitSpeed; spaceship.x = target.x + Math.cos(spaceship.orbitAngle) * orbitRadius; spaceship.y = target.y + Math.sin(spaceship.orbitAngle) * orbitRadius; spaceship.currentAngle = Math.atan2(target.y - spaceship.y, target.x - spaceship.x); }
}

function findNearestMiningNode() { if (miningNodes.length === 0) return; let nearestNode = null, minDSq = Infinity; miningNodes.forEach(node => { const dSq = Math.pow(node.x-spaceship.x,2)+Math.pow(node.y-spaceship.y,2); if (dSq < minDSq) { minDSq = dSq; nearestNode = node; } }); spaceship.target = nearestNode; }

function applyDamageToMineral(deltaTime) {
    if (spaceship.isMining && spaceship.target) {
        const target = spaceship.target; spaceship.miningTickTimer -= deltaTime;
        if (spaceship.miningTickTimer <= 0) {
            spaceship.miningTickTimer = 0.15; let damage = spaceship.dps * 0.15; const isCrit = Math.random() < spaceship.critChance;
            if (isCrit) { damage *= spaceship.critMultiplier; screenShakeMagnitude = 3; screenShakeDuration = 8; playSynthSFX('crit'); damageTexts.push({ x: target.x + (Math.random() - 0.5) * 20, y: target.y - 10, text: formatNumber(damage) + (isFeverTime ? " FEVER!" : " CRITICAL!"), isCritical: true, alpha: 1, life: 50 }); }
            else { if (screenShakeDuration <= 0) { screenShakeMagnitude = 0.5; screenShakeDuration = 2; } damageTexts.push({ x: target.x + (Math.random() - 0.5) * 20, y: target.y - 10, text: formatNumber(damage), isCritical: false, alpha: 1, life: 40 }); }
            target.hp -= damage;
            if (target.hp <= 0) {
                const earned = Math.floor(target.resources * spaceship.productionMultiplier * achievementMultiplier);
                resources += earned; totalOresMined++; oresMinedInStage++; playSynthSFX('break');
                if (oresMinedInStage >= oresRequiredForNextStage) { currentStage++; oresMinedInStage = 0; oresRequiredForNextStage = Math.floor(oresRequiredForNextStage * 1.1) + 5; updateBackground(); updateDimensionUI(); }
                updateStageUI(); floatingTexts.push({ x: target.x, y: target.y, text: `+${formatNumber(earned)}`, rgbColor: target.isRare ? {r:255,g:215,b:0} : {r:255,g:255,b:255}, opacity: 1, life: 60 });
                screenShakeMagnitude = 5; screenShakeDuration = 20; spawnExplosionParticles(target.x, target.y, target.color);
                miningNodes = miningNodes.filter(node => node.id !== target.id); spaceship.target = null; spaceship.isMining = false; generateMiningNode();
            } else { target.currentSize = miningNodeSize * (target.hp / target.maxHp); }
        }
    }
}

function spawnExplosionParticles(x, y, color) { for (let i = 0; i < 20; i++) { const ang = Math.random() * TWO_PI, spd = Math.random() * 3 + 1; particles.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 40, color: color, size: Math.random() * 3 + 1 }); } }
function updateParticles() { for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx; p.y += p.vy; p.life--; if (p.life <= 0) particles.splice(i, 1); } }
function updateFloatingTexts() { for (let i = floatingTexts.length - 1; i >= 0; i--) { const ft = floatingTexts[i]; ft.y -= 0.5; ft.opacity -= 1 / (ft.life || 60); if (ft.opacity <= 0) floatingTexts.splice(i, 1); } }
function drawFloatingTexts(ctx) { ctx.textAlign = 'center'; for (const ft of floatingTexts) { const c = ft.rgbColor || {r: 255, g: 255, b: 255}; ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${ft.opacity})`; ctx.font = 'bold 20px Arial'; ctx.fillText(ft.text, ft.x, ft.y); } }
function updateAndDrawDamageTexts(ctx) { for (let i = damageTexts.length - 1; i >= 0; i--) { const dt = damageTexts[i]; dt.y -= 1; dt.life--; dt.alpha = dt.life / (dt.isCritical ? 50 : 40); ctx.save(); ctx.globalAlpha = dt.alpha; ctx.font = dt.isCritical ? 'bold 24px Arial' : 'bold 18px Arial'; ctx.fillStyle = dt.isCritical ? '#FFD700' : '#FF4500'; ctx.textAlign = 'center'; ctx.fillText(dt.text, dt.x, dt.y); ctx.restore(); if (dt.life <= 0) damageTexts.splice(i, 1); } }

function spawnComet() { if (!comet) comet = { x: -50, y: Math.random() * (camera.height - 100) + 50, vx: Math.random() * 2 + 1.5, vy: (Math.random() - 0.5) * 0.5, radius: 20, life: 1000 }; }
function updateComet() { if (comet) { comet.x += comet.vx; comet.y += comet.vy; if (Math.random() < 0.3) particles.push({ x: comet.x, y: comet.y, vx: -comet.vx*0.5, vy: (Math.random()-0.5), life: 20, color: '#00ffff', size: 2 }); if (comet.x > canvas.width + 50) comet = null; } }
function drawComet(ctx) { if (comet) { ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = "#00ffff"; ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(comet.x, comet.y, 20, 0, TWO_PI); ctx.fill(); ctx.restore(); } }

function draw() {
    ctx.save(); let sx = 0, sy = 0; if (screenShakeDuration > 0) { sx = (Math.random() * 2 - 1) * screenShakeMagnitude; sy = (Math.random() * 2 - 1) * screenShakeMagnitude; } ctx.translate(sx, sy);
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => { ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, TWO_PI); ctx.fill(); s.y += s.speed; if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; } });
    if (isFeverTime) { ctx.strokeStyle = `rgba(0, 255, 255, ${Math.sin(Date.now() / 100) * 0.3 + 0.3})`; ctx.lineWidth = 10; ctx.strokeRect(0, 0, canvas.width, canvas.height); }
    ctx.save(); ctx.translate(-camera.x, -camera.y);
    miningNodes.forEach(n => { ctx.fillStyle = n.color; ctx.beginPath(); ctx.arc(n.x, n.y, n.currentSize, 0, TWO_PI); ctx.fill(); });
    particles.forEach(p => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TWO_PI); ctx.fill(); ctx.restore(); });
    const fy = Math.sin(spaceship.floatAngle) * 5; ctx.save(); ctx.translate(spaceship.x, spaceship.y + fy); ctx.rotate(spaceship.currentAngle + Math.PI / 2);
    if (tierImages[shipTier] && tierImages[shipTier].complete && tierImages[shipTier].naturalWidth !== 0) { ctx.drawImage(tierImages[shipTier], -spaceship.width / 2, -spaceship.height / 2, spaceship.width, spaceship.height); }
    else { ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-15, 20); ctx.lineTo(15, 20); ctx.closePath(); ctx.fillStyle = shipTier === 3 ? '#ff00ff' : (shipTier === 2 ? '#ff8c00' : '#00ffff'); ctx.fill(); }
    ctx.restore();
    drawFloatingTexts(ctx); updateAndDrawDamageTexts(ctx); ctx.restore(); if (comet) drawComet(ctx); ctx.restore();
    resourceCountElement.textContent = formatNumber(resources); darkMatterCountElement.textContent = formatNumber(darkMatter); updateStageUI();
}

function updateButtonText() { upgradeButton1.textContent = `Miner Lv.${minerLevel} (${formatNumber(getMinerCost())})`; upgradeButton2.textContent = `Engine Lv.${engineLevel} (${formatNumber(getEngineCost())})`; upgradeButton3.textContent = `Crit Lv.${critLevel} (${formatNumber(getCritCost())})`; upgradeButtonPerm.textContent = `Dark Energy Lv.${darkEnergyLevel} (⚛️${formatNumber(getDarkEnergyCost())})`; prestigeButton.textContent = `Prestige (+⚛️${formatNumber(getPendingDarkMatter())})`; }
function updateStatsWindow() { if (isStatsWindowOpen) { statDps.textContent = formatNumber(spaceship.dps); statCritChance.textContent = (spaceship.critChance * 100).toFixed(1) + "%"; statCritMult.textContent = "x" + spaceship.critMultiplier.toFixed(1); statStage.textContent = currentStage + ` (D-${currentDimension})`; statTotalMined.textContent = formatNumber(totalOresMined); statAchBonus.textContent = "+" + Math.round((achievementMultiplier - 1) * 100) + "%"; } }
function updateStageUI() { if (stageTextElement) { stageTextElement.textContent = `System Level: ${currentStage} (${oresMinedInStage} / ${oresRequiredForNextStage})${isFeverTime ? ' [FEVER]' : ''}`; stageTextElement.style.color = isFeverTime ? "#00ffff" : "white"; } }
function updateBackground() { const h = (currentStage - 1) * 20 % 360; bgColor = `hsl(${h}, 30%, ${isFeverTime ? '10%' : '5%'})`; }
function updateDimensionUI() { const t = dimensionThemes[currentDimension] || { name: `Dim ${currentDimension}`, color: "white" }; if (dimensionNameElement) { dimensionNameElement.textContent = t.name; dimensionNameElement.style.color = t.color; } if (currentStage >= 50) dimensionJumpButton.classList.remove('hidden'); else dimensionJumpButton.classList.add('hidden'); }
function renderAchievements() { if (achList) { achList.innerHTML = ''; achievements.forEach(a => { const i = document.createElement('div'); i.className = `achievement-item ${a.achieved ? 'achieved' : ''}`; i.innerHTML = `<strong>${a.name}</strong><br><small>${a.desc}</small>`; achList.appendChild(i); }); } }

function saveGame() { if (isResetting) return; localStorage.setItem('infiniteSpaceMinerSave', JSON.stringify({ resources, minerLevel, engineLevel, critLevel, currentStage, oresMinedInStage, oresRequiredForNextStage, totalOresMined, darkMatter, darkEnergyLevel, currentDimension, achievements, lastSaveTime: Date.now() })); }
function loadGame() {
    const saved = JSON.parse(localStorage.getItem('infiniteSpaceMinerSave'));
    if (saved) { resources = saved.resources || 0; minerLevel = saved.minerLevel || 0; engineLevel = saved.engineLevel || 0; critLevel = saved.critLevel || 0; currentStage = saved.currentStage || 1; oresMinedInStage = saved.oresMinedInStage || 0; oresRequiredForNextStage = saved.oresRequiredForNextStage || 30; totalOresMined = saved.totalOresMined || 0; darkMatter = saved.darkMatter || 0; darkEnergyLevel = saved.darkEnergyLevel || 0; currentDimension = saved.currentDimension || 1; if (saved.achievements) achievements = saved.achievements; }
    if (!oresRequiredForNextStage || oresRequiredForNextStage < 30) oresRequiredForNextStage = 30;
    if (!currentStage) currentStage = 1;
    calculateStats(); updateStageUI(); updateBackground(); updateDimensionUI(); renderAchievements(); updateButtonText();
}

function toggleStatsWindow() { isStatsWindowOpen = !isStatsWindowOpen; statsWindow.classList.toggle('hidden', !isStatsWindowOpen); if (isStatsWindowOpen) renderAchievements(); }

function initStars() { stars = []; for (let i = 0; i < numStars; i++) stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2 + 0.5, speed: Math.random() * currentStarSpeed + 0.5 }); }

muteBtnElement.addEventListener('click', toggleMute);
viewStatsBtn.addEventListener('click', toggleStatsWindow);
document.getElementById('close-stats-btn').addEventListener('click', toggleStatsWindow);
gameInfoElement.addEventListener('click', () => { gameInfoElement.classList.add('hidden'); initAudio(); });
resourceCountElement.addEventListener('click', () => { 
    initAudio(); const b = Math.max(1, spaceship.dps * 100 * spaceship.productionMultiplier * achievementMultiplier); resources += b; 
    playSynthSFX('upgrade'); floatingTexts.push({ x: window.innerWidth / 2, y: 100, text: `BONUS: +${formatNumber(b)}`, rgbColor: {r: 0, g: 255, b: 204}, opacity: 1, life: 80 }); 
});
canvas.addEventListener('mousedown', (e) => {
    initAudio(); const rect = canvas.getBoundingClientRect(); const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (comet && Math.sqrt(Math.pow(mx-comet.x,2)+Math.pow(my-comet.y,2)) < 40) { comet = null; isFeverTime = true; feverTimer = FEVER_DURATION; calculateStats(); updateBackground(); floatingTexts.push({ x: world.width / 2, y: world.height / 2, text: "FEVER TIME!!!", rgbColor: {r: 0, g: 255, b: 255}, opacity: 1, life: 120 }); return; }
    miningNodes.forEach(n => { if (Math.sqrt(Math.pow(mx+camera.x-n.x,2)+Math.pow(my+camera.y-n.y,2)) < n.currentSize + 30) { const d = spaceship.dps * 0.2; n.hp -= d; const r = Math.max(0.1, (n.resources / n.maxHp) * d * spaceship.productionMultiplier * achievementMultiplier); resources += r; playSynthSFX('break'); damageTexts.push({ x: n.x, y: n.y, text: formatNumber(d), isCritical: false, alpha: 1, life: 30 }); floatingTexts.push({ x: n.x, y: n.y - 20, text: `+${formatNumber(r)}`, rgbColor: {r:255,g:255,b:255}, opacity: 1, life: 40 }); } });
});

window.addEventListener('keydown', (e) => { if (e.key.toLowerCase()==='f') { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } if (e.key.toLowerCase()==='r') { if (confirm('Reset all?')) { isResetting = true; localStorage.clear(); location.reload(); } } });
upgradeButton1.addEventListener('click', () => { const cost = getMinerCost(); if (resources >= cost) { resources -= cost; minerLevel++; playSynthSFX('upgrade'); calculateStats(); updateButtonText(); saveGame(); } });
upgradeButton2.addEventListener('click', () => { const cost = getEngineCost(); if (resources >= cost) { resources -= cost; engineLevel++; playSynthSFX('upgrade'); calculateStats(); initStars(); updateButtonText(); saveGame(); } });
upgradeButton3.addEventListener('click', () => { const cost = getCritCost(); if (resources >= cost) { resources -= cost; critLevel++; playSynthSFX('upgrade'); calculateStats(); updateButtonText(); saveGame(); } });
upgradeButtonPerm.addEventListener('click', () => { const cost = getDarkEnergyCost(); if (darkMatter >= cost) { darkMatter -= cost; darkEnergyLevel++; playSynthSFX('upgrade'); calculateStats(); updateButtonText(); saveGame(); } });
prestigeButton.addEventListener('click', () => { if (currentStage < 5) return; const g = getPendingDarkMatter(); if (confirm(`Prestige for ⚛️ ${formatNumber(g)}?`)) { darkMatter += g; resources = 0; minerLevel = 0; engineLevel = 0; critLevel = 0; currentStage = 1; oresMinedInStage = 0; oresRequiredForNextStage = 30; calculateStats(); updateBackground(); updateStageUI(); updateButtonText(); miningNodes = []; for(let i=0; i<maxMiningNodes; i++) generateMiningNode(); saveGame(); } });
dimensionJumpButton.addEventListener('click', () => { if (currentStage < 50) return; if (confirm('Jump to next dimension? (All reset for x5 Bonus)')) { currentDimension++; resources = 0; minerLevel = 0; engineLevel = 0; critLevel = 0; darkMatter = 0; darkEnergyLevel = 0; currentStage = 1; oresMinedInStage = 0; oresRequiredForNextStage = 30; calculateStats(); updateBackground(); updateStageUI(); updateDimensionUI(); updateButtonText(); miningNodes = []; for(let i=0; i<maxMiningNodes; i++) generateMiningNode(); saveGame(); } });
tabStatsBtn.addEventListener('click', () => { statList.classList.remove('hidden'); achList.classList.add('hidden'); tabStatsBtn.classList.add('active'); tabAchBtn.classList.remove('active'); });
tabAchBtn.addEventListener('click', () => { statList.classList.add('hidden'); achList.classList.remove('hidden'); tabAchBtn.classList.add('active'); tabStatsBtn.classList.remove('active'); renderAchievements(); });

function gameLoop() { const now = Date.now(), deltaTime = (now - lastUpdate) / 1000; lastUpdate = now; update(deltaTime); draw(); requestAnimationFrame(gameLoop); }
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; camera.width = canvas.width; camera.height = canvas.height; initStars(); });
canvas.width = window.innerWidth; canvas.height = window.innerHeight; loadGame(); initStars(); for(let i=0; i<maxMiningNodes; i++) generateMiningNode(); setInterval(generateMiningNode, 1000); setInterval(spawnComet, 90000); setInterval(saveGame, 10000); gameLoop();
