# 🍅 Focus Tomato

A simple, private Pomodoro timer for Chrome with a built-in to-do list, ambient focus sounds, and optional YouTube background audio.

No accounts. No tracking. Works offline (except YouTube playback).

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)

## Features

- **Three modes:** Focus, Short break, Long break, with configurable lengths.
- **Runs in the background:** the timer keeps counting even when the popup is closed, and shows the minutes remaining right on the toolbar icon.
- **Notification + chime** at the end of every session, with quick **Start break / Skip** buttons.
- **Focus sounds:** built-in **ocean waves** and **clock tick** (offline), or paste a **YouTube link** to play any ambience/lofi stream in the background.
- **Built-in to-do list:** jot down what you want to get done this cycle and check items off. Tasks persist across restarts.
- **Daily count:** a small "🍅 N today" tracker for motivation.
- **Keyboard shortcuts:** start/pause without opening the popup.
- **Dark + light theme** (follows your system).

## Install

### From source (load unpacked)

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `pomodoro-extension` folder.
5. Pin the 🍅 icon to your toolbar.

### Chrome Web Store

_(Coming soon - link will go here once published.)_

## Usage

- Click the 🍅 icon, pick a mode, and hit **Start**.
- Choose a **Focus sound** from the dropdown. For YouTube, paste any link (e.g. an ocean-ambience or lofi live stream); it plays hidden in the background.
- Add tasks in **This cycle** and check them off as you go.
- Adjust durations, the long-break interval, auto-start, and default sound under **Settings**.

### Keyboard shortcuts

| Action       | macOS         | Windows / Linux  |
| ------------ | ------------- | ---------------- |
| Start/resume | `Ctrl+Cmd+S`  | `Ctrl+Shift+S`   |
| Pause        | `Ctrl+Cmd+D`  | `Ctrl+Shift+D`   |

Rebind them at `chrome://extensions/shortcuts`. Note: on some macOS setups `Ctrl+Cmd+D` is reserved by the system ("look up word"); if it doesn't work, just rebind it.

## Notes on YouTube audio

YouTube playback is an embedded player, so it needs an internet connection and **may show ads** unless you have YouTube Premium. The built-in ocean and clock-tick sounds always work offline with no ads.

## Privacy

Everything is stored locally in your browser. The extension collects, sends, and shares **no data**. See [PRIVACY.md](PRIVACY.md). The only external connection is to YouTube, and only when you choose a YouTube link as your focus sound.

## Tech

Manifest V3. The timer lives in a background service worker (`chrome.alarms`); audio plays from an offscreen document (`chrome.offscreen`) because service workers can't play sound. No build step, no dependencies.

## License

[MIT](LICENSE)
