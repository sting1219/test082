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

// Offline Bonus Popup Elements

// Game Info Element
const gameInfoElement = document.getElementById('game-info');

let stars = [];
const numStars = 200;
let currentStarSpeed = 2; // Use a variable for star speed

// --- Spaceship ---
const spaceshipElement = document.getElementById('spaceship');
let spaceshipX = canvas.width / 2;
let spaceshipY = canvas.height / 2;
let spaceshipSpeed = 1; // Pixels per frame, changed to let for upgrades
let minerDPS = 10; // Initial Damage Per Second for the miner, changed to 10 as per user request
let spaceshipTarget = null; // Current mining node target
let isMining = false; // Is the spaceship currently mining?

// --- Floating Texts ---
let floatingTexts = [];
const floatingTextSpeed = 0.5; // Pixels per frame upwards
const floatingTextLife = 60; // Frames until fully faded

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
            resources: 10, // Fixed resources per node
            hp: 10, // Fixed HP per node
            maxHp: 10, // Fixed maxHp per node
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

// --- Floating Text Drawing ---
function drawFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const textObj = floatingTexts[i];

        // Update position and opacity
        textObj.y -= floatingTextSpeed;
        textObj.opacity -= 1 / floatingTextLife; // Decrease opacity over its life

        // Remove if faded or off-screen (or life ended)
        if (textObj.opacity <= 0) {
            floatingTexts.splice(i, 1);
            continue;
        }

        // Draw text
        ctx.save(); // Save current canvas state
        ctx.font = 'bold 20px Arial';
        // Convert hex color to rgba with opacity
        const hex = textObj.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${textObj.opacity})`;
        ctx.textAlign = 'center';
        ctx.fillText(textObj.text, textObj.x, textObj.y);
        ctx.restore(); // Restore canvas state
    }
}
// --- Floating Text Drawing ---

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
        if (distance < spaceshipSpeed) { // If very close, jump directly to target
            spaceshipX = spaceshipTarget.x;
            spaceshipY = spaceshipTarget.y;
        } else { // Otherwise, move normally
            spaceshipX += Math.cos(targetAngle) * spaceshipSpeed;
            spaceshipY += Math.sin(targetAngle) * spaceshipSpeed;
        }
        spaceshipElement.classList.remove('mining');
    } else { // Arrived at target, start mining
        isMining = true;
        spaceshipElement.classList.add('mining');
    }

    // Update HTML spaceship position and rotation
    spaceshipElement.style.left = `${spaceshipX}px`;
    spaceshipElement.style.top = `${spaceshipY}px`;
    spaceshipElement.style.transform = `translate(-50%, -50%) rotate(${currentAngle * 180 / Math.PI + 90}deg)`; // Use smoothed angle
}

function applyDamageToMineral(deltaTime) {
    if (!isMining || !spaceshipTarget) return;

    // Reduce mineral HP
    const damageDealt = minerDPS * deltaTime;
    spaceshipTarget.hp -= damageDealt;
    console.log(`Mining: minerDPS=${minerDPS.toFixed(2)}, deltaTime=${deltaTime.toFixed(2)}, damageDealt=${damageDealt.toFixed(2)}, mineral HP left=${spaceshipTarget.hp.toFixed(2)}`);

    // Check if mineral is destroyed
    if (spaceshipTarget.hp <= 0) {
        const actualResourcesGained = spaceshipTarget.resources * engineProductionMultiplier;
        resources += actualResourcesGained;
        displayedResources = resources;
        resourceCountElement.textContent = Math.floor(displayedResources);

        // Create floating text
        floatingTexts.push({
            text: `+${Math.floor(actualResourcesGained)}`,
            x: spaceshipTarget.x,
            y: spaceshipTarget.y,
            opacity: 1,
            life: floatingTextLife, // Use predefined life for consistency
            color: '#00ffcc' // Fixed UI accent color
        });

        // Remove the mined node
        miningNodes = miningNodes.filter(node => node.id !== spaceshipTarget.id);
        spaceshipTarget = null;
        isMining = false; // Reset mining state
        spaceshipElement.classList.remove('mining'); // Remove mining animation
        findNearestMiningNode(); // Find a new target
        updateButtonText(); // Update production rate if it depends on miner level (it does now)
    }
}
// --- End Spaceship Movement ---

// --- LocalStorage Functions ---
function saveGame() {
    const gameState = {
        resources: resources,
        minerLevel: minerLevel,
        minerCost: minerCost,
        engineLevel: engineLevel,
        engineCost: engineCost,
        lastSaveTime: Date.now(),
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
        console.log(`Game Loaded! Engine Cost: ${engineCost}`);
        lastUpdate = Date.now(); // Set lastUpdate to now for correct deltaTime calculation

        // Recalculate derived stats and update UI
        currentStarSpeed = 2 + (engineLevel * 0.5); // This remains 0.5 for visual effect
        engineProductionMultiplier = 1 + (engineLevel * 1); // Recalculate production multiplier based on engine level
        spaceshipSpeed = 1 + (engineLevel * 0.2); // Recalculate spaceship speed based on engine level (reverted)
        minerDPS = 10 + (minerLevel * 10); // Recalculate minerDPS based on miner level
        
        updateButtonText();
        initStars(); // Reinitialize stars with potentially new speed
        console.log(`Game Loaded! Miner Level: ${minerLevel}, Calculated minerDPS: ${minerDPS}`);
        
        console.log('Game Loaded!');
        return null; // No longer returning lastSaveTime
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





function updateButtonText() {
    upgradeButton1.textContent = `Miner Upgrade (🛠️) Lv.${minerLevel} (Next: 💎${Math.floor(minerCost)})`;
    upgradeButton2.textContent = `Engine Booster (⚡) Lv.${engineLevel} (Next: 💎${Math.floor(engineCost)})`;
}

// Upgrade functions
function upgrade1() {
    if (resources >= minerCost) {
        resources -= minerCost;
        resourceCountElement.textContent = Math.floor(resources);
        minerLevel++;
        minerDPS += 10; // Each miner level adds 10 DPS
        minerCost = Math.floor(minerCost * 1.5); // Increase cost by 50%
        console.log(`Miner Upgraded! Level: ${minerLevel}, Current minerDPS: ${minerDPS}`);
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
        resourceCountElement.textContent = Math.floor(resources);
        engineLevel++;
        engineCost = Math.floor(engineCost * 1.8); // Increase cost by 80% (re-added)
        currentStarSpeed += 0.5; // Increase star speed (this remains 0.5 as it's visual)
        engineProductionMultiplier += 1; // Increase production multiplier by 1 per level
        spaceshipSpeed += 0.2; // Increase spaceship's actual movement speed by 0.2 per level (reverted)
        console.log(`Engine Upgraded! Level: ${engineLevel}, Current engineCost: ${engineCost}`);
        
        // Reinitialize stars with new speed to make the change visible
        initStars(); 
        
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


// --- End Offline Bonus Calculation ---


updateButtonText(); // Initial update of button text

// Save game periodically and on unload
setInterval(saveGame, 10000); // Save every 10 seconds
window.addEventListener('beforeunload', saveGame);

// Game Loop (will be expanded later)
function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - lastUpdate) / 1000; // time in seconds
    lastUpdate = now;

    drawStars();
    drawMiningNodes(); // 광물 노드 그리기
    drawMiningLaser(); // Draw laser if mining
    drawFloatingTexts(); // Draw and update floating texts

    moveSpaceship(); // 우주선 이동
    applyDamageToMineral(deltaTime); // Apply damage to mineral if mining


    requestAnimationFrame(gameLoop);
}

gameLoop();