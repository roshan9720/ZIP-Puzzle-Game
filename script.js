document.addEventListener('DOMContentLoaded', () => {
  let coins = parseInt(localStorage.getItem('zip_coins')) || 322;
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
  let cellSize = 60;

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

    const total = size * size;
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
    let maxNumbers = Math.min(14, Math.floor(total * 0.6));

    if (lvl <= 3) {
      minNumbers = 2;
      maxNumbers = 3;
    } else if (lvl <= 10) {
      minNumbers = 2;
      maxNumbers = 6;
    } else {
      minNumbers = 3;
      maxNumbers = Math.min(16, 4 + Math.floor(lvl / 5));
    }

    let numCheckpoints = Math.floor(rand() * (maxNumbers - minNumbers + 1)) + minNumbers;

    const checkpoints = {};
    const step = (total - 1) / (numCheckpoints - 1);

    for (let i = 0; i < numCheckpoints; i++) {
      let idx = i === numCheckpoints - 1 ? total - 1 : Math.round(i * step);
      const cell = fullPath[idx];
      checkpoints[`${cell.r},${cell.c}`] = i + 1;
    }

    const pathSet = new Set();
    for (let i = 0; i < fullPath.length - 1; i++) {
      let a = `${fullPath[i].r},${fullPath[i].c}`;
      let b = `${fullPath[i+1].r},${fullPath[i+1].c}`;
      pathSet.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    }

    const walls = new Set();
    
    if (lvl >= 5) {
      let maxWalls = Math.floor(1 + (lvl - 4) * 0.6);
      let wallCount = 0;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          let neighbors = [
            { r: r + 1, c },
            { r, c: c + 1 }
          ];

          for (let n of neighbors) {
            if (n.r < size && n.c < size) {
              let a = `${r},${c}`;
              let b = `${n.r},${n.c}`;
              let key = a < b ? `${a}-${b}` : `${b}-${a}`;

              if (!pathSet.has(key) && rand() < 0.45 && wallCount < maxWalls) {
                walls.add(key);
                wallCount++;
              }
            }
          }
        }
      }
    }

    return { size, checkpoints, walls };
  }

  // --- UPDATED SCREEN NAVIGATION SYSTEM WITH MOBILE BACK SUPPORT ---
  function switchScreen(screenId, pushHistory = true) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.add('active');
    }

    if (pushHistory && screenId !== 'home-screen') {
      history.pushState({ screen: screenId }, '', '');
    }
  }

  // Handle Mobile Phone Hardware Back Button
  window.addEventListener('popstate', () => {
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id !== 'home-screen') {
      updateHomeUI();
      switchScreen('home-screen', false);
    }
  });

  function updateHomeUI() {
    const lvlLabel = document.getElementById('home-level-label');
    if (lvlLabel) lvlLabel.innerText = `Level ${currentLevel}`;
    updateCoins(0);
  }

  function calculateCellSize() {
    const availWidth = window.innerWidth > 430 ? 400 : window.innerWidth - 30;
    const availHeight = window.innerHeight - 230;
    const sizeBasedOnWidth = Math.floor(availWidth / gridCols);
    const sizeBasedOnHeight = Math.floor(availHeight / gridCols);
    return Math.min(sizeBasedOnWidth, sizeBasedOnHeight);
  }

  function isWallBetween(r1, c1, r2, c2) {
    let a = `${r1},${c1}`;
    let b = `${r2},${c2}`;
    let key = a < b ? `${a}-${b}` : `${b}-${a}`;
    return walls.has(key);
  }

  function startLevel(lvl) {
    if (lvl < 1) lvl = 1;
    currentLevel = lvl;
    localStorage.setItem('zip_current_level', currentLevel);

    const data = generateSolvableLevel(lvl);
    gridCols = data.size;
    checkpoints = data.checkpoints;
    walls = data.walls;
    totalCells = gridCols * gridCols;
    maxCheckpoint = Math.max(...Object.values(checkpoints), 1);

    const lvlDisplay = document.getElementById('level-display');
    if (lvlDisplay) lvlDisplay.innerText = `Level ${lvl}`;

    if (savedPaths[currentLevel] && savedPaths[currentLevel].length > 0) {
      path = [...savedPaths[currentLevel]];
    } else {
      path = [];
    }

    isDragging = false;
    cellSize = calculateCellSize();

    const gridElem = document.getElementById('grid');
    if (gridElem) {
      gridElem.style.gridTemplateColumns = `repeat(${gridCols}, ${cellSize}px)`;
      gridElem.style.gridTemplateRows = `repeat(${gridCols}, ${cellSize}px)`;
      gridElem.innerHTML = '';

      for (let r = 0; r < gridCols; r++) {
        for (let c = 0; c < gridCols; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.dataset.r = r;
          cell.dataset.c = c;

          const key = `${r},${c}`;
          if (checkpoints[key]) {
            const numBadge = document.createElement('div');
            numBadge.className = 'num-badge';
            numBadge.innerText = checkpoints[key];
            cell.appendChild(numBadge);
          }

          gridElem.appendChild(cell);
        }
      }
    }

    switchScreen('game-screen');
    updateCoins(0);
    updateUI(false);
  }

  function tryAddToPath(r, c) {
    const key = `${r},${c}`;
    const cellVal = checkpoints[key] || null;

    if (path.length === 0) {
      if (cellVal === 1) { 
        path.push({ r, c }); 
        saveCurrentPath();
        return true; 
      }
      return false;
    }

    if (path.some(p => p.r === r && p.c === c)) {
      return false; 
    }

    const head = path[path.length - 1];
    if (Math.abs(head.r - r) + Math.abs(head.c - c) !== 1) return false;

    if (isWallBetween(head.r, head.c, r, c)) {
      return false;
    }

    if (cellVal !== null) {
      const hitCheckpoints = path.map(p => checkpoints[`${p.r},${p.c}`]).filter(Boolean);
      const currentHighest = hitCheckpoints.length > 0 ? Math.max(...hitCheckpoints) : 1;
      if (cellVal !== currentHighest + 1) return false;
    }

    path.push({ r, c });
    saveCurrentPath();
    return true;
  }

  function drawSVGPathAndWalls() {
    const svg = document.getElementById('svg-path-layer');
    if (!svg) return;
    svg.innerHTML = '';

    walls.forEach(wallKey => {
      let parts = wallKey.split('-');
      let [r1, c1] = parts[0].split(',').map(Number);
      let [r2, c2] = parts[1].split(',').map(Number);

      let wallLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      
      if (r1 === r2) {
        let x = Math.max(c1, c2) * cellSize;
        let y1 = r1 * cellSize + 2;
        let y2 = (r1 + 1) * cellSize - 2;
        wallLine.setAttribute('x1', x);
        wallLine.setAttribute('y1', y1);
        wallLine.setAttribute('x2', x);
        wallLine.setAttribute('y2', y2);
      } else {
        let y = Math.max(r1, r2) * cellSize;
        let x1 = c1 * cellSize + 2;
        let x2 = (c1 + 1) * cellSize - 2;
        wallLine.setAttribute('x1', x1);
        wallLine.setAttribute('y1', y);
        wallLine.setAttribute('x2', x2);
        wallLine.setAttribute('y2', y);
      }

      wallLine.setAttribute('stroke', '#ef4444');
      wallLine.setAttribute('stroke-width', '6');
      wallLine.setAttribute('stroke-linecap', 'round');
      svg.appendChild(wallLine);
    });

    if (path.length === 0) return;

    let pointsStr = '';
    path.forEach((p, idx) => {
      const x = p.c * cellSize + cellSize / 2;
      const y = p.r * cellSize + cellSize / 2;
      pointsStr += `${x},${y} `;

      if (idx === 0) {
        const startCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        startCircle.setAttribute('cx', x);
        startCircle.setAttribute('cy', y);
        startCircle.setAttribute('r', cellSize * 0.22);
        startCircle.setAttribute('fill', '#a85597');
        svg.appendChild(startCircle);
      }
      if (idx === path.length - 1 && path.length > 1) {
        const endCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        endCircle.setAttribute('cx', x);
        endCircle.setAttribute('cy', y);
        endCircle.setAttribute('r', cellSize * 0.18);
        endCircle.setAttribute('fill', '#f97316');
        svg.appendChild(endCircle);
      }
    });

    if (path.length > 1) {
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', pointsStr.trim());
      polyline.setAttribute('fill', 'none');
      polyline.setAttribute('stroke', '#a85597');
      polyline.setAttribute('stroke-width', cellSize * 0.32);
      polyline.setAttribute('stroke-linecap', 'round');
      polyline.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(polyline);
    }
  }

  function updateUI(checkWin = true) {
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('visited'));

    path.forEach((p) => {
      const elem = document.querySelector(`[data-r="${p.r}"][data-c="${p.c}"]`);
      if (elem) elem.classList.add('visited');
    });

    drawSVGPathAndWalls();

    if (checkWin && path.length === totalCells) {
      const lastCell = path[path.length - 1];
      const lastCellKey = `${lastCell.r},${lastCell.c}`;
      const lastCellNum = checkpoints[lastCellKey];

      const hitCheckpoints = path.map(p => checkpoints[`${p.r},${p.c}`]).filter(Boolean);

      if (hitCheckpoints.length === maxCheckpoint && lastCellNum === maxCheckpoint) {
        if (currentLevel >= highestUnlocked) {
          highestUnlocked = currentLevel + 1;
          localStorage.setItem('zip_highest_unlocked', highestUnlocked);
          updateCoins(10);
          document.getElementById('win-msg').innerText = `Level ${currentLevel} Cleared! +10 Coins!`;
        } else {
          document.getElementById('win-msg').innerText = `Level ${currentLevel} Solved!`;
        }
        document.getElementById('win-modal').classList.add('active');
      } else {
        showToast(`Incomplete Level! Line must end on badge (${maxCheckpoint}).`);
      }
    }
  }

  function renderMenu() {
    const menuGrid = document.getElementById('level-grid-menu');
    if (!menuGrid) return;
    menuGrid.innerHTML = '';

    const startLvl = (menuPage - 1) * levelsPerPage + 1;
    const endLvl = startLvl + levelsPerPage - 1;

    for (let i = startLvl; i <= endLvl; i++) {
      const btn = document.createElement('button');
      const isUnlocked = i <= highestUnlocked;
      btn.className = `btn-level-select ${!isUnlocked ? 'locked' : ''}`;
      btn.innerText = i;

      if (isUnlocked) {
        btn.addEventListener('click', () => startLevel(i));
      }

      menuGrid.appendChild(btn);
    }

    const pageLabel = document.getElementById('page-info-label');
    if (pageLabel) pageLabel.innerText = `Levels ${startLvl} - ${endLvl}`;
  }

  // GRID CONTROLS
  const gridElem = document.getElementById('grid');

  function handleStart(e) {
    const touch = e.touches ? e.touches[0] : e;
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) return;
    
    const cell = target.closest('.cell');
    if (!cell) return;
    
    isDragging = true;
    tryAddToPath(parseInt(cell.dataset.r), parseInt(cell.dataset.c));
    updateUI(true);
  }

  function handleMove(e) {
    if (!isDragging) return;
    const touch = e.touches ? e.touches[0] : e;
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) return;

    const cell = target.closest('.cell');
    if (cell && tryAddToPath(parseInt(cell.dataset.r), parseInt(cell.dataset.c))) {
      updateUI(true);
    }
  }

  function handleEnd() {
    isDragging = false;
  }

  if (gridElem) {
    gridElem.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    gridElem.addEventListener('touchstart', handleStart, { passive: true });
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
  }

  // --- BUTTON EVENT LISTENERS WITH SAFE NULL CHECKS ---
  const homePlayBtn = document.getElementById('home-play-btn');
  if (homePlayBtn) {
    homePlayBtn.addEventListener('click', () => startLevel(currentLevel));
  }

  const homeMenuBtn = document.getElementById('home-menu-btn');
  if (homeMenuBtn) {
    homeMenuBtn.addEventListener('click', () => {
      menuPage = Math.ceil(highestUnlocked / levelsPerPage) || 1;
      renderMenu();
      switchScreen('menu-screen');
    });
  }

  const openMenuBtn = document.getElementById('open-menu-btn');
  if (openMenuBtn) {
    openMenuBtn.addEventListener('click', () => {
      updateHomeUI();
      switchScreen('home-screen');
    });
  }

  const menuBackBtn = document.getElementById('menu-back-btn');
  if (menuBackBtn) {
    menuBackBtn.addEventListener('click', () => {
      updateHomeUI();
      switchScreen('home-screen');
    });
  }

  const prevPageBtn = document.getElementById('prev-page-btn');
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (menuPage > 1) { menuPage--; renderMenu(); }
    });
  }

  const nextPageBtn = document.getElementById('next-page-btn');
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      menuPage++; renderMenu();
    });
  }

  const jumpBtn = document.getElementById('jump-btn');
  if (jumpBtn) {
    jumpBtn.addEventListener('click', () => {
      const jumpInput = document.getElementById('jump-input');
      const targetLvl = jumpInput ? parseInt(jumpInput.value) : null;
      if (targetLvl && targetLvl > 0) {
        if (targetLvl <= highestUnlocked) {
          startLevel(targetLvl);
        } else {
          showToast(`Level ${targetLvl} is locked!`);
        }
      }
    });
  }

  const cleanBtn = document.getElementById('clean-btn');
  if (cleanBtn) {
    cleanBtn.addEventListener('click', () => {
      if (coins >= 8) {
        updateCoins(-8);
        path = [];
        saveCurrentPath();
        updateUI(false);
        showToast("Board cleaned successfully!");
      } else {
        showToast("Not enough coins to Clean! Need 8 ★");
      }
    });
  }

  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      showToast('Link copied to clipboard!');
    });
  }

  const nextLvlBtn = document.getElementById('next-lvl-btn');
  if (nextLvlBtn) {
    nextLvlBtn.addEventListener('click', () => {
      const winModal = document.getElementById('win-modal');
      if (winModal) winModal.classList.remove('active');
      startLevel(currentLevel + 1);
    });
  }

  window.addEventListener('resize', () => {
    const gameScreen = document.getElementById('game-screen');
    if (gameScreen && gameScreen.classList.contains('active')) {
      cellSize = calculateCellSize();
      if (gridElem) {
        gridElem.style.gridTemplateColumns = `repeat(${gridCols}, ${cellSize}px)`;
        gridElem.style.gridTemplateRows = `repeat(${gridCols}, ${cellSize}px)`;
      }
      updateUI(false);
    }
  });

  updateHomeUI();
});
