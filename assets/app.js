const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;

const screens = new Map(
  Array.from(document.querySelectorAll('.screen')).map((section) => [section.id, section])
);

const fallbackWordPairs = [
  { id: '1', category: 'history', word: 'World War II', hint: 'Cold War' },
  { id: '2', category: 'sport', word: 'Football', hint: 'Rugby' },
  { id: '3', category: 'food', word: 'Pizza', hint: 'Flatbread' },
  { id: '4', category: 'movies', word: 'Inception', hint: 'Matrix' },
  { id: '5', category: 'history', word: 'Abraham Lincoln', hint: 'George Washington' },
  { id: '6', category: 'science', word: 'Gravity', hint: 'Magnetism' },
  { id: '7', category: 'music', word: 'Beethoven', hint: 'Mozart' },
  { id: '8', category: 'travel', word: 'Paris', hint: 'Rome' },
  { id: '9', category: 'technology', word: 'Smartphone', hint: 'Tablet' },
  { id: '10', category: 'nature', word: 'Oak Tree', hint: 'Pine Tree' },
  { id: '11', category: 'gaming', word: 'Chess', hint: 'Checkers' },
  { id: '12', category: 'art', word: 'Starry Night', hint: 'Sunflowers' },
];

const startButton = document.getElementById('btn-start');
const dataStatus = document.getElementById('data-status');
const playerForm = document.getElementById('player-form');
const playerInputs = document.getElementById('player-inputs');
const playerTemplate = document.getElementById('player-row-template');
const addPlayerButton = document.getElementById('btn-add-player');
const playerNextButton = document.getElementById('btn-player-next');
const playerCountInfo = document.getElementById('player-count-info');
const categorySelect = document.getElementById('category-select');
const imposterSelect = document.getElementById('imposter-select');
const gameSetupForm = document.getElementById('game-setup-form');
const resetPlayersButton = document.getElementById('btn-reset-players');
const newPlayersButton = document.getElementById('btn-new-players');
const newRoundButton = document.getElementById('btn-new-round');
const revealPlayerName = document.getElementById('reveal-player-name');
const roleDisplay = document.getElementById('role-display');
const roleInstruction = document.getElementById('role-instruction');
const roleWord = document.getElementById('role-word');
const revealButton = document.getElementById('btn-reveal');
const privacyTip = document.querySelector('.privacy-tip');
const readyStartingName = document.getElementById('starting-player-name');
const summaryWord = document.getElementById('summary-word');
const summaryHint = document.getElementById('summary-hint');
const wordSummary = document.getElementById('word-summary');
const toggleSummaryButton = document.getElementById('btn-toggle-summary');

let wordPairs = [];
let isRoleVisible = false;

const gameState = {
  players: [],
  category: 'any',
  numImposters: 1,
  word: '',
  hint: '',
  currentRevealIndex: 0,
  startingPlayerIndex: null,
};

init();

async function init() {
  setScreen('screen-welcome');
  seedPlayerInputs();
  attachEventListeners();

  try {
    wordPairs = await loadWords();
    if (!wordPairs.length) {
      throw new Error('No word pairs found in words.csv');
    }
    dataStatus.textContent = `Loaded ${wordPairs.length} prompts`;
    startButton.disabled = false;
    populateCategoryOptions(wordPairs);
  } catch (error) {
    console.error(error);
    wordPairs = fallbackWordPairs;
    dataStatus.textContent =
      'Loaded built-in sample pack. Host the files via HTTP to use words.csv.';
    startButton.disabled = false;
    populateCategoryOptions(wordPairs);
  }
}

function attachEventListeners() {
  startButton.addEventListener('click', () => {
    goToPlayerSetup(Boolean(gameState.players.length));
  });

  addPlayerButton.addEventListener('click', () => {
    addPlayerRow();
    updatePlayerFormState();
  });

  playerForm.addEventListener('input', () => {
    updatePlayerFormState();
  });

  playerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const names = collectPlayerNames();
    if (names.length < MIN_PLAYERS) {
      return;
    }
    gameState.players = names.map((name) => ({ name }));
    gameState.numImposters = Math.min(gameState.numImposters, gameState.players.length - 1);
    populateImposterOptions();
    setScreen('screen-game-setup');
  });

  gameSetupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!wordPairs.length) {
      return;
    }

    const selectedCategory = categorySelect.value;
    const selectedImposters = Number(imposterSelect.value);
    const picked = pickRandomWord(wordPairs, selectedCategory);
    if (!picked) {
      alert('No words available for that category. Try another one.');
      return;
    }

    gameState.category = selectedCategory;
    gameState.numImposters = selectedImposters;
    gameState.word = picked.word;
    gameState.hint = picked.hint;
    gameState.players = assignRoles(gameState.players, selectedImposters);
    gameState.currentRevealIndex = 0;
    gameState.startingPlayerIndex = null;
    prepareRevealForCurrentPlayer();
    setScreen('screen-role-reveal');
  });

  resetPlayersButton.addEventListener('click', () => {
    goToPlayerSetup(true);
  });

  newPlayersButton.addEventListener('click', () => {
    goToPlayerSetup(true);
  });

  newRoundButton.addEventListener('click', () => {
    prepareNextRound();
  });

  toggleSummaryButton.addEventListener('click', () => {
    const shouldShow = wordSummary.hidden;
    wordSummary.hidden = !wordSummary.hidden;
    toggleSummaryButton.textContent = shouldShow
      ? 'Hide answers'
      : 'Reveal answers (after the round)';
  });

  revealButton.addEventListener('click', () => {
    if (!isRoleVisible) {
      showCurrentRole();
    } else {
      advanceRevealFlow();
    }
  });
}

function setScreen(id) {
  screens.forEach((element, key) => {
    element.classList.toggle('visible', key === id);
  });
  document.body.dataset.screen = id;
}

function seedPlayerInputs(names = []) {
  playerInputs.innerHTML = '';
  const values = names.length ? names : [];
  values.forEach((name) => addPlayerRow(name));
  while (playerInputs.children.length < MIN_PLAYERS) {
    addPlayerRow('');
  }
  updatePlayerFormState();
}

function addPlayerRow(value = '') {
  if (playerInputs.children.length >= MAX_PLAYERS) {
    return;
  }
  const clone = playerTemplate.content.firstElementChild.cloneNode(true);
  const input = clone.querySelector('input');
  const removeButton = clone.querySelector('button');
  input.value = value;
  input.addEventListener('focus', () => input.select());
  removeButton.addEventListener('click', () => {
    clone.remove();
    updatePlayerFormState();
  });
  playerInputs.appendChild(clone);
}

function updatePlayerFormState() {
  const totalRows = playerInputs.children.length;
  const names = collectPlayerNames();
  playerNextButton.disabled = names.length < MIN_PLAYERS;
  addPlayerButton.disabled = totalRows >= MAX_PLAYERS;
  playerCountInfo.textContent = `Players ready: ${names.length} / ${MAX_PLAYERS}`;
}

function collectPlayerNames() {
  return Array.from(playerInputs.querySelectorAll('input'))
    .map((input) => input.value.trim())
    .filter(Boolean);
}

async function loadWords() {
  const response = await fetch('words.csv');
  if (!response.ok) {
    throw new Error(`Failed to fetch words.csv (${response.status})`);
  }
  const text = await response.text();
  return parseCsv(text);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const [headerLine, ...rows] = lines;
  if (!headerLine) return [];
  const headers = headerLine.split(',');
  return rows
    .map((line) => line.split(',').map((value) => value.trim()))
    .filter((cells) => cells.length === headers.length)
    .map((cells) => {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = cells[index];
      });
      return {
        id: entry.id,
        category: entry.category,
        word: entry.word,
        hint: entry.hint,
      };
    })
    .filter((entry) => entry.word && entry.hint);
}

function populateCategoryOptions(list = []) {
  const categories = Array.from(new Set(list.map((item) => item.category.trim()))).sort();
  categorySelect.innerHTML = '';
  const anyOption = new Option('Any category', 'any', true, true);
  categorySelect.append(anyOption);
  categories.forEach((category) => {
    const option = new Option(capitalize(category), category);
    categorySelect.append(option);
  });
  const availableValues = ['any', ...categories];
  const defaultValue = availableValues.includes(gameState.category) ? gameState.category : 'any';
  categorySelect.value = defaultValue;
  gameState.category = defaultValue;
}

function populateImposterOptions() {
  const playerCount = gameState.players.length;
  imposterSelect.innerHTML = '';
  for (let i = 1; i < playerCount; i += 1) {
    const option = new Option(`${i} ${i === 1 ? 'imposter' : 'imposters'}`, String(i));
    imposterSelect.append(option);
  }
  const desired = Math.min(Math.max(gameState.numImposters, 1), playerCount - 1);
  gameState.numImposters = desired;
  imposterSelect.value = String(desired);
}

function pickRandomWord(list, selectedCategory) {
  const pool =
    selectedCategory && selectedCategory !== 'any'
      ? list.filter((item) => item.category === selectedCategory)
      : list;
  if (!pool.length) {
    return null;
  }
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

function assignRoles(players, numImposters) {
  const indices = players.map((_, index) => index);
  shuffle(indices);
  const imposterIndices = new Set(indices.slice(0, numImposters));
  return players.map((player, index) => ({
    name: player.name,
    role: imposterIndices.has(index) ? 'imposter' : 'civilian',
  }));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function prepareRevealForCurrentPlayer() {
  isRoleVisible = false;
  const player = gameState.players[gameState.currentRevealIndex];
  revealPlayerName.textContent = player.name;
  roleWord.textContent = 'Secret word hidden';
  roleInstruction.textContent = 'Only look when you are ready';
  roleDisplay.classList.remove('revealed');
  revealButton.textContent = 'Tap to reveal';
  privacyTip.hidden = false;
}

function showCurrentRole() {
  const player = gameState.players[gameState.currentRevealIndex];
  const text = player.role === 'imposter' ? gameState.hint : gameState.word;
  roleWord.textContent = text;
  roleInstruction.textContent = player.role === 'imposter' ? 'You are an imposter' : 'You are safe';
  roleDisplay.classList.add('revealed');
  revealButton.textContent = isLastReveal() ? 'All set' : 'Next player';
  isRoleVisible = true;
  privacyTip.hidden = true;
}

function advanceRevealFlow() {
  if (!isRoleVisible) {
    return;
  }
  if (isLastReveal()) {
    showReadyScreen();
  } else {
    gameState.currentRevealIndex += 1;
    prepareRevealForCurrentPlayer();
  }
}

function isLastReveal() {
  return gameState.currentRevealIndex === gameState.players.length - 1;
}

function showReadyScreen() {
  gameState.startingPlayerIndex = pickStartingPlayer(gameState.players);
  readyStartingName.textContent = gameState.players[gameState.startingPlayerIndex].name;
  summaryWord.textContent = gameState.word;
  summaryHint.textContent = gameState.hint;
  wordSummary.hidden = true;
  toggleSummaryButton.textContent = 'Reveal answers (after the round)';
  setScreen('screen-ready');
}

function pickStartingPlayer(players) {
  return Math.floor(Math.random() * players.length);
}

function prepareNextRound() {
  gameState.players = gameState.players.map((player) => ({ name: player.name }));
  gameState.currentRevealIndex = 0;
  setScreen('screen-game-setup');
  populateImposterOptions();
  const hasCategory = Array.from(categorySelect.options).some(
    (option) => option.value === gameState.category
  );
  if (!hasCategory) {
    gameState.category = 'any';
  }
  categorySelect.value = gameState.category;
}

function goToPlayerSetup(prefill = false) {
  if (prefill) {
    gameState.players = gameState.players.map((player) => ({ name: player.name }));
  }
  const names = prefill ? gameState.players.map((player) => player.name) : [];
  seedPlayerInputs(names);
  setScreen('screen-player-setup');
}

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
