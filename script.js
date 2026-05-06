// CONFIGURACIÓN DEL JUEGO
// Definimos las dimensiones del tablero y la velocidad base.
// COLS y ROWS = número de celdas en X e Y
// CELL = tamaño en píxeles de cada celda
// BASE_INTERVAL = milisegundos entre cada tick (movimiento) en nivel 1
const COLS = 26, ROWS = 26, CELL = 20;
const BASE_INTERVAL = 140;

// REFERENCIAS AL DOM
// Guardamos referencias a los elementos HTML que vamos a manipular desde JS.
// Es más eficiente hacerlo una vez aquí que buscarlo cada vez con getElementById.
const canvas      = document.getElementById('game');
const ctx         = canvas.getContext('2d'); // Contexto 2D para dibujar
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

// Ajustamos el tamaño real del canvas en píxeles según nuestra configuración
canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;

// VARIABLES DE ESTADO
// Estas variables guardan la información del juego en todo momento.
let snake;      // Array de objetos {x, y} que representan cada segmento de la serpiente
let dir;        // Dirección actual de movimiento {x, y}
let nextDir;    // Próxima dirección (se aplica al siguiente tick para evitar giros de 180°)
let food;       // Posición de la comida {x, y}
let score;      // Puntuación actual
let best;       // Mejor puntuación (persistida en localStorage)
let level;      // Nivel actual (aumenta con el score)
let combo;      // Contador de comidas consecutivas sin perder
let particles;  // Array de partículas para efectos visuales
let gameLoop;   // Referencia al setInterval del bucle principal
let running;    // true si el juego está activo
let paused;     // true si el juego está pausado
let gameOver;   // true si el jugador perdió

// SISTEMA DE AUDIO
// Usamos la Web Audio API para generar sonidos sintéticos sin archivos de audio.
// Creamos osciladores con diferentes frecuencias y formas de onda.
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx; // Se inicializa al primer input del usuario (requisito del navegador)

// Inicializamos el contexto de audio (debe hacerse tras un gesto del usuario)
function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}

// Función base para generar un tono
// freq: frecuencia en Hz | type: forma de onda | duration: duración en segundos | vol: volumen
function playTone(freq, type = 'square', duration = 0.08, vol = 0.12) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(); // Genera la onda
  const g = audioCtx.createGain();       // Controla el volumen
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  // La frecuencia baja a la mitad al final: da efecto de "caída"
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, audioCtx.currentTime + duration);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration); // Fade out
  o.connect(g);
  g.connect(audioCtx.destination); // Conecta a los altavoces
  o.start();
  o.stop(audioCtx.currentTime + duration);
}

// Sonido al comer: dos tonos ascendentes con pequeño delay (efecto "pip pip")
function sfxEat()   { playTone(440, 'square', 0.10, 0.15); setTimeout(() => playTone(660, 'square', 0.08, 0.12), 60); }

// Sonido de muerte: dos tonos graves descendentes (efecto de falla)
function sfxDie()   { playTone(200, 'sawtooth', 0.3, 0.2); setTimeout(() => playTone(100, 'sawtooth', 0.4, 0.2), 120); }

// Sonido de subir de nivel: melodía ascendente de 4 notas
function sfxLevel() { [523, 659, 784, 1046].forEach((f,i) => setTimeout(() => playTone(f,'square',0.12,0.15), i*80)); }

// Sonido de movimiento: tono muy corto y grave (sutil)
function sfxMove()  { playTone(110, 'square', 0.03, 0.04); }

// INICIALIZACIÓN
// Resetea todas las variables al estado inicial antes de cada partida.
function init() {
  // Serpiente inicial: 3 segmentos horizontales en el centro del tablero
  snake    = [{ x: 13, y: 13 }, { x: 12, y: 13 }, { x: 11, y: 13 }];
  dir      = { x: 1, y: 0 };  // Empieza moviéndose hacia la derecha
  nextDir  = { x: 1, y: 0 };
  score    = 0;
  level    = 1;
  combo    = 0;
  particles = [];
  // Leemos el mejor score guardado en el navegador (persiste entre sesiones)
  best     = parseInt(localStorage.getItem('snakeBest') || '0');
  updateHUD();
  spawnFood(); // Generamos la primera comida
}

// GENERACIÓN DE COMIDA
// Elige una posición aleatoria que no esté ocupada por la serpiente.
function spawnFood() {
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS)
    };
  // Repetimos si la posición coincide con algún segmento de la serpiente
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  food = pos;
}

// TICK PRINCIPAL (BUCLE DEL JUEGO)
// Esta función se llama repetidamente cada X milisegundos (setInterval).
// En cada tick: calculamos nueva posición, detectamos colisiones, actualizamos estado.
function tick() {
  if (paused || gameOver) return; // No hacemos nada si está pausado o terminado

  // Aplicamos la dirección que el jugador eligió
  dir = { ...nextDir };

  // Calculamos dónde estará la cabeza en el próximo paso
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  //Colisión con paredes 
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return die();

  //Colisión con el cuerpo propio 
  if (snake.some(s => s.x === head.x && s.y === head.y)) return die();

  // Añadimos la nueva cabeza al frente del array
  snake.unshift(head);

  // ¿La cabeza llegó a la comida?
  if (head.x === food.x && head.y === food.y) {
    combo++;
    // Si hay combo activo, multiplicamos los puntos base
    const pts = 10 * level * (combo > 1 ? combo : 1);
    score += pts;

    // Actualizamos el mejor score si se supera
    if (score > best) {
      best = score;
      localStorage.setItem('snakeBest', best); // Lo guardamos en el navegador
    }

    sfxEat();

    // Efecto de partículas en la posición de la comida
    spawnParticles(food.x * CELL + CELL/2, food.y * CELL + CELL/2, '#ff2d78');

    // Texto flotante con los puntos ganados
    showScorePop(food.x * CELL, food.y * CELL, `+${pts}`);

    updateCombo();  // Actualiza el texto de combo en pantalla
    spawnFood();    // Genera nueva comida

    //Sistema de niveles
    // Cada 150 puntos subimos un nivel, lo que aumenta la velocidad
    const newLevel = Math.floor(score / 150) + 1;
    if (newLevel > level) {
      level = newLevel;
      sfxLevel();
      clearInterval(gameLoop);
      // Reducimos el intervalo (más rápido) con un mínimo de 50ms
      gameLoop = setInterval(tick, Math.max(50, BASE_INTERVAL - (level - 1) * 12));
    }
  } else {
    // Si no comió, eliminamos el último segmento (la cola se mueve hacia adelante)
    snake.pop();
    combo = 0; // Rompemos el combo
    comboEl.classList.remove('show'); // Ocultamos el texto de combo
  }

  updateHUD(); // Actualizamos los números en pantalla
  draw();      // Redibujamos todo el canvas
}

// MUERTE
// Se activa cuando hay colisión. Lanza partículas por toda la serpiente
// y muestra la pantalla de game over tras un pequeño delay dramático.
function die() {
  gameOver = true;
  clearInterval(gameLoop); // Detenemos el bucle
  sfxDie();

  // Partículas en cada segmento de la serpiente
  snake.forEach(s =>
    spawnParticles(s.x * CELL + CELL/2, s.y * CELL + CELL/2, '#00ff88', 4)
  );

  // Pequeño delay para que se vean las partículas antes del overlay
  setTimeout(showGameOver, 600);
}

// FUNCIÓN DE DIBUJO
// Redibuja el canvas completo en cada tick.
// Orden: fondo → grid → partículas → comida → serpiente
function draw() {
  //Fondo y grid 
  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, canvas.width, canvas.height); // Borramos el frame anterior

  // Dibujamos las líneas de la cuadrícula
  ctx.strokeStyle = '#0d1a2e';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x*CELL, 0); ctx.lineTo(x*CELL, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y*CELL); ctx.lineTo(canvas.width, y*CELL); ctx.stroke();
  }

  // Partículas
  // Filtramos las que ya expiraron (life <= 0) y dibujamos las activas
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife; // Se vuelven transparentes al morir
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    ctx.restore();
    // Actualizamos posición y física de cada partícula
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15; // Gravedad suave
    p.life--;
  });

  //Comida
  // Efecto de pulso: el brillo varía con una onda sinusoidal basada en el tiempo
  const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);
  ctx.save();
  ctx.shadowColor = '#ff2d78';
  ctx.shadowBlur  = 18 * pulse; // El brillo "late" 
  ctx.fillStyle   = '#ff2d78';
  const fp = 3; // Padding interno
  roundRect(ctx, food.x*CELL + fp, food.y*CELL + fp, CELL - fp*2, CELL - fp*2, 4);
  ctx.fill();
  // Diamante blanco en el centro de la comida (detalle visual)
  ctx.fillStyle = '#ff8aaf';
  ctx.beginPath();
  const cx = food.x*CELL + CELL/2, cy = food.y*CELL + CELL/2;
  ctx.moveTo(cx, cy-4); ctx.lineTo(cx+4, cy);
  ctx.lineTo(cx, cy+4); ctx.lineTo(cx-4, cy);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  //Serpiente
  snake.forEach((seg, i) => {
    const isHead = i === 0;
    const t = i / snake.length; // Valor 0→1 desde cabeza hasta cola

    // El color se degrada de verde brillante a verde oscuro según la posición
    const green = isHead ? '#00ff88' : lerpColor('#00cc66', '#004422', t);

    ctx.save();
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = isHead ? 20 : 8 * (1 - t); // La cabeza brilla más

    ctx.fillStyle = green;
    const pad = isHead ? 1 : 2; // La cabeza es ligeramente más grande
    roundRect(ctx, seg.x*CELL + pad, seg.y*CELL + pad, CELL - pad*2, CELL - pad*2, isHead ? 5 : 3);
    ctx.fill();

    // Ojos de la serpiente (solo en la cabeza)
    if (isHead) {
      const eyeSize = 3, eyeOff = 4;
      ctx.fillStyle = '#050810'; // Color oscuro para los ojos
      // Calculamos la posición de los ojos perpendicular a la dirección de movimiento
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

// FUNCIONES AUXILIARES

// Dibuja un rectángulo con esquinas redondeadas en el canvas
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Interpola entre dos colores hexadecimales según el valor t (0 = color a, 1 = color b)
// Usado para el degradado de color en el cuerpo de la serpiente
function lerpColor(a, b, t) {
  const ah = a.slice(1), bh = b.slice(1);
  const ar = parseInt(ah.slice(0,2),16), ag = parseInt(ah.slice(2,4),16), ab = parseInt(ah.slice(4,6),16);
  const br = parseInt(bh.slice(0,2),16), bg = parseInt(bh.slice(2,4),16), bb = parseInt(bh.slice(4,6),16);
  return `#${Math.round(ar+(br-ar)*t).toString(16).padStart(2,'0')}${Math.round(ag+(bg-ag)*t).toString(16).padStart(2,'0')}${Math.round(ab+(bb-ab)*t).toString(16).padStart(2,'0')}`;
}

// Crea N partículas que explotan radialmente desde un punto
// Cada partícula tiene velocidad, tamaño, color y vida aleatoria
function spawnParticles(x, y, color, n = 12) {
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 / n) * i + Math.random() * 0.4;
    const speed = 1.5 + Math.random() * 2.5;
    particles.push({
      x, y, color,
      vx: Math.cos(angle) * speed, // Velocidad en X según ángulo
      vy: Math.sin(angle) * speed, // Velocidad en Y según ángulo
      size: 3 + Math.random() * 4,
      life: 25 + Math.random() * 15,
      maxLife: 40,
    });
  }
}

// Crea un elemento HTML flotante con el texto de puntos que se anima con CSS
function showScorePop(x, y, text) {
  const el = document.createElement('div');
  el.className = 'score-pop';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  canvasWrap.appendChild(el);
  // Se elimina del DOM cuando termina su animación CSS
  el.addEventListener('animationend', () => el.remove());
}

// Muestra u oculta el texto de combo según la racha actual
function updateCombo() {
  if (combo >= 2) {
    comboEl.textContent = `COMBO x${combo}`;
    comboEl.classList.add('show');
  } else {
    comboEl.classList.remove('show');
  }
}

// Actualiza los números de score, best score y nivel en el header
function updateHUD() {
  scoreEl.textContent = String(score).padStart(6, '0'); // Siempre 6 dígitos: 000042
  bestEl.textContent  = String(best).padStart(6, '0');
  levelEl.textContent = String(level).padStart(2, '0');
}

// OVERLAY (MENÚ)
// Maneja los textos y visibilidad de la pantalla superpuesta
function showGameOver() {
  overTitle.textContent = 'GAME OVER';
  overSub.textContent   = 'Presiona ESPACIO o toca para reiniciar';
  overScore.textContent = `SCORE: ${String(score).padStart(6,'0')}`;
  startBtn.textContent  = '↺ RETRY';
  overlay.classList.add('visible'); // Mostramos el overlay
  running = false;
}

// Arranca o reinicia el juego completo
function startGame() {
  initAudio(); // Inicializamos audio en el primer gesto del usuario
  overlay.classList.remove('visible'); // Ocultamos el menú
  overScore.textContent = '';
  init();         // Reseteamos el estado
  gameOver = false;
  paused   = false;
  running  = true;
  clearInterval(gameLoop);
  // Iniciamos el bucle principal que llama a tick() cada BASE_INTERVAL ms
  gameLoop = setInterval(tick, BASE_INTERVAL);
  draw(); // Dibujamos el primer frame
}

// CONTROLES DE TECLADO
// Capturamos las teclas de dirección, espacio y pausa

// Mapa de teclas a vectores de dirección
const DIRS = {
  ArrowUp:    { x: 0, y:-1 }, w: { x: 0, y:-1 },
  ArrowDown:  { x: 0, y: 1 }, s: { x: 0, y: 1 },
  ArrowLeft:  { x:-1, y: 0 }, a: { x:-1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
};

document.addEventListener('keydown', e => {
  const d = DIRS[e.key];

  if (d) {
    e.preventDefault(); // Evita que las flechas hagan scroll en la página
    if (running && !gameOver) {
      // Verificamos que no sea la dirección opuesta (no puedes girar 180°)
      if (d.x !== -dir.x || d.y !== -dir.y) {
        nextDir = d;
        sfxMove();
      }
    }
  }

  // Espacio: inicia o reinicia el juego
  if (e.code === 'Space') {
    e.preventDefault();
    if (!running || gameOver) startGame();
  }

  // P: alterna pausa
  if (e.key === 'p' || e.key === 'P') {
    if (running && !gameOver) {
      paused = !paused;
      if (paused) {
        // Mostramos overlay de pausa
        overTitle.textContent = 'PAUSE';
        overSub.textContent   = 'Presiona P para continuar';
        overScore.textContent = '';
        startBtn.style.display = 'none'; // Ocultamos el botón en pausa
        overlay.classList.add('visible');
      } else {
        overlay.classList.remove('visible');
        startBtn.style.display = ''; // Restauramos el botón
      }
    }
  }
});

// Clic en el botón de la pantalla
startBtn.addEventListener('click', startGame);

// CONTROLES TÁCTILES (SWIPE)
// Para que el juego funcione en móvil detectamos deslizamientos en la pantalla.
// Guardamos el punto de inicio del toque y calculamos la dirección al soltar.
let touchStart = null;

canvas.addEventListener('touchstart', e => {
  touchStart = e.touches[0]; // Guardamos la posición inicial del dedo
}, { passive: true });

canvas.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.clientX; // Desplazamiento X
  const dy = e.changedTouches[0].clientY - touchStart.clientY; // Desplazamiento Y

  // Si el deslizamiento fue muy pequeño, lo ignoramos (puede ser un tap)
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;

  // Determinamos si el swipe fue más horizontal o vertical
  let nd;
  if (Math.abs(dx) > Math.abs(dy)) {
    nd = dx > 0 ? DIRS.ArrowRight : DIRS.ArrowLeft;
  } else {
    nd = dy > 0 ? DIRS.ArrowDown : DIRS.ArrowUp;
  }

  // Aplicamos la dirección si no es la opuesta a la actual
  if (nd.x !== -dir.x || nd.y !== -dir.y) {
    nextDir = nd;
    sfxMove();
  }
  touchStart = null;
}, { passive: true });


// INICIO
// Inicializamos el estado y dibujamos el primer frame (el menú de inicio).
// El juego no corre hasta que el usuario presione PLAY.
init();
draw();

//ya estaa creoo
