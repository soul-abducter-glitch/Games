const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const WIDTH = 972;
const HEIGHT = 500;

// LCD-стиль: 4 дорожки с 4 сегментами каждая
const LANES = ['LT', 'LB', 'RT', 'RB']; // ЛВ, ЛН, ПВ, ПН
const SEGMENTS = ['S0', 'S1', 'S2', 'S3'];

// Позиции сегментов яиц на дорожках (сетка 972×500, координаты по процентам из промта)
const LANE_SEGMENTS = {
  LT: [
    { x: Math.round(972 * 0.18), y: Math.round(500 * 0.18) },  // S0 - курятник лево-верх (18%,18%)
    { x: Math.round(972 * 0.30), y: Math.round(500 * 0.28) },  // S1 (30%,28%)
    { x: Math.round(972 * 0.40), y: Math.round(500 * 0.36) },  // S2 (40%,36%)
    { x: Math.round(972 * 0.44), y: Math.round(500 * 0.58) }   // S3 - зона ловли (44%,58%)
  ],
  LB: [
    { x: Math.round(972 * 0.18), y: Math.round(500 * 0.42) },  // S0 - курятник лево-низ (18%,42%)
    { x: Math.round(972 * 0.28), y: Math.round(500 * 0.54) },  // S1 (28%,54%)
    { x: Math.round(972 * 0.38), y: Math.round(500 * 0.68) },  // S2 (38%,68%)
    { x: Math.round(972 * 0.44), y: Math.round(500 * 0.82) }   // S3 (44%,82%)
  ],
  RT: [
    { x: Math.round(972 * 0.82), y: Math.round(500 * 0.18) },  // S0 - курятник право-верх (82%,18%)
    { x: Math.round(972 * 0.70), y: Math.round(500 * 0.28) },  // S1 (70%,28%)
    { x: Math.round(972 * 0.60), y: Math.round(500 * 0.36) },  // S2 (60%,36%)
    { x: Math.round(972 * 0.56), y: Math.round(500 * 0.58) }   // S3 (56%,58%)
  ],
  RB: [
    { x: Math.round(972 * 0.82), y: Math.round(500 * 0.42) },  // S0 - курятник право-низ (82%,42%)
    { x: Math.round(972 * 0.72), y: Math.round(500 * 0.54) },  // S1 (72%,54%)
    { x: Math.round(972 * 0.62), y: Math.round(500 * 0.68) },  // S2 (62%,68%)
    { x: Math.round(972 * 0.56), y: Math.round(500 * 0.82) }   // S3 (56%,82%)
  ]
};

// Позиции собаки для 4 поз (привязаны к S3 сегментам для точного совпадения корзины)
const DOG_POSITIONS = {
  LT: { x: LANE_SEGMENTS.LT[3].x, y: LANE_SEGMENTS.LT[3].y },
  LB: { x: LANE_SEGMENTS.LB[3].x, y: LANE_SEGMENTS.LB[3].y },
  RT: { x: LANE_SEGMENTS.RT[3].x, y: LANE_SEGMENTS.RT[3].y },
  RB: { x: LANE_SEGMENTS.RB[3].x, y: LANE_SEGMENTS.RB[3].y }
};

// Параметры тиков (дискретное движение) в ms
const TICK_DURATION_MS = {
  A: { start: 280, min: 120 },
  B: { start: 220, min: 120 }
};

// Параметры спавна в ms
// A: 1.2-1.4 с (центр 1.3 с, вариация ±0.1 с)
// B: 0.8-1.0 с (центр 0.9 с, вариация ±0.1 с)
const BASE_SPAWN_INTERVAL_MS = { A: 1300, B: 900, min_A: 700, min_B: 500 };
const SPAWN_VARIATION_MS = 100; // ±100ms

// Система жизней
const MAX_LIVES = 3;
const BROKEN_EGG_DISPLAY_TIME = 0.7;
const INPUT_LOCK_DURATION = 0.4;
const BLINK_DURATION = 0.4;
const BUTTON_DEBOUNCE_MS = 160;

const STORAGE_KEYS = {
  best: 'lcdEggCatch.bestScore',
  lang: 'lcdEggCatch.language',
  mode: 'lcdEggCatch.mode'
};

const I18N = {
  en: {
    title: 'Dog & Eggs',
    gameA: 'Game A',
    gameB: 'Game B',
    start: 'Start',
    reset: 'Reset',
    language: 'Language',
    scoreLabel: 'Score',
    bestLabel: 'Best',
    missesLabel: 'Misses',
    modeLabel: 'Mode',
    modeA: 'Game A',
    modeB: 'Game B',
    nextLabel: 'next',
    hintControls: 'Arrows/WASD to move | Space start | R reset | 1/2 modes | L language | H debug',
    paused: 'Paused',
    pressStart: 'Press Start',
    gameOver: 'Game Over',
    newRecord: 'New Record!',
    nuPogodi: 'WELL, JUST YOU WAIT!',
    elektronika: 'ELECTRONIKA'
  },
  ru: {
    title: 'Пес и яйца',
    gameA: 'Игра A',
    gameB: 'Игра B',
    start: 'Старт',
    reset: 'Сброс',
    language: 'Язык',
    scoreLabel: 'Счёт',
    bestLabel: 'Рекорд',
    missesLabel: 'Промахи',
    modeLabel: 'Режим',
    modeA: 'Игра A',
    modeB: 'Игра B',
    nextLabel: 'далее',
    hintControls: 'Стрелки/WASD для движения | Пробел старт | R сброс | 1/2 режимы | L язык | H отладка',
    paused: 'Пауза',
    pressStart: 'Нажми Старт',
    gameOver: 'Конец игры',
    newRecord: 'Новый рекорд!',
    nuPogodi: 'НУ, ПОГОДИ!',
    elektronika: 'ЭЛЕКТРОНИКА'
  }
};

let storageEnabled = true;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
function loadPersistentData() {
  try {
    const savedBest = localStorage.getItem(STORAGE_KEYS.best);
    if (savedBest) {
      state.bestScore = Number(savedBest) || 0;
    }
    const savedLang = localStorage.getItem(STORAGE_KEYS.lang);
    if (savedLang && I18N[savedLang]) {
      state.language = savedLang;
    }
    const savedMode = localStorage.getItem(STORAGE_KEYS.mode);
    if (savedMode === 'A' || savedMode === 'B') {
      state.nextMode = savedMode;
    }
  } catch (err) {
    storageEnabled = false;
    console.warn('Storage unavailable:', err);
  }
}

function saveBestScore() {
  if (!storageEnabled) return;
  try {
    localStorage.setItem(STORAGE_KEYS.best, String(state.bestScore));
  } catch (err) {
    console.warn('Cannot persist best score:', err);
  }
}

function saveLanguage(lang) {
  if (!storageEnabled) return;
  try {
    localStorage.setItem(STORAGE_KEYS.lang, lang);
  } catch (err) {
    console.warn('Cannot persist language:', err);
  }
}

function saveMode(mode) {
  if (!storageEnabled) return;
  try {
    localStorage.setItem(STORAGE_KEYS.mode, mode);
  } catch (err) {
    console.warn('Cannot persist mode:', err);
  }
}

// Новый тип состояния игры для дискретного режима
const state = {
  currentMode: 'A',  // 'A' or 'B'
  score: 0,
  bestScore: 0,
  lives: MAX_LIVES,
  playerSide: 'L', // 'L' or 'R'
  playerRow: 'T', // 'T' or 'B'
  playerPose: 'LT', // computed from side+row: 'LT', 'LB', 'RB', 'RT'
  eggs: [null, null, null, null], // Array<EggState | null> of length 4, indices 0-3 for lanes LT,LB,RT,RB
  brokenEggs: [], // Array<{ lane: string, timer: number }>
  tickMs: 280, // current global tick interval in milliseconds, mode A 280ms, B 220ms
  nextTickAt: 0, // timestamp when next tick should occur
  spawnTimer: 0, // time until next egg spawn in ms
  spawnInterval: 1300, // in ms
  gameOver: false,
  screenMode: false,
  mute: false,
  consecutiveCatches: 0,
  mouseJoyTimer: 0,
  language: 'en',
  nextMode: 'A',
  showHUD: false,
  lastScoreMilestone: 0 // for tracking difficulty scaling
};

// Define EggState
function EggState(lane, segment) {
  this.lane = lane;
  this.segment = segment;
  this.id = Math.random(); // unique id
}

const scoreDisplay = document.getElementById('scoreDisplay');
const bestDisplay = document.getElementById('bestDisplay');
const modeDisplay = document.getElementById('modeDisplay');
const missDots = Array.from(document.querySelectorAll('.miss-dot'));
const buttons = Array.from(document.querySelectorAll('.console-inner [data-action]'));
const i18nNodes = Array.from(document.querySelectorAll('[data-i18n]'));

const buttonCooldown = new WeakMap();
const audio = { ctx: null, master: null, unlocked: false };

// ---------------------------------------------------------------------------
// Game lifecycle
// ---------------------------------------------------------------------------

function initializeGame(mode) {
  state.currentMode = mode;
  state.tickMs = TICK_DURATION_MS[mode].start;
  state.spawnInterval = BASE_SPAWN_INTERVAL_MS[mode];
}

function startGame() {
  initializeGame(state.nextMode);
  state.gameOver = false;
  state.score = 0;
  state.lastScoreMilestone = 0;
  state.lives = MAX_LIVES;
  state.playerSide = 'L';
  state.playerRow = 'T';
  state.playerPose = 'LT';
  state.eggs = [null, null, null, null];
  state.brokenEggs = [];
  state.consecutiveCatches = 0;
  state.mouseJoyTimer = 0;
  const now = performance.now();
  state.spawnTimer = state.spawnInterval; // start delay
  state.nextTickAt = now + state.tickMs;
  updateScoreUI();
  updateLivesUI();
  updateModeUI();
}

function resetGame() {
  // Восстановить стартовые значения режима (tickMs и spawnInterval)
  initializeGame(state.currentMode);
  
  state.gameOver = false;
  state.score = 0;
  state.lastScoreMilestone = 0;
  state.lives = MAX_LIVES;
  state.playerSide = 'L';
  state.playerRow = 'T';
  state.playerPose = 'LT';
  state.eggs = [null, null, null, null];
  state.brokenEggs = [];
  state.consecutiveCatches = 0;
  state.mouseJoyTimer = 0;
  state.spawnTimer = state.spawnInterval; // Используем стартовый интервал
  const now = performance.now();
  state.nextTickAt = now + state.tickMs;
  updateScoreUI();
  updateLivesUI();
}

// ---------------------------------------------------------------------------
// Game update loop

let lastTime = 0;

function loop(timestamp) {
  const deltaMs = timestamp - lastTime;
  lastTime = timestamp;
  updateGameLogic(deltaMs, timestamp);
  render();
  requestAnimationFrame(loop);
}

function updateGameLogic(deltaMs, now) {
  if (state.gameOver) return;
  
  // spawn timer (first)
  state.spawnTimer -= deltaMs;
  if (state.spawnTimer <= 0) {
    spawnEgg();
    // A: 1.2-1.4s (center 1.3, ±0.15s), B: 0.8-1.0s (center 0.9, ±0.1s)
    const center = state.currentMode === 'A' ? 1300 : 900;
    const variation = state.currentMode === 'A' ? 150 : 100;
    const randomVariation = (Math.random() - 0.5) * 2 * variation;
    state.spawnTimer = center + randomVariation;
  }
  
  // ticks (second, using nextTickAt to avoid drift)
  if (now >= state.nextTickAt) {
    processTick();
    state.nextTickAt += state.tickMs; // align to avoid drift
  }
  
  // mouse timer
  if (state.mouseJoyTimer > 0) {
    state.mouseJoyTimer -= deltaMs / 1000; // to s
  }
  
  // broken eggs
  for (let i = state.brokenEggs.length - 1; i >= 0; i--) {
    state.brokenEggs[i].timer -= deltaMs / 1000;
    if (state.brokenEggs[i].timer <= 0) {
      state.brokenEggs.splice(i, 1);
    }
  }
}

function processTick() {
  // Обрабатываем все яйца в один тик
  // Если несколько яиц достигают S3 одновременно, ловится только текущая поза
  for (let i = 0; i < 4; i++) {
    if (state.eggs[i]) {
      state.eggs[i].segment += 1;
      // Eggs move from S0->S1->S2->S3, then resolve at S3
      if (state.eggs[i].segment >= 3) {
        resolveEgg(i);
      }
    }
  }
}

function resolveEgg(index) {
  const egg = state.eggs[index];
  state.eggs[index] = null;
  
  if (state.playerPose === egg.lane) {
    // CATCH
    state.score += 1;
    state.consecutiveCatches += 1;
    
    // Анимация радости мыши
    if (state.consecutiveCatches >= 10 || state.score % 10 === 0) {
      state.mouseJoyTimer = 0.5;
    }
    
    updateScoreUI();
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      updateBestUI();
      saveBestScore();
    }
    
    checkDifficultyScaling();
    if (!state.mute) playBeep();
  } else {
    // MISS
    state.lives -= 1;
    state.consecutiveCatches = 0;
    updateLivesUI();
    
    // Показать разбитое яйцо на дорожке
    state.brokenEggs.push({
      lane: egg.lane,
      timer: BROKEN_EGG_DISPLAY_TIME
    });
    
    // Короткая визуальная пауза +400ms (не меняя tickMs)
    state.nextTickAt += INPUT_LOCK_DURATION * 1000;
    
    if (!state.mute) playCluck();
    if (state.lives <= 0) {
      state.gameOver = true;
    }
  }
}

function spawnEgg() {
  // ИНВАРИАНТ: не более 1 яйца на дорожку
  let availableLanes = [];
  for (let i = 0; i < 4; i++) {
    if (state.eggs[i] === null) {
      availableLanes.push(i);
    }
  }
  
  if (availableLanes.length === 0) {
    return; // Все дорожки заняты
  }
  
  // Game A: только 1 яйцо за раз
  // Game B: до 2 яиц одновременно, но никогда не на одной дорожке
  const maxSpawn = state.currentMode === 'B' && availableLanes.length >= 2 
    ? Math.min(2, availableLanes.length)
    : 1;
  
  for (let i = 0; i < maxSpawn; i += 1) {
    if (availableLanes.length === 0) break; // Защита от переполнения
    
    // Выбираем случайную свободную дорожку
    const laneIndex = Math.floor(Math.random() * availableLanes.length);
    const iLane = availableLanes.splice(laneIndex, 1)[0]; // splice удаляет из списка
    
    state.eggs[iLane] = new EggState(LANES[iLane], 0);
  }
}

function checkDifficultyScaling() {
  // Ускоряем только при достижении новых вех (каждые +20 очков)
  const currentMilestone = Math.floor(state.score / 20);
  
  if (currentMilestone > state.lastScoreMilestone) {
    state.lastScoreMilestone = currentMilestone;
    
    // Ускорение тика: ×0.9, минимум 120ms
    const minTick = TICK_DURATION_MS[state.currentMode].min;
    state.tickMs = Math.max(minTick, state.tickMs * 0.9);
    
    // Ускорение спавна на 50 очках
    if (state.score > 0 && state.score % 50 === 0) {
      const minSpawn = BASE_SPAWN_INTERVAL_MS[`min_${state.currentMode}`];
      state.spawnInterval = Math.max(minSpawn, state.spawnInterval * 0.9);
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering

function render() {
    // Фон LCD: вертикальный градиент #DCEBE1 → #CFE3D6
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#DCEBE1');
    gradient.addColorStop(1, '#CFE3D6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Рисуем фоновый декор (курятники, кусты)
    drawBackground();
    
    if (state.screenMode) {
        // SCREEN режим: показываем призраки всех сегментов для калибровки (12-18% непрозрачности)
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#1A1A1A';
        LANES.forEach(lane => {
            LANE_SEGMENTS[lane].forEach(pos => drawEggAt(pos.x, pos.y));
        });
        // Призраки собак во всех позах
        LANES.forEach(lane => {
            drawDog(DOG_POSITIONS[lane], lane);
            drawBasket(lane);
        });
        ctx.globalAlpha = 1;
    } else {
        // Обычный режим: строгий порядок слоев (БЕЗ призраков)
        // фон < собака < корзина < яйца < UI
        
        // Слой 1: Мышь-наблюдатель (фоновый элемент)
        drawMouse(state.mouseJoyTimer > 0);
        
        if (!state.gameOver) {
            // Слой 2: Собака (силуэт)
            ctx.fillStyle = '#1A1A1A';
            drawDog(DOG_POSITIONS[state.playerPose], state.playerPose);
            
            // Слой 3: Корзина (отдельный слой поверх собаки для читаемости!)
            drawBasket(state.playerPose);
            
            // Слой 4: Яйца (поверх корзины)
            drawEggs();
            
            // Разбитые яйца (на уровне яиц)
            drawBrokenEggs();
            
            // Слой 5: UI (счет и жизни поверх всего)
            drawScore();
            drawLives();
        } else {
            drawGameOver();
        }
        
        // Диагностический HUD
        if (state.showHUD) {
            drawHUD();
        }
    }
}



// Фоновый декор: курятники/жёлоба и кусты тонкими линиями
function drawBackground() {
    ctx.save();
    ctx.strokeStyle = '#0A673F'; // Акцентный цвет рамки
    ctx.fillStyle = '#0A673F';
    ctx.lineWidth = 2;
    
    const scale = HEIGHT / 500;
    
    // Левый верхний курятник (жёлоб)
    ctx.beginPath();
    ctx.moveTo(WIDTH * 0.05, HEIGHT * 0.05);
    ctx.lineTo(WIDTH * 0.15, HEIGHT * 0.12);
    ctx.lineTo(WIDTH * 0.18, HEIGHT * 0.18);
    ctx.stroke();
    
    // Левый нижний курятник
    ctx.beginPath();
    ctx.moveTo(WIDTH * 0.05, HEIGHT * 0.35);
    ctx.lineTo(WIDTH * 0.15, HEIGHT * 0.38);
    ctx.lineTo(WIDTH * 0.18, HEIGHT * 0.42);
    ctx.stroke();
    
    // Правый верхний курятник
    ctx.beginPath();
    ctx.moveTo(WIDTH * 0.95, HEIGHT * 0.05);
    ctx.lineTo(WIDTH * 0.85, HEIGHT * 0.12);
    ctx.lineTo(WIDTH * 0.82, HEIGHT * 0.18);
    ctx.stroke();
    
    // Правый нижний курятник
    ctx.beginPath();
    ctx.moveTo(WIDTH * 0.95, HEIGHT * 0.35);
    ctx.lineTo(WIDTH * 0.85, HEIGHT * 0.38);
    ctx.lineTo(WIDTH * 0.82, HEIGHT * 0.42);
    ctx.stroke();
    
    // Кусты/травка внизу (схематично)
    ctx.beginPath();
    ctx.arc(WIDTH * 0.1, HEIGHT * 0.95, 15 * scale, 0, Math.PI, true);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(WIDTH * 0.9, HEIGHT * 0.95, 15 * scale, 0, Math.PI, true);
    ctx.stroke();
    
    ctx.restore();
}

// Собака: 4 позы (силуэты без деталей, высота ~80px)
function drawDog(point, pose) {
    ctx.save();
    ctx.fillStyle = '#1A1A1A';
    ctx.translate(point.x, point.y);
    
    const scale = HEIGHT / 500; // Масштабирование от базовой сетки
    const isLeft = pose === 'LT' || pose === 'LB';
    const flipX = isLeft ? -1 : 1;
    
    ctx.scale(flipX * scale, scale);
    
    // Тело (округлое)
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Голова
    ctx.beginPath();
    ctx.arc(-8, -30, 18, 0, Math.PI * 2);
    ctx.fill();
    
    // Ушки (длинные собачьи)
    ctx.beginPath();
    ctx.ellipse(-15, -42, 6, 18, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.ellipse(-1, -42, 6, 18, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Лапы (схематично)
    ctx.beginPath();
    ctx.ellipse(-12, 25, 8, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.ellipse(12, 25, 8, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// Корзина (отдельный слой поверх собаки, центр = S3)
function drawBasket(pose) {
    const point = DOG_POSITIONS[pose];
    ctx.save();
    ctx.fillStyle = '#1A1A1A';
    ctx.translate(point.x, point.y);
    
    const scale = HEIGHT / 500;
    ctx.scale(scale, scale);
    
    // Эллипс-корыто с приподнятыми краями
    ctx.beginPath();
    ctx.ellipse(0, 10, 45, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Боковые края (приподнятые)
    ctx.beginPath();
    ctx.moveTo(-42, 5);
    ctx.lineTo(-45, -5);
    ctx.lineTo(-38, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(42, 5);
    ctx.lineTo(45, -5);
    ctx.lineTo(38, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

function drawEggs() {
    ctx.save();
    ctx.fillStyle = '#1A1A1A';
    for (let i = 0; i < 4; i++) {
      if (state.eggs[i]) {
        const pos = LANE_SEGMENTS[state.eggs[i].lane][state.eggs[i].segment];
        drawEggAt(pos.x, pos.y);
      }
    }
    ctx.restore();
}

function drawBrokenEggs() {
    ctx.save();
    ctx.fillStyle = '#2A2A2A';
    for (let broken of state.brokenEggs) {
      const pos = LANE_SEGMENTS[broken.lane][3];
      drawBrokenEggAt(pos.x, pos.y);
    }
    ctx.restore();
}

function drawScore() {
    ctx.save();
    ctx.fillStyle = '#000000';
    const fontSize = Math.round(HEIGHT * 0.06); // ~30px при 500px высоты
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(padScore(state.score), WIDTH / 2, HEIGHT * 0.1);
    ctx.restore();
}

function drawLives() {
    ctx.save();
    ctx.fillStyle = '#1A1A1A';
    const scale = HEIGHT / 500;
    const iconSize = 16 * scale; // ~16px в базовой сетке
    const startX = WIDTH * 0.03;
    const startY = HEIGHT * 0.04;
    const spacing = iconSize * 1.8;
    
    for (let i = 0; i < MAX_LIVES; i++) {
        const x = startX + i * spacing;
        const y = startY;
        
        if (i < state.lives) {
            // Активное яйцо
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#1A1A1A';
        } else {
            // Потерянное яйцо (призрак)
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#1A1A1A';
        }
        
        // Маленькая иконка яйца
        ctx.beginPath();
        ctx.ellipse(x, y, iconSize * 0.35, iconSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawGameOver() {
    ctx.save();
    
    // Полупрозрачный фон
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, 'rgba(220, 235, 225, 0.92)');
    gradient.addColorStop(1, 'rgba(207, 227, 214, 0.92)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    ctx.fillStyle = '#000000';
    const largeFontSize = Math.round(HEIGHT * 0.072); // ~36px
    const mediumFontSize = Math.round(HEIGHT * 0.048); // ~24px
    const smallFontSize = Math.round(HEIGHT * 0.032); // ~16px
    
    ctx.font = `bold ${largeFontSize}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    
    const dict = I18N[state.language];
    ctx.fillText(dict.gameOver, WIDTH / 2, HEIGHT / 2 - HEIGHT * 0.08);
    
    ctx.font = `bold ${mediumFontSize}px "Courier New", monospace`;
    ctx.fillText(dict.scoreLabel + ': ' + padScore(state.score), WIDTH / 2, HEIGHT / 2 + HEIGHT * 0.02);
    
    if (state.score >= state.bestScore) {
        ctx.fillText(dict.newRecord, WIDTH / 2, HEIGHT / 2 + HEIGHT * 0.1);
    } else {
        ctx.fillText(dict.bestLabel + ': ' + padScore(state.bestScore), WIDTH / 2, HEIGHT / 2 + HEIGHT * 0.1);
    }
    
    ctx.font = `${smallFontSize}px "Courier New", monospace`;
    ctx.fillText(dict.pressStart, WIDTH / 2, HEIGHT / 2 + HEIGHT * 0.18);
    
    ctx.restore();
}

// ---------------------------------------------------------------------------
// Other functions

function toggleMute() {
  state.mute = !state.mute;
}

const padScore = (value) => value.toString().padStart(4, '0');

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function applyLocalization() {
  const dict = I18N[state.language];
  i18nNodes.forEach((node) => {
    const key = node.dataset.i18n;
    if (!key) return;
    const text = dict[key];
    if (text !== undefined) {
      node.textContent = text;
    }
  });
  document.querySelectorAll('.console-inner [data-action][data-i18n]').forEach((button) => {
    const key = button.dataset.i18n;
    if (dict[key]) {
      button.setAttribute('aria-label', dict[key]);
    }
  });
  document.title = dict.title;
  updateModeUI();
}

function setLanguage(lang, persist = true) {
  if (!I18N[lang]) return;
  state.language = lang;
  document.documentElement.lang = lang;
  applyLocalization();
  if (persist) saveLanguage(lang);
}

function toggleLanguage() {
  const next = state.language === 'en' ? 'ru' : 'en';
  setLanguage(next);
}

function setMode(mode, persist = true) {
  if (mode !== 'A' && mode !== 'B') return;
  state.nextMode = mode;
  updateModeUI();
  if (persist) saveMode(mode);
}

function updateScoreUI() {
  scoreDisplay.textContent = padScore(state.score);
}

function updateBestUI() {
  bestDisplay.textContent = padScore(state.bestScore);
}

function updateLivesUI() {
  missDots.forEach((dot, index) => {
    dot.classList.toggle('filled', index < state.lives);
  });
}

function updateModeUI() {
  const dict = I18N[state.language];
  const current = state.nextMode;
  const label = current === 'A' ? dict.modeA : dict.modeB;
  modeDisplay.textContent = label;
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------
function bindEvents() {
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      ensureAudio(); // Разблокировать аудио при первом взаимодействии
      
      const action = btn.dataset.action;
      switch (action) {
        case 'LT':
          setPlayerSide('L');
          setPlayerRow('T');
          break;
        case 'LB':
          setPlayerSide('L');
          setPlayerRow('B');
          break;
        case 'RT':
          setPlayerSide('R');
          setPlayerRow('T');
          break;
        case 'RB':
          setPlayerSide('R');
          setPlayerRow('B');
          break;
        case 'start':
          startGame();
          break;
        case 'reset':
        case 'restart':
          resetGame();
          break;
        case 'gameA':
          setMode('A');
          break;
        case 'gameB':
          setMode('B');
          break;
        case 'screen':
          toggleScreenMode();
          break;
        case 'mute':
          toggleMute();
          break;
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return; // Игнорировать автоповтор
    
    ensureAudio(); // Разблокировать аудио при первом взаимодействии
    
    switch (e.code) {
      // Двухосевое управление: стороны
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        setPlayerSide('L');
        break;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        setPlayerSide('R');
        break;
      
      // Двухосевое управление: ряды
      case 'ArrowUp':
      case 'KeyW':
        e.preventDefault();
        setPlayerRow('T');
        break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        setPlayerRow('B');
        break;
      
      // Прочие команды
      case 'Space':
      case 'Enter':
        e.preventDefault();
        startGame();
        break;
      case 'KeyR':
        e.preventDefault();
        resetGame();
        break;
      case 'KeyL':
        toggleLanguage();
        break;
      case 'KeyH':
        e.preventDefault();
        toggleHUD();
        break;
      case 'Digit1':
        setMode('A');
        break;
      case 'Digit2':
        setMode('B');
        break;
    }
  });

  document.addEventListener('visibilitychange', onVisibilityChange);
}

function onVisibilityChange() {
  if (document.hidden && !state.gameOver) {
    resetGame();
  }
}

function toggleScreenMode() {
  state.screenMode = !state.screenMode;
}

function toggleHUD() {
  state.showHUD = !state.showHUD;
}

function setPlayerSide(side) {
  if (side !== 'L' && side !== 'R') return;
  state.playerSide = side;
  updatePlayerPose();
}

function setPlayerRow(row) {
  if (row !== 'T' && row !== 'B') return;
  state.playerRow = row;
  updatePlayerPose();
}

function updatePlayerPose() {
  state.playerPose = state.playerSide + state.playerRow;
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
function ensureAudio() {
  if (audio.unlocked) return;
  try {
    if (!audio.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.setValueAtTime(0.18, audio.ctx.currentTime);
      audio.master.connect(audio.ctx.destination);
    }
    if (audio.ctx.state === 'suspended') {
      audio.ctx.resume().then(() => {
        audio.unlocked = true;
      }).catch(() => {});
    } else {
      audio.unlocked = true;
    }
  } catch (err) {
    console.warn('Audio init failed:', err);
  }
}

function playTone({ frequency, duration, type = 'square', gain = 0.2, delay = 0 }) {
  if (!audio.unlocked || state.mute || !audio.ctx || !audio.master) return;
  const ctxRef = audio.ctx;
  const start = ctxRef.currentTime + delay;
  const osc = ctxRef.createOscillator();
  const env = ctxRef.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env).connect(audio.master);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function playBeep() {
  playTone({ frequency: 880, duration: 0.12, type: 'square', gain: 0.16 });
}

function playCluck() {
  if (!audio.unlocked || state.mute || !audio.ctx || !audio.master) return;
  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const env = audio.ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.28);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.linearRampToValueAtTime(0.24, now + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  osc.connect(env).connect(audio.master);
  osc.start(now);
  osc.stop(now + 0.46);
}

function playLevelUp() {
  playTone({ frequency: 620, duration: 0.16, type: 'triangle', gain: 0.12 });
  playTone({ frequency: 780, duration: 0.22, type: 'triangle', gain: 0.1, delay: 0.16 });
}

// ---------------------------------------------------------------------------
// Rendering additions
// ---------------------------------------------------------------------------
// LCD стиль: без теней, без размытий, чёткие контуры
function applyLcdStyles() {
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

// Яйцо: простой моноцветный овал 20×28px, без вращения
function drawEggAt(x, y) {
    ctx.save();
    ctx.fillStyle = '#1A1A1A';
    ctx.translate(x, y);
    
    const scale = HEIGHT / 500;
    ctx.scale(scale, scale);
    
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// Разбитое яйцо: пятно с осколками (немного светлее для различимости)
function drawBrokenEggAt(x, y) {
    ctx.save();
    ctx.fillStyle = '#2A2A2A'; // Немного светлее
    ctx.translate(x, y);
    
    const scale = HEIGHT / 500;
    ctx.scale(scale, scale);
    
    // Пятно
    ctx.beginPath();
    ctx.ellipse(0, 2, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Осколки (зубчики)
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-14, -8);
    ctx.lineTo(-8, -6);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-2, -12);
    ctx.lineTo(2, -12);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(10, -4);
    ctx.lineTo(14, -8);
    ctx.lineTo(8, -6);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(12, 2);
    ctx.lineTo(18, 0);
    ctx.lineTo(14, 4);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

// Мышь-наблюдатель (высота ~32-36px, слева внизу)
function drawMouse(isCheer) {
    ctx.save();
    
    const scale = HEIGHT / 500;
    const posX = WIDTH * 0.08; // 8% от левого края
    const posY = HEIGHT * 0.92; // Внизу
    
    if (isCheer) {
        // Активное состояние (радость)
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#1A1A1A';
    } else {
        // Пассивное состояние (легкая тень)
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#1A1A1A';
    }
    
    ctx.translate(posX, posY);
    ctx.scale(scale, scale);
    
    // Тело
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Голова
    ctx.beginPath();
    ctx.arc(0, -18, 9, 0, Math.PI * 2);
    ctx.fill();
    
    // Уши (большие круглые)
    ctx.beginPath();
    ctx.arc(-7, -24, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(7, -24, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Хвостик
    ctx.beginPath();
    ctx.moveTo(10, 5);
    ctx.quadraticCurveTo(18, 0, 22, -5);
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Если радость - поднятые лапки
    if (isCheer) {
        ctx.beginPath();
        ctx.arc(-10, -5, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(10, -5, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

function fillEllipse(cx, cy, rx, ry, strokeOutline = true) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  if (strokeOutline) {
    ctx.stroke();
  }
}

function fillPolygon(points, strokeOutline = true) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fill();
  if (strokeOutline) {
    ctx.stroke();
  }
}

// Диагностический HUD (правый верхний угол)
function drawHUD() {
  ctx.save();
  
  // Полупрозрачный фон
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(WIDTH - 300, 10, 290, 160);
  
  ctx.fillStyle = '#00FF00';
  ctx.font = '14px "Courier New", monospace';
  ctx.textAlign = 'left';
  
  let y = 30;
  const x = WIDTH - 290;
  
  ctx.fillText(`pose=${state.playerPose} (${state.playerSide}${state.playerRow})`, x, y);
  y += 20;
  ctx.fillText(`tick=${Math.round(state.tickMs)}ms`, x, y);
  y += 20;
  ctx.fillText(`spawn in=${Math.round(state.spawnTimer)}ms`, x, y);
  y += 20;
  ctx.fillText(`mode=${state.currentMode}, score=${state.score}, lives=${state.lives}`, x, y);
  y += 20;
  
  // Список активных яиц
  const activeEggs = [];
  for (let i = 0; i < 4; i++) {
    if (state.eggs[i]) {
      activeEggs.push(`${LANES[i]}:S${state.eggs[i].segment}`);
    }
  }
  ctx.fillText(`eggs: ${activeEggs.length > 0 ? activeEggs.join(', ') : 'none'}`, x, y);
  y += 20;
  
  ctx.fillText(`nextTickAt=${Math.round(state.nextTickAt - performance.now())}ms`, x, y);
  
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function init() {
  loadPersistentData();
  setLanguage(state.language, false);
  setMode(state.nextMode, false);
  updateBestUI();
  bindEvents();
  requestAnimationFrame(loop);
}

init();
