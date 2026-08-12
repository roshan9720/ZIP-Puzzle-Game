document.addEventListener('DOMContentLoaded', () => {
    // Initialize 500 coins if not present
    let coins = parseInt(localStorage.getItem('zip_coins'));
    if (isNaN(coins)) {
        coins = 500;
        localStorage.setItem('zip_coins', coins);
    }
    document.querySelectorAll('.coin-display').forEach(el => el.innerText = coins);

    let currentLevel = parseInt(localStorage.getItem('zip_current_level')) || 1;
    let highestUnlocked = parseInt(localStorage.getItem('zip_highest_unlocked')) || 1;
    let savedPaths = JSON.parse(localStorage.getItem('zip_saved_paths') || '{}');
    let menuPage = 1;
    const levelsPerPage = 60;
    let toastTimeout = null;

    let gridCols = 4;
    let path = [];
    let isDragging = false;
    let checkpoints = {};
    let walls = new Set();
    let totalCells = 16;
    let maxCheckpoint = 1;

    // Screen Switching
    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    function showToast(text) {
        const toast = document.getElementById('toast-banner');
        const toastMsg = document.getElementById('toast-msg');
        if (!toast || !toastMsg) return;

        toastMsg.innerText = text;  
        toast.classList.add('show');  

        clearTimeout(toastTimeout);  
        toastTimeout = setTimeout(() => {  
            toast.classList.remove('show');  
        }, 3200);
    }

    function updateCoins(amount) {
        coins += amount;
        if (coins < 0) coins = 0;
        localStorage.setItem('zip_coins', coins);
        document.querySelectorAll('.coin-display').forEach(el => el.innerText = coins);
    }

    function saveCurrentPath() {
        savedPaths[currentLevel] = path;
        localStorage.setItem('zip_saved_paths', JSON.stringify(savedPaths));
    }

    function getSeededRandom(lvl) {
        let seed = (lvl ^ 0x6D2B79F5) + Math.imul(lvl, 0x1B873593);
        return function() {
            seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
            seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
            return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
        };
    }

    function generateSolvableLevel(lvl) {
        const rand = getSeededRandom(lvl);

        let size = 4;  
        if (lvl >= 6) size = 5;  
        if (lvl >= 21) size = 6;  
        if (lvl >= 51) size = 7;  

        gridCols = size;
        const total = size * size;  
        totalCells = total;
        let fullPath = [];  
        let visited = Array(size).fill(0).map(() => Array(size).fill(false));  

        function dfs(r, c) {  
            fullPath.push({ r, c });  
            visited[r][c] = true;  
            if (fullPath.length === total) return true;  

            let dirs = [{ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 }];  
            dirs.sort(() => rand() - 0.5);  

            for (let d of dirs) {  
                if (d.r >= 0 && d.r < size && d.c >= 0 && d.c < size && !visited[d.r][d.c]) {  
                    if (dfs(d.r, d.c)) return true;  
                }  
            }  
            fullPath.pop();  
            visited[r][c] = false;  
            return false;  
        }  

        let attempts = 0;  
        while (fullPath.length < total && attempts < 100) {  
            visited = Array(size).fill(0).map(() => Array(size).fill(false));  
            fullPath = [];  
            dfs(Math.floor(rand() * size), Math.floor(rand() * size));  
            attempts++;  
        }  

        if (fullPath.length < total) {  
            fullPath = [];  
            for (let r = 0; r < size; r++) {  
                if (r % 2 === 0) {  
                    for (let c = 0; c < size; c++) fullPath.push({ r, c });  
                } else {  
                    for (let c = size - 1; c >= 0; c--) fullPath.push({ r, c });  
                }  
            }  
        }  

        let minNumbers = 2;  
        let maxNumbers = Math.min(10, Math.floor(total * 0.5));  

        if (lvl <= 3) {  
            minNumbers = 2;  
            maxNumbers = 3;  
        } else if (lvl <= 10) {  
            minNumbers = 2;  
            maxNumbers = 5;  
        } else {  
            minNumbers = 3;  
            maxNumbers = Math.min(8, 3 + Math.floor(lvl / 10));  
        }  

        let numCheckpoints = Math.floor(rand() * (maxNumbers - minNumbers + 1)) + minNumbers;  
        if (numCheckpoints > fullPath.length) numCheckpoints = fullPath.length;

        checkpoints = {};
        let step = Math.max(1, Math.floor((fullPath.length - 1) / (numCheckpoints - 1)));
        let count = 1;
        for (let i = 0; i < fullPath.length && count <= numCheckpoints; i += step) {
            let pt = fullPath[i];
            checkpoints[`${pt.r},${pt.c}`] = count++;
        }
        let lastPt = fullPath[fullPath.length - 1];
        if (!Object.values(checkpoints).includes(count - 1)) {
            checkpoints[`${lastPt.r},${lastPt.c}`] = numCheckpoints;
        }

        maxCheckpoint = Math.max(...Object.values(checkpoints));
    }

    function loadLevel(lvl) {
        currentLevel = lvl;
        localStorage.setItem('zip_current_level', currentLevel);
        document.getElementById('level-display').innerText = `Level ${currentLevel}`;
        document.getElementById('home-level-label').innerText = `Level ${currentLevel}`;

        generateSolvableLevel(currentLevel);
        path = savedPaths[currentLevel] || [];
        renderGrid();
        renderSVGPath();
    }

    function renderGrid() {
        const gridEl = document.getElementById('grid');
        gridEl.innerHTML = '';
        gridEl.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;

        for (let r = 0; r < gridCols; r++) {
            for (let c = 0; c < gridCols; c++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.r = r;
                cell.dataset.c = c;

                let key = `${r},${c}`;
                if (checkpoints[key]) {
                    cell.classList.add('checkpoint');
                    cell.innerText = checkpoints[key];
                }

                if (path.some(p => p.r === r && p.c === c)) {
                    cell.classList.add('active');
                }

                cell.addEventListener('mousedown', (e) => startDrag(r, c, e));
                cell.addEventListener('mouseenter', () => continueDrag(r, c));
                cell.addEventListener('touchstart', (e) => { e.preventDefault(); startDrag(r, c, e); }, {passive: false});
                cell.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    let touch = e.touches[0];
                    let target = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (target && target.classList.contains('grid-cell')) {
                        continueDrag(parseInt(target.dataset.r), parseInt(target.dataset.c));
                    }
                }, {passive: false});

                gridEl.appendChild(cell);
            }
        }
    }

    function startDrag(r, c, e) {
        isDragging = true;
        path = [{ r, c }];
        renderGrid();
        renderSVGPath();
    }

    function continueDrag(r, c) {
        if (!isDragging) return;
        let last = path[path.length - 1];
        if (!last) return;

        let dr = Math.abs(last.r - r);
        let dc = Math.abs(last.c - c);
        if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
            let existingIdx = path.findIndex(p => p.r === r && p.c === c);
            if (existingIdx !== -1) {
                path = path.slice(0, existingIdx + 1);
            } else {
                path.push({ r, c });
            }
            renderGrid();
            renderSVGPath();
            checkWinCondition();
        }
    }

    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('touchend', () => { isDragging = false; });

    function renderSVGPath() {
        const svg = document.getElementById('svg-path-layer');
        svg.innerHTML = '';
        if (path.length < 2) return;

        const gridEl = document.getElementById('grid');
        const rect = gridEl.getBoundingClientRect();
        svg.setAttribute('width', rect.width);
        svg.setAttribute('height', rect.height);

        let pointsStr = '';
        let cellW = rect.width / gridCols;
        let cellH = rect.height / gridCols;

        path.forEach(p => {
            let x = p.c * cellW + cellW / 2;
            let y = p.r * cellH + cellH / 2;
            pointsStr += `${x},${y} `;
        });

        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', pointsStr.trim());
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', 'var(--path-color, #6366f1)');
        polyline.setAttribute('stroke-width', Math.max(6, cellW * 0.2));
        polyline.setAttribute('stroke-linecap', 'round');
        polyline.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(polyline);
    }

    function checkWinCondition() {
        let cpVisitedOrder = [];
        path.forEach(p => {
            let key = `${p.r},${p.c}`;
            if (checkpoints[key]) {
                cpVisitedOrder.push(checkpoints[key]);
            }
        });

        let expected = 1;
        for (let num of cpVisitedOrder) {
            if (num === expected) {
                expected++;
            } else if (num > expected) {
                break;
            }
        }

        if (expected - 1 === maxCheckpoint && path.length === totalCells) {
            isDragging = false;
            saveCurrentPath();
            if (currentLevel >= highestUnlocked) {
                highestUnlocked = currentLevel + 1;
                localStorage.setItem('zip_highest_unlocked', highestUnlocked);
            }
            updateCoins(10);
            document.getElementById('win-msg').innerText = "+10 Coins Earned!";
            document.getElementById('win-modal').style.display = 'flex';
        }
    }

    function renderLevelMenu() {
        const menuGrid = document.getElementById('level-grid-menu');
        menuGrid.innerHTML = '';
        let start = (menuPage - 1) * levelsPerPage + 1;
        let end = Math.min(start + levelsPerPage - 1, 300);

        for (let i = start; i <= end; i++) {
            let btn = document.createElement('button');
            btn.className = 'level-menu-item';
            btn.innerText = i;
            if (i > highestUnlocked) {
                btn.classList.add('locked');
                btn.disabled = true;
            } else {
                btn.addEventListener('click', () => {
                    loadLevel(i);
                    showScreen('game-screen');
                });
            }
            menuGrid.appendChild(btn);
        }
        document.getElementById('page-info-label').innerText = `Page ${menuPage}`;
    }

    // Event Listeners for UI Buttons
    document.getElementById('home-play-btn').addEventListener('click', () => {
        loadLevel(currentLevel);
        showScreen('game-screen');
    });

    document.getElementById('home-menu-btn').addEventListener('click', () => {
        renderLevelMenu();
        showScreen('menu-screen');
    });

    document.getElementById('open-menu-btn').addEventListener('click', () => {
        renderLevelMenu();
        showScreen('menu-screen');
    });

    document.getElementById('menu-back-btn').addEventListener('click', () => {
        showScreen('home-screen');
    });

    document.getElementById('prev-page-btn').addEventListener('click', () => {
        if (menuPage > 1) {
            menuPage--;
            renderLevelMenu();
        }
    });

    document.getElementById('next-page-btn').addEventListener('click', () => {
        if (menuPage * levelsPerPage < 300) {
            menuPage++;
            renderLevelMenu();
        }
    });

    document.getElementById('jump-btn').addEventListener('click', () => {
        let val = parseInt(document.getElementById('jump-input').value);
        if (val >= 1 && val <= highestUnlocked) {
            loadLevel(val);
            showScreen('game-screen');
        } else {
            showToast("Level is locked or invalid!");
        }
    });

    document.getElementById('clean-btn').addEventListener('click', () => {
        path = [];
        renderGrid();
        renderSVGPath();
    });

    document.getElementById('share-btn').addEventListener('click', () => {
        showToast("Level shared!");
    });

    document.getElementById('next-lvl-btn').addEventListener('click', () => {
        document.getElementById('win-modal').style.display = 'none';
        loadLevel(currentLevel + 1);
    });

    document.getElementById('home-level-label').innerText = `Level ${currentLevel}`;
});
            
