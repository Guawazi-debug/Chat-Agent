# AI Chat Web

Standalone browser version of the AI chat application.

## Structure

- `index.html` - Single-page app markup.
- `app.js` - Browser chat state, provider calls, rendering, storage, and UI events.
- `config.js` - API endpoints, model defaults, memory settings, and constants.
- `styles.css` - Theme variables and responsive layout styles.
- `dev-server.mjs` - Dependency-free local static server.

## Development

```bash
cd web-app
npm start
```

Open `http://localhost:8080`.

You can also open `index.html` directly in a browser for quick checks, but the local server is preferred when testing browser APIs and relative assets.

## Ownership

Develop Web-only behavior here. Do not edit `electron-app/` or `mobile-app/` unless the change is intentionally ported to those targets.
