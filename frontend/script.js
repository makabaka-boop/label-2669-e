class BullsAndCowsGame {
    constructor() {
        this.answer = '';
        this.input = '';
        this.history = []; // Array of {guess, resultA, resultB}
        this.maxGuesses = Infinity;
        this.isGameOver = false;
        
        // DOM Elements
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

        this.init();
    }

    init() {
        this.bindEvents();
        this.startNewGame();
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

        // Keyboard support
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
        
        const difficulty = this.difficultySelect.value;
        switch(difficulty) {
            case 'easy': this.maxGuesses = 15; break;
            case 'medium': this.maxGuesses = 10; break;
            case 'expert': this.maxGuesses = 6; break;
            default: this.maxGuesses = Infinity; // beginner
        }

        this.updateUI();
        this.updateInputDisplay(); // Clear input boxes
        this.historyList.innerHTML = '';
        this.showMessage('游戏已开始，请输入3位不重复数字');
        this.enableControls();
        
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
        
        // Prevent duplicate digits in input
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
            this.updateUI(); // Update UI to show 0 remaining guesses
            this.showMessage(`游戏结束！正确答案是: ${this.answer}`, 'error');
            this.disableControls();
        } else {
            this.updateUI();
        }
    }

    handleWin() {
        this.isGameOver = true;
        this.showMessage(`恭喜你！猜对了！答案是 ${this.answer}`, 'success');
        this.updateUI(); // To show final count
        this.disableControls();
    }

    // Hint Algorithm
    handleHint() {
        if (this.isGameOver) return;

        // 1. Generate all possible valid numbers (012 to 987, unique digits)
        const candidates = this.getAllCandidates();
        
        // 2. Filter candidates based on history
        // A candidate is valid if, for every past guess G with result R,
        // comparing G against candidate C also yields result R.
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

        // 3. Pick a random one from valid candidates
        const randomIndex = Math.floor(Math.random() * validCandidates.length);
        const suggestion = validCandidates[randomIndex];
        
        // 4. Fill input
        this.input = suggestion;
        this.updateInputDisplay();
        this.showMessage(`建议尝试: ${suggestion} (剩余 ${validCandidates.length} 种可能答案)`);
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

    // UI Updates
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
        
        // Insert at top
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

// Start the game
new BullsAndCowsGame();
