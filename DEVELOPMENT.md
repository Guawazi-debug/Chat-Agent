# Multi-Target Development Guide

This repository is organized as three independently developed app targets plus a root-level coordination area.

## App Targets

- `web-app/` - Standalone browser app. Use this for Web-only UI, browser storage, and provider behavior.
- `electron-app/` - Windows desktop app built with Electron. Use this for desktop menus, IPC, filesystem persistence, import/export dialogs, and packaging.
- `mobile-app/` - Capacitor app for Android/iOS. Use this for native mobile plugins, camera/filesystem integration, touch behavior, and safe-area handling.

The repository root is for workspace scripts and documentation. Do not add runtime Web source files to the root; Web development should happen in `web-app/`.

## Commands

```bash
# Web
cd web-app
npm start

# Desktop
cd electron-app
npm install
npm start
npm run build

# Mobile
cd mobile-app
npm install
npm run sync
npm run android
```

## Development Rules

Keep target-specific changes inside the target directory. If a behavior should exist in multiple targets, apply and verify it in each target explicitly instead of relying on implicit file copying.

Shared concepts such as model IDs, storage keys, and provider request formats should stay consistent across targets. When changing these contracts, update all affected `config.js` and `app.js` copies deliberately and document which targets were verified.

Generated output should remain out of normal edits: `node_modules/`, `electron-app/dist/`, Capacitor/Android build output, and packaged installers.
