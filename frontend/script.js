const STORAGE_KEY_GAME = 'bc_current_game';
const STORAGE_KEY_RECORDS = 'bc_challenge_records';
const MAX_RECORDS = 10;

const CHALLENGES = [
    {
        id: 'hit_1a2b_within_3',
        desc: '3 步内命中 1A2B',
        description: '在第 1-3 次猜测中，至少有一次结果为 1A2B',
        requiresDifficulty: null,
        check: (ctx) => {
            if (ctx.history.length === 0) return { status: 'ongoing', progress: '等待第 1 次猜测' };
            const firstThree = ctx.history.slice(0, 3);
            const hit = firstThree.find(r => r.A === 1 && r.B === 2);
            if (hit) return { status: 'completed', progress: `第 ${firstThree.indexOf(hit) + 1} 步命中 1A2B` };
            if (ctx.history.length >= 3) return { status: 'failed', reason: '前 3 次均未出现 1A2B' };
            return { status: 'ongoing', progress: `已猜 ${ctx.history.length}/3` };
        }
    },
    {
        id: 'no_hint_clear',
        desc: '本局不使用提示完成通关',
        description: '整局游戏中不点击任何提示按钮',
        requiresDifficulty: null,
        check: (ctx) => {
            if (ctx.hintUsed && ctx.history.length > 0) {
                if (ctx.isGameOver && ctx.won) {
                    return { status: 'failed', reason: '使用了提示后通关' };
                }
                return { status: 'failed', reason: '已使用提示' };
            }
            if (ctx.isGameOver && ctx.won) {
                return { status: 'completed', progress: '未使用提示完成通关' };
            }
            if (ctx.hintUsed) {
                return { status: 'failed', reason: '已使用提示' };
            }
            return { status: 'ongoing', progress: '尚未使用提示' };
        }
    },
    {
        id: 'consecutive_a_results',
        desc: '连续两次结果都包含 A',
        description: '存在连续两次猜测，每次结果的 A 都 ≥ 1',
        requiresDifficulty: null,
        check: (ctx) => {
            if (ctx.history.length < 2) return { status: 'ongoing', progress: `已猜 ${ctx.history.length}/2` };
            for (let i = 1; i < ctx.history.length; i++) {
                if (ctx.history[i].A >= 1 && ctx.history[i - 1].A >= 1) {
                    return { status: 'completed', progress: `第 ${i} 步和第 ${i + 1} 步均含 A` };
                }
            }
            return { status: 'ongoing', progress: `已猜 ${ctx.history.length}，尚未出现连续含 A` };
        }
    },
    {
        id: 'expert_win',
        desc: '专家模式下获胜',
        description: '在专家难度（6 次）中成功猜中答案',
        requiresDifficulty: 'expert',
        check: (ctx) => {
            if (ctx.difficulty !== 'expert') return { status: 'failed', reason: '请切换到专家模式' };
            if (ctx.isGameOver && ctx.won) return { status: 'completed', progress: '专家模式通关' };
            if (ctx.isGameOver && !ctx.won) return { status: 'failed', reason: '专家模式未通关' };
            return { status: 'ongoing', progress: `专家模式，已猜 ${ctx.history.length}/6` };
        }
    },
    {
        id: 'win_within_5',
        desc: '5 步内获胜',
        description: '在第 5 次猜测以内（含第 5 次）猜中答案',
        requiresDifficulty: null,
        check: (ctx) => {
            if (ctx.isGameOver && ctx.won) {
                if (ctx.history.length <= 5) return { status: 'completed', progress: `第 ${ctx.history.length} 步获胜` };
                return { status: 'failed', reason: `第 ${ctx.history.length} 步才获胜（需 ≤5）` };
            }
            if (ctx.history.length >= 5) return { status: 'failed', reason: '前 5 次均未猜中' };
            return { status: 'ongoing', progress: `已猜 ${ctx.history.length}/5` };
        }
    },
    {
        id: 'all_results_contain_a',
        desc: '每次猜测结果都包含 A',
        description: '每一次非最终猜中结果都至少包含 1 个 A',
        requiresDifficulty: null,
        check: (ctx) => {
            if (ctx.history.length === 0) return { status: 'ongoing', progress: '等待第 1 次猜测' };
            const nonFinal = ctx.history.slice(0, -1);
            const final = ctx.history[ctx.history.length - 1];
            if (nonFinal.some(r => r.A === 0)) {
                return { status: 'failed', reason: `第 ${nonFinal.findIndex(r => r.A === 0) + 1} 次结果 A=0` };
            }
            if (ctx.isGameOver && ctx.won) return { status: 'completed', progress: `全部 ${ctx.history.length} 次均含 A` };
            if (final && final.A >= 1 && !ctx.isGameOver) {
                return { status: 'ongoing', progress: `已猜 ${ctx.history.length}，均含 A` };
            }
            if (final && final.A === 0 && !ctx.isGameOver) {
                return { status: 'failed', reason: `第 ${ctx.history.length} 次结果 A=0` };
            }
            return { status: 'ongoing', progress: `已猜 ${ctx.history.length}` };
        }
    },
    {
        id: 'no_b_results',
        desc: '整局游戏没有任何 B',
        description: '每次猜测结果 B 都为 0（直到猜中为止）',
        requiresDifficulty: null,
        check: (ctx) => {
            if (ctx.history.length === 0) return { status: 'ongoing', progress: '等待第 1 次猜测' };
            const hitB = ctx.history.find(r => r.B > 0);
            if (hitB) {
                const idx = ctx.history.indexOf(hitB);
                return { status: 'failed', reason: `第 ${idx + 1} 次结果出现 B${hitB.B}` };
            }
            if (ctx.isGameOver && ctx.won) return { status: 'completed', progress: `全部 ${ctx.history.length} 次均无 B` };
            return { status: 'ongoing', progress: `已猜 ${ctx.history.length}，均无 B` };
        }
    },
    {
        id: 'medium_or_better_win',
        desc: '中等以上难度获胜',
        description: '在中等、简单或专家难度中猜中答案',
        requiresDifficulty: null,
        check: (ctx) => {
            if (ctx.difficulty === 'beginner') return { status: 'failed', reason: '入门模式不计入此挑战' };
            if (ctx.isGameOver && ctx.won) return { status: 'completed', progress: `${difficultyLabel(ctx.difficulty)}模式通关` };
            if (ctx.isGameOver && !ctx.won) return { status: 'failed', reason: '未通关' };
            return { status: 'ongoing', progress: `${difficultyLabel(ctx.difficulty)}模式` };
        }
    }
];

function difficultyLabel(d) {
    return { beginner: '入门', easy: '简单', medium: '中等', expert: '专家' }[d] || d;
}

class BullsAndCowsGame {
    constructor() {
        this.answer = '';
        this.input = '';
        this.history = [];
        this.maxGuesses = Infinity;
        this.isGameOver = false;
        this.won = false;
        this.difficulty = 'beginner';
        this.hintUsed = false;
        this.currentChallenge = null;
        this.challengeStatus = 'ongoing';
        this.challengeFailReason = '';
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

        this.challengePanel = document.getElementById('challenge-panel');
        this.challengeStatusEl = document.getElementById('challenge-status');
        this.challengeDescEl = document.getElementById('challenge-desc');
        this.challengeProgressEl = document.getElementById('challenge-progress');
        this.challengeSwitchBtn = document.getElementById('challenge-switch-btn');
        this.challengeRecordsBtn = document.getElementById('challenge-records-btn');

        this.resultModal = document.getElementById('result-modal');
        this.resultModalTitle = document.getElementById('result-modal-title');
        this.resultModalChallenge = document.getElementById('result-modal-challenge');
        this.resultModalBtn = document.getElementById('result-modal-btn');

        this.recordsModal = document.getElementById('records-modal');
        this.recordsList = document.getElementById('records-list');
        this.recordsModalClose = document.getElementById('records-modal-close');

        this.init();
    }

    init() {
        this.challengeRecords = this.loadRecords();
        this.bindEvents();
        const restored = this.restoreGame();
        if (!restored) {
            this.startNewGame(false);
        }
        this.updateChallengeUI();
    }

    bindEvents() {
        this.newGameBtn.addEventListener('click', () => this.startNewGame(true));
        this.difficultySelect.addEventListener('change', () => this.startNewGame(true));
        this.challengeSwitchBtn.addEventListener('click', () => this.switchChallenge());
        this.challengeRecordsBtn.addEventListener('click', () => this.showRecords());
        this.recordsModalClose.addEventListener('click', () => this.recordsModal.classList.remove('show'));
        this.resultModalBtn.addEventListener('click', () => {
            this.resultModal.classList.remove('show');
            this.startNewGame(true);
        });
        this.recordsModal.addEventListener('click', (e) => {
            if (e.target === this.recordsModal) this.recordsModal.classList.remove('show');
        });

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

    startNewGame(forceNewChallenge = false) {
        this.answer = this.generateUniqueNumber();
        this.input = '';
        this.history = [];
        this.isGameOver = false;
        this.won = false;
        this.hintUsed = false;
        this.challengeFailReason = '';
        this.challengeStatus = 'ongoing';

        this.difficulty = this.difficultySelect.value;
        switch (this.difficulty) {
            case 'easy': this.maxGuesses = 15; break;
            case 'medium': this.maxGuesses = 10; break;
            case 'expert': this.maxGuesses = 6; break;
            default: this.maxGuesses = Infinity;
        }

        if (forceNewChallenge || !this.currentChallenge) {
            this.currentChallenge = this.pickRandomChallenge();
        }

        this.updateUI();
        this.updateInputDisplay();
        this.historyList.innerHTML = '';
        this.showMessage('游戏已开始，请输入3位不重复数字');
        this.enableControls();
        this.updateChallengeUI();
        this.saveGame();

        console.log('Secret Answer (Debug):', this.answer);
    }

    pickRandomChallenge(excludeId = null) {
        const pool = CHALLENGES.filter(c => {
            if (excludeId && c.id === excludeId) return false;
            if (c.requiresDifficulty && c.requiresDifficulty !== this.difficulty) return false;
            return true;
        });
        return pool[Math.floor(Math.random() * pool.length)];
    }

    switchChallenge() {
        if (this.isGameOver) return;
        this.currentChallenge = this.pickRandomChallenge(this.currentChallenge ? this.currentChallenge.id : null);
        this.challengeStatus = 'ongoing';
        this.challengeFailReason = '';
        this.updateChallengeUI();
        this.saveGame();
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

        this.evaluateChallenge();

        if (A === 3) {
            this.won = true;
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
            this.updateUI();
            this.showMessage(`游戏结束！正确答案是: ${this.answer}`, 'error');
            this.disableControls();
            this.evaluateChallenge();
            this.showResultModal(false);
        } else {
            this.updateUI();
        }
    }

    handleWin() {
        this.isGameOver = true;
        this.showMessage(`恭喜你！猜对了！答案是 ${this.answer}`, 'success');
        this.updateUI();
        this.disableControls();
        this.evaluateChallenge();
        this.showResultModal(true);
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

    evaluateChallenge() {
        if (!this.currentChallenge) return;

        const ctx = {
            history: this.history,
            isGameOver: this.isGameOver,
            won: this.won,
            hintUsed: this.hintUsed,
            difficulty: this.difficulty
        };

        const result = this.currentChallenge.check(ctx);
        this.challengeStatus = result.status;
        this.challengeFailReason = result.reason || '';

        if (this.isGameOver && (this.challengeStatus === 'completed' || this.challengeStatus === 'failed')) {
            this.recordChallengeResult();
        }

        this.updateChallengeUI();
    }

    updateChallengeUI() {
        if (!this.currentChallenge) {
            this.challengePanel.style.display = 'none';
            return;
        }
        this.challengePanel.style.display = '';

        this.challengeDescEl.textContent = this.currentChallenge.description;

        const ctx = {
            history: this.history,
            isGameOver: this.isGameOver,
            won: this.won,
            hintUsed: this.hintUsed,
            difficulty: this.difficulty
        };
        const liveResult = this.currentChallenge.check(ctx);

        if (this.challengeStatus === 'completed' || liveResult.status === 'completed') {
            this.challengePanel.classList.remove('failed');
            this.challengePanel.classList.add('completed');
            this.challengeStatusEl.textContent = '已完成';
            this.challengeStatusEl.className = 'challenge-status completed';
            this.challengeProgressEl.textContent = liveResult.progress || this._lastProgress || '';
            this.challengeProgressEl.classList.remove('fail-reason');
        } else if (this.challengeStatus === 'failed' || liveResult.status === 'failed') {
            this.challengePanel.classList.remove('completed');
            this.challengePanel.classList.add('failed');
            this.challengeStatusEl.textContent = '已失效';
            this.challengeStatusEl.className = 'challenge-status failed';
            this.challengeProgressEl.textContent = this.challengeFailReason || liveResult.reason || '';
            this.challengeProgressEl.classList.add('fail-reason');
        } else {
            this.challengePanel.classList.remove('completed', 'failed');
            this.challengeStatusEl.textContent = '进行中';
            this.challengeStatusEl.className = 'challenge-status';
            this.challengeProgressEl.textContent = liveResult.progress || '';
            this._lastProgress = liveResult.progress || '';
            this.challengeProgressEl.classList.remove('fail-reason');
        }
    }

    recordChallengeResult() {
        const record = {
            id: this.currentChallenge.id,
            desc: this.currentChallenge.desc,
            description: this.currentChallenge.description,
            status: this.challengeStatus,
            won: this.won,
            guessCount: this.history.length,
            difficulty: this.difficulty,
            failReason: this.challengeFailReason,
            timestamp: Date.now()
        };
        this.challengeRecords.unshift(record);
        if (this.challengeRecords.length > MAX_RECORDS) {
            this.challengeRecords = this.challengeRecords.slice(0, MAX_RECORDS);
        }
        this.saveRecords();
    }

    showResultModal(won) {
        this.resultModalTitle.textContent = won ? '恭喜通关！' : '游戏结束';
        let challengeText = '';
        if (this.currentChallenge) {
            if (this.challengeStatus === 'completed') {
                challengeText = `挑战「${this.currentChallenge.desc}」：<span class="challenge-result-success">已完成</span>`;
            } else if (this.challengeStatus === 'failed') {
                challengeText = `挑战「${this.currentChallenge.desc}」：<span class="challenge-result-fail">未完成</span>（${this.challengeFailReason}）`;
            } else {
                challengeText = `挑战「${this.currentChallenge.desc}」：未结算`;
            }
        }
        this.resultModalChallenge.innerHTML = challengeText;
        this.resultModal.classList.add('show');
    }

    showRecords() {
        this.renderRecordsList();
        this.recordsModal.classList.add('show');
    }

    renderRecordsList() {
        if (this.challengeRecords.length === 0) {
            this.recordsList.innerHTML = '<li class="empty-records">暂无挑战记录</li>';
            return;
        }
        this.recordsList.innerHTML = this.challengeRecords.map(r => {
            const statusClass = r.status === 'completed' ? 'record-status-success' : 'record-status-fail';
            const statusText = r.status === 'completed' ? '已完成' : '未完成';
            const date = new Date(r.timestamp);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            return `
                <li>
                    <div class="record-task">${r.desc}</div>
                    <div class="record-meta">
                        <span>${difficultyLabel(r.difficulty)} · ${r.won ? `第${r.guessCount}步通关` : '未通关'}</span>
                        <span class="${statusClass}">${statusText}</span>
                    </div>
                    <div class="record-meta" style="margin-top:2px;">
                        <span>${dateStr}</span>
                        ${r.status === 'failed' ? `<span style="color:#ef4444">${r.failReason}</span>` : ''}
                    </div>
                </li>
            `;
        }).join('');
    }

    saveGame() {
        try {
            const data = {
                answer: this.answer,
                input: this.input,
                history: this.history,
                maxGuesses: this.maxGuesses === Infinity ? null : this.maxGuesses,
                isGameOver: this.isGameOver,
                won: this.won,
                difficulty: this.difficulty,
                hintUsed: this.hintUsed,
                currentChallengeId: this.currentChallenge ? this.currentChallenge.id : null,
                challengeStatus: this.challengeStatus,
                challengeFailReason: this.challengeFailReason
            };
            localStorage.setItem(STORAGE_KEY_GAME, JSON.stringify(data));
        } catch (e) {
            console.warn('saveGame failed', e);
        }
    }

    restoreGame() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_GAME);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data.answer) return false;

            this.answer = data.answer;
            this.input = data.input || '';
            this.history = data.history || [];
            this.maxGuesses = data.maxGuesses === null ? Infinity : data.maxGuesses;
            this.isGameOver = data.isGameOver || false;
            this.won = data.won || false;
            this.difficulty = data.difficulty || 'beginner';
            this.hintUsed = data.hintUsed || false;
            this.challengeStatus = data.challengeStatus || 'ongoing';
            this.challengeFailReason = data.challengeFailReason || '';
            this.currentChallenge = CHALLENGES.find(c => c.id === data.currentChallengeId) || null;

            this.difficultySelect.value = this.difficulty;

            this.updateUI();
            this.updateInputDisplay();
            this.historyList.innerHTML = '';
            this.history.forEach(r => this.addHistoryItem(r.guess, r.A, r.B));
            this.updateChallengeUI();

            if (this.isGameOver) {
                this.disableControls();
                if (this.won) {
                    this.showMessage(`游戏已结束，答案 ${this.answer}`, 'success');
                } else {
                    this.showMessage(`游戏已结束，答案 ${this.answer}`, 'error');
                }
            } else {
                this.enableControls();
                this.showMessage('游戏已恢复，请继续输入');
            }
            return true;
        } catch (e) {
            console.warn('restoreGame failed', e);
            return false;
        }
    }

    loadRecords() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    saveRecords() {
        try {
            localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(this.challengeRecords));
        } catch (e) {
            console.warn('saveRecords failed', e);
        }
    }
}

new BullsAndCowsGame();
