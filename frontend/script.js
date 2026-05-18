const CHALLENGE_TASKS = [
    {
        id: 'win_in_3',
        desc: '3 步内命中 1A2B 或更好',
        evaluate(game) {
            if (game.history.length === 0) return 'pending';
            const last = game.history[game.history.length - 1];
            if (game.history.length <= 3 && (last.A + last.B) >= 3 && last.A >= 1) return 'completed';
            if (game.history.length > 3) return 'failed';
            return 'pending';
        },
        failReason(game) {
            if (game.history.length > 3) return '已超过 3 步';
            return '';
        }
    },
    {
        id: 'no_hint_win',
        desc: '本局不使用提示完成通关',
        evaluate(game) {
            if (game.isGameOver && game.history.length > 0) {
                const last = game.history[game.history.length - 1];
                if (last.A === 3 && !game.hintUsed) return 'completed';
                if (last.A === 3 && game.hintUsed) return 'failed';
            }
            if (game.hintUsed) return 'failed';
            return 'pending';
        },
        failReason(game) {
            if (game.hintUsed) return '已使用过提示';
            return '';
        }
    },
    {
        id: 'consecutive_a',
        desc: '连续两次结果都包含 A',
        evaluate(game) {
            if (game.history.length < 2) return 'pending';
            const len = game.history.length;
            if (game.history[len - 1].A > 0 && game.history[len - 2].A > 0) return 'completed';
            if (game.history[len - 1].A === 0 && game.history.length >= 2) {
                const hasPair = game.history.slice(0, -1).some((r, i) =>
                    i < game.history.length - 2 && r.A > 0 && game.history[i + 1].A > 0
                );
                if (hasPair) return 'completed';
            }
            const remaining = game.maxGuesses === Infinity ? true : (game.maxGuesses - game.history.length >= 2);
            if (!remaining && game.history.length >= 2) {
                let found = false;
                for (let i = 0; i < game.history.length - 1; i++) {
                    if (game.history[i].A > 0 && game.history[i + 1].A > 0) { found = true; break; }
                }
                if (!found) return 'failed';
            }
            return 'pending';
        },
        failReason() { return '剩余步数不足以达成连续两次包含 A'; }
    },
    {
        id: 'expert_win',
        desc: '专家模式下获胜',
        checkEligible(game) { return game.difficultySelect.value === 'expert'; },
        evaluate(game) {
            if (game.difficultySelect.value !== 'expert') return 'failed';
            if (game.isGameOver && game.history.length > 0) {
                const last = game.history[game.history.length - 1];
                if (last.A === 3) return 'completed';
                return 'failed';
            }
            return 'pending';
        },
        failReason(game) {
            if (game.difficultySelect.value !== 'expert') return '当前非专家模式';
            return '';
        }
    },
    {
        id: 'first_guess_1a',
        desc: '首次猜测就获得至少 1A',
        evaluate(game) {
            if (game.history.length === 0) return 'pending';
            if (game.history[0].A >= 1) return 'completed';
            return 'failed';
        },
        failReason() { return '首次猜测未获得 A'; }
    },
    {
        id: 'win_no_more_than_5',
        desc: '5 步以内通关',
        evaluate(game) {
            if (game.isGameOver && game.history.length > 0) {
                const last = game.history[game.history.length - 1];
                if (last.A === 3 && game.history.length <= 5) return 'completed';
                if (last.A === 3 && game.history.length > 5) return 'failed';
            }
            if (game.history.length >= 5 && !game.isGameOver) {
                const last = game.history[game.history.length - 1];
                if (last.A !== 3) return 'failed';
            }
            return 'pending';
        },
        failReason(game) {
            if (game.history.length > 5) return '已超过 5 步';
            return '';
        }
    }
];

class BullsAndCowsGame {
    constructor() {
        this.answer = '';
        this.input = '';
        this.history = [];
        this.maxGuesses = Infinity;
        this.isGameOver = false;
        this.hintUsed = false;

        this.currentChallenge = null;
        this.challengeStatus = 'pending';
        this.challengeRecords = [];

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

        this.challengeDesc = document.getElementById('challenge-desc');
        this.challengeStatusEl = document.getElementById('challenge-status');
        this.challengeSwitchBtn = document.getElementById('challenge-switch-btn');
        this.challengeHistoryBtn = document.getElementById('challenge-history-btn');
        this.challengeHistoryPanel = document.getElementById('challenge-history-panel');
        this.challengeHistoryList = document.getElementById('challenge-history-list');

        this.loadPersistedData();
        this.init();
    }

    loadPersistedData() {
        try {
            const records = localStorage.getItem('bac_challenge_records');
            if (records) this.challengeRecords = JSON.parse(records);
        } catch (e) { this.challengeRecords = []; }
    }

    saveChallengeRecords() {
        try {
            localStorage.setItem('bac_challenge_records', JSON.stringify(this.challengeRecords));
        } catch (e) {}
    }

    saveGameState() {
        if (this.isGameOver) {
            localStorage.removeItem('bac_active_game');
            return;
        }
        const state = {
            answer: this.answer,
            input: this.input,
            history: this.history,
            maxGuesses: this.maxGuesses,
            hintUsed: this.hintUsed,
            difficulty: this.difficultySelect.value,
            currentChallenge: this.currentChallenge ? this.currentChallenge.id : null,
            challengeStatus: this.challengeStatus
        };
        try {
            localStorage.setItem('bac_active_game', JSON.stringify(state));
        } catch (e) {}
    }

    loadGameState() {
        try {
            const raw = localStorage.getItem('bac_active_game');
            if (!raw) return false;
            const state = JSON.parse(raw);
            if (!state || !state.answer) return false;

            this.answer = state.answer;
            this.input = state.input || '';
            this.history = state.history || [];
            this.maxGuesses = state.maxGuesses ?? Infinity;
            this.hintUsed = state.hintUsed || false;
            this.isGameOver = false;

            if (state.difficulty) {
                this.difficultySelect.value = state.difficulty;
            }

            if (state.currentChallenge) {
                this.currentChallenge = CHALLENGE_TASKS.find(t => t.id === state.currentChallenge) || null;
                this.challengeStatus = state.challengeStatus || 'pending';
            } else {
                this.currentChallenge = null;
                this.challengeStatus = 'pending';
            }

            this.historyList.innerHTML = '';
            for (const record of this.history) {
                this.addHistoryItem(record.guess, record.A, record.B);
            }

            this.updateUI();
            this.updateInputDisplay();
            this.updateChallengeUI();
            this.showMessage('已恢复上次游戏进度');
            this.enableControls();
            return true;
        } catch (e) {
            return false;
        }
    }

    init() {
        this.bindEvents();
        this.updateChallengeHistoryUI();
        if (!this.loadGameState()) {
            this.startNewGame();
        }
    }

    bindEvents() {
        this.newGameBtn.addEventListener('click', () => this.startNewGame());
        this.difficultySelect.addEventListener('change', () => this.startNewGame());

        this.keyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleInput(e.target.dataset.key));
        });

        this.undoBtn.addEventListener('click', () => this.handleUndo());
        this.submitBtn.addEventListener('click', () => this.handleSubmit());
        this.hintBtn.addEventListener('click', () => this.handleHint());

        this.challengeSwitchBtn.addEventListener('click', () => this.switchChallenge());

        this.challengeHistoryBtn.addEventListener('click', () => {
            const panel = this.challengeHistoryPanel;
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        document.addEventListener('keydown', (e) => {
            if (this.isGameOver) return;
            if (e.key >= '0' && e.key <= '9') this.handleInput(e.key);
            if (e.key === 'Backspace') this.handleUndo();
            if (e.key === 'Enter') this.handleSubmit();
        });
    }

    startNewGame() {
        this.answer = this.generateUniqueNumber();
        this.input = '';
        this.history = [];
        this.isGameOver = false;
        this.hintUsed = false;

        const difficulty = this.difficultySelect.value;
        switch (difficulty) {
            case 'easy': this.maxGuesses = 15; break;
            case 'medium': this.maxGuesses = 10; break;
            case 'expert': this.maxGuesses = 6; break;
            default: this.maxGuesses = Infinity;
        }

        this.assignChallenge();

        this.updateUI();
        this.updateInputDisplay();
        this.historyList.innerHTML = '';
        this.showMessage('游戏已开始，请输入3位不重复数字');
        this.enableControls();
        this.saveGameState();

        console.log('Secret Answer (Debug):', this.answer);
    }

    assignChallenge(taskId) {
        if (taskId) {
            this.currentChallenge = CHALLENGE_TASKS.find(t => t.id === taskId) || null;
        } else {
            const eligible = CHALLENGE_TASKS.filter(t => {
                if (t.checkEligible) return t.checkEligible(this);
                return true;
            });
            if (eligible.length === 0) {
                this.currentChallenge = null;
            } else {
                this.currentChallenge = eligible[Math.floor(Math.random() * eligible.length)];
            }
        }
        this.challengeStatus = 'pending';
        this.updateChallengeUI();
    }

    switchChallenge() {
        if (this.isGameOver) return;
        const eligible = CHALLENGE_TASKS.filter(t => {
            if (t.checkEligible) return t.checkEligible(this);
            return true;
        });
        if (eligible.length === 0) {
            this.showMessage('当前难度无可用挑战任务', 'error');
            return;
        }
        const others = eligible.filter(t => !this.currentChallenge || t.id !== this.currentChallenge.id);
        const pool = others.length > 0 ? others : eligible;
        this.currentChallenge = pool[Math.floor(Math.random() * pool.length)];
        this.challengeStatus = 'pending';
        this.updateChallengeUI();
        this.saveGameState();
    }

    evaluateChallenge() {
        if (!this.currentChallenge) return;
        if (this.challengeStatus !== 'pending') return;

        const result = this.currentChallenge.evaluate(this);
        if (result === 'completed' || result === 'failed') {
            this.challengeStatus = result;
            this.recordChallengeResult();
        }
    }

    recordChallengeResult() {
        if (!this.currentChallenge) return;
        let reason = '';
        if (this.challengeStatus === 'failed') {
            reason = this.currentChallenge.failReason
                ? this.currentChallenge.failReason(this)
                : '';
            if (!reason) {
                reason = '未能达成挑战目标';
            }
        }
        const record = {
            taskId: this.currentChallenge.id,
            taskDesc: this.currentChallenge.desc,
            result: this.challengeStatus,
            reason: reason,
            difficulty: this.difficultySelect.value,
            timestamp: Date.now()
        };
        this.challengeRecords.unshift(record);
        if (this.challengeRecords.length > 10) {
            this.challengeRecords = this.challengeRecords.slice(0, 10);
        }
        this.saveChallengeRecords();
        this.updateChallengeHistoryUI();
    }

    updateChallengeUI() {
        if (!this.currentChallenge) {
            this.challengeDesc.textContent = '当前难度无可用挑战';
            this.challengeStatusEl.textContent = '';
            this.challengeStatusEl.className = 'challenge-status';
            return;
        }
        this.challengeDesc.textContent = this.currentChallenge.desc;

        if (this.challengeStatus === 'completed') {
            this.challengeStatusEl.textContent = '✅ 挑战完成！';
            this.challengeStatusEl.className = 'challenge-status completed';
        } else if (this.challengeStatus === 'failed') {
            let reason = this.currentChallenge.failReason
                ? this.currentChallenge.failReason(this)
                : '';
            if (!reason) reason = '未能达成挑战目标';
            this.challengeStatusEl.textContent = `❌ 挑战失败：${reason}`;
            this.challengeStatusEl.className = 'challenge-status failed';
        } else {
            this.challengeStatusEl.textContent = '⏳ 进行中...';
            this.challengeStatusEl.className = 'challenge-status pending';
        }
    }

    updateChallengeHistoryUI() {
        this.challengeHistoryBtn.textContent = `挑战记录 (${this.challengeRecords.length})`;
        this.challengeHistoryList.innerHTML = '';
        for (const r of this.challengeRecords) {
            const li = document.createElement('li');
            const date = new Date(r.timestamp);
            const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            const resultClass = r.result === 'completed' ? 'win' : 'lose';
            const resultText = r.result === 'completed' ? '完成' : (r.reason ? `失败：${r.reason}` : '失败');
            li.innerHTML = `
                <span>${r.taskDesc}</span>
                <span class="ch-result ${resultClass}">${resultText} · ${timeStr}</span>
            `;
            this.challengeHistoryList.appendChild(li);
        }
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

        if (A === 3) {
            this.handleWin();
        } else {
            this.input = '';
            this.updateInputDisplay();
            this.evaluateChallenge();
            this.updateChallengeUI();
            this.checkGameOver();
        }
        this.saveGameState();
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
            if (this.challengeStatus === 'pending') {
                this.evaluateChallenge();
                if (this.challengeStatus === 'pending') {
                    this.challengeStatus = 'failed';
                    this.recordChallengeResult();
                }
            }
            this.updateUI();
            this.updateChallengeUI();
            this.showMessage(`游戏结束！正确答案是: ${this.answer}`, 'error');
            this.disableControls();
            this.saveGameState();
        } else {
            this.updateUI();
        }
    }

    handleWin() {
        this.isGameOver = true;
        if (this.challengeStatus === 'pending') {
            this.evaluateChallenge();
        }
        if (this.challengeStatus === 'pending') {
            this.challengeStatus = 'failed';
            this.recordChallengeResult();
        }
        const challengeInfo = this.currentChallenge
            ? (this.challengeStatus === 'completed' ? ' | 🏆 挑战完成！' : ' | 挑战未完成')
            : '';
        this.showMessage(`恭喜你！猜对了！答案是 ${this.answer}${challengeInfo}`, 'success');
        this.updateUI();
        this.updateChallengeUI();
        this.disableControls();
        this.saveGameState();
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

        this.evaluateChallenge();
        this.updateChallengeUI();
        this.saveGameState();
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
}

new BullsAndCowsGame();
