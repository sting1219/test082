const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let resources = 0;
let displayedResources = 0; // For smooth animation of resource count
let baseMiningPower = 0.5; // Initial automatic mining power
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


let stars = [];
const numStars = 200;
let currentStarSpeed = 2; // Use a variable for star speed

// --- LocalStorage Functions ---
function saveGame() {
    const gameState = {
        resources: resources,
        minerLevel: minerLevel,
        minerCost: minerCost,
        engineLevel: engineLevel,
        engineCost: engineCost,
        lastSaveTime: Date.now() // Save current time for offline bonus calculation
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
        engineProductionMultiplier += 0.1; // Increase production multiplier by 0.1
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
    updateResources(); // Update resources in the game loop
    requestAnimationFrame(gameLoop);
}

gameLoop();