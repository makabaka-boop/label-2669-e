const CHALLENGE_TASKS = [
    {
        id: 'three_steps_1a2b',
        description: '3 步内命中 1A2B',
        check: (history, game) => {
            if (history.length === 0) return { status: 'pending' };
            for (let i = 0; i < Math.min(history.length, 3); i++) {
                if (history[i].A === 1 && history[i].B === 2) {
                    return { status: 'completed' };
                }
            }
            if (history.length >= 3 || game.isGameOver) {
                return { status: 'failed', reason: '已使用 3 次机会，未命中 1A2B' };
            }
            return { status: 'pending' };
        }
    },
    {
        id: 'no_hint_win',
        description: '本局不使用提示完成通关',
        check: (history, game) => {
            if (game.hintUsed) {
                return { status: 'failed', reason: '已使用了提示功能' };
            }
            if (game.isGameOver && history.length > 0 && history[history.length - 1].A === 3) {
                return { status: 'completed' };
            }
            return { status: 'pending' };
        }
    },
    {
        id: 'consecutive_a',
        description: '连续两次结果都包含 A',
        check: (history, game) => {
            if (history.length < 2) return { status: 'pending' };
            const last = history[history.length - 1];
            const prev = history[history.length - 2];
            if (last.A > 0 && prev.A > 0) {
                return { status: 'completed' };
            }
            return { status: 'pending' };
        }
    },
    {
        id: 'expert_win',
        description: '专家模式下获胜',
        check: (history, game) => {
            if (game.difficulty !== 'expert') {
                return { status: 'failed', reason: '当前不是专家模式' };
            }
            if (game.isGameOver) {
                if (history.length > 0 && history[history.length - 1].A === 3) {
                    return { status: 'completed' };
                } else {
                    return { status: 'failed', reason: '专家模式下未能获胜' };
                }
            }
            return { status: 'pending' };
        }
    },
    {
        id: 'within_5_steps',
        description: '5 步内完成通关',
        check: (history, game) => {
            if (history.length > 0 && history[history.length - 1].A === 3) {
                if (history.length <= 5) {
                    return { status: 'completed' };
                } else {
                    return { status: 'failed', reason: `使用了 ${history.length} 步，超过 5 步限制` };
                }
            }
            if (history.length >= 5) {
                return { status: 'failed', reason: '已使用 5 次机会，未完成通关' };
            }
            return { status: 'pending' };
        }
    },
    {
        id: 'all_results_have_b',
        description: '每次结果都至少包含 1 个 B',
        check: (history, game) => {
            for (let i = 0; i < history.length; i++) {
                if (history[i].B === 0) {
                    return { status: 'failed', reason: `第 ${i + 1} 次猜测结果不含 B` };
                }
            }
            if (game.isGameOver && history.length > 0 && history[history.length - 1].A === 3) {
                return { status: 'completed' };
            }
            return { status: 'pending' };
        }
    },
    {
        id: 'first_guess_2a0b',
        description: '第一次猜测获得 2A0B',
        check: (history, game) => {
            if (history.length === 0) return { status: 'pending' };
            if (history[0].A === 2 && history[0].B === 0) {
                return { status: 'completed' };
            }
            return { status: 'failed', reason: '第一次猜测未获得 2A0B' };
        }
    },
    {
        id: 'no_duplicate_digits_in_history',
        description: '所有猜测使用的数字不重复（累计）',
        check: (history, game) => {
            const usedDigits = new Set();
            for (const record of history) {
                for (const d of record.guess) {
                    if (usedDigits.has(d)) {
                        return { status: 'failed', reason: `数字 ${d} 在多次猜测中重复使用` };
                    }
                    usedDigits.add(d);
                }
            }
            if (game.isGameOver && history.length > 0 && history[history.length - 1].A === 3) {
                return { status: 'completed' };
            }
            return { status: 'pending' };
        }
    }
];

const STORAGE_KEYS = {
    CURRENT_GAME: 'bulls_cows_current_game',
    CHALLENGE_HISTORY: 'bulls_cows_challenge_history'
};

class BullsAndCowsGame {
    constructor() {
        this.answer = '';
        this.input = '';
        this.history = [];
        this.maxGuesses = Infinity;
        this.isGameOver = false;
        this.difficulty = 'beginner';
        this.hintUsed = false;
        this.currentChallenge = null;
        this.challengeStatus = 'pending';
        this.challengeFailureReason = '';
        this.challengeHistory = [];

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
        this.challengeDescription = document.getElementById('challenge-description');
        this.statusBadge = document.getElementById('status-badge');
        this.changeChallengeBtn = document.getElementById('change-challenge-btn');
        this.challengeFailure = document.getElementById('challenge-failure');

        this.init();
    }

    init() {
        this.loadChallengeHistory();
        this.bindEvents();
        if (!this.restoreGame()) {
            this.startNewGame();
        }
    }

    bindEvents() {
        this.newGameBtn.addEventListener('click', () => this.startNewGame());
        this.difficultySelect.addEventListener('change', () => this.startNewGame());
        this.changeChallengeBtn.addEventListener('click', () => this.changeChallenge());

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

        window.addEventListener('beforeunload', () => this.saveGame());
    }

    getRandomChallenge(excludeId = null) {
        let availableChallenges = CHALLENGE_TASKS.filter(task => {
            if (task.id === 'expert_win' && this.difficulty !== 'expert') return false;
            if (excludeId && task.id === excludeId) return false;
            return true;
        });
        if (availableChallenges.length === 0) {
            availableChallenges = CHALLENGE_TASKS.filter(task => {
                if (task.id === 'expert_win' && this.difficulty !== 'expert') return false;
                return true;
            });
        }
        const randomIndex = Math.floor(Math.random() * availableChallenges.length);
        return { ...availableChallenges[randomIndex] };
    }

    changeChallenge() {
        if (this.history.length > 0) {
            this.showMessage('游戏开始后无法切换任务', 'error');
            setTimeout(() => this.showMessage(''), 1500);
            return;
        }
        const currentId = this.currentChallenge ? this.currentChallenge.id : null;
        this.currentChallenge = this.getRandomChallenge(currentId);
        this.challengeStatus = 'pending';
        this.challengeFailureReason = '';
        this.updateChallengeUI();
        this.saveGame();
    }

    checkChallenge() {
        if (!this.currentChallenge) return;
        
        const task = CHALLENGE_TASKS.find(t => t.id === this.currentChallenge.id);
        if (!task) return;

        const result = task.check(this.history, this);
        this.challengeStatus = result.status;
        if (result.reason) {
            this.challengeFailureReason = result.reason;
        }
    }

    updateChallengeUI() {
        if (!this.currentChallenge) return;

        this.challengeDescription.textContent = this.currentChallenge.description;

        this.challengeCard.classList.remove('completed', 'failed');
        
        if (this.challengeStatus === 'completed') {
            this.challengeCard.classList.add('completed');
            this.statusBadge.textContent = '✓ 已完成';
            this.challengeFailure.style.display = 'none';
        } else if (this.challengeStatus === 'failed') {
            this.challengeCard.classList.add('failed');
            this.statusBadge.textContent = '✗ 已失败';
            if (this.challengeFailureReason) {
                this.challengeFailure.textContent = `失败原因：${this.challengeFailureReason}`;
                this.challengeFailure.style.display = 'block';
            }
        } else {
            this.statusBadge.textContent = '进行中';
            this.challengeFailure.style.display = 'none';
        }

        this.changeChallengeBtn.disabled = this.history.length > 0;
    }

    startNewGame() {
        this.answer = this.generateUniqueNumber();
        this.input = '';
        this.history = [];
        this.isGameOver = false;
        this.hintUsed = false;
        
        this.difficulty = this.difficultySelect.value;
        switch(this.difficulty) {
            case 'easy': this.maxGuesses = 15; break;
            case 'medium': this.maxGuesses = 10; break;
            case 'expert': this.maxGuesses = 6; break;
            default: this.maxGuesses = Infinity;
        }

        this.currentChallenge = this.getRandomChallenge();
        this.challengeStatus = 'pending';
        this.challengeFailureReason = '';

        this.updateUI();
        this.updateChallengeUI();
        this.updateInputDisplay();
        this.historyList.innerHTML = '';
        this.showMessage('游戏已开始，请输入3位不重复数字');
        this.enableControls();
        
        this.saveGame();
        
        console.log('Secret Answer (Debug):', this.answer);
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
        this.saveGame();
    }

    handleUndo() {
        if (this.isGameOver || this.input.length === 0) return;
        this.input = this.input.slice(0, -1);
        this.updateInputDisplay();
        this.saveGame();
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
        this.updateChallengeUI();

        if (A === 3) {
            this.handleWin();
        } else {
            this.input = '';
            this.updateInputDisplay();
            this.checkGameOver();
        }

        this.saveGame();
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
            this.checkChallenge();
            this.updateChallengeUI();
            this.updateUI();
            this.showMessage(`游戏结束！正确答案是: ${this.answer}`, 'error');
            this.disableControls();
            this.recordChallengeResult(false);
            this.saveGame();
        } else {
            this.updateUI();
        }
    }

    handleWin() {
        this.isGameOver = true;
        this.checkChallenge();
        this.updateChallengeUI();
        
        let winMessage = `恭喜你！猜对了！答案是 ${this.answer}`;
        if (this.currentChallenge) {
            if (this.challengeStatus === 'completed') {
                winMessage += ' 🎉 挑战完成！';
            } else if (this.challengeStatus === 'failed') {
                winMessage += '（挑战失败）';
            }
        }
        
        this.showMessage(winMessage, 'success');
        this.updateUI();
        this.disableControls();
        this.recordChallengeResult(true);
        this.saveGame();
    }

    handleHint() {
        if (this.isGameOver) return;

        this.hintUsed = true;

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

        this.checkChallenge();
        this.updateChallengeUI();
        this.saveGame();
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

    saveGame() {
        const gameState = {
            answer: this.answer,
            input: this.input,
            history: this.history,
            maxGuesses: this.maxGuesses,
            isGameOver: this.isGameOver,
            difficulty: this.difficulty,
            hintUsed: this.hintUsed,
            currentChallenge: this.currentChallenge,
            challengeStatus: this.challengeStatus,
            challengeFailureReason: this.challengeFailureReason,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.CURRENT_GAME, JSON.stringify(gameState));
    }

    restoreGame() {
        const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_GAME);
        if (!saved) return false;

        try {
            const state = JSON.parse(saved);
            
            if (state.isGameOver) {
                localStorage.removeItem(STORAGE_KEYS.CURRENT_GAME);
                return false;
            }

            this.answer = state.answer;
            this.input = state.input || '';
            this.history = state.history || [];
            this.maxGuesses = state.maxGuesses;
            this.isGameOver = state.isGameOver;
            this.difficulty = state.difficulty || 'beginner';
            this.hintUsed = state.hintUsed || false;
            this.currentChallenge = state.currentChallenge;
            this.challengeStatus = state.challengeStatus || 'pending';
            this.challengeFailureReason = state.challengeFailureReason || '';

            this.difficultySelect.value = this.difficulty;

            this.historyList.innerHTML = '';
            this.history.forEach(record => {
                this.addHistoryItem(record.guess, record.A, record.B);
            });

            this.updateInputDisplay();
            this.updateUI();
            this.updateChallengeUI();
            this.showMessage('已恢复上次游戏进度');
            this.enableControls();

            console.log('Restored Answer (Debug):', this.answer);
            return true;
        } catch (e) {
            console.error('Failed to restore game:', e);
            localStorage.removeItem(STORAGE_KEYS.CURRENT_GAME);
            return false;
        }
    }

    loadChallengeHistory() {
        const saved = localStorage.getItem(STORAGE_KEYS.CHALLENGE_HISTORY);
        if (saved) {
            try {
                this.challengeHistory = JSON.parse(saved);
            } catch (e) {
                this.challengeHistory = [];
            }
        }
    }

    saveChallengeHistory() {
        localStorage.setItem(STORAGE_KEYS.CHALLENGE_HISTORY, JSON.stringify(this.challengeHistory));
    }

    recordChallengeResult(won) {
        if (!this.currentChallenge) return;

        const record = {
            challengeId: this.currentChallenge.id,
            challengeDescription: this.currentChallenge.description,
            status: this.challengeStatus,
            won: won,
            difficulty: this.difficulty,
            steps: this.history.length,
            timestamp: Date.now()
        };

        this.challengeHistory.unshift(record);
        if (this.challengeHistory.length > 10) {
            this.challengeHistory = this.challengeHistory.slice(0, 10);
        }

        this.saveChallengeHistory();
    }
}

new BullsAndCowsGame();
