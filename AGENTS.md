# Repository Guidelines

## Project Structure & Module Organization

This repository contains a multi-target AI chat application. `web-app/` is the standalone browser client and should be used for Web development. `electron-app/` is the Electron desktop client, with `main.js` and `preload.js` handling desktop windows, menus, IPC, and file storage. `mobile-app/` is the Capacitor client; `mobile-app/www/` contains mobile web assets, and `mobile-app/mobile.js` adds native mobile behavior. The repository root is for workspace scripts and documentation. `DEVELOPMENT.md` is the primary three-target workflow guide.

## Build, Test, and Development Commands

- Web: run `npm run web` from the repo root, or `cd web-app` then `npm start`; visit `http://localhost:8080`.
- Electron: run `cd electron-app`, `npm install`, then `npm start` for development.
- Electron build: run `npm run build` for Windows installer and portable targets, or `npm run build:portable`.
- Mobile: run `cd mobile-app`, `npm install`, `npm run sync`, then `npm run android` or `npm run ios`.
- Android setup helpers: `mobile-app/setup-android.bat` and `mobile-app/run-android.bat`.

## Coding Style & Naming Conventions

Use plain HTML, CSS, and JavaScript. Follow the existing four-space JavaScript indentation, semicolon usage, `const`/`let`, camelCase functions and variables, and uppercase global config objects such as `APP_CONFIG` and `MODEL_CONFIG`. Keep browser logic in the target's `app.js`, provider defaults in `config.js`, and visual changes in `styles.css`. Keep platform-specific changes inside the relevant target directory; port shared behavior deliberately.

## Testing Guidelines

No automated test framework or coverage target is currently configured. Validate changes manually in the affected targets: `npm run web` for Web, `npm start` inside `electron-app/` for Electron, and Capacitor sync/open for mobile. For API or storage changes, verify localStorage keys with the `ai_chat_` prefix and check Electron/Mobile persistence through the app UI.

## Commit & Pull Request Guidelines

This checkout does not include Git history, so no repository-specific commit convention can be inferred. Use short imperative commit subjects, for example `Fix mobile sidebar overlay`. Pull requests should describe the user-visible change, list tested targets and commands, link related issues, and include screenshots or screen recordings for UI changes.

## Security & Configuration Tips

Do not commit real API keys or exported chat data. API keys are intended to stay in local app storage. Treat `config.js` endpoints and provider request formats carefully, especially MiMo-specific headers and non-streaming behavior.
