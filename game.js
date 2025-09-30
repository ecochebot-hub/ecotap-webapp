const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

let gameState = {
    points: 0,
    trees: 0,
    level: 1,
    energy: 100,
    maxEnergy: 100,
    totalTaps: 0,
    multiplier: 1.0,
    lastEnergyUpdate: Date.now()
};

const CONFIG = {
    ENERGY_REGEN_RATE: 1,
    ENERGY_REGEN_INTERVAL: 60000,
    POINTS_PER_TREE: 1000,
    SYNC_INTERVAL: 5000,
    MAX_TAPS_QUEUE: 50
};

let tapQueue = 0;
let syncTimer = null;

const elements = {
    loading: document.getElementById('loading'),
    game: document.getElementById('game'),
    error: document.getElementById('error'),
    errorMessage: document.getElementById('error-message'),
    points: document.getElementById('points'),
    trees: document.getElementById('trees'),
    level: document.getElementById('level'),
    energyText: document.getElementById('energy-text'),
    energyFill: document.getElementById('energy-fill'),
    tree: document.getElementById('tap-tree'),
    tapEffect: document.getElementById('tap-effect'),
    multiplier: document.getElementById('multiplier'),
    floatingContainer: document.getElementById('floating-points-container')
};

async function initGame() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('user_id');
        
        if (!userId) {
            throw new Error('User ID not found');
        }

        await loadUserData(userId);
        startEnergyRegeneration();
        startAutoSync();
        setupTapHandler();
        showScreen('game');
        tg.ready();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError(error.message);
    }
}

async function loadUserData(userId) {
    return new Promise((resolve) => {
        setTimeout(() => {
            gameState = {
                points: 0,
                trees: 0,
                level: 1,
                energy: 100,
                maxEnergy: 100,
                totalTaps: 0,
                multiplier: 1.0,
                lastEnergyUpdate: Date.now()
            };
            
            updateUI();
            resolve();
        }, 1500);
    });
}

function setupTapHandler() {
    elements.tree.addEventListener('click', handleTap);
    elements.tree.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

function handleTap(e) {
    if (gameState.energy < 1) {
        showToast('⚡ Not enough energy!');
        shakeElement(elements.tree);
        return;
    }
    
    gameState.energy--;
    const pointsEarned = Math.floor(1 * gameState.multiplier);
    gameState.points += pointsEarned;
    gameState.totalTaps++;
    
    const newTrees = Math.floor(gameState.points / CONFIG.POINTS_PER_TREE);
    if (newTrees > gameState.trees) {
        gameState.trees = newTrees;
        showToast('🌳 New tree planted!');
    }
    
    tapQueue++;
    updateUI();
    playTapAnimation(e);
    showFloatingPoints(e, pointsEarned);
    
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

function playTapAnimation(e) {
    elements.tree.classList.add('tapped');
    setTimeout(() => {
        elements.tree.classList.remove('tapped');
    }, 300);
    
    elements.tapEffect.classList.add('active');
    setTimeout(() => {
        elements.tapEffect.classList.remove('active');
    }, 600);
}

function showFloatingPoints(e, points) {
    const floatingPoint = document.createElement('div');
    floatingPoint.className = 'floating-point';
    floatingPoint.textContent = `+${points}`;
    
    floatingPoint.style.left = `${e.clientX}px`;
    floatingPoint.style.top = `${e.clientY}px`;
    
    elements.floatingContainer.appendChild(floatingPoint);
    
    setTimeout(() => {
        floatingPoint.remove();
    }, 1000);
}

function updateUI() {
    elements.points.textContent = formatNumber(gameState.points);
    elements.trees.textContent = formatNumber(gameState.trees);
    elements.level.textContent = gameState.level;
    elements.energyText.textContent = `${gameState.energy}/${gameState.maxEnergy}`;
    elements.multiplier.textContent = `x${gameState.multiplier.toFixed(1)}`;
    
    const energyPercent = (gameState.energy / gameState.maxEnergy) * 100;
    elements.energyFill.style.width = `${energyPercent}%`;
    
    if (energyPercent < 20) {
        elements.energyFill.style.background = 'linear-gradient(90deg, #f44336, #ff5722)';
    } else if (energyPercent < 50) {
        elements.energyFill.style.background = 'linear-gradient(90deg, #ff9800, #ffc107)';
    } else {
        elements.energyFill.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
    }
}

function startEnergyRegeneration() {
    setInterval(() => {
        if (gameState.energy < gameState.maxEnergy) {
            gameState.energy = Math.min(
                gameState.maxEnergy,
                gameState.energy + CONFIG.ENERGY_REGEN_RATE
            );
            updateUI();
        }
    }, CONFIG.ENERGY_REGEN_INTERVAL);
}

function startAutoSync() {
    syncTimer = setInterval(async () => {
        if (tapQueue > 0) {
            await syncWithServer();
        }
    }, CONFIG.SYNC_INTERVAL);
}

async function syncWithServer() {
    if (tapQueue === 0) return;
    
    try {
        const tapsToSend = tapQueue;
        tapQueue = 0;
        
        const data = {
            taps: tapsToSend,
            points: gameState.points,
            energy: gameState.energy
        };
        
        tg.sendData(JSON.stringify(data));
        console.log('Synced with server:', data);
        
    } catch (error) {
        console.error('Sync error:', error);
        tapQueue += tapsToSend;
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    showScreen('error');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 14px;
        z-index: 10000;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

function shakeElement(element) {
    element.style.animation = 'shake 0.5s';
    setTimeout(() => {
        element.style.animation = '';
    }, 500);
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        syncWithServer();
    }
});

window.addEventListener('beforeunload', () => {
    syncWithServer();
});

initGame();
