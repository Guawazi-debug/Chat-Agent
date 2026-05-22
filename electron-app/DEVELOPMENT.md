# Electron Development

This directory owns the desktop application.

## Scope

- `main.js` owns Electron windows, menus, dialogs, app lifecycle, and IPC handlers.
- `preload.js` exposes the safe renderer bridge through `contextBridge`.
- `index.html`, `app.js`, `config.js`, and `styles.css` are the desktop renderer copy.
- `dist/` is generated output and should not be edited by hand.

## Commands

```bash
npm install
npm start
npm run build
npm run build:portable
```

## Development Rules

Make Electron-only behavior here. If a renderer change should also ship on Web or Mobile, port it explicitly to `web-app/` and/or `mobile-app/www/` and verify each target.

Desktop persistence should continue to use Electron IPC and `app.getPath('userData')`. Do not store secrets or exported chat data in source files.
