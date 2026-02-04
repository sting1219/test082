const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let resources = 0;
let displayedResources = 0; // For smooth animation of resource count
let lastUpdate = Date.now();

let engineProductionMultiplier = 1;

let minerLevel = 0;
let minerCost = 10; // Initial cost for miner upgrade

let engineLevel = 0;
let engineCost = 50; // Initial cost for engine upgrade

const resourceCountElement = document.getElementById('resource-count');
const upgradeButton1 = document.getElementById('upgrade-button-1');
const upgradeButton2 = document.getElementById('upgrade-button-2');

// Game Info Element
const gameInfoElement = document.getElementById('game-info');

let stars = [];
const numStars = 200;
let currentStarSpeed = 2; // Use a variable for star speed

// --- Spaceship -- -
let spaceshipX = canvas.width / 2;
let spaceshipY = canvas.height / 2;
let spaceshipSpeed = 1; // Pixels per frame, changed to let for upgrades
let minerDPS = 10; // Initial Damage Per Second for the miner
let spaceshipTarget = null; // Current mining node target
let isMining = false; // Initialize isMining state
let floatAngle = 0;
let shakeAngle = 0; // For smooth shaking animation

// --- Particle System -- -
let particles = [];

// --- Floating Texts -- -
let floatingTexts = [];
const floatingTextSpeed = 0.5;
let floatingTextLife = 60; // Frames

// --- Screen Shake variables -- -
let screenShakeMagnitude = 0;
let screenShakeDuration = 0;

// --- Rotation -- -
let currentAngle = 0;
let targetAngle = 0;
const rotationSpeed = 0.05;

// --- Mining Nodes -- -
let miningNodes = [];
const maxMiningNodes = 10;
const miningNodeSize = 10;
const rareMineralChance = 0.1;
const rareMineralMultiplier = 5;

// Orbiting variables
let currentOrbitAngle = 0;
const orbitRadius = miningNodeSize + 5;
const orbitSpeed = 0.05;

// --- Camera Variables ---
let cameraX = 0;
let cameraY = 0;
let targetCameraX = 0;
let targetCameraY = 0;
const cameraLerpFactor = 0.05;

// --- Constants ---
const TWO_PI = Math.PI * 2;

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

function hexToRgb(hex) {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return { r, g, b };
}


// --- MiningNode Variables ---
const standardHpAmount = 100;
const standardResourceAmount = 10;

function generateMiningNode() {
    if (miningNodes.length < maxMiningNodes) {
        const isRare = Math.random() < rareMineralChance;
        const resourcesAmount = isRare ? standardResourceAmount * rareMineralMultiplier : standardResourceAmount;
        const hpAmount = isRare ? standardHpAmount * rareMineralMultiplier : standardHpAmount;

        miningNodes.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
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

function drawSpaceship() {
    const floatY = Math.sin(floatAngle) * 5;
    ctx.save();
    ctx.translate(spaceshipX, spaceshipY + floatY);
    ctx.rotate(currentAngle + Math.PI / 2);
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

function drawMiningNodes() {
    miningNodes.forEach(node => {
        let drawX = node.x;
        let drawY = node.y;

        if (isMining && spaceshipTarget && node.id === spaceshipTarget.id) {
            drawX += Math.sin(shakeAngle) * 2;
            drawY += Math.cos(shakeAngle) * 2;
        }

        ctx.fillStyle = node.isRare ? 'gold' : 'lightgray';
        ctx.beginPath();
        ctx.arc(drawX, drawY, node.currentSize, 0, TWO_PI);
        ctx.fill();
    });
}

function drawFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const textObj = floatingTexts[i];
        textObj.y -= floatingTextSpeed;
        textObj.opacity -= 1 / floatingTextLife;

        if (textObj.opacity <= 0) {
            floatingTexts.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.font = 'bold 20px Arial';
        const { r, g, b } = textObj.rgbColor;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${textObj.opacity})`;
        ctx.textAlign = 'center';
        ctx.fillText(textObj.text, textObj.x, textObj.y);
        ctx.restore();
    }
}

function findNearestMiningNode() {
    if (miningNodes.length === 0) {
        for (let i = 0; i < maxMiningNodes; i++) {
            generateMiningNode();
        }
        return;
    }

    let nearestNode = null;
    let minDistance = Infinity;

    miningNodes.forEach(node => {
        const dx = node.x - spaceshipX;
        const dy = node.y - spaceshipY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
            minDistance = distance;
            nearestNode = node;
        }
    });
    spaceshipTarget = nearestNode;
}

function spawnBoosterParticles() {
    const backX = spaceshipX + Math.cos(currentAngle + Math.PI/2) * 15;
    const backY = spaceshipY + Math.sin(currentAngle + Math.PI/2) * 15;
    const angle = currentAngle - Math.PI/2 + (Math.random() - 0.5) * 0.5;
    const speed = Math.random() * 2 + 1;

    particles.push({
        x: backX,
        y: backY,
        vx: -Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
        life: 20 + Math.random() * 10,
        color: '#FF4500',
        size: 2 + Math.random() * 2
    });
}

function spawnResourceParticles(node) {
    const numParticles = 1;
    for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * TWO_PI;
        const startX = node.x + (Math.random() - 0.5) * node.currentSize;
        const startY = node.y + (Math.random() - 0.5) * node.currentSize;

        particles.push({
            x: startX,
            y: startY,
            vx: 0,
            vy: 0,
            life: 60 + Math.random() * 20,
            color: node.isRare ? 'gold' : 'lightgray',
            size: 3 + Math.random() * 2,
            type: 'resource_attraction'
        });
    }
}

function moveSpaceship() {
    if (!spaceshipTarget) {
        findNearestMiningNode();
        return;
    }

    const dx = spaceshipTarget.x - spaceshipX;
    const dy = spaceshipTarget.y - spaceshipY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    targetAngle = Math.atan2(dy, dx);
    let angleDiff = targetAngle - currentAngle;
    while (angleDiff > Math.PI) angleDiff -= TWO_PI;
    while (angleDiff < -Math.PI) angleDiff += TWO_PI;

    currentAngle += angleDiff * rotationSpeed;

    if (distance > orbitRadius + spaceshipSpeed) {
        spaceshipX = lerp(spaceshipX, spaceshipTarget.x, 0.05 * spaceshipSpeed);
        spaceshipY = lerp(spaceshipY, spaceshipTarget.y, 0.05 * spaceshipSpeed);
        isMining = false;
        if (Math.random() < 0.5) {
            spawnBoosterParticles();
        }
    } else if (distance > miningNodeSize / 2) {
        isMining = true;
        currentOrbitAngle += orbitSpeed;
        spaceshipX = spaceshipTarget.x + Math.cos(currentOrbitAngle) * orbitRadius;
        spaceshipY = spaceshipTarget.y + Math.sin(currentOrbitAngle) * orbitRadius;
    } else {
        isMining = true;
        spaceshipX = spaceshipTarget.x + Math.cos(currentOrbitAngle) * orbitRadius;
        spaceshipY = spaceshipTarget.y + Math.sin(currentOrbitAngle) * orbitRadius;
    }
}

function spawnContactParticles(x, y, color = 'lightgray') {
    for (let i = 0; i < 3; i++) {
        const angle = Math.random() * TWO_PI;
        const speed = Math.random() * 0.5;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 15 + Math.random() * 10,
            color: color,
            size: 1 + Math.random() * 2
        });
    }
}

function saveGame() {
    const gameState = {
        resources: resources,
        minerLevel: minerLevel,
        minerCost: minerCost,
        engineLevel: engineLevel,
        engineCost: engineCost,
        lastSaveTime: Date.now(),
    };
    localStorage.setItem('infiniteSpaceMinerSave', JSON.stringify(gameState));
    console.log('Game Saved!');
}

function resetGame() {
    resources = 0;
    minerLevel = 0;
    minerCost = 10;
    engineLevel = 0;
    engineCost = 50;

    currentStarSpeed = 2;
    engineProductionMultiplier = 1;
    spaceshipSpeed = 1;
    minerDPS = 10;

    updateButtonText();
    saveGame();
    console.log("Game Reset!");
}

function loadGame() {
    const savedState = localStorage.getItem('infiniteSpaceMinerSave');
    if (savedState) {
        const gameState = JSON.parse(savedState);
        resources = gameState.resources || 0;
        displayedResources = resources;
        minerLevel = gameState.minerLevel || 0;
        minerCost = gameState.minerCost || 10;
        engineLevel = gameState.engineLevel || 0;
        engineCost = gameState.engineCost || 50;
        lastUpdate = Date.now();

        currentStarSpeed = 2 + (engineLevel * 0.5);
        engineProductionMultiplier = 1 + (engineLevel * 1);
        spaceshipSpeed = 1 + (engineLevel * 0.2);
        minerDPS = 10 + (minerLevel * 10);
        
        updateButtonText();
        initStars();
        
        console.log('Game Loaded!');
        return null;
    }
    console.log('No saved game found.');
    return null;
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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

function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

function updateButtonText() {
    upgradeButton1.textContent = `Miner Upgrade (🛠️) Lv.${minerLevel} (Next: 💎${Math.floor(minerCost)})`;
    upgradeButton2.textContent = `Engine Booster (⚡) Lv.${engineLevel} (Next: 💎${Math.floor(engineCost)})`;
}

function upgrade1() {
    if (resources >= minerCost) {
        resources -= minerCost;
        resourceCountElement.textContent = Math.floor(resources);
        minerLevel++;
        minerDPS += 10;
        minerCost = Math.floor(minerCost * 1.5);
        updateButtonText();
        saveGame();
    } else {
        console.log("Not enough resources for Miner Upgrade!");
    }
}

function upgrade2() {
    if (resources >= engineCost) {
        resources -= engineCost;
        resourceCountElement.textContent = Math.floor(resources);
        engineLevel++;
        engineCost = Math.floor(engineCost * 1.8);
        currentStarSpeed += 0.5;
        engineProductionMultiplier += 1;
        spaceshipSpeed += 0.2;
        initStars();
        updateButtonText();
        saveGame();
    } else {
        console.log("Not enough resources for Engine Booster!");
    }
}

upgradeButton1.addEventListener('click', upgrade1);
upgradeButton2.addEventListener('click', upgrade2);
resourceCountElement.addEventListener('click', () => {
    const cheatAmount = 10000;
    resources += cheatAmount;
    displayedResources = resources;
    resourceCountElement.textContent = Math.floor(resources);
    console.log(`CHEAT: Added ${cheatAmount} resources by clicking.`);
});
gameInfoElement.addEventListener('click', () => {
    gameInfoElement.classList.add('hidden');
});
window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') {
        document.body.classList.toggle('fullscreen-active');
    }
    if (e.key === 'r' || e.key === 'R') {
        resetGame();
    }
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
initStars();

setInterval(generateMiningNode, 5000);

updateButtonText();
setInterval(saveGame, 10000);
window.addEventListener('beforeunload', saveGame);

function spawnMiningDebrisParticles(x, y, color = 'lightgray') {
    for (let i = 0; i < 2; i++) {
        const angle = Math.random() * TWO_PI;
        const speed = Math.random() * 2 + 1;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 10,
            color: color,
            size: 2 + Math.random() * 2
        });
    }
}

function spawnExplosionParticles(x, y, color) {
    const numExplosionParticles = 30;
    for (let i = 0; i < numExplosionParticles; i++) {
        const angle = Math.random() * TWO_PI;
        const speed = Math.random() * 4 + 2;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 45 + Math.random() * 15,
            color: color,
            size: 3 + Math.random() * 3
        });
    }
}

function applyDamageToMineral(deltaTime) {
    if (isMining && spaceshipTarget) {
        spaceshipTarget.hp -= minerDPS * deltaTime;
        if (Math.random() < 0.2) {
            spawnMiningDebrisParticles(spaceshipX, spaceshipY, spaceshipTarget.isRare ? 'gold' : 'lightgray');
        }
        if (Math.random() < 0.1) {
            spawnResourceParticles(spaceshipTarget);
        }
        if (screenShakeDuration <= 0) {
            screenShakeMagnitude = 0.5;
            screenShakeDuration = 2;
        }
        if (spaceshipTarget.hp <= 0) {
            resources += spaceshipTarget.resources * engineProductionMultiplier;
            resourceCountElement.textContent = Math.floor(resources);
            const color = spaceshipTarget.isRare ? '#FFD700' : '#FFFFFF';
            floatingTexts.push({
                x: spaceshipTarget.x,
                y: spaceshipTarget.y,
                text: `+${Math.floor(spaceshipTarget.resources * engineProductionMultiplier)}`,
                color: color,
                rgbColor: hexToRgb(color),
                opacity: 1
            });
            screenShakeMagnitude = 5;
            screenShakeDuration = 20;
            spawnExplosionParticles(spaceshipTarget.x, spaceshipTarget.y, spaceshipTarget.isRare ? 'gold' : 'lightgray');
            miningNodes = miningNodes.filter(node => node.id !== spaceshipTarget.id);
            spaceshipTarget = null;
            isMining = false;
            generateMiningNode();
        } else {
            spaceshipTarget.currentSize = miningNodeSize * (spaceshipTarget.hp / spaceshipTarget.maxHp);
        }
    }
}

function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - lastUpdate) / 1000;
    lastUpdate = now;
    floatAngle += 0.05;
    shakeAngle += 0.2;

    let shakeX = 0;
    let shakeY = 0;
    if (screenShakeDuration > 0) {
        shakeX = (Math.random() * 2 - 1) * screenShakeMagnitude;
        shakeY = (Math.random() * 2 - 1) * screenShakeMagnitude;
        screenShakeDuration--;
    }
    
    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawStars();
    drawMiningNodes();
    drawFloatingTexts();
    
    moveSpaceship();

    targetCameraX = spaceshipX;
    targetCameraY = spaceshipY;

    cameraX = lerp(cameraX, targetCameraX - canvas.width / 2, cameraLerpFactor);
    cameraY = lerp(cameraY, targetCameraY - canvas.height / 2, cameraLerpFactor);

    drawSpaceship();
    applyDamageToMineral(deltaTime);

    if (isMining && spaceshipTarget) {
        if (Math.random() < 0.3) {
            spawnContactParticles(spaceshipTarget.x, spaceshipTarget.y, spaceshipTarget.isRare ? 'gold' : 'lightgray');
        }
    }
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const newParticles = [];
    for (const p of particles) {

        if (p.type === 'resource_attraction') {
            const dx = spaceshipX - p.x;
            const dy = spaceshipY - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const attractionSpeed = 3;
            if (distance < 10) {
                continue;
            }
            p.vx = (dx / distance) * attractionSpeed;
            p.vy = (dy / distance) * attractionSpeed;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if (p.life > 0) {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
            ctx.fill();
            newParticles.push(p);
        }
    }
    particles = newParticles;
    ctx.restore();
    
    ctx.restore();
    
    requestAnimationFrame(gameLoop);
}

loadGame();
gameLoop();