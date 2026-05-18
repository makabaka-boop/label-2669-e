const CHALLENGE_TYPES = {
    THREE_STEPS_1A2B: {
        id: 'THREE_STEPS_1A2B',
        title: '3步内命中1A2B',
        description: '在前3次猜测中，至少有一次得到1A2B的结果',
        check: (history, currentGuess, gameState) => {
            if (history.length > 3) return { completed: false, failed: true, reason: '已超过3次猜测' };
            const has1A2B = history.some(h => h.A === 1 && h.B === 2);
            if (has1A2B) return { completed: true, failed: false };
            return { completed: false, failed: false };
        }
    },
    NO_HINT_WIN: {
        id: 'NO_HINT_WIN',
        title: '不使用提示通关',
        description: '本局游戏不使用"提示"按钮，完成通关',
        check: (history, currentGuess, gameState) => {
            if (gameState.hintUsed) return { completed: false, failed: true, reason: '使用了提示功能' };
            if (gameState.isWin) return { completed: true, failed: false };
            return { completed: false, failed: false };
        }
    },
    CONSECUTIVE_A: {
        id: 'CONSECUTIVE_A',
        title: '连续两次包含A',
        description: '连续两次猜测结果中都至少有1个A',
        check: (history, currentGuess, gameState) => {
            if (history.length < 2) return { completed: false, failed: false };
            const lastTwo = history.slice(-2);
            const bothHaveA = lastTwo.every(h => h.A > 0);
            if (bothHaveA) return { completed: true, failed: false };
            return { completed: false, failed: false };
        }
    },
    EXPERT_WIN: {
        id: 'EXPERT_WIN',
        title: '专家模式获胜',
        description: '在专家难度（6次机会）下完成通关',
        check: (history, currentGuess, gameState) => {
            if (gameState.difficulty !== 'expert') return { completed: false, failed: true, reason: '未选择专家难度' };
            if (gameState.isWin) return { completed: true, failed: false };
            return { completed: false, failed: false };
        }
    },
    FIVE_STEPS_WIN: {
        id: 'FIVE_STEPS_WIN',
        title: '5步内通关',
        description: '在5次猜测以内猜出正确答案',
        check: (history, currentGuess, gameState) => {
            if (gameState.isWin) {
                if (history.length <= 5) return { completed: true, failed: false };
                return { completed: false, failed: true, reason: '通关时已超过5次猜测' };
            }
            if (history.length >= 5) return { completed: false, failed: true, reason: '已超过5次猜测' };
            return { completed: false, failed: false };
        }
    },
    ALL_GUESSES_HAVE_B: {
        id: 'ALL_GUESSES_HAVE_B',
        title: '每次都有B',
        description: '本局所有猜测结果都至少包含1个B',
        check: (history, currentGuess, gameState) => {
            if (history.length === 0) return { completed: false, failed: false };
            const hasNoB = history.some(h => h.B === 0);
            if (hasNoB) return { completed: false, failed: true, reason: '某次猜测结果不包含B' };
            if (gameState.isWin) return { completed: true, failed: false };
            return { completed: false, failed: false };
        }
    },
    FIRST_GUESS_0A0B: {
        id: 'FIRST_GUESS_0A0B',
        title: '开门红：0A0B开局',
        description: '第一次猜测得到0A0B的结果',
        check: (history, currentGuess, gameState) => {
            if (history.length >= 1) {
                if (history[0].A === 0 && history[0].B === 0) return { completed: true, failed: false };
                return { completed: false, failed: true, reason: '第一次猜测不是0A0B' };
            }
            return { completed: false, failed: false };
        }
    },
    THREE_CONSECUTIVE_B: {
        id: 'THREE_CONSECUTIVE_B',
        title: '三连B',
        description: '连续三次猜测结果中B的数量都大于0',
        check: (history, currentGuess, gameState) => {
            if (history.length < 3) return { completed: false, failed: false };
            const lastThree = history.slice(-3);
            const allHaveB = lastThree.every(h => h.B > 0);
            if (allHaveB) return { completed: true, failed: false };
            return { completed: false, failed: false };
        }
    }
};

const STORAGE_KEYS = {
    CURRENT_GAME: 'bulls_cows_current_game',
    CHALLENGE_HISTORY: 'bulls_cows_challenge_history',
    LAST_INCOMPLETE: 'bulls_cows_last_incomplete'
};

class BullsAndCowsGame {
    constructor() {
        this.answer = '';
        this.input = '';
        this.history = [];
        this.maxGuesses = Infinity;
        this.isGameOver = false;
        this.isWin = false;
        this.hintUsed = false;
        this.difficulty = 'beginner';
        
        this.currentChallenge = null;
        this.challengeStatus = { completed: false, failed: false, reason: '' };
        this.challengeHistory = [];
        this.lastIncompleteGame = null;
        
        this.difficultySelect = document.getElementById('difficulty');
        this.newGameBtn = document.getElementById('new-game-btn');
        this.remainingInfo = document.getElementById('remaining-info');
        this.messageArea = document.getElementById('message-area');
        this.digitBoxes = document.querySelectorAll('.digit-box');
        this.historyList = document.getElementById('history-list');
        this.hintBtn = document.getElementById('hint-btn');
        this.keyBtns = document.querySelectorAll('.key-btn[data-key]');
        this.undoBtn = document.getElementById('undo-btn');
        this.submitBtn = document.getElementById('submit-btn');
        
        this.challengeCard = document.getElementById('challenge-card');
        this.challengeTitle = document.getElementById('challenge-title');
        this.challengeStatusEl = document.getElementById('challenge-status');
        this.switchChallengeBtn = document.getElementById('switch-challenge-btn');

        this.init();
    }

    init() {
        this.loadFromStorage();
        this.bindEvents();
        
        if (this.lastIncompleteGame && !this.lastIncompleteGame.isGameOver) {
            this.restoreIncompleteGame();
        } else {
            this.startNewGame();
        }
    }

    bindEvents() {
        this.newGameBtn.addEventListener('click', () => this.startNewGame());
        this.difficultySelect.addEventListener('change', () => this.startNewGame());
        this.switchChallengeBtn.addEventListener('click', () => this.switchChallenge());
        
        this.keyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleInput(e.target.dataset.key));
        });

        this.undoBtn.addEventListener('click', () => this.handleUndo());
        this.submitBtn.addEventListener('click', () => this.handleSubmit());
        this.hintBtn.addEventListener('click', () => this.handleHint());

        document.addEventListener('keydown', (e) => {
            if (this.isGameOver) return;
            if (e.key >= '0' && e.key <= '9') this.handleInput(e.key);
            if (e.key === 'Backspace') this.handleUndo();
            if (e.key === 'Enter') this.handleSubmit();
        });
    }

    getRandomChallenge() {
        const keys = Object.keys(CHALLENGE_TYPES);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        return CHALLENGE_TYPES[randomKey];
    }

    switchChallenge() {
        if (this.history.length > 0) {
            this.showMessage('游戏进行中无法切换挑战', 'error');
            setTimeout(() => this.showMessage(''), 1500);
            return;
        }
        this.currentChallenge = this.getRandomChallenge();
        this.challengeStatus = { completed: false, failed: false, reason: '' };
        this.updateChallengeUI();
        this.saveToStorage();
    }

    startNewGame() {
        this.answer = this.generateUniqueNumber();
        this.input = '';
        this.history = [];
        this.isGameOver = false;
        this.isWin = false;
        this.hintUsed = false;
        this.difficulty = this.difficultySelect.value;
        
        switch(this.difficulty) {
            case 'easy': this.maxGuesses = 15; break;
            case 'medium': this.maxGuesses = 10; break;
            case 'expert': this.maxGuesses = 6; break;
            default: this.maxGuesses = Infinity;
        }

        if (!this.currentChallenge || this.challengeStatus.completed || this.challengeStatus.failed) {
            this.currentChallenge = this.getRandomChallenge();
        }
        this.challengeStatus = { completed: false, failed: false, reason: '' };

        this.updateUI();
        this.updateInputDisplay();
        this.updateChallengeUI();
        this.historyList.innerHTML = '';
        this.showMessage('游戏已开始，请输入3位不重复数字');
        this.enableControls();
        
        this.saveToStorage();
        
        console.log('Secret Answer (Debug):', this.answer);
    }

    restoreIncompleteGame() {
        const game = this.lastIncompleteGame;
        this.answer = game.answer;
        this.input = '';
        this.history = game.history;
        this.isGameOver = game.isGameOver;
        this.isWin = game.isWin;
        this.hintUsed = game.hintUsed;
        this.difficulty = game.difficulty;
        this.maxGuesses = game.maxGuesses;
        
        if (game.currentChallenge && game.currentChallenge.id) {
            this.currentChallenge = CHALLENGE_TYPES[game.currentChallenge.id] || this.getRandomChallenge();
        } else {
            this.currentChallenge = this.getRandomChallenge();
        }
        this.challengeStatus = game.challengeStatus || { completed: false, failed: false, reason: '' };
        
        this.difficultySelect.value = this.difficulty;
        
        this.updateUI();
        this.updateInputDisplay();
        this.updateChallengeUI();
        this.historyList.innerHTML = '';
        this.history.forEach(h => this.addHistoryItem(h.guess, h.A, h.B));
        
        if (this.isGameOver) {
            this.disableControls();
        } else {
            this.enableControls();
        }
        
        this.showMessage('已恢复上次未完成的游戏');
    }

    checkChallenge() {
        if (!this.currentChallenge) return;
        
        if (this.challengeStatus.completed || this.challengeStatus.failed) {
            this.updateChallengeUI();
            return;
        }
        
        const gameState = {
            isWin: this.isWin,
            isGameOver: this.isGameOver,
            hintUsed: this.hintUsed,
            difficulty: this.difficulty,
            maxGuesses: this.maxGuesses
        };
        
        const result = this.currentChallenge.check(this.history, this.input, gameState);
        
        if (this.isGameOver && !result.completed && !result.failed) {
            this.challengeStatus = {
                completed: false,
                failed: true,
                reason: '游戏结束时未完成挑战'
            };
        } else {
            this.challengeStatus = result;
        }
        
        this.updateChallengeUI();
    }

    getChallengeProgressText() {
        if (!this.currentChallenge) return '';
        
        switch (this.currentChallenge.id) {
            case 'THREE_STEPS_1A2B':
                return `已猜 ${this.history.length}/3 次`;
            case 'FIVE_STEPS_WIN':
                return `已猜 ${this.history.length}/5 次`;
            case 'CONSECUTIVE_A':
                return `连续含A: ${this.getConsecutiveACount()} 次`;
            case 'THREE_CONSECUTIVE_B':
                return `连续含B: ${this.getConsecutiveBCount()} 次`;
            case 'NO_HINT_WIN':
                return this.hintUsed ? '已使用提示' : '未使用提示';
            case 'ALL_GUESSES_HAVE_B':
                return `全部含B: ${this.history.every(h => h.B > 0) ? '是' : '否'}`;
            default:
                return '进行中...';
        }
    }

    getConsecutiveACount() {
        let count = 0;
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].A > 0) count++;
            else break;
        }
        return count;
    }

    getConsecutiveBCount() {
        let count = 0;
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].B > 0) count++;
            else break;
        }
        return count;
    }

    updateChallengeUI() {
        if (!this.currentChallenge) return;
        
        this.challengeTitle.textContent = this.currentChallenge.title;
        
        if (this.challengeStatus.completed) {
            this.challengeStatusEl.textContent = '✓ 挑战完成！';
            this.challengeCard.classList.add('completed');
            this.challengeCard.classList.remove('failed');
        } else if (this.challengeStatus.failed) {
            this.challengeStatusEl.textContent = `✗ 挑战失败：${this.challengeStatus.reason}`;
            this.challengeCard.classList.add('failed');
            this.challengeCard.classList.remove('completed');
        } else {
            this.challengeStatusEl.textContent = this.getChallengeProgressText();
            this.challengeCard.classList.remove('completed', 'failed');
        }
        
        this.switchChallengeBtn.disabled = this.history.length > 0;
    }

    generateUniqueNumber() {
        const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        let result = '';
        for (let i = 0; i < 3; i++) {
            const randomIndex = Math.floor(Math.random() * digits.length);
            result += digits[randomIndex];
            digits.splice(randomIndex, 1);
        }
        return result;
    }

    handleInput(key) {
        if (this.isGameOver || this.input.length >= 3) return;
        
        if (this.input.includes(key)) {
            this.showMessage('数字不能重复', 'error');
            setTimeout(() => this.showMessage(''), 1000);
            return;
        }

        this.input += key;
        this.updateInputDisplay();
    }

    handleUndo() {
        if (this.isGameOver || this.input.length === 0) return;
        this.input = this.input.slice(0, -1);
        this.updateInputDisplay();
    }

    handleSubmit() {
        if (this.isGameOver) return;
        if (this.input.length !== 3) {
            this.showMessage('请输入3位数字', 'error');
            return;
        }

        const guess = this.input;
        const { A, B } = this.calculateResult(guess, this.answer);
        
        this.history.push({ guess, A, B });
        this.addHistoryItem(guess, A, B);
        
        this.checkChallenge();
        this.saveToStorage();
        
        if (A === 3) {
            this.handleWin();
        } else {
            this.input = '';
            this.updateInputDisplay();
            this.checkGameOver();
        }
    }

    calculateResult(guess, target) {
        let A = 0;
        let B = 0;
        for (let i = 0; i < 3; i++) {
            if (guess[i] === target[i]) {
                A++;
            } else if (target.includes(guess[i])) {
                B++;
            }
        }
        return { A, B };
    }

    checkGameOver() {
        if (this.maxGuesses !== Infinity && this.history.length >= this.maxGuesses) {
            this.isGameOver = true;
            this.finalizeChallengeOnLoss('次数已耗尽');
            this.updateUI();
            this.showMessage(`游戏结束！正确答案是: ${this.answer}`, 'error');
            this.disableControls();
            this.clearIncompleteGame();
        } else {
            this.updateUI();
        }
    }

    finalizeChallengeOnLoss(reason) {
        if (!this.currentChallenge) return;
        
        if (!this.challengeStatus.completed && !this.challengeStatus.failed) {
            this.challengeStatus = {
                completed: false,
                failed: true,
                reason: reason
            };
        }
        
        this.updateChallengeUI();
        this.saveChallengeResult(this.challengeStatus.completed);
    }

    handleWin() {
        this.isGameOver = true;
        this.isWin = true;
        this.checkChallenge();
        
        if (this.currentChallenge && !this.challengeStatus.completed && !this.challengeStatus.failed) {
            this.challengeStatus = {
                completed: false,
                failed: true,
                reason: '通关时未满足挑战条件'
            };
        }
        
        let winMsg = `恭喜你！猜对了！答案是 ${this.answer}`;
        if (this.currentChallenge) {
            if (this.challengeStatus.completed) {
                winMsg += ' 🎉 挑战成功！';
                this.saveChallengeResult(true);
            } else {
                winMsg += ` （挑战失败：${this.challengeStatus.reason}）`;
                this.saveChallengeResult(false);
            }
        }
        
        this.showMessage(winMsg, 'success');
        this.updateUI();
        this.updateChallengeUI();
        this.disableControls();
        this.clearIncompleteGame();
    }

    handleHint() {
        if (this.isGameOver) return;
        this.hintUsed = true;
        this.checkChallenge();
        this.updateChallengeUI();

        const candidates = this.getAllCandidates();
        
        const validCandidates = candidates.filter(candidate => {
            return this.history.every(record => {
                const res = this.calculateResult(record.guess, candidate);
                return res.A === record.A && res.B === record.B;
            });
        });

        if (validCandidates.length === 0) {
            this.showMessage('没有符合当前历史记录的答案（可能存在矛盾）', 'error');
            return;
        }

        const randomIndex = Math.floor(Math.random() * validCandidates.length);
        const suggestion = validCandidates[randomIndex];
        
        this.input = suggestion;
        this.updateInputDisplay();
        this.showMessage(`建议尝试: ${suggestion} (剩余 ${validCandidates.length} 种可能答案)`);
        this.saveToStorage();
    }

    getAllCandidates() {
        const candidates = [];
        for (let i = 0; i < 1000; i++) {
            const s = i.toString().padStart(3, '0');
            if (this.isUnique(s)) {
                candidates.push(s);
            }
        }
        return candidates;
    }

    isUnique(str) {
        return str[0] !== str[1] && str[0] !== str[2] && str[1] !== str[2];
    }

    updateInputDisplay() {
        this.digitBoxes.forEach((box, index) => {
            box.textContent = this.input[index] || '';
            if (this.input[index]) {
                box.classList.add('filled');
            } else {
                box.classList.remove('filled');
            }
        });
    }

    addHistoryItem(guess, A, B) {
        const li = document.createElement('li');
        li.className = 'history-item';
        
        const isSuccess = A === 3;
        const badgeClass = isSuccess ? 'success' : 'normal';
        
        li.innerHTML = `
            <span>${guess}</span>
            <span class="result-badge ${badgeClass}">A${A}B${B}</span>
        `;
        
        this.historyList.insertBefore(li, this.historyList.firstChild);
    }

    updateUI() {
        const count = this.history.length;
        if (this.maxGuesses === Infinity) {
            this.remainingInfo.innerHTML = `已猜次数: <span>${count}</span>`;
        } else {
            const remaining = this.maxGuesses - count;
            this.remainingInfo.innerHTML = `剩余次数: <span style="color: ${remaining < 3 ? 'red' : 'inherit'}">${remaining}</span>`;
        }
    }

    showMessage(msg, type = 'normal') {
        this.messageArea.textContent = msg;
        this.messageArea.style.color = type === 'error' ? 'var(--danger-color)' : 
                                     type === 'success' ? 'var(--success-color)' : 
                                     'var(--primary-color)';
    }

    disableControls() {
        this.keyBtns.forEach(btn => btn.disabled = true);
        this.undoBtn.disabled = true;
        this.submitBtn.disabled = true;
        this.hintBtn.disabled = true;
    }

    enableControls() {
        this.keyBtns.forEach(btn => btn.disabled = false);
        this.undoBtn.disabled = false;
        this.submitBtn.disabled = false;
        this.hintBtn.disabled = false;
    }

    saveToStorage() {
        const gameData = {
            answer: this.answer,
            history: this.history,
            isGameOver: this.isGameOver,
            isWin: this.isWin,
            hintUsed: this.hintUsed,
            difficulty: this.difficulty,
            maxGuesses: this.maxGuesses,
            currentChallenge: this.currentChallenge,
            challengeStatus: this.challengeStatus,
            timestamp: Date.now()
        };
        
        if (!this.isGameOver) {
            localStorage.setItem(STORAGE_KEYS.LAST_INCOMPLETE, JSON.stringify(gameData));
        }
    }

    loadFromStorage() {
        try {
            const incompleteStr = localStorage.getItem(STORAGE_KEYS.LAST_INCOMPLETE);
            if (incompleteStr) {
                this.lastIncompleteGame = JSON.parse(incompleteStr);
            }
            
            const historyStr = localStorage.getItem(STORAGE_KEYS.CHALLENGE_HISTORY);
            if (historyStr) {
                this.challengeHistory = JSON.parse(historyStr);
            }
        } catch (e) {
            console.error('Failed to load from storage:', e);
        }
    }

    clearIncompleteGame() {
        localStorage.removeItem(STORAGE_KEYS.LAST_INCOMPLETE);
        this.lastIncompleteGame = null;
    }

    saveChallengeResult(success) {
        if (!this.currentChallenge) return;
        
        const record = {
            challengeId: this.currentChallenge.id,
            challengeTitle: this.currentChallenge.title,
            success: success,
            guessCount: this.history.length,
            difficulty: this.difficulty,
            timestamp: Date.now()
        };
        
        this.challengeHistory.unshift(record);
        if (this.challengeHistory.length > 10) {
            this.challengeHistory = this.challengeHistory.slice(0, 10);
        }
        
        localStorage.setItem(STORAGE_KEYS.CHALLENGE_HISTORY, JSON.stringify(this.challengeHistory));
    }
}

new BullsAndCowsGame();
