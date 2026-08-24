
# MindfulMinutes

A private, local-first Chrome extension for setting daily website limits and reviewing weekly screen-time progress.

## Features

- Add any website by domain (for example, `instagram.com`)
- Set different weekday and weekend limits
- Count time only while the website's tab is active, the Chrome window is focused, and the user is not idle
- Redirect to a friendly block page when the day's time is used up
- Reset limits automatically at local midnight
- Edit, pause, or remove limits at any time
- Show daily usage, weekly totals, goals met, and time reclaimed compared with last week
- Keep all rules and browsing-time totals in Chrome's local extension storage

## Install in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select this project folder.
5. Pin **Mindful Web Time** from the extensions menu.

Open the extension popup for today's overview. Choose **Manage limits & view progress** for the full dashboard.

## Development

There is no build step or third-party dependency. Run the logic tests with:

```powershell
npm test
```

Usage is saved for 90 days. The tracker commits active-tab time every 30 seconds and when the active tab, window focus, or idle state changes.

