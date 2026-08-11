function generateSolvableLevel(lvl) {
  const rand = getSeededRandom(lvl);
  
  // 1. DYNAMIC GRID SIZE BASED ON LEVEL DIFFICULTY
  let size = 4;
  if (lvl >= 6) size = 5;      // Medium: 5x5
  if (lvl >= 21) size = 6;     // Hard: 6x6
  if (lvl >= 51) size = 7;     // Expert: 7x7

  const total = size * size;
  let fullPath = [];
  let visited = Array(size).fill(0).map(() => Array(size).fill(false));

  // DFS to generate a random solvable Hamiltonian Path
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

  // Fallback pattern if DFS exceeds max depth
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

  // 2. DYNAMIC NUMBER CHECKPOINTS (DIFFICULTY SCALING)
  let numCheckpoints;
  if (lvl <= 3) {
    numCheckpoints = 2; // Very Easy (1 -> 2)
  } else if (lvl <= 5) {
    numCheckpoints = 3; // Easy (1 -> 2 -> 3)
  } else if (lvl <= 15) {
    numCheckpoints = Math.min(total, 4 + Math.floor((lvl - 5) / 2));
  } else {
    // High difficulty density for higher levels
    numCheckpoints = Math.min(total, Math.floor(total * 0.6) + Math.floor(lvl / 10));
  }

  const checkpoints = {};
  const step = (total - 1) / (numCheckpoints - 1);

  for (let i = 0; i < numCheckpoints; i++) {
    let idx = i === numCheckpoints - 1 ? total - 1 : Math.round(i * step);
    const cell = fullPath[idx];
    checkpoints[`${cell.r},${cell.c}`] = i + 1;
  }

  // 3. WALLS / OBSTACLES DENSITY SCALING
  const pathSet = new Set();
  for (let i = 0; i < fullPath.length - 1; i++) {
    let a = `${fullPath[i].r},${fullPath[i].c}`;
    let b = `${fullPath[i+1].r},${fullPath[i+1].c}`;
    pathSet.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }

  const walls = new Set();
  
  // Easy levels (1-5) have NO WALLS
  if (lvl >= 6) {
    // Walls count grows as level increases
    let maxWalls = Math.floor(2 + (lvl - 5) * 0.8);
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

            // Place wall only if it doesn't block the correct solution
            if (!pathSet.has(key) && rand() < 0.5 && wallCount < maxWalls) {
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
