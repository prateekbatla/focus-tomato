// Focus Tomato - background service worker
// Owns the timer state machine, alarms, notifications, badge, and audio relay.

const DEFAULT_SETTINGS = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4, // long break after this many focus sessions
  autoStart: false,
  defaultSound: 'ocean', // ocean | tick | youtube | off
  volume: 70,
};

const DEFAULT_STATE = {
  mode: 'focus', // focus | short | long
  remaining: DEFAULT_SETTINGS.focusMin * 60, // seconds left when paused
  running: false,
  endTime: null, // epoch ms when the running session ends
  focusCount: 0, // completed focus sessions in the current cycle
  sound: DEFAULT_SETTINGS.defaultSound,
  youtubeUrl: '',
  youtubeId: null,
};

const ALARM_COMPLETE = 'complete';
const ALARM_BADGE = 'badge';

const MODE_COLOR = { focus: '#e5484d', short: '#30a46c', long: '#3e63dd' };
const MODE_LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };

// ---------- storage helpers ----------

async function getSettings() {
  const { settings } = await chrome.storage.sync.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

async function getState() {
  const { state } = await chrome.storage.local.get('state');
  return { ...DEFAULT_STATE, ...(state || {}) };
}

async function setState(patch) {
  const state = await getState();
  const next = { ...state, ...patch };
  await chrome.storage.local.set({ state: next });
  return next;
}

function durationFor(mode, settings) {
  if (mode === 'short') return settings.shortMin * 60;
  if (mode === 'long') return settings.longMin * 60;
  return settings.focusMin * 60;
}

function liveRemaining(state) {
  if (state.running && state.endTime) {
    return Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
  }
  return state.remaining;
}

// ---------- youtube ----------

function parseYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const parts = u.pathname.split('/');
      const i = parts.findIndex((p) => p === 'embed' || p === 'live' || p === 'shorts');
      if (i >= 0 && parts[i + 1]) return parts[i + 1];
    }
  } catch (e) {
    // not a URL; maybe a bare id
    if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  }
  return null;
}

// ---------- offscreen audio ----------

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play ambient focus sounds and the session-end chime.',
  });
}

async function audio(msg) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({ target: 'offscreen', ...msg }).catch(() => {});
}

async function startAmbient(state, settings) {
  if (state.mode !== 'focus' || state.sound === 'off') {
    audio({ type: 'stop' });
    return;
  }
  audio({
    type: 'play',
    sound: state.sound,
    youtubeId: state.youtubeId,
    volume: settings.volume,
  });
}

function stopAmbient() {
  audio({ type: 'stop' });
}

// ---------- badge ----------

async function updateBadge() {
  const state = await getState();
  if (!state.running) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const secs = liveRemaining(state);
  const mins = Math.ceil(secs / 60);
  await chrome.action.setBadgeBackgroundColor({ color: MODE_COLOR[state.mode] });
  await chrome.action.setBadgeText({ text: String(mins) });
}

// ---------- timer control ----------

async function start() {
  const state = await getState();
  if (state.running) return;
  const settings = await getSettings();
  const remaining = state.remaining > 0 ? state.remaining : durationFor(state.mode, settings);
  const endTime = Date.now() + remaining * 1000;
  const next = await setState({ running: true, endTime, remaining });
  await chrome.alarms.clear(ALARM_COMPLETE);
  await chrome.alarms.clear(ALARM_BADGE);
  chrome.alarms.create(ALARM_COMPLETE, { when: endTime });
  chrome.alarms.create(ALARM_BADGE, { periodInMinutes: 0.5 });
  await startAmbient(next, settings);
  await updateBadge();
}

async function pause() {
  const state = await getState();
  if (!state.running) return;
  const remaining = liveRemaining(state);
  await setState({ running: false, endTime: null, remaining });
  await chrome.alarms.clear(ALARM_COMPLETE);
  await chrome.alarms.clear(ALARM_BADGE);
  stopAmbient();
  await updateBadge();
}

async function reset() {
  const state = await getState();
  const settings = await getSettings();
  await setState({
    running: false,
    endTime: null,
    remaining: durationFor(state.mode, settings),
  });
  await chrome.alarms.clear(ALARM_COMPLETE);
  await chrome.alarms.clear(ALARM_BADGE);
  stopAmbient();
  await updateBadge();
}

async function setMode(mode) {
  const settings = await getSettings();
  await chrome.alarms.clear(ALARM_COMPLETE);
  await chrome.alarms.clear(ALARM_BADGE);
  stopAmbient();
  await setState({
    mode,
    running: false,
    endTime: null,
    remaining: durationFor(mode, settings),
  });
  await updateBadge();
}

function nextModeFor(state, settings) {
  if (state.mode === 'focus') {
    const focusCount = state.focusCount + 1;
    const mode = focusCount % settings.longEvery === 0 ? 'long' : 'short';
    return { mode, focusCount };
  }
  // leaving a break
  return { mode: 'focus', focusCount: state.mode === 'long' ? 0 : state.focusCount };
}

async function bumpDailyCount() {
  const today = new Date().toISOString().slice(0, 10);
  const { daily } = await chrome.storage.local.get('daily');
  if (daily && daily.date === today) {
    await chrome.storage.local.set({ daily: { date: today, count: daily.count + 1 } });
  } else {
    await chrome.storage.local.set({ daily: { date: today, count: 1 } });
  }
}

// Advance to the next mode. `completed` = the focus session actually finished
// (fire chime/notification and count it). Skipping a break passes completed=false.
async function advance({ completed }) {
  const state = await getState();
  const settings = await getSettings();
  const wasFocus = state.mode === 'focus';

  await chrome.alarms.clear(ALARM_COMPLETE);
  await chrome.alarms.clear(ALARM_BADGE);
  stopAmbient();

  if (completed && wasFocus) await bumpDailyCount();

  const { mode, focusCount } = nextModeFor(state, settings);
  const next = await setState({
    mode,
    focusCount,
    running: false,
    endTime: null,
    remaining: durationFor(mode, settings),
  });

  if (completed) {
    audio({ type: 'chime', volume: settings.volume });
    await notifyTransition(state.mode, mode);
  }

  if (settings.autoStart) {
    await start();
  } else {
    await updateBadge();
  }
}

async function complete() {
  const state = await getState();
  if (!state.running) return; // guard against double fire
  await advance({ completed: true });
}

async function skip() {
  // Skip the current (presumably break) session without counting it.
  await advance({ completed: false });
}

// ---------- notifications ----------

async function notifyTransition(fromMode, toMode) {
  const toBreak = toMode === 'short' || toMode === 'long';
  const title = fromMode === 'focus' ? 'Focus complete 🍅' : 'Break over';
  const message = toBreak
    ? `Time for a ${MODE_LABEL[toMode].toLowerCase()}.`
    : 'Ready to focus?';
  const buttons = toBreak
    ? [{ title: `Start ${MODE_LABEL[toMode].toLowerCase()}` }, { title: 'Skip break' }]
    : [{ title: 'Start focus' }, { title: 'Dismiss' }];

  await chrome.notifications.create('pomodoro', {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    buttons,
    priority: 2,
    requireInteraction: false,
  });
}

chrome.notifications.onButtonClicked.addListener(async (id, idx) => {
  if (id !== 'pomodoro') return;
  chrome.notifications.clear(id);
  if (idx === 0) {
    await start();
  } else {
    const state = await getState();
    if (state.mode === 'short' || state.mode === 'long') {
      await skip();
    }
  }
});

// ---------- alarms ----------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_COMPLETE) {
    await complete();
  } else if (alarm.name === ALARM_BADGE) {
    const state = await getState();
    if (state.running && liveRemaining(state) <= 0) {
      await complete();
    } else {
      await updateBadge();
    }
  }
});

// ---------- keyboard shortcuts ----------

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'start-timer') await start();
  if (command === 'stop-timer') await pause();
});

// ---------- messages from popup / options ----------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target === 'offscreen') return; // not for us
  (async () => {
    switch (msg.cmd) {
      case 'start':
        await start();
        break;
      case 'pause':
        await pause();
        break;
      case 'reset':
        await reset();
        break;
      case 'setMode':
        await setMode(msg.mode);
        break;
      case 'skip':
        await advance({ completed: false });
        break;
      case 'timeUp':
        await complete();
        break;
      case 'setSound': {
        const youtubeId = msg.sound === 'youtube' ? parseYouTubeId(msg.youtubeUrl) : null;
        const next = await setState({
          sound: msg.sound,
          youtubeUrl: msg.youtubeUrl || '',
          youtubeId,
        });
        const settings = await getSettings();
        if (next.running) await startAmbient(next, settings);
        sendResponse({ ok: true, youtubeId });
        return;
      }
      case 'setVolume': {
        await chrome.storage.sync.set({
          settings: { ...(await getSettings()), volume: msg.volume },
        });
        audio({ type: 'volume', volume: msg.volume });
        break;
      }
      case 'getState': {
        sendResponse({
          state: await getState(),
          settings: await getSettings(),
        });
        return;
      }
    }
    sendResponse({ ok: true });
  })();
  return true; // async response
});

// ---------- init ----------

async function init() {
  const { settings } = await chrome.storage.sync.get('settings');
  if (!settings) await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
  const { state } = await chrome.storage.local.get('state');
  if (!state) {
    const s = await getSettings();
    await chrome.storage.local.set({
      state: { ...DEFAULT_STATE, sound: s.defaultSound, remaining: s.focusMin * 60 },
    });
  } else if (state.running && state.endTime && state.endTime <= Date.now()) {
    // Session ended while the worker was asleep.
    await complete();
  }
  await updateBadge();
}

// When settings change while the timer is idle, refresh the displayed duration.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'sync' || !changes.settings) return;
  const state = await getState();
  if (state.running) return;
  const settings = await getSettings();
  await setState({ remaining: durationFor(state.mode, settings) });
});

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
