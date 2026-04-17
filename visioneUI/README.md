# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## VBS Logging (Competition)

This UI includes browser-side VBS logging with local persistence and final export.

### What is logged

- Query snapshots with `events` and ranked `results`.
- Submission interactions (frame and text answer submissions).
- Main browsing interactions (e.g. similarity exploration, video summary open).

### Storage and export

- Logs are stored locally in browser `IndexedDB` during the session.
- At the end of the competition use `Export logs` from the status bar.
- If supported by the browser, export writes one folder per user and one file per log entry.
- File naming follows `timestamp.json` (with optional `_N` suffix only when needed to avoid collisions).

### Recommended pre-run setup

1. Open Settings and set DRES user fields (`dresUsername`, optional `dresMemberId`).
2. Select challenge type (`KIS`, `AVS`, `Q&A`).
3. In the status bar choose logging depth with the `Top ...` control:
	- `Top 100` for lightweight logging.
	- `Top 1000` for balanced logging.
	- `Top 10000` for full analysis (largest files).

### End-of-run procedure

1. Click `Export logs (...)` in the status bar.
2. Choose the destination directory when prompted.
3. Verify that exported JSON files are present in the user folder.

### Safe log deletion

Local logs can be deleted from the status bar with `Delete logs`.

To avoid accidental deletion, the UI uses safe mode:

1. Confirmation dialog with log count and user folder.
2. Manual code entry (`DELETE-<logCount>`) before deletion is executed.

Deletion affects only local browser logs for the current user folder.

### Notes

- Exported JSON payload keeps timestamp alignment: file timestamp matches JSON `timestamp`.
- If directory export is not available in the browser, a fallback download is generated.
- For best compatibility and large exports, use a Chromium-based browser.
