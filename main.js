const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let resources = 0;
let displayedResources = 0; // For smooth animation of resource count
let baseMiningPower = 0; // Initial automatic mining power, set to 0 for active mining
let minerProductionBonus = 0;
let engineProductionMultiplier = 1;
let productionRate = (baseMiningPower + minerProductionBonus) * engineProductionMultiplier; // Total resources per second
let lastUpdate = Date.now();

let minerLevel = 0;
let minerCost = 10; // Initial cost for miner upgrade

let engineLevel = 0;
let engineCost = 50; // Initial cost for engine upgrade

const resourceCountElement = document.getElementById('resource-count');
const productionRateElement = document.getElementById('production-rate');
const upgradeButton1 = document.getElementById('upgrade-button-1');
const upgradeButton2 = document.getElementById('upgrade-button-2');

// Offline Bonus Popup Elements
const offlineBonusPopup = document.getElementById('offline-bonus-popup');
const offlineResourcesEarnedElement = document.getElementById('offline-resources-earned');
const closePopupButton = document.getElementById('close-popup');

// Game Info Element
const gameInfoElement = document.getElementById('game-info');

let stars = [];
const numStars = 200;
let currentStarSpeed = 2; // Use a variable for star speed

// --- Spaceship ---
const spaceshipElement = document.getElementById('spaceship');
let spaceshipX = canvas.width / 2;
let spaceshipY = canvas.height / 2;
const spaceshipSpeed = 2; // Pixels per frame
let spaceshipTarget = null; // Current mining node target
let isMining = false; // Is the spaceship currently mining?

// --- Rotation ---
let currentAngle = 0;
let targetAngle = 0;
const rotationSpeed = 0.05; // Controls how fast the ship rotates

// --- Mining Nodes ---
let miningNodes = [];
const maxMiningNodes = 10;
const miningNodeSize = 10;
const miningNodeValue = 5; // Base resources per node

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

function generateMiningNode() {
    if (miningNodes.length < maxMiningNodes) {
        miningNodes.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: miningNodeSize,
            resources: miningNodeValue + Math.random() * miningNodeValue, // Nodes have varying resources
            id: Date.now() + Math.random() // Unique ID for tracking
        });
    }
}

function drawMiningNodes() {
    miningNodes.forEach(node => {
        let drawX = node.x;
        let drawY = node.y;

        // Apply shake effect if this node is being mined
        if (isMining && spaceshipTarget && node.id === spaceshipTarget.id) {
            drawX += (Math.random() - 0.5) * 4; // Random shake of +/- 2 pixels
            drawY += (Math.random() - 0.5) * 4;
        }

        ctx.fillStyle = 'lightgray'; // Color for mining nodes
        ctx.beginPath();
        ctx.arc(drawX, drawY, node.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawMiningLaser() {
    if (isMining && spaceshipTarget) {
        ctx.strokeStyle = 'cyan'; // Laser color
        ctx.lineWidth = 2; // Laser width
        ctx.beginPath();
        ctx.moveTo(spaceshipX, spaceshipY);
        ctx.lineTo(spaceshipTarget.x, spaceshipTarget.y);
        ctx.stroke();
    }
}
// --- End Mining Nodes ---

// --- Spaceship Movement ---
function findNearestMiningNode() {
    if (isMining || miningNodes.length === 0) {
        if (miningNodes.length === 0) {
            for (let i = 0; i < maxMiningNodes; i++) {
                generateMiningNode();
            }
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

function moveSpaceship() {
    if (isMining) return; // Don't move while mining

    if (!spaceshipTarget) {
        // No target, idle state
        spaceshipElement.classList.remove('mining');
        findNearestMiningNode();
        return;
    }

    const dx = spaceshipTarget.x - spaceshipX;
    const dy = spaceshipTarget.y - spaceshipY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Update target angle
    targetAngle = Math.atan2(dy, dx);
    
    // Smoothly rotate
    // Handle angle wrapping for smooth rotation
    let angleDiff = targetAngle - currentAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    currentAngle += angleDiff * rotationSpeed;
    
    if (distance > miningNodeSize) { // Move if not at target
        // Use the direct angle for movement to prevent orbiting
        spaceshipX += Math.cos(targetAngle) * spaceshipSpeed;
        spaceshipY += Math.sin(targetAngle) * spaceshipSpeed;
        spaceshipElement.classList.remove('mining');
    } else { // Arrived at target, start mining
        isMining = true;
        spaceshipElement.classList.add('mining');
        
        setTimeout(() => {
            if (!spaceshipTarget) return; // Target might have been removed

            resources += spaceshipTarget.resources * engineProductionMultiplier;
            displayedResources = resources;
            resourceCountElement.textContent = Math.floor(displayedResources);

            miningNodes = miningNodes.filter(node => node.id !== spaceshipTarget.id);
            spaceshipTarget = null;
            isMining = false;
            spaceshipElement.classList.remove('mining');
            findNearestMiningNode();
            updateProductionRate();
        }, 1000); // Mine for 1 second
    }

    // Update HTML spaceship position and rotation
    spaceshipElement.style.left = `${spaceshipX}px`;
    spaceshipElement.style.top = `${spaceshipY}px`;
    spaceshipElement.style.transform = `translate(-50%, -50%) rotate(${currentAngle * 180 / Math.PI + 90}deg)`; // Use smoothed angle
}
// --- End Spaceship Movement ---

// --- LocalStorage Functions ---
function saveGame() {
    const gameState = {
        resources: resources,
        minerLevel: minerLevel,
        minerCost: minerCost,
        engineLevel: engineLevel, // 중복된 키 수정
        engineCost: engineCost,
        lastSaveTime: Date.now(), // Save current time for offline bonus calculation
        // Save relevant mining node properties if necessary (e.g., if they persist)
        // For now, mining nodes do not persist
    };
    localStorage.setItem('infiniteSpaceMinerSave', JSON.stringify(gameState));
    console.log('Game Saved!');
}

function loadGame() {
    const savedState = localStorage.getItem('infiniteSpaceMinerSave');
    if (savedState) {
        const gameState = JSON.parse(savedState);
        resources = gameState.resources || 0;
        displayedResources = resources; // Initialize displayedResources to actual resources on load
        minerLevel = gameState.minerLevel || 0;
        minerCost = gameState.minerCost || 10;
        engineLevel = gameState.engineLevel || 0;
        engineCost = gameState.engineCost || 50;
        lastUpdate = Date.now(); // Set lastUpdate to now for correct deltaTime calculation

        // Recalculate derived stats and update UI
        minerProductionBonus = minerLevel; // Each level adds 1 production
        currentStarSpeed = 2 + (engineLevel * 0.5); // Initial + 0.5 per level
        engineProductionMultiplier = 1 + (engineLevel * 0.1); // Initial + 0.1 per level
        
        updateProductionRate();
        updateButtonText();
        initStars(); // Reinitialize stars with potentially new speed
        
        console.log('Game Loaded!');
        return gameState.lastSaveTime; // Return last save time for offline bonus
    }
    console.log('No saved game found.');
    return null;
}
// --- End LocalStorage Functions ---


function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    spaceshipX = canvas.width / 2; // Recenter spaceship on resize
    spaceshipY = canvas.height / 2;
}

function initStars() {
    stars = [];
    for (let i = 0; i < numStars; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * currentStarSpeed + 0.5 // Use currentStarSpeed
        });
    }
}

function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
    ctx.fillStyle = 'white';
    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0; // Reset star to top
            star.x = Math.random() * canvas.width;
            star.speed = Math.random() * currentStarSpeed + 0.5; // Recalculate speed with currentStarSpeed
        }
    });
}

function updateProductionRate() {
    productionRate = (baseMiningPower + minerProductionBonus) * engineProductionMultiplier;
    productionRateElement.textContent = productionRate.toFixed(1);
}

function updateResources() {
    if (isMining) return; // Don't produce resources while mining (they are collected at the end)

    const now = Date.now();
    const deltaTime = (now - lastUpdate) / 1000; // time in seconds
    resources += productionRate * deltaTime;
    lastUpdate = now;

    // Smoothly animate displayed resources
    if (displayedResources < resources) {
        displayedResources = Math.min(resources, displayedResources + productionRate * deltaTime * 0.5); // Animate faster than production
    } else if (displayedResources > resources) { // If resources were spent, immediately reflect it
        displayedResources = resources;
    }
    
    resourceCountElement.textContent = Math.floor(displayedResources);
}

function updateButtonText() {
    upgradeButton1.textContent = `Miner Upgrade (🛠️) Lv.${minerLevel} (Next: 💎${Math.floor(minerCost)})`;
    upgradeButton2.textContent = `Engine Booster (⚡) Lv.${engineLevel} (Next: 💎${Math.floor(engineCost)})`;
}

// Upgrade functions
function upgrade1() {
    if (resources >= minerCost) {
        resources -= minerCost;
        displayedResources = resources; // Immediately update displayed resources
        minerLevel++;
        minerProductionBonus += 1; // Each level adds 1 production
        minerCost = Math.floor(minerCost * 1.5); // Increase cost by 50%
        updateProductionRate();
        updateButtonText();
        saveGame(); // Save game after upgrade
    } else {
        // Optional: Add visual feedback for not enough resources
        console.log("Not enough resources for Miner Upgrade!");
    }
}

function upgrade2() {
    if (resources >= engineCost) {
        resources -= engineCost;
        displayedResources = resources; // Immediately update displayed resources
        engineLevel++;
        currentStarSpeed += 0.5; // Increase star speed
        engineProductionMultiplier += 0.2; // Increase production multiplier by 0.2
        engineCost = Math.floor(engineCost * 1.8); // Increase cost by 80%
        
        // Reinitialize stars with new speed to make the change visible
        initStars(); 
        
        updateProductionRate();
        updateButtonText();
        saveGame(); // Save game after upgrade
    } else {
        // Optional: Add visual feedback for not enough resources
        console.log("Not enough resources for Engine Booster!");
    }
}

// Event Listeners for upgrade buttons
upgradeButton1.addEventListener('click', upgrade1);
upgradeButton2.addEventListener('click', upgrade2);

// Event Listener for Game Info click to hide
gameInfoElement.addEventListener('click', () => {
    gameInfoElement.classList.add('hidden');
});

// Keyboard Fullscreen Toggle Logic
window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') { // Use 'F' key to toggle fullscreen
        document.body.classList.toggle('fullscreen-active');
    }
});


// Initial setup
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
initStars();

// Generate new nodes periodically
setInterval(generateMiningNode, 5000);


const lastSaveTime = loadGame(); // Load game state and get last save time

// --- Offline Bonus Calculation ---
if (lastSaveTime) {
    const timeOffline = (Date.now() - lastSaveTime) / 1000; // time in seconds
    if (timeOffline > 60) { // Only show bonus if offline for more than 60 seconds (1 minute)
        // Calculate production rate based on loaded game state
        const effectiveProductionRate = (baseMiningPower + minerProductionBonus) * engineProductionMultiplier;
        const offlineEarned = effectiveProductionRate * timeOffline;
        
        if (offlineEarned > 0) {
            resources += offlineEarned;
            displayedResources = resources; // Immediately update displayed resources with offline bonus
            offlineResourcesEarnedElement.textContent = Math.floor(offlineEarned);
            offlineBonusPopup.classList.remove('hidden');
        }
    }
}

closePopupButton.addEventListener('click', () => {
    offlineBonusPopup.classList.add('hidden');
    saveGame(); // Save game state after claiming offline bonus
});
// --- End Offline Bonus Calculation ---


updateProductionRate(); // Initial update of production rate display
updateButtonText(); // Initial update of button text

// Save game periodically and on unload
setInterval(saveGame, 10000); // Save every 10 seconds
window.addEventListener('beforeunload', saveGame);

// Game Loop (will be expanded later)
function gameLoop() {
    drawStars();
    drawMiningNodes(); // 광물 노드 그리기
    drawMiningLaser(); // Draw laser if mining

    moveSpaceship(); // 우주선 이동

    updateResources(); // 자원 업데이트
    requestAnimationFrame(gameLoop);
}

gameLoop();