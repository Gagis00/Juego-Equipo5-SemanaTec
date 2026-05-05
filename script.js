// ─── CONFIG ────────────────────────────────────────────────────────────────
const COLS = 26, ROWS = 26, CELL = 20;
const BASE_INTERVAL = 140; // ms per tick at level 1

// ─── DOM ───────────────────────────────────────────────────────────────────
const canvas      = document.getElementById('game');
const ctx         = canvas.getContext('2d');
const scoreEl     = document.getElementById('score');
const bestEl      = document.getElementById('best');
const levelEl     = document.getElementById('level');
const overlay     = document.getElementById('overlay');
const overTitle   = document.getElementById('over-title');
const overSub     = document.getElementById('over-sub');
const overScore   = document.getElementById('over-score');
const startBtn    = document.getElementById('start-btn');
const comboEl     = document.getElementById('combo-display');
const canvasWrap  = document.getElementById('canvas-wrap');

//configurción del canvas
canvas.width = 1000;
canvas.height = 500;
// ─── CONFIG ────────────────────────────────────────────────────────────────
const COLS = 26, ROWS = 26, CELL = 20;
const BASE_INTERVAL = 140; // ms per tick at level 1

// ─── DOM ───────────────────────────────────────────────────────────────────
const canvas      = document.getElementById('game');
const ctx         = canvas.getContext('2d');
const scoreEl     = document.getElementById('score');
const bestEl      = document.getElementById('best');
const levelEl     = document.getElementById('level');
const overlay     = document.getElementById('overlay');
const overTitle   = document.getElementById('over-title');
const overSub     = document.getElementById('over-sub');
const overScore   = document.getElementById('over-score');
const startBtn    = document.getElementById('start-btn');
const comboEl     = document.getElementById('combo-display');
const canvasWrap  = document.getElementById('canvas-wrap');

canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;

// ─── STATE ─────────────────────────────────────────────────────────────────
let snake, dir, nextDir, food, score, best, level, combo, particles;
let gameLoop, running, paused, gameOver;

// ─── AUDIO ─────────────────────────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}
function playTone(freq, type = 'square', duration = 0.08, vol = 0.12) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, audioCtx.currentTime + duration);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + duration);
}
function sfxEat()   { playTone(440, 'square', 0.10, 0.15); setTimeout(() => playTone(660, 'square', 0.08, 0.12), 60); }
function sfxDie()   { playTone(200, 'sawtooth', 0.3, 0.2); setTimeout(() => playTone(100, 'sawtooth', 0.4, 0.2), 120); }
function sfxLevel() { [523, 659, 784, 1046].forEach((f,i) => setTimeout(() => playTone(f,'square',0.12,0.15), i*80)); }
function sfxMove()  { playTone(110, 'square', 0.03, 0.04); }

// ─── INIT ──────────────────────────────────────────────────────────────────
function init() {
  snake    = [{ x: 13, y: 13 }, { x: 12, y: 13 }, { x: 11, y: 13 }];
  dir      = { x: 1, y: 0 };
  nextDir  = { x: 1, y: 0 };
  score    = 0;
  level    = 1;
  combo    = 0;
  particles = [];
  best     = parseInt(localStorage.getItem('snakeBest') || '0');
  updateHUD();
  spawnFood();
}

// ─── FOOD ──────────────────────────────────────────────────────────────────
function spawnFood() {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  food = pos;
}

// ─── GAME TICK ─────────────────────────────────────────────────────────────
function tick() {
  if (paused || gameOver) return;

  dir = { ...nextDir };
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Wall collision
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return die();
  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) return die();

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    combo++;
    const pts = 10 * level * (combo > 1 ? combo : 1);
    score += pts;
    if (score > best) { best = score; localStorage.setItem('snakeBest', best); }
    sfxEat();
    spawnParticles(food.x * CELL + CELL/2, food.y * CELL + CELL/2, '#ff2d78');
    showScorePop(food.x * CELL, food.y * CELL, `+${pts}`);
    updateCombo();
    spawnFood();

    const newLevel = Math.floor(score / 150) + 1;
    if (newLevel > level) {
      level = newLevel;
      sfxLevel();
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, Math.max(50, BASE_INTERVAL - (level - 1) * 12));
    }
  } else {
    snake.pop();
    combo = 0;
    comboEl.classList.remove('show');
  }

  updateHUD();
  draw();
}

// ─── DIE ───────────────────────────────────────────────────────────────────
function die() {
  gameOver = true;
  clearInterval(gameLoop);
  sfxDie();
  snake.forEach(s => spawnParticles(s.x * CELL + CELL/2, s.y * CELL + CELL/2, '#00ff88', 4));
  setTimeout(showGameOver, 600);
}

// ─── DRAW ──────────────────────────────────────────────────────────────────
function draw() {
  // Background grid
  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#0d1a2e';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(canvas.width,y*CELL); ctx.stroke();
  }

  // Particles
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    ctx.restore();
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.15;
    p.life--;
  });

  // Food
  const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);
  ctx.save();
  ctx.shadowColor = '#ff2d78';
  ctx.shadowBlur  = 18 * pulse;
  ctx.fillStyle   = '#ff2d78';
  const fp = 3;
  roundRect(ctx, food.x*CELL + fp, food.y*CELL + fp, CELL - fp*2, CELL - fp*2, 4);
  ctx.fill();
  // inner diamond
  ctx.fillStyle = '#ff8aaf';
  ctx.beginPath();
  const cx = food.x*CELL + CELL/2, cy = food.y*CELL + CELL/2;
  ctx.moveTo(cx, cy-4); ctx.lineTo(cx+4, cy); ctx.lineTo(cx, cy+4); ctx.lineTo(cx-4, cy);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // Snake
  snake.forEach((seg, i) => {
    const isHead = i === 0;
    const t = i / snake.length;
    const green = isHead ? '#00ff88' : lerpColor('#00cc66', '#004422', t);
    ctx.save();
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = isHead ? 20 : 8 * (1 - t);
    ctx.fillStyle   = green;
    const pad = isHead ? 1 : 2;
    roundRect(ctx, seg.x*CELL + pad, seg.y*CELL + pad, CELL - pad*2, CELL - pad*2, isHead ? 5 : 3);
    ctx.fill();
    if (isHead) {
      // Eyes
      const eyeSize = 3, eyeOff = 4;
      ctx.fillStyle = '#050810';
      const ex = dir.x, ey = dir.y;
      const px1 = seg.x*CELL + CELL/2 + ey*eyeOff - ex*(eyeOff-2);
      const py1 = seg.y*CELL + CELL/2 + ex*eyeOff - ey*(eyeOff-2);
      const px2 = seg.x*CELL + CELL/2 - ey*eyeOff - ex*(eyeOff-2);
      const py2 = seg.y*CELL + CELL/2 - ex*eyeOff - ey*(eyeOff-2);
      ctx.beginPath(); ctx.arc(px1 + ex*3, py1 + ey*3, eyeSize/2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px2 + ex*3, py2 + ey*3, eyeSize/2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  });
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lerpColor(a, b, t) {
  const ah = a.slice(1), bh = b.slice(1);
  const ar = parseInt(ah.slice(0,2),16), ag = parseInt(ah.slice(2,4),16), ab = parseInt(ah.slice(4,6),16);
  const br = parseInt(bh.slice(0,2),16), bg = parseInt(bh.slice(2,4),16), bb = parseInt(bh.slice(4,6),16);
  return `#${Math.round(ar+(br-ar)*t).toString(16).padStart(2,'0')}${Math.round(ag+(bg-ag)*t).toString(16).padStart(2,'0')}${Math.round(ab+(bb-ab)*t).toString(16).padStart(2,'0')}`;
}

function spawnParticles(x, y, color, n = 12) {
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 / n) * i + Math.random() * 0.4;
    const speed = 1.5 + Math.random() * 2.5;
    particles.push({
      x, y, color,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 4,
      life: 25 + Math.random() * 15,
      maxLife: 40,
    });
  }
}

function showScorePop(x, y, text) {
  const el = document.createElement('div');
  el.className = 'score-pop';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  canvasWrap.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function updateCombo() {
  if (combo >= 2) {
    comboEl.textContent = `COMBO x${combo}`;
    comboEl.classList.add('show');
  } else {
    comboEl.classList.remove('show');
  }
}

function updateHUD() {
  scoreEl.textContent = String(score).padStart(6, '0');
  bestEl.textContent  = String(best).padStart(6, '0');
  levelEl.textContent = String(level).padStart(2, '0');
}

// ─── OVERLAY ───────────────────────────────────────────────────────────────
function showGameOver() {
  overTitle.textContent = 'GAME OVER';
  overSub.textContent   = 'Presiona ESPACIO o toca para reiniciar';
  overScore.textContent = `SCORE: ${String(score).padStart(6,'0')}`;
  startBtn.textContent  = '↺ RETRY';
  overlay.classList.add('visible');
  running = false;
}

function startGame() {
  initAudio();
  overlay.classList.remove('visible');
  overScore.textContent = '';
  init();
  gameOver = false;
  paused   = false;
  running  = true;
  clearInterval(gameLoop);
  gameLoop = setInterval(tick, BASE_INTERVAL);
  draw();
}

// ─── INPUT ─────────────────────────────────────────────────────────────────
const DIRS = {
  ArrowUp:    { x: 0, y:-1 }, w: { x: 0, y:-1 },
  ArrowDown:  { x: 0, y: 1 }, s: { x: 0, y: 1 },
  ArrowLeft:  { x:-1, y: 0 }, a: { x:-1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
};

document.addEventListener('keydown', e => {
  const d = DIRS[e.key];
  if (d) {
    e.preventDefault();
    if (running && !gameOver) {
      if (d.x !== -dir.x || d.y !== -dir.y) {
        nextDir = d;
        sfxMove();
      }
    }
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!running || gameOver) startGame();
  }
  if (e.key === 'p' || e.key === 'P') {
    if (running && !gameOver) {
      paused = !paused;
      if (paused) {
        overTitle.textContent = 'PAUSE';
        overSub.textContent   = 'Presiona P para continuar';
        overScore.textContent = '';
        startBtn.style.display = 'none';
        overlay.classList.add('visible');
      } else {
        overlay.classList.remove('visible');
        startBtn.style.display = '';
      }
    }
  }
});

startBtn.addEventListener('click', startGame);

// ─── SWIPE ─────────────────────────────────────────────────────────────────
let touchStart = null;
canvas.addEventListener('touchstart', e => { touchStart = e.touches[0]; }, { passive: true });
canvas.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.clientX;
  const dy = e.changedTouches[0].clientY - touchStart.clientY;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
  let nd;
  if (Math.abs(dx) > Math.abs(dy)) nd = dx > 0 ? DIRS.ArrowRight : DIRS.ArrowLeft;
  else                              nd = dy > 0 ? DIRS.ArrowDown  : DIRS.ArrowUp;
  if (nd.x !== -dir.x || nd.y !== -dir.y) { nextDir = nd; sfxMove(); }
  touchStart = null;
}, { passive: true });

// ─── INIT RENDER ───────────────────────────────────────────────────────────
init();
draw();
