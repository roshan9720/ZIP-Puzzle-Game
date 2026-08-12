Document.addEventListener('DOMContentLoaded', () => {
let coins = parseInt(localStorage.getItem('zip_coins'));
if (isNaN(coins)) {
    coins = 1000; // 500 default + 500 added
    localStorage.setItem('zip_coins', coins);
} else if (!localStorage.getItem('zip_500_added')) {
    coins += 500;
    localStorage.setItem('zip_500_added', 'true');
    localStorage.setItem('zip_coins', coins);
}

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
});
