# Privacy Policy - Focus Tomato

_Last updated: 2026-06-17_

Focus Tomato is designed to be private by default.

## What we collect

**Nothing.** Focus Tomato does not collect, store on any server, transmit, sell, or share any personal data or usage data. There are no accounts, no analytics, and no tracking.

## What is stored, and where

The extension saves the following **only in your own browser**, using Chrome's `storage` API:

- Your settings (session lengths, long-break interval, auto-start, default sound, volume).
- Your to-do list and the daily completed-session count.
- The current timer state.

Settings may sync across your own devices if you are signed into Chrome with sync enabled - this stays within your Google account and is never sent to us.

## External connections

The only external connection happens when **you** choose a **YouTube link** as your focus sound. In that case the extension loads YouTube's standard embedded player to play your chosen video. This connection is governed by [Google's Privacy Policy](https://policies.google.com/privacy). If you use the built-in ocean or clock-tick sounds, no external connection is made.

## Permissions

- `alarms` - run the timer in the background.
- `notifications` - alert you when a session ends.
- `storage` - save your settings, tasks, and timer state locally.
- `offscreen` - play audio (service workers cannot play sound directly).
- access to `youtube.com` - only to embed the player when you pick a YouTube sound.

## Contact

Questions? Open an issue on the project's GitHub repository.
