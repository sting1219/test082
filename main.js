
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- World & Camera ---
const world = { width: 3000, height: 3000 };
const camera = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };

// --- Game State ---
let resources = 0;
let lastUpdate = Date.now();
let minerLevel = 0;
let minerCost = 10;
let engineLevel = 0;
let engineCost = 50;

// --- Game Objects ---
let spaceship = {
    x: world.width / 2,
    y: world.height / 2,
    speed: 1,
    dps: 10,
    target: null,
    isMining: false,
    floatAngle: 0,
    currentAngle: 0,
    targetAngle: 0,
    productionMultiplier: 1,
};
let miningNodes = [];
let particles = [];
let floatingTexts = [];
let stars = [];

// --- Game Parameters ---
const numStars = 200;
let currentStarSpeed = 2;
const maxMiningNodes = 15;
const miningNodeSize = 10;
const rareMineralChance = 0.1;
const rareMineralMultiplier = 5;
const rotationSpeed = 0.05;
const orbitRadius = miningNodeSize + 5;
const orbitSpeed = 0.05;
const cameraLerpFactor = 0.05;
const TWO_PI = Math.PI * 2;
let screenShakeMagnitude = 0;
let screenShakeDuration = 0;
let shakeAngle = 0;

// --- UI Elements ---
const resourceCountElement = document.getElementById('resource-count');
const upgradeButton1 = document.getElementById('upgrade-button-1');
const upgradeButton2 = document.getElementById('upgrade-button-2');
const gameInfoElement = document.getElementById('game-info');

// --- Utility Functions ---
function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

function hexToRgb(hex) {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return { r, g, b };
}

// --- Initialization ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.width = canvas.width;
    camera.height = canvas.height;
    initStars();
}

function initStars() {
    stars = [];
    for (let i = 0; i < numStars; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * currentStarSpeed + 0.5
        });
    }
}

// --- Object Generation ---
function generateMiningNode() {
    if (miningNodes.length < maxMiningNodes) {
        const isRare = Math.random() < rareMineralChance;
        const resourcesAmount = isRare ? 10 * rareMineralMultiplier : 10;
        const hpAmount = isRare ? 100 * rareMineralMultiplier : 100;

        miningNodes.push({
            x: Math.random() * world.width,
            y: Math.random() * world.height,
            initialSize: miningNodeSize,
            currentSize: miningNodeSize,
            resources: resourcesAmount,
            hp: hpAmount,
            maxHp: hpAmount,
            id: Date.now() + Math.random(),
            isRare: isRare
        });
    }
}

// --- Update Functions ---
function update(deltaTime) {
    spaceship.floatAngle += 0.05;
    shakeAngle += 0.2;

    moveSpaceship();
    applyDamageToMineral(deltaTime);
    updateParticles(deltaTime);
    updateFloatingTexts(deltaTime);
    
    // Update Camera to follow spaceship
    camera.x = lerp(camera.x, spaceship.x - camera.width / 2, cameraLerpFactor);
    camera.y = lerp(camera.y, spaceship.y - camera.height / 2, cameraLerpFactor);

    // Clamp camera to world boundaries
    camera.x = Math.max(0, Math.min(camera.x, world.width - camera.width));
    camera.y = Math.max(0, Math.min(camera.y, world.height - camera.height));
    
    if (screenShakeDuration > 0) {
        screenShakeDuration--;
    }
}

function moveSpaceship() {
    if (!spaceship.target || !miningNodes.some(n => n.id === spaceship.target.id)) {
        findNearestMiningNode();
        return;
    }

    const target = spaceship.target;
    const dx = target.x - spaceship.x;
    const dy = target.y - spaceship.y;
    const distanceSq = dx * dx + dy * dy; // Use squared distance for comparison

    spaceship.targetAngle = Math.atan2(dy, dx);
    let angleDiff = spaceship.targetAngle - spaceship.currentAngle;
    while (angleDiff > Math.PI) angleDiff -= TWO_PI;
    while (angleDiff < -Math.PI) angleDiff += TWO_PI;
    spaceship.currentAngle += angleDiff * rotationSpeed;
    
    const minDistance = orbitRadius + spaceship.speed;

    if (distanceSq > minDistance * minDistance) {
        spaceship.x = lerp(spaceship.x, target.x, 0.05 * spaceship.speed);
        spaceship.y = lerp(spaceship.y, target.y, 0.05 * spaceship.speed);
        spaceship.isMining = false;
        if (Math.random() < 0.5) {
            spawnBoosterParticles();
        }
    } else {
        spaceship.isMining = true;
        target.orbitAngle = (target.orbitAngle || 0) + orbitSpeed;
        spaceship.x = target.x + Math.cos(target.orbitAngle) * orbitRadius;
        spaceship.y = target.y + Math.sin(target.orbitAngle) * orbitRadius;
    }
}

function findNearestMiningNode() {
    if (miningNodes.length === 0) return;

    let nearestNode = null;
    let minDistanceSq = Infinity;

    miningNodes.forEach(node => {
        const dx = node.x - spaceship.x;
        const dy = node.y - spaceship.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            nearestNode = node;
        }
    });
    spaceship.target = nearestNode;
}

function applyDamageToMineral(deltaTime) {
    if (spaceship.isMining && spaceship.target) {
        const target = spaceship.target;
        target.hp -= spaceship.dps * deltaTime;
        
        if (Math.random() < 0.1) spawnResourceParticles(target);

        if (screenShakeDuration <= 0) {
            screenShakeMagnitude = 0.5;
            screenShakeDuration = 2;
        }

        if (target.hp <= 0) {
            const earned = Math.floor(target.resources * spaceship.productionMultiplier);
            resources += earned;
            const color = target.isRare ? '#FFD700' : '#FFFFFF';
            floatingTexts.push({
                x: target.x,
                y: target.y,
                text: `+${earned}`,
                rgbColor: hexToRgb(color),
                opacity: 1,
                life: 60,
            });

            screenShakeMagnitude = 5;
            screenShakeDuration = 20;
            spawnExplosionParticles(target.x, target.y, target.isRare ? 'gold' : 'lightgray');

            miningNodes = miningNodes.filter(node => node.id !== target.id);
            spaceship.target = null;
            spaceship.isMining = false;
            generateMiningNode();
        } else {
            target.currentSize = miningNodeSize * (target.hp / target.maxHp);
        }
    }
}

function updateParticles(deltaTime) {
    const newParticles = [];
    for (const p of particles) {
        if (p.type === 'resource_attraction') {
            const dx = spaceship.x - p.x;
            const dy = spaceship.y - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const attractionSpeed = 3;
            if (distance < 10) {
                p.life = 0; // Mark for removal
            } else {
                p.vx = (dx / distance) * attractionSpeed;
                p.vy = (dy / distance) * attractionSpeed;
            }
        }

        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if (p.life > 0) {
            newParticles.push(p);
        }
    }
    particles = newParticles;
}

function updateFloatingTexts(deltaTime) {
    const newFloatingTexts = [];
    for (const ft of floatingTexts) {
        ft.y -= 0.5; // floatingTextSpeed
        ft.opacity -= 1 / ft.life;
        if (ft.opacity > 0) {
            newFloatingTexts.push(ft);
        }
    }
    floatingTexts = newFloatingTexts;
}


// --- Drawing Functions ---
function draw() {
    // --- Screen-space drawings (UI, Background) ---
    ctx.save();
    let shakeX = 0, shakeY = 0;
    if (screenShakeDuration > 0) {
        shakeX = (Math.random() * 2 - 1) * screenShakeMagnitude;
        shakeY = (Math.random() * 2 - 1) * screenShakeMagnitude;
    }
    ctx.translate(shakeX, shakeY);
    
    // Clear and draw background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawStars();

    // --- World-space drawings (Game Objects) ---
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    drawMiningNodes(ctx);
    drawParticles(ctx);
    drawSpaceship(ctx);
    drawFloatingTexts(ctx);

    ctx.restore(); // Restore from camera translation
    ctx.restore(); // Restore from shake translation
    
    // Update UI text (not canvas)
    resourceCountElement.textContent = Math.floor(resources);
}

function drawStars() {
    ctx.fillStyle = 'white';
    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, TWO_PI);
        ctx.fill();

        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
            star.speed = Math.random() * currentStarSpeed + 0.5;
        }
    });
}

function drawSpaceship(ctx) {
    const floatY = Math.sin(spaceship.floatAngle) * 5;
    ctx.save();
    ctx.translate(spaceship.x, spaceship.y + floatY);
    ctx.rotate(spaceship.currentAngle + Math.PI / 2);
    ctx.globalCompositeOperation = 'lighter';

    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(-10, 15);
    ctx.lineTo(10, 15);
    ctx.closePath();
    ctx.fillStyle = '#FF0077';
    ctx.fill();
    ctx.restore();
}

function drawMiningNodes(ctx) {
    miningNodes.forEach(node => {
        // Culling: Don't draw if off-screen
        const size = node.currentSize;
        if (node.x + size < camera.x || node.x - size > camera.x + camera.width ||
            node.y + size < camera.y || node.y - size > camera.y + camera.height) {
            return;
        }
        
        let drawX = node.x;
        let drawY = node.y;

        if (spaceship.isMining && spaceship.target && node.id === spaceship.target.id) {
            drawX += Math.sin(shakeAngle) * 2;
            drawY += Math.cos(shakeAngle) * 2;
        }

        ctx.fillStyle = node.isRare ? 'gold' : 'lightgray';
        ctx.beginPath();
        ctx.arc(drawX, drawY, size, 0, TWO_PI);
        ctx.fill();
    });
}

function drawParticles(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
        // Culling
        const size = p.size;
        if (p.x + size < camera.x || p.x - size > camera.x + camera.width ||
            p.y + size < camera.y || p.y - size > camera.y + camera.height) {
            continue;
        }
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
        ctx.fill();
    }
    ctx.restore();
}

function drawFloatingTexts(ctx) {
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    for (const ft of floatingTexts) {
        // Culling
        if (ft.x < camera.x || ft.x > camera.x + camera.width ||
            ft.y < camera.y || ft.y > camera.y + camera.height) {
            continue;
        }
        const { r, g, b } = ft.rgbColor;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${ft.opacity})`;
        ctx.fillText(ft.text, ft.x, ft.y);
    }
}

// --- Particle Spawning ---
function spawnBoosterParticles() {
    const angle = spaceship.currentAngle - Math.PI/2 + (Math.random() - 0.5) * 0.5;
    particles.push({
        x: spaceship.x, y: spaceship.y,
        vx: -Math.cos(angle) * (Math.random() * 2 + 1),
        vy: -Math.sin(angle) * (Math.random() * 2 + 1),
        life: 20 + Math.random() * 10, color: '#FF4500', size: 2 + Math.random() * 2
    });
}
function spawnResourceParticles(node) {
    particles.push({
        x: node.x, y: node.y, vx: 0, vy: 0,
        life: 60 + Math.random() * 20, color: node.isRare ? 'gold' : 'lightgray',
        size: 3 + Math.random() * 2, type: 'resource_attraction'
    });
}
function spawnExplosionParticles(x, y, color) {
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * TWO_PI;
        const speed = Math.random() * 4 + 2;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: 45 + Math.random() * 15, color: color, size: 3 + Math.random() * 3
        });
    }
}

// --- Save/Load & UI ---
function updateButtonText() {
    upgradeButton1.textContent = `Miner Upgrade (🛠️) Lv.${minerLevel} (Next: 💎${Math.floor(minerCost)})`;
    upgradeButton2.textContent = `Engine Booster (⚡) Lv.${engineLevel} (Next: 💎${Math.floor(engineCost)})`;
}

function upgrade1() { // Miner
    if (resources >= minerCost) {
        resources -= minerCost;
        minerLevel++;
        spaceship.dps += 10;
        minerCost = Math.floor(minerCost * 1.5);
        updateButtonText();
        saveGame();
    }
}

function upgrade2() { // Engine
    if (resources >= engineCost) {
        resources -= engineCost;
        engineLevel++;
        engineCost = Math.floor(engineCost * 1.8);
        currentStarSpeed += 0.5;
        spaceship.productionMultiplier += 1;
        spaceship.speed += 0.2;
        initStars();
        updateButtonText();
        saveGame();
    }
}

function saveGame() {
    const gameState = {
        resources, minerLevel, minerCost, engineLevel, engineCost,
        lastSaveTime: Date.now(),
    };
    localStorage.setItem('infiniteSpaceMinerSave', JSON.stringify(gameState));
    console.log('Game Saved!');
}

function loadGame() {
    const savedState = localStorage.getItem('infiniteSpaceMinerSave');
    if (savedState) {
        const gs = JSON.parse(savedState);
        resources = gs.resources || 0;
        minerLevel = gs.minerLevel || 0;
        minerCost = gs.minerCost || 10;
        engineLevel = gs.engineLevel || 0;
        engineCost = gs.engineCost || 50;

        spaceship.dps = 10 + (minerLevel * 10);
        currentStarSpeed = 2 + (engineLevel * 0.5);
        spaceship.productionMultiplier = 1 + (engineLevel * 1);
        spaceship.speed = 1 + (engineLevel * 0.2);
    }
    updateButtonText();
    console.log(savedState ? 'Game Loaded!' : 'No saved game found.');
}

// --- Main Loop ---
function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - lastUpdate) / 1000;
    lastUpdate = now;

    update(deltaTime);
    draw();
    
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners & Initial Setup ---
upgradeButton1.addEventListener('click', upgrade1);
upgradeButton2.addEventListener('click', upgrade2);
resourceCountElement.addEventListener('click', () => {
    resources += 10000; // Cheat
});
gameInfoElement.addEventListener('click', () => {
    gameInfoElement.classList.add('hidden');
});
window.addEventListener('resize', resizeCanvas);
window.addEventListener('beforeunload', saveGame);

// --- Start Game ---
resizeCanvas();
for(let i=0; i<maxMiningNodes; i++) { generateMiningNode(); }
setInterval(generateMiningNode, 3000);
setInterval(saveGame, 10000);
loadGame();
gameLoop();
