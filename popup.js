// Focus Tomato - popup UI logic.

const $ = (id) => document.getElementById(id);
const MODE_COLOR = { focus: '#e5484d', short: '#30a46c', long: '#3e63dd' };

let state = null;
let settings = null;
let tasks = [];
let tickHandle = null;
let firedTimeUp = false;

const send = (msg) => chrome.runtime.sendMessage(msg);

function fmt(secs) {
  secs = Math.max(0, secs);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function liveRemaining() {
  if (state.running && state.endTime) {
    return Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
  }
  return state.remaining;
}

function renderTimer() {
  const secs = liveRemaining();
  $('timer').textContent = fmt(secs);
  if (state.running && secs <= 0 && !firedTimeUp) {
    firedTimeUp = true;
    send({ cmd: 'timeUp' });
  }
}

function renderControls() {
  document.documentElement.style.setProperty('--accent', MODE_COLOR[state.mode]);
  for (const btn of document.querySelectorAll('.mode')) {
    btn.setAttribute('aria-selected', String(btn.dataset.mode === state.mode));
  }
  $('startPause').textContent = state.running ? 'Pause' : 'Start';
  $('sound').value = state.sound;
  $('youtubeUrl').value = state.youtubeUrl || '';
  $('youtubeUrl').classList.toggle('hidden', state.sound !== 'youtube');
}

function renderAll() {
  renderControls();
  renderTimer();
}

async function loadDaily() {
  const { daily } = await chrome.storage.local.get('daily');
  const today = new Date().toISOString().slice(0, 10);
  const count = daily && daily.date === today ? daily.count : 0;
  $('daily').textContent = `🍅 ${count} today`;
}

// ---------- to-do list ----------

function renderTasks() {
  const list = $('todoList');
  list.innerHTML = '';
  const done = tasks.filter((t) => t.done).length;
  $('todoCount').textContent = tasks.length ? `${done}/${tasks.length}` : '';

  if (!tasks.length) {
    const li = document.createElement('li');
    li.className = 'todo-empty';
    li.textContent = 'Add what you want to get done this cycle.';
    list.appendChild(li);
    return;
  }

  tasks.forEach((task, i) => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (task.done ? ' done' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = task.done;
    cb.setAttribute('aria-label', task.text);
    cb.addEventListener('change', () => toggleTask(i));

    const span = document.createElement('span');
    span.textContent = task.text;

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = 'Delete';
    del.setAttribute('aria-label', `Delete ${task.text}`);
    del.addEventListener('click', () => removeTask(i));

    li.append(cb, span, del);
    list.appendChild(li);
  });
}

async function saveTasks() {
  await chrome.storage.local.set({ tasks });
}

async function addTask(text) {
  text = text.trim();
  if (!text) return;
  tasks.push({ text, done: false });
  await saveTasks();
  renderTasks();
}

async function toggleTask(i) {
  tasks[i].done = !tasks[i].done;
  await saveTasks();
  renderTasks();
}

async function removeTask(i) {
  tasks.splice(i, 1);
  await saveTasks();
  renderTasks();
}

// ---------- events ----------

function wire() {
  $('startPause').addEventListener('click', () => {
    send({ cmd: state.running ? 'pause' : 'start' });
  });
  $('reset').addEventListener('click', () => send({ cmd: 'reset' }));
  $('skip').addEventListener('click', () => send({ cmd: 'skip' }));

  for (const btn of document.querySelectorAll('.mode')) {
    btn.addEventListener('click', () => send({ cmd: 'setMode', mode: btn.dataset.mode }));
  }

  $('sound').addEventListener('change', () => {
    const sound = $('sound').value;
    $('youtubeUrl').classList.toggle('hidden', sound !== 'youtube');
    send({ cmd: 'setSound', sound, youtubeUrl: $('youtubeUrl').value });
  });

  $('youtubeUrl').addEventListener('change', () => {
    send({ cmd: 'setSound', sound: 'youtube', youtubeUrl: $('youtubeUrl').value });
  });

  let volTimer = null;
  $('volume').addEventListener('input', () => {
    clearTimeout(volTimer);
    const volume = Number($('volume').value);
    volTimer = setTimeout(() => send({ cmd: 'setVolume', volume }), 120);
  });

  $('todoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addTask($('todoInput').value);
    $('todoInput').value = '';
  });

  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.state) {
      state = changes.state.newValue;
      firedTimeUp = false;
      renderAll();
    }
    if (area === 'local' && changes.daily) loadDaily();
    if (area === 'local' && changes.tasks) {
      tasks = changes.tasks.newValue || [];
      renderTasks();
    }
    if (area === 'sync' && changes.settings) {
      settings = changes.settings.newValue;
      $('volume').value = settings.volume;
    }
  });
}

async function init() {
  const resp = await send({ cmd: 'getState' });
  state = resp.state;
  settings = resp.settings;
  $('volume').value = settings.volume;

  const { tasks: stored } = await chrome.storage.local.get('tasks');
  tasks = stored || [];

  wire();
  renderAll();
  renderTasks();
  loadDaily();

  tickHandle = setInterval(renderTimer, 1000);
}

window.addEventListener('unload', () => clearInterval(tickHandle));
init();
