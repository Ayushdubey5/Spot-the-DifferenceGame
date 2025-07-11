class SpotTheDifferenceGame {
    constructor() {
        this.gameConfig = null;
        this.foundDifferences = [];
        this.totalDifferences = 0;
        this.startTime = null;
        this.timer = null;
        this.hintsUsed = 0;
        this.maxHints = 3;
        this.wrongClicks = 0;
        this.toleranceArea = 25; // pixels
        this.currentLevel = 0;
        this.levels = [];
        
        this.initializeGame();
    }

    async initializeGame() {
        this.showLoadingScreen();
        
        try {
            await this.loadGameConfig();
            this.setupEventListeners();
            this.startNewGame();
        } catch (error) {
            console.error('Error initializing game:', error);
            this.showError('Failed to load game. Please refresh the page.');
        }
        
        this.hideLoadingScreen();
    }

    showLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'flex';
    }

    hideLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'none';
    }

    async loadGameConfig() {
        try {
            // Load configuration from config.json
            const response = await fetch('/config.json');
            const gameData = await response.json();
            
            this.levels = gameData.levels;
            this.gameConfig = this.levels[this.currentLevel];
            
            // Set game title
            document.getElementById('game-title').textContent = this.gameConfig.gameTitle;
            
            // Load images
            await this.loadImages();
            
            this.totalDifferences = this.gameConfig.differences.length;
            this.updateScore();
            
        } catch (error) {
            throw new Error('Failed to load game configuration');
        }
    }

    async loadImages() {
        const img1 = document.getElementById('image1');
        const img2 = document.getElementById('image2');
        
        return new Promise((resolve, reject) => {
            let loadedImages = 0;
            
            const imageLoaded = () => {
                loadedImages++;
                if (loadedImages === 2) {
                    resolve();
                }
            };
            
            img1.onload = imageLoaded;
            img2.onload = imageLoaded;
            img1.onerror = () => reject(new Error('Failed to load image 1'));
            img2.onerror = () => reject(new Error('Failed to load image 2'));
            
            img1.src = this.gameConfig.images.image1;
            img2.src = this.gameConfig.images.image2;
        });
    }

    setupEventListeners() {
        // Image click handlers
        document.getElementById('overlay1').addEventListener('click', (e) => this.handleImageClick(e, 1));
        document.getElementById('overlay2').addEventListener('click', (e) => this.handleImageClick(e, 2));
        
        // Button handlers
        document.getElementById('hint-btn').addEventListener('click', () => this.useHint());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('new-game-btn').addEventListener('click', () => this.nextLevel());
        document.getElementById('play-again-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('new-level-btn').addEventListener('click', () => this.nextLevel());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'h':
                case 'H':
                    this.useHint();
                    break;
                case 'r':
                case 'R':
                    this.restartGame();
                    break;
                case 'n':
                case 'N':
                    this.nextLevel();
                    break;
            }
        });
    }

    startNewGame() {
        this.foundDifferences = [];
        this.startTime = Date.now();
        this.hintsUsed = 0;
        this.wrongClicks = 0;
        
        this.clearMarkers();
        this.startTimer();
        this.updateScore();
        this.updateHints();
        
        // Reset modal
        document.getElementById('success-modal').style.display = 'none';
    }

    handleImageClick(event, imageNumber) {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Scale coordinates to actual image size
        const img = document.getElementById(`image${imageNumber}`);
        const scaleX = img.naturalWidth / img.offsetWidth;
        const scaleY = img.naturalHeight / img.offsetHeight;
        
        const actualX = x * scaleX;
        const actualY = y * scaleY;
        
        const differenceIndex = this.findDifferenceAtPosition(actualX, actualY);
        
        if (differenceIndex !== -1 && !this.foundDifferences.includes(differenceIndex)) {
            this.markDifference(differenceIndex, x, y);
            this.foundDifferences.push(differenceIndex);
            this.updateScore();
            this.playSound('success');
            
            if (this.foundDifferences.length === this.totalDifferences) {
                this.gameCompleted();
            }
        } else {
            this.showWrongClick(x, y, imageNumber);
            this.wrongClicks++;
            this.playSound('click');
        }
    }

    findDifferenceAtPosition(x, y) {
        for (let i = 0; i < this.gameConfig.differences.length; i++) {
            const diff = this.gameConfig.differences[i];
            const centerX = diff.x + (diff.width / 2);
            const centerY = diff.y + (diff.height / 2);
            
            const distance = Math.sqrt(
                Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
            );
            
            if (distance <= this.toleranceArea) {
                return i;
            }
        }
        return -1;
    }

    markDifference(differenceIndex, clickX, clickY) {
        const difference = this.gameConfig.differences[differenceIndex];
        
        // Mark on both images
        for (let i = 1; i <= 2; i++) {
            const container = document.getElementById(`image${i}-container`);
            const img = document.getElementById(`image${i}`);
            
            const marker = document.createElement('div');
            marker.className = 'difference-marker';
            marker.dataset.differenceIndex = differenceIndex;
            
            // Scale position to displayed image size
            const scaleX = img.offsetWidth / img.naturalWidth;
            const scaleY = img.offsetHeight / img.naturalHeight;
            
            const displayX = (difference.x + difference.width / 2) * scaleX;
            const displayY = (difference.y + difference.height / 2) * scaleY;
            
            marker.style.left = `${displayX - 20}px`;
            marker.style.top = `${displayY - 20}px`;
            
            container.appendChild(marker);
        }
    }

    showWrongClick(x, y, imageNumber) {
        const container = document.getElementById(`image${imageNumber}-container`);
        const wrongMarker = document.createElement('div');
        wrongMarker.className = 'wrong-click';
        wrongMarker.style.left = `${x - 15}px`;
        wrongMarker.style.top = `${y - 15}px`;
        
        container.appendChild(wrongMarker);
        
        setTimeout(() => {
            wrongMarker.remove();
        }, 800);
    }

    useHint() {
        if (this.hintsUsed >= this.maxHints) {
            this.showTemporaryMessage('No more hints available!');
            return;
        }
        
        const unFoundDifferences = this.gameConfig.differences.filter(
            (_, index) => !this.foundDifferences.includes(index)
        );
        
        if (unFoundDifferences.length === 0) return;
        
        const randomDiff = unFoundDifferences[Math.floor(Math.random() * unFoundDifferences.length)];
        const diffIndex = this.gameConfig.differences.indexOf(randomDiff);
        
        this.showHint(diffIndex);
        this.hintsUsed++;
        this.updateHints();
    }

    showHint(differenceIndex) {
        const difference = this.gameConfig.differences[differenceIndex];
        
        for (let i = 1; i <= 2; i++) {
            const container = document.getElementById(`image${i}-container`);
            const img = document.getElementById(`image${i}`);
            
            const hint = document.createElement('div');
            hint.className = 'hint-highlight';
            
            const scaleX = img.offsetWidth / img.naturalWidth;
            const scaleY = img.offsetHeight / img.naturalHeight;
            
            const displayX = (difference.x + difference.width / 2) * scaleX;
            const displayY = (difference.y + difference.height / 2) * scaleY;
            
            hint.style.left = `${displayX - 30}px`;
            hint.style.top = `${displayY - 30}px`;
            hint.style.width = '60px';
            hint.style.height = '60px';
            
            container.appendChild(hint);
            
            setTimeout(() => {
                hint.remove();
            }, 3000);
        }
    }

    startTimer() {
        this.timer = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('timer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    updateScore() {
        document.getElementById('score').textContent = 
            `${this.foundDifferences.length} / ${this.totalDifferences}`;
    }

    updateHints() {
        const hintsLeft = this.maxHints - this.hintsUsed;
        document.getElementById('hints').textContent = hintsLeft;
        
        const hintBtn = document.getElementById('hint-btn');
        if (hintsLeft <= 0) {
            hintBtn.disabled = true;
            hintBtn.textContent = '💡 No Hints Left';
        } else {
            hintBtn.disabled = false;
            hintBtn.textContent = `💡 Use Hint (${hintsLeft})`;
        }
    }

    gameCompleted() {
        this.stopTimer();
        
        const totalTime = Date.now() - this.startTime;
        const minutes = Math.floor(totalTime / 60000);
        const seconds = Math.floor((totalTime % 60000) / 1000);
        
        const accuracy = Math.round((this.totalDifferences / (this.totalDifferences + this.wrongClicks)) * 100);
        
        document.getElementById('final-time').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('final-score').textContent = this.totalDifferences;
        document.getElementById('accuracy').textContent = `${accuracy}%`;
        
        document.getElementById('success-modal').style.display = 'block';
        
        this.playSound('success');
    }

    restartGame() {
        this.stopTimer();
        this.currentLevel = 0;
        this.gameConfig = this.levels[this.currentLevel];
        this.startNewGame();
    }

    nextLevel() {
        this.stopTimer();
        this.currentLevel = (this.currentLevel + 1) % this.levels.length;
        this.gameConfig = this.levels[this.currentLevel];
        
        // Update game title
        document.getElementById('game-title').textContent = this.gameConfig.gameTitle;
        
        // Load new images
        this.loadImages().then(() => {
            this.totalDifferences = this.gameConfig.differences.length;
            this.startNewGame();
        });
    }

    clearMarkers() {
        document.querySelectorAll('.difference-marker, .hint-highlight').forEach(marker => {
            marker.remove();
        });
    }

    playSound(type) {
        const audio = document.getElementById(`${type}-sound`);
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => {
                // Ignore audio play errors (user interaction required)
            });
        }
    }

    showTemporaryMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            z-index: 1000;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 2000);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 30px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                z-index: 2000;
                text-align: center;
                max-width: 400px;
            ">
                <h3 style="color: #f44336; margin-bottom: 15px;">Error</h3>
                <p style="margin-bottom: 20px;">${message}</p>
                <button onclick="location.reload()" style="
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Refresh Page</button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new SpotTheDifferenceGame();
});

// Handle window resize
window.addEventListener('resize', () => {
    // Clear existing markers and recalculate positions
    document.querySelectorAll('.difference-marker').forEach(marker => {
        marker.remove();
    });
});

// Disable right-click context menu on images
document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'IMG') {
        e.preventDefault();
    }
});

// Disable image dragging
document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG') {
        e.preventDefault();
    }
});