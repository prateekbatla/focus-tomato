// Focus Tomato - offscreen audio host.
// Plays bundled ambient loops + chime, and drives a hidden YouTube embed.

const ocean = document.getElementById('ocean');
const tick = document.getElementById('tick');
const chime = document.getElementById('chime');
const yt = document.getElementById('yt');

const loops = { ocean, tick };
let currentYouTubeId = null;

function vol(v) {
  return Math.min(1, Math.max(0, (v ?? 70) / 100));
}

function stopLoops() {
  for (const a of Object.values(loops)) {
    a.pause();
    a.currentTime = 0;
  }
}

function ytCommand(func, args = []) {
  yt.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args }),
    '*'
  );
}

function stopYouTube() {
  // Removing the src is the most reliable way to silence the embed.
  yt.src = '';
  currentYouTubeId = null;
}

function playYouTube(id, volume) {
  if (!id) return;
  if (id !== currentYouTubeId) {
    currentYouTubeId = id;
    // enablejsapi lets us postMessage volume/play/pause; loop needs playlist=id.
    yt.src =
      `https://www.youtube.com/embed/${id}` +
      `?enablejsapi=1&autoplay=1&loop=1&playlist=${id}&controls=0&playsinline=1`;
  } else {
    ytCommand('playVideo');
  }
  // Give the iframe a moment to load before setting volume.
  setTimeout(() => ytCommand('setVolume', [Math.round(vol(volume) * 100)]), 1200);
}

function play(msg) {
  stopLoops();
  if (msg.sound === 'youtube') {
    playYouTube(msg.youtubeId, msg.volume);
    return;
  }
  stopYouTube();
  const a = loops[msg.sound];
  if (a) {
    a.volume = vol(msg.volume);
    a.play().catch(() => {});
  }
}

function stopAll() {
  stopLoops();
  ytCommand('pauseVideo');
  stopYouTube();
}

function setVolume(v) {
  for (const a of Object.values(loops)) a.volume = vol(v);
  ytCommand('setVolume', [Math.round(vol(v) * 100)]);
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
      stopAll();
      break;
    case 'volume':
      setVolume(msg.volume);
      break;
    case 'chime':
      playChime(msg.volume);
      break;
  }
});
