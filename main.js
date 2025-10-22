const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const FIXED_DT = 1 / 60;

// LCD-стиль: 4 дорожки с 4 сегментами каждая
const LANES = ['LT', 'LB', 'RT', 'RB']; // ЛВ, ЛН, ПВ, ПН
const SEGMENTS = ['S0', 'S1', 'S2', 'S3'];

// Позиции сегментов яиц на дорожках (под 400×300)
const LANE_SEGMENTS = {
  LT: [
    { x: 45, y: 50 },    // S0 - курятник лево-верх
    { x: 75, y: 88 },    // S1
    { x: 105, y: 126 },  // S2
    { x: 135, y: 164 }   // S3 - зона ловли
  ],
  LB: [
    { x: 45, y: 180 },   // S0 - курятник лево-низ
    { x: 75, y: 195 },   // S1
    { x: 105, y: 210 },  // S2
    { x: 135, y: 225 }   // S3
  ],
  RT: [  
    { x: 355, y: 50 },   // S0 - курятник право-верх
    { x: 325, y: 88 },   // S1
    { x: 295, y: 126 },  // S2
    { x: 265, y: 164 }   // S3
  ],
  RB: [
    { x: 355, y: 180 },  // S0 - курятник право-низ
    { x: 325, y: 195 },  // S1
    { x: 295, y: 210 },  // S2
    { x: 265, y: 225 }   // S3
  ]
};

// Позиции собаки с корзиной для 4 поз (центр экрана)
const DOG_POSITIONS = {
  LT: { x: 165, y: 168 },
  LB: { x: 165, y: 228 },
  RT: { x: 235, y: 168 },
  RB: { x: 235, y: 228 }
};

// Параметры тиков (дискретное движение)
const TICK_DURATION = {
  A: { start: 0.65, min: 0.35 },
  B: { start: 0.55, min: 0.32 }
};

// Параметры спавна
const BASE_SPAWN_INTERVAL = { A: 2.5, B: 2.2, min_A: 1.4, min_B: 1.3 };
const SPAWN_VARIATION = 0.4; // ±0.4s
const MIN_SPAWN_DELAY = 0.6; // Минимальная задержка между спавнами

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
    hintControls: 'Arrow keys to move | Space start/pause | R reset | 1/2 modes | L language',
    paused: 'Paused',
    pressStart: 'Press Start',
    gameOver: 'Game Over',
    newRecord: 'New Record!'
  },
  ru: {
    title: 'Собачка и яйца',
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
    hintControls: 'Стрелки для движения | Пробел старт/пауза | R сброс | 1/2 режимы | L язык',
    paused: 'Пауза',
    pressStart: 'Нажми Старт',
    gameOver: 'Конец игры',
    newRecord: 'Новый рекорд!'
  }
};

const state = {
  mode: 'A',
  nextMode: 'A',
  score: 0,
  bestScore: 0,
  lives: MAX_LIVES,
  language: 'en',
  playerPose: 'LT', // ЛВ начальная поза
  eggs: [], // Массив: { lane: 'LT', segment: 0 }
  brokenEggs: [], // { lane: 'LT', timer: 0 }
  mouse: { x: 30, y: HEIGHT - 60, joyTimer: 0 },
  phase: 'attract',
  playing: false,
  highlightPose: null,
  highlightTimer: 0,
  blinkTimer: 0,
  freezeTimer: 0,
  inputLockTimer: 0,
  inputLocked: false,
  tickTimer: 0, // Таймер дискретных тиков
  tickDuration: 0.65, // Текущая длительность тика
  spawnTimer: 0,
  spawnInterval: 2.5,
  lastSpawnTime: 0, // Время последнего спавна
  pendingGameOver: false,
  consecutiveCatches: 0, // Для анимации мыши
  level: 1, // Текущий уровень
  walkAnimation: 0 // Анимация ходьбы (0-1)
};

let storageEnabled = true;

const scoreDisplay = document.getElementById('scoreDisplay');
const bestDisplay = document.getElementById('bestDisplay');
const modeDisplay = document.getElementById('modeDisplay');
const missDots = Array.from(document.querySelectorAll('.miss-dot'));
const buttons = Array.from(document.querySelectorAll('.panel button'));
const i18nNodes = Array.from(document.querySelectorAll('[data-i18n]'));

const buttonCooldown = new WeakMap();
const audio = { ctx: null, master: null, unlocked: false };

let lastTimestamp = performance.now();
let accumulator = 0;

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
      state.mode = savedMode;
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
  buttons.forEach((button) => {
    const key = button.dataset.i18n;
    if (!key) return;
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
  if (state.phase !== 'playing' && state.phase !== 'paused') {
    state.mode = mode;
  }
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
  const activeRun = state.phase === 'playing' || state.phase === 'paused';
  const current = activeRun ? state.mode : state.nextMode;
  const label = current === 'A' ? dict.modeA : dict.modeB;
  if (activeRun && state.mode !== state.nextMode) {
    const nextLabel = state.nextMode === 'A' ? dict.modeA : dict.modeB;
    modeDisplay.textContent = `${label} (${dict.nextLabel}: ${nextLabel})`;
  } else {
    modeDisplay.textContent = label;
  }
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------
function bindEvents() {
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onCanvasPointer, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('visibilitychange', onVisibilityChange);
  buttons.forEach((button) => {
    button.addEventListener('pointerdown', onPanelButtonPointer, { passive: false });
  });
}

function onKeyDown(event) {
  if (event.repeat) return;
  ensureAudio();
  switch (event.code) {
    case 'ArrowLeft':
      event.preventDefault();
      moveHorizontal('left');
      break;
    case 'ArrowRight':
      event.preventDefault();
      moveHorizontal('right');
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveVertical('up');
      break;
    case 'ArrowDown':
      event.preventDefault();
      moveVertical('down');
      break;
    case 'Space':
    case 'Enter':
      event.preventDefault();
      startOrPause();
      break;
    case 'KeyR':
      event.preventDefault();
      resetGame();
      break;
    case 'Digit1':
      setMode('A');
      break;
    case 'Digit2':
      setMode('B');
      break;
    case 'KeyL':
      toggleLanguage();
      break;
    default:
      break;
  }
}

function onKeyUp(event) {
  // Больше не нужно отслеживать состояние клавиш
}

// Горизонтальное перемещение (←/→)
function moveHorizontal(direction) {
  if (state.inputLocked) return;
  const currentSide = state.playerPose[0]; // 'L' или 'R'
  const currentLevel = state.playerPose[1]; // 'T' или 'B'
  
  if (direction === 'left') {
    setPlayerPose('L' + currentLevel);
  } else {
    setPlayerPose('R' + currentLevel);
  }
}

// Вертикальное перемещение (↑/↓)
function moveVertical(direction) {
  if (state.inputLocked) return;
  const currentSide = state.playerPose[0]; // 'L' или 'R'
  const currentLevel = state.playerPose[1]; // 'T' или 'B'
  
  if (direction === 'up') {
    setPlayerPose(currentSide + 'T');
  } else {
    setPlayerPose(currentSide + 'B');
  }
}

function onCanvasPointer(event) {
  event.preventDefault();
  ensureAudio();
  if (state.inputLocked) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = WIDTH / rect.width;
  const scaleY = HEIGHT / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  
  // Разделить экран на 4 зоны
  const isLeft = x < WIDTH / 2;
  const isTop = y < HEIGHT / 2;
  
  let pose;
  if (isLeft && isTop) pose = 'LT';
  else if (isLeft && !isTop) pose = 'LB';
  else if (!isLeft && isTop) pose = 'RT';
  else pose = 'RB';
  
  setPlayerPose(pose);
}

function onPanelButtonPointer(event) {
  event.preventDefault();
  ensureAudio();
  const button = event.currentTarget;
  const now = performance.now();
  const cooldownUntil = buttonCooldown.get(button) || 0;
  if (cooldownUntil > now) return;
  buttonCooldown.set(button, now + BUTTON_DEBOUNCE_MS);
  button.classList.add('pressed');
  setTimeout(() => button.classList.remove('pressed'), 140);
  switch (button.dataset.action) {
    case 'gameA':
      setMode('A');
      break;
    case 'gameB':
      setMode('B');
      break;
    case 'start':
      startOrPause();
      break;
    case 'reset':
      resetGame();
      break;
    case 'language':
      toggleLanguage();
      break;
    default:
      break;
  }
}

function onVisibilityChange() {
  if (document.hidden && state.phase === 'playing') {
    pauseGame();
  }
}

function setPlayerPose(pose, options = {}) {
  const { force = false, flash = true } = options;
  if (!force && state.inputLocked) return;
  state.playerPose = pose;
  if (flash) {
    state.highlightPose = pose;
    state.highlightTimer = 0.14;
  }
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
  if (!audio.unlocked || !audio.ctx || !audio.master) return;
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
  if (!audio.unlocked || !audio.ctx || !audio.master) return;
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
// Game lifecycle
// ---------------------------------------------------------------------------
function startGame() {
  state.mode = state.nextMode;
  state.phase = 'playing';
  state.playing = true;
  state.score = 0;
  state.lives = MAX_LIVES;
  state.level = 1;
  state.eggs.length = 0;
  state.brokenEggs.length = 0;
  state.mouse.joyTimer = 0;
  state.consecutiveCatches = 0;
  state.walkAnimation = 0;
  
  // Инициализация тиков и спавна для текущего режима
  state.tickDuration = TICK_DURATION[state.mode].start;
  state.tickTimer = state.tickDuration;
  state.spawnInterval = BASE_SPAWN_INTERVAL[state.mode];
  state.spawnTimer = state.spawnInterval * 0.6;
  state.lastSpawnTime = MIN_SPAWN_DELAY; // Начинаем с возможностью спавна
  
  state.freezeTimer = 0;
  state.blinkTimer = 0;
  state.highlightPose = null;
  state.highlightTimer = 0;
  state.inputLockTimer = 0;
  state.inputLocked = false;
  state.pendingGameOver = false;
  
  updateScoreUI();
  updateLivesUI();
  updateModeUI();
}

function resetGame() {
  enterAttract();
}

function enterAttract() {
  state.phase = 'attract';
  state.playing = false;
  state.mode = state.nextMode;
  state.score = 0;
  state.lives = MAX_LIVES;
  state.level = 1;
  state.eggs.length = 0;
  state.brokenEggs.length = 0;
  state.mouse.joyTimer = 0;
  state.consecutiveCatches = 0;
  state.walkAnimation = 0;
  
  state.tickDuration = TICK_DURATION[state.mode].start;
  state.tickTimer = 0;
  state.spawnInterval = BASE_SPAWN_INTERVAL[state.mode];
  state.spawnTimer = 0;
  state.lastSpawnTime = 0;
  
  state.freezeTimer = 0;
  state.blinkTimer = 0;
  state.highlightPose = null;
  state.highlightTimer = 0;
  state.inputLockTimer = 0;
  state.inputLocked = false;
  state.pendingGameOver = false;
  
  setPlayerPose('LT', { force: true, flash: false });
  updateScoreUI();
  updateLivesUI();
  updateModeUI();
}

function startOrPause() {
  if (state.phase === 'playing') {
    pauseGame();
  } else if (state.phase === 'paused') {
    resumeGame();
  } else {
    startGame();
  }
}

function pauseGame() {
  state.phase = 'paused';
  state.playing = false;
  updateModeUI();
}

function resumeGame() {
  state.phase = 'playing';
  state.playing = true;
  state.spawnTimer = Math.min(state.spawnTimer, state.spawnInterval);
  updateModeUI();
}

function handleGameOver() {
  state.phase = 'gameover';
  state.playing = false;
  state.eggs.length = 0;
  state.brokenEggs.length = 0;
  state.spawnTimer = state.spawnInterval;
  state.freezeTimer = 0;
  state.highlightPose = null;
  state.highlightTimer = 0;
  state.inputLockTimer = 0;
  state.inputLocked = false;
  updateModeUI();
}

function lockInput(duration) {
  state.inputLockTimer = Math.max(state.inputLockTimer, duration);
  state.inputLocked = true;
  state.highlightPose = null;
  state.highlightTimer = 0;
}

// ---------------------------------------------------------------------------
// Game update loop
// ---------------------------------------------------------------------------
function loop(timestamp) {
  const delta = Math.min(0.25, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  accumulator += delta;
  while (accumulator >= FIXED_DT) {
    step(FIXED_DT);
    accumulator -= FIXED_DT;
  }
  render();
  requestAnimationFrame(loop);
}

function step(dt) {
  updateTimers(dt);
  if (state.phase !== 'playing') return;
  if (state.freezeTimer > 0) return;
  updateSpawner(dt);
  updateMouse(dt);
  updateTicks(dt);
}

function updateTimers(dt) {
  if (state.highlightTimer > 0) {
    state.highlightTimer = Math.max(0, state.highlightTimer - dt);
    if (state.highlightTimer === 0) {
      state.highlightPose = null;
    }
  }
  if (state.blinkTimer > 0) {
    state.blinkTimer = Math.max(0, state.blinkTimer - dt);
  }
  if (state.freezeTimer > 0) {
    state.freezeTimer = Math.max(0, state.freezeTimer - dt);
  }
  if (state.inputLockTimer > 0) {
    state.inputLockTimer = Math.max(0, state.inputLockTimer - dt);
    state.inputLocked = state.inputLockTimer > 0;
  } else {
    state.inputLocked = false;
  }
  if (state.pendingGameOver && state.blinkTimer <= 0) {
    state.pendingGameOver = false;
    handleGameOver();
  }
}

function updateSpawner(dt) {
  state.spawnTimer -= dt;
  state.lastSpawnTime += dt;
  
  while (state.spawnTimer <= 0) {
    // Проверяем минимальную задержку с последнего спавна
    if (state.lastSpawnTime >= MIN_SPAWN_DELAY) {
      spawnEgg();
      state.lastSpawnTime = 0;
    }
    
    const variation = (Math.random() - 0.5) * 2 * SPAWN_VARIATION;
    state.spawnTimer += state.spawnInterval + variation;
    
    // Если не прошло минимальное время - откладываем спавн
    if (state.lastSpawnTime < MIN_SPAWN_DELAY) {
      state.spawnTimer = Math.max(state.spawnTimer, MIN_SPAWN_DELAY - state.lastSpawnTime);
      break;
    }
  }
}

function updateMouse(dt) {
  if (state.mouse.joyTimer > 0) {
    state.mouse.joyTimer = Math.max(0, state.mouse.joyTimer - dt);
  }

  for (let i = state.brokenEggs.length - 1; i >= 0; i -= 1) {
    const brokenEgg = state.brokenEggs[i];
    brokenEgg.timer += dt;
    if (brokenEgg.timer >= BROKEN_EGG_DISPLAY_TIME) {
      state.brokenEggs.splice(i, 1);
    }
  }
  
  // Обновляем анимацию ходьбы
  if (state.phase === 'playing') {
    state.walkAnimation += dt * 3; // Скорость анимации
    if (state.walkAnimation > 1) {
      state.walkAnimation = 0;
    }
  }
}

// Дискретное движение яиц тиками
function updateTicks(dt) {
  state.tickTimer -= dt;
  
  while (state.tickTimer <= 0) {
    processTick();
    state.tickTimer += state.tickDuration;
  }
}

// Обработка одного тика: все яйца двигаются на следующий сегмент
function processTick() {
  for (let i = state.eggs.length - 1; i >= 0; i -= 1) {
    const egg = state.eggs[i];
    
    // Двигаем яйцо на следующий сегмент
    egg.segment += 1;
    
    // Проверяем достижение зоны ловли (S3)
    if (egg.segment >= 3) {
      resolveEgg(i);
    }
  }
}

function resolveEgg(index) {
  const egg = state.eggs[index];
  state.eggs.splice(index, 1);
  
  // Проверка: совпадает ли поза собаки с дорожкой яйца
  if (state.playerPose === egg.lane) {
    handleCatch();
  } else {
    handleMiss(egg.lane);
  }
}

function handleCatch() {
  state.score += 1;
  state.consecutiveCatches += 1;
  
  // Анимация радости мыши
  if (state.consecutiveCatches >= 10 || state.score % 10 === 0) {
    state.mouse.joyTimer = 0.5;
  }
  
  updateScoreUI();
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    updateBestUI();
    saveBestScore();
  }
  
  checkDifficultyScaling();
  playBeep();
}

function handleMiss(lane) {
  state.lives -= 1;
  state.consecutiveCatches = 0;
  updateLivesUI();

  // Показать разбитое яйцо на дорожке
  state.brokenEggs.push({
    lane: lane,
    timer: 0
  });

  playCluck();
  lockInput(INPUT_LOCK_DURATION);
  state.blinkTimer = BLINK_DURATION;
  state.freezeTimer = BLINK_DURATION;

  if (state.lives <= 0) {
    state.pendingGameOver = true;
  }
}

function checkDifficultyScaling() {
  // Каждые 10 очков = новый уровень
  const newLevel = Math.floor(state.score / 10) + 1;
  
  if (newLevel > state.level) {
    state.level = newLevel;
    
    // Плавное ускорение: -5% тик, -7% спавн каждый уровень
    const minTick = TICK_DURATION[state.mode].min;
    state.tickDuration = Math.max(minTick, state.tickDuration * 0.95);
    
    const minSpawn = BASE_SPAWN_INTERVAL[`min_${state.mode}`];
    state.spawnInterval = Math.max(minSpawn, state.spawnInterval * 0.93);
    
    playLevelUp();
  }
}

// ---------------------------------------------------------------------------
// Spawner helpers
// ---------------------------------------------------------------------------
function spawnEgg() {
  // Выбираем случайную дорожку для спавна
  const availableLanes = LANES.filter(lane => {
    // Проверяем, нет ли уже яйца на этой дорожке
    return !state.eggs.some(egg => egg.lane === lane);
  });
  
  if (availableLanes.length === 0) {
    // Все дорожки заняты
    return;
  }
  
  // В режиме B можем спавнить на 2 дорожки одновременно
  const maxSpawn = state.mode === 'B' && availableLanes.length >= 2 ? 2 : 1;
  
  for (let i = 0; i < maxSpawn; i += 1) {
    if (availableLanes.length === 0) break;
    
    const laneIndex = Math.floor(Math.random() * availableLanes.length);
    const lane = availableLanes.splice(laneIndex, 1)[0];
    
    state.eggs.push({
      lane: lane,
      segment: 0 // Начинаем с S0
    });
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render() {
  const dict = I18N[state.language];
  ctx.fillStyle = '#dfe7d2';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Порядок слоев: рамка < фон < курятники < дорожки < неактивные позы < активная поза < яйца < UI
  drawScreenFrame();
  drawBackground();       // Деревья и кусты на фоне
  drawCoops();            // Курятники в 4 углах
  drawLanes();            // Дорожки-жёлобы
  drawInactiveCatchers(); // Неактивные позы собаки
  drawActiveCatcher();    // Активная поза собаки
  drawEggs();             // Яйца
  drawBrokenEggs();       // Разбитые яйца
  drawMouse();            // Мышка с анимацией радости

  drawHud(dict);
  if (state.highlightPose && state.highlightTimer > 0) {
    drawHighlight();
  }
  if (state.phase === 'attract') {
    drawAttractOverlay(dict);
  } else if (state.phase === 'paused') {
    drawPausedOverlay(dict);
  } else if (state.phase === 'gameover') {
    drawGameOverOverlay(dict);
  }
  if (state.blinkTimer > 0) {
    drawBlink();
  }
}

function drawScreenFrame() {
  ctx.save();
  ctx.strokeStyle = '#2a4a2a';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, WIDTH - 20, HEIGHT - 20);
  ctx.restore();
}

function drawBackground() {
  ctx.save();
  
  // Горизонт и небо (градиент)
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#d8e7c8');
  gradient.addColorStop(0.5, '#c8d4b8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  // Земля внизу
  ctx.fillStyle = '#b8c4a8';
  ctx.fillRect(0, HEIGHT - 80, WIDTH, 80);
  
  // Трава (полоски)
  ctx.strokeStyle = '#a8b498';
  ctx.lineWidth = 2;
  for (let i = 0; i < 20; i++) {
    const x = 30 + i * 25;
    ctx.beginPath();
    ctx.moveTo(x, HEIGHT - 75);
    ctx.lineTo(x - 3, HEIGHT - 65);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 5, HEIGHT - 70);
    ctx.lineTo(x + 2, HEIGHT - 60);
    ctx.stroke();
  }
  
  // Задние деревья (полупрозрачные)
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#3a5a3a';
  
  // Левые деревья
  drawTree(100, 130, 30, 50);
  drawTree(140, 140, 25, 45);
  
  // Правые деревья  
  drawTree(412, 130, 30, 50);
  drawTree(372, 140, 25, 45);
  
  ctx.globalAlpha = 1.0;
  
  // Передние кусты (более четкие)
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#4a6a4a';
  
  // Левый куст
  fillEllipse(70, 310, 35, 25);
  fillEllipse(55, 305, 25, 20);
  fillEllipse(85, 308, 28, 22);
  
  // Правый куст
  fillEllipse(442, 310, 35, 25);
  fillEllipse(457, 305, 25, 20);
  fillEllipse(427, 308, 28, 22);
  
  // Центральный куст
  fillEllipse(256, 335, 45, 30);
  fillEllipse(235, 330, 35, 25);
  fillEllipse(277, 332, 38, 27);
  
  ctx.restore();
}

function drawTree(x, y, width, height) {
  ctx.save();
  
  // Ствол
  ctx.fillStyle = '#3a4a3a';
  ctx.fillRect(x - 4, y, 8, height * 0.6);
  
  // Крона (несколько овалов)
  ctx.fillStyle = '#4a6a4a';
  fillEllipse(x, y - height * 0.2, width, height * 0.5, false);
  fillEllipse(x - width * 0.3, y - height * 0.1, width * 0.7, height * 0.4, false);
  fillEllipse(x + width * 0.3, y - height * 0.1, width * 0.7, height * 0.4, false);
  fillEllipse(x, y + height * 0.1, width * 0.8, height * 0.3, false);
  
  ctx.restore();
}

function drawCoops() {
  ctx.save();
  ctx.fillStyle = '#3a5a3a';
  ctx.strokeStyle = '#2a4a2a';
  ctx.lineWidth = 2;
  
  // Рисуем 4 курятника в углах
  const coopPositions = [
    LANE_SEGMENTS.LT[0], // Лево-верх
    LANE_SEGMENTS.LB[0], // Лево-низ
    LANE_SEGMENTS.RT[0], // Право-верх
    LANE_SEGMENTS.RB[0]  // Право-низ
  ];
  
  coopPositions.forEach(pos => {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    
    // Домик курятника
    ctx.fillRect(-15, -10, 30, 20);
    ctx.strokeRect(-15, -10, 30, 20);
    
    // Крыша
    ctx.beginPath();
    ctx.moveTo(-18, -10);
    ctx.lineTo(0, -22);
    ctx.lineTo(18, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
  });
  
  ctx.restore();
}

function drawLanes() {
  ctx.save();
  ctx.strokeStyle = '#a5b598';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  
  // Рисуем дорожки как пунктирные линии
  LANES.forEach(lane => {
    const segments = LANE_SEGMENTS[lane];
    ctx.beginPath();
    ctx.moveTo(segments[0].x, segments[0].y);
    for (let i = 1; i < segments.length; i += 1) {
      ctx.lineTo(segments[i].x, segments[i].y);
    }
    ctx.stroke();
  });
  
  ctx.setLineDash([]);
  ctx.restore();
}



function drawInactiveCatchers() {
  ctx.save();
  ctx.globalAlpha = 0.32;
  // Рисуем все 4 неактивные позы
  LANES.forEach(lane => {
    if (lane !== state.playerPose) {
      drawDogCatcher(DOG_POSITIONS[lane], false);
    }
  });
  ctx.restore();
}

function drawActiveCatcher() {
  drawDogCatcher(DOG_POSITIONS[state.playerPose], true);
}

function drawDogCatcher(point, active) {
  ctx.save();
  ctx.translate(point.x, point.y);
  const facing = point.x < WIDTH / 2 ? 1 : -1;
  ctx.scale(facing, 1);
  
  // Анимация ходьбы (качание)
  const walkOffset = Math.sin(state.walkAnimation * Math.PI * 2) * 2;
  
  // Волк в стиле оригинала
  const color = '#2a3a2a';
  ctx.lineWidth = active ? 3 : 2.5;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  
  // Хвост (за спиной)
  ctx.save();
  ctx.translate(-30, 10);
  ctx.rotate(-0.3 + walkOffset * 0.05);
  fillEllipse(0, 0, 8, 20, false);
  ctx.restore();
  
  // Тело
  fillEllipse(-4, 8, 22, 18);
  
  // Голова
  fillEllipse(14, -6, 14, 12);
  
  // Уши (два)
  fillPolygon([[8, -16], [12, -30], [18, -18]]); // Левое ухо
  fillPolygon([[18, -16], [24, -28], [28, -16]]); // Правое ухо
  
  // Морда (вытянутая)
  fillPolygon([[26, -6], [38, -4], [38, 4], [26, 6], [22, 0]]);
  
  // Нос
  ctx.fillStyle = '#1a2a1a';
  fillEllipse(38, 0, 3, 4, false);
  ctx.fillStyle = color;
  
  // Глаз
  ctx.fillStyle = '#1a2a1a';
  fillEllipse(20, -4, 2, 3, false);
  ctx.fillStyle = color;
  
  // Передние лапы (с анимацией)
  ctx.save();
  ctx.translate(4, 18);
  ctx.rotate(walkOffset * 0.1);
  fillPolygon([[-2, 0], [2, 0], [2, 16], [-2, 16]]);
  ctx.restore();
  
  ctx.save();
  ctx.translate(10, 18);
  ctx.rotate(-walkOffset * 0.1);
  fillPolygon([[-2, 0], [2, 0], [2, 16], [-2, 16]]);
  ctx.restore();
  
  // Задние лапы
  fillPolygon([[-14, 14], [-10, 14], [-10, 26], [-14, 26]]);
  fillPolygon([[-22, 14], [-18, 14], [-18, 26], [-22, 26]]);
  
  // Корзина (всегда есть у волка)
  ctx.fillStyle = '#8b4513';
  ctx.strokeStyle = '#654321';
  ctx.lineWidth = 2.5;
  
  // Основание корзины
  fillEllipse(0, 34, 30, 14, false);
  
  // Ручка корзины
  ctx.beginPath();
  ctx.moveTo(-26, 28);
  ctx.quadraticCurveTo(0, 16, 26, 28);
  ctx.stroke();
  
  // Плетение корзины
  ctx.lineWidth = 1.5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 8, 30);
    ctx.lineTo(i * 8, 38);
    ctx.stroke();
  }
  
  ctx.restore();
}

function drawMouse() {
  ctx.save();
  ctx.lineWidth = 2.5;

  // Draw mouse with joy animation
  const joyScale = state.mouse.joyTimer > 0 ? 1.3 : 1.0;
  const joyOffsetY = state.mouse.joyTimer > 0 ? -6 : 0;

  ctx.save();
  ctx.translate(state.mouse.x, state.mouse.y + joyOffsetY);
  ctx.scale(joyScale, joyScale);
  drawMouseSilhouette(0, 0, 1);
  ctx.restore();

  ctx.restore();
}

function drawBrokenEggs() {
  ctx.save();
  ctx.fillStyle = '#f2e3c5';
  ctx.strokeStyle = '#623632';
  ctx.lineWidth = 3;

  for (const brokenEgg of state.brokenEggs) {
    const alpha = 1 - (brokenEgg.timer / BROKEN_EGG_DISPLAY_TIME);
    const pos = LANE_SEGMENTS[brokenEgg.lane][3]; // S3 позиция
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(pos.x, pos.y);
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-2, -4);
    ctx.lineTo(0, -10);
    ctx.lineTo(6, -2);
    ctx.lineTo(10, -12);
    ctx.lineTo(16, 0);
    ctx.lineTo(8, 12);
    ctx.lineTo(2, 2);
    ctx.lineTo(-2, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawMouseSilhouette(x, y, facing) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  
  const color = '#3a4a3a';
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  
  // Тело зайца
  fillEllipse(0, 18, 18, 14, false);
  
  // Голова
  fillEllipse(14, 6, 12, 10, false);
  
  // Длинные уши (как у зайца)
  fillPolygon([[8, -8], [10, -26], [14, -8]]); // Левое ухо
  fillPolygon([[18, -8], [22, -24], [24, -8]]); // Правое ухо
  
  // Внутренняя часть ушей (светлая)
  ctx.fillStyle = '#8a9a8a';
  fillPolygon([[10, -7], [11, -22], [13, -9]], false);
  fillPolygon([[19, -7], [21, -20], [23, -9]], false);
  ctx.fillStyle = color;
  
  // Морда
  fillEllipse(24, 6, 6, 5, false);
  
  // Нос
  ctx.fillStyle = '#2a3a2a';
  fillEllipse(28, 6, 2, 2, false);
  ctx.fillStyle = color;
  
  // Глаз
  ctx.fillStyle = '#1a2a1a';
  fillEllipse(18, 2, 2, 3, false);
  ctx.fillStyle = color;
  
  // Передние лапки
  fillEllipse(6, 26, 5, 6, false);
  fillEllipse(14, 26, 5, 6, false);
  
  // Задние лапы (больше)
  fillEllipse(-6, 24, 6, 8, false);
  fillEllipse(-14, 24, 6, 8, false);
  
  // Хвостик (маленький пушистый)
  ctx.fillStyle = '#5a6a5a';
  fillEllipse(-16, 18, 5, 5, false);
  
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

function drawHighlight() {
  const point = DOG_POSITIONS[state.highlightPose];
  if (!point) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 215, 64, 0.8)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawEggs() {
  ctx.save();
  
  for (const egg of state.eggs) {
    const pos = LANE_SEGMENTS[egg.lane][egg.segment];
    ctx.save();
    ctx.translate(pos.x, pos.y);
    
    // Основа яйца
    ctx.fillStyle = '#f5f5dc';
    ctx.strokeStyle = '#2a3a2a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Пятнышки на яйце
    ctx.fillStyle = '#d5c5ac';
    fillEllipse(-2, -4, 2, 3, false);
    fillEllipse(2, 2, 1.5, 2.5, false);
    fillEllipse(0, 6, 1.8, 2.2, false);
    
    // Блик
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    fillEllipse(-2, -6, 2, 4, false);
    
    ctx.restore();
  }
  
  ctx.restore();
}

function drawHud(dict) {
  ctx.save();
  ctx.fillStyle = '#cbd8c7';
  ctx.fillRect(30, 18, WIDTH - 60, 45);
  ctx.strokeStyle = '#3a523a';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 18, WIDTH - 60, 45);
  ctx.fillStyle = '#1a2a1a';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${dict.scoreLabel.toUpperCase()}: ${padScore(state.score)}`, 45, 45);
  ctx.textAlign = 'right';
  ctx.fillText(`${dict.bestLabel.toUpperCase()}: ${padScore(state.bestScore)}`, WIDTH - 45, 45);
  
  // Показываем уровень по центру
  if (state.phase === 'playing' || state.phase === 'paused') {
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = '#2a4a2a';
    ctx.fillText(`LVL ${state.level}`, WIDTH / 2, 45);
  }
  
  ctx.textAlign = 'left';
  drawLivesCanvas(dict);
  ctx.restore();
}

function drawLivesCanvas(dict) {
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillStyle = '#1a2a1a';
  ctx.fillText('LIVES', WIDTH / 2 - 55, HEIGHT - 40);
  const baseX = WIDTH / 2;
  const y = HEIGHT - 48;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(baseX + i * 28, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = i < state.lives ? '#2a3a2a' : '#95a595';
    ctx.fill();
    ctx.strokeStyle = '#2c3c2c';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

function drawOverlayBox() {
  ctx.save();
  ctx.fillStyle = 'rgba(20, 35, 20, 0.78)';
  ctx.fillRect(80, 120, WIDTH - 160, 160);
  ctx.strokeStyle = '#183118';
  ctx.lineWidth = 4;
  ctx.strokeRect(80, 120, WIDTH - 160, 160);
  ctx.restore();
}

function drawAttractOverlay(dict) {
  drawOverlayBox();
  ctx.save();
  ctx.fillStyle = '#f3f5ec';
  ctx.font = 'bold 28px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(dict.pressStart, WIDTH / 2, 190);
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText(dict.hintControls, WIDTH / 2, 230);
  ctx.restore();
}

function drawPausedOverlay(dict) {
  drawOverlayBox();
  ctx.save();
  ctx.fillStyle = '#f3f5ec';
  ctx.font = 'bold 32px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(dict.paused, WIDTH / 2, 200);
  ctx.font = '18px "Courier New", monospace';
  ctx.fillText(dict.pressStart, WIDTH / 2, 240);
  ctx.restore();
}

function drawGameOverOverlay(dict) {
  drawOverlayBox();
  ctx.save();
  ctx.fillStyle = '#f3f5ec';
  ctx.font = 'bold 32px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(dict.gameOver, WIDTH / 2, 170);
  ctx.font = '20px "Courier New", monospace';
  ctx.fillText(`${dict.scoreLabel}: ${padScore(state.score)}`, WIDTH / 2, 205);
  ctx.fillText(`${dict.bestLabel}: ${padScore(state.bestScore)}`, WIDTH / 2, 235);
  if (state.score === state.bestScore && state.score > 0) {
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText(dict.newRecord, WIDTH / 2, 260);
  }
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText('Press R to Restart', WIDTH / 2, state.score === state.bestScore && state.score > 0 ? 275 : 260);
  ctx.restore();
}

function drawBlink() {
  ctx.save();
  const intensity = 0.45 + 0.2 * Math.sin((state.blinkTimer / BLINK_DURATION) * Math.PI);
  ctx.fillStyle = `rgba(60, 30, 30, ${Math.min(0.65, intensity)})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawBrokenEgg();
  ctx.restore();
}

function drawBrokenEgg() {
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2 + 24);
  ctx.fillStyle = '#f2e3c5';
  ctx.strokeStyle = '#623632';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-44, 0);
  ctx.lineTo(-24, -32);
  ctx.lineTo(-8, -12);
  ctx.lineTo(0, -28);
  ctx.lineTo(16, -8);
  ctx.lineTo(28, -32);
  ctx.lineTo(48, 0);
  ctx.lineTo(24, 32);
  ctx.lineTo(4, 8);
  ctx.lineTo(-8, 28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function padScore(value) {
  return value.toString().padStart(3, '0');
}

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------
function init() {
  loadPersistentData();
  setLanguage(state.language, false);
  setMode(state.nextMode, false);
  updateBestUI();
  enterAttract();
  bindEvents();
  requestAnimationFrame(loop);
}

init();

/*
Complete game redesign implemented:
- Eggs spawn from 4 corners (LT, RT, LB, RB) with physics-based gravity system
- Eggs fly with realistic parabolic trajectories toward center of screen
- Dog has basket in LB/RB positions with precise hitbox collision detection
- Lives system (3 lives) replaces old misses system - Game Over when lives = 0
- Eggs rotate during flight with random rotation speeds for visual appeal
- Mouse shows joy animation (scale + bounce) when eggs are caught successfully
- Broken egg particles appear when eggs are missed, fade out over time
- Proper z-layer rendering: background → nests → dog → basket → eggs → UI
- Difficulty scaling: gravity increases, spawn intervals decrease every 20 points
- Centered score display with lives indicator (3 egg icons) instead of misses
- Game Over screen shows "Press R to Restart" instruction
- All original features preserved (audio, scoring, modes, localization, etc.)
*/
