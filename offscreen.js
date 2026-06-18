// Focus Tomato - offscreen audio host.
// Plays bundled ambient loops + chime, and drives a hidden YouTube embed.

const ocean = document.getElementById('ocean');
const tick = document.getElementById('tick');
const chime = document.getElementById('chime');
const yt = document.getElementById('yt');

const loops = { ocean, tick };
let currentYouTubeId = null;
let pendingVolume = 70;
let ytNudge = null;

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
  clearInterval(ytNudge);
  // about:blank is the most reliable way to fully silence the embed.
  yt.src = 'about:blank';
  currentYouTubeId = null;
}

function playYouTube(id, volume) {
  if (volume != null) pendingVolume = volume;
  if (!id) return;

  if (id !== currentYouTubeId) {
    currentYouTubeId = id;
    // Start muted: muted autoplay is always allowed by the browser. We unmute
    // via the IFrame API once it's actually playing. `loop` needs playlist=id.
    const origin = encodeURIComponent(location.origin);
    yt.src =
      `https://www.youtube.com/embed/${id}` +
      `?enablejsapi=1&autoplay=1&mute=1&loop=1&playlist=${id}` +
      `&controls=0&playsinline=1&origin=${origin}`;
  }

  // The player ignores commands until it has loaded, so nudge it a few times:
  // play, then unmute and set the real volume.
  clearInterval(ytNudge);
  let tries = 0;
  ytNudge = setInterval(() => {
    ytCommand('playVideo');
    ytCommand('unMute');
    ytCommand('setVolume', [Math.round(vol(pendingVolume) * 100)]);
    if (++tries >= 6) clearInterval(ytNudge);
  }, 800);
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
  pendingVolume = v;
  for (const a of Object.values(loops)) a.volume = vol(v);
  ytCommand('unMute');
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
