// Focus Tomato - options page logic.

const DEFAULTS = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoStart: false,
  defaultSound: 'ocean',
  volume: 70,
};

const $ = (id) => document.getElementById(id);
const FIELDS = ['focusMin', 'shortMin', 'longMin', 'longEvery', 'defaultSound', 'volume'];

async function load() {
  const { settings } = await chrome.storage.sync.get('settings');
  const s = { ...DEFAULTS, ...(settings || {}) };
  for (const f of FIELDS) $(f).value = s[f];
  $('autoStart').checked = s.autoStart;
}

async function save() {
  const settings = {
    focusMin: clampInt($('focusMin').value, 1, 180, 25),
    shortMin: clampInt($('shortMin').value, 1, 60, 5),
    longMin: clampInt($('longMin').value, 1, 120, 15),
    longEvery: clampInt($('longEvery').value, 1, 12, 4),
    autoStart: $('autoStart').checked,
    defaultSound: $('defaultSound').value,
    volume: clampInt($('volume').value, 0, 100, 70),
  };
  await chrome.storage.sync.set({ settings });
  // Reflect new durations on any idle timer immediately.
  chrome.runtime.sendMessage({ cmd: 'getState' }, () => {});
  $('saved').textContent = 'Saved ✓';
  setTimeout(() => ($('saved').textContent = ''), 1500);
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

$('save').addEventListener('click', save);
$('shortcuts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

load();
