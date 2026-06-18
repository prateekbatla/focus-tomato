// Focus Tomato - offscreen audio host.
// Plays the bundled ambient loops + the session-end chime. (YouTube is handled
// by the background script via a separate mini-player window.)

const LOOP_IDS = ['ocean', 'clock-soft', 'clock-wall', 'clock-mech', 'rain'];
const loops = {};
for (const id of LOOP_IDS) loops[id] = document.getElementById(id);
const chime = document.getElementById('chime');

function vol(v) {
  return Math.min(1, Math.max(0, (v ?? 70) / 100));
}

function stopLoops() {
  for (const a of Object.values(loops)) {
    a.pause();
    a.currentTime = 0;
  }
}

function play(msg) {
  stopLoops();
  const a = loops[msg.sound];
  if (a) {
    a.volume = vol(msg.volume);
    a.play().catch(() => {});
  }
}

function setVolume(v) {
  for (const a of Object.values(loops)) a.volume = vol(v);
}

function playChime(v) {
  chime.volume = vol(v);
  chime.currentTime = 0;
  chime.play().catch(() => {});
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== 'offscreen') return;
  switch (msg.type) {
    case 'play':
      play(msg);
      break;
    case 'stop':
      stopLoops();
      break;
    case 'volume':
      setVolume(msg.volume);
      break;
    case 'chime':
      playChime(msg.volume);
      break;
  }
});
