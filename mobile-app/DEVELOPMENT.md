# Mobile Development

This directory owns the Capacitor Android/iOS application.

## Scope

- `www/` contains the mobile web bundle.
- `www/mobile.js` owns Capacitor-specific behavior such as camera, filesystem, sharing, haptics, gestures, and safe-area handling.
- `android/` and future `ios/` projects are native shells generated and managed by Capacitor tooling.
- `node_modules/` and native build outputs should not be edited by hand.

## Commands

```bash
npm install
npm run sync
npm run android
npm run ios
```

For browser preview, run:

```bash
npm start
```

## Development Rules

Make mobile-only behavior here. If a shared chat or provider change is needed, port it deliberately to `web-app/` and `electron-app/` rather than copying blindly.

After editing `www/`, run `npm run sync` before opening or building the native project.
