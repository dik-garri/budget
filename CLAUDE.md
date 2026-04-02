# Budget App

## Overview
Mobile-first budget tracking PWA. Google Sheets as database via Google Apps Script. No backend server, no auth.

## Tech Stack
- Vanilla HTML/CSS/JS (no framework, no build step)
- Chart.js (CDN) for analytics
- Google Apps Script as REST API
- Google Sheets as database
- GitHub Pages hosting
- PWA (service worker + manifest)

## Project Structure
```
index.html          # Single-page app shell
css/style.css       # All styles, mobile-first
js/api.js           # GAS Web App fetch wrappers
js/ui.js            # DOM rendering helpers
js/charts.js        # Chart.js wrappers
js/app.js           # State, routing, events
gas/Code.gs         # Google Apps Script (deployed separately)
sw.js               # Service worker for PWA
manifest.json       # PWA manifest
icons/              # App icons (192px, 512px)
```

## Architecture
- Frontend fetches data from GAS Web App via `fetch()`
- GAS reads/writes Google Sheets (Transactions, Categories, Users)
- API URL stored in `localStorage('budget_api_url')`
- Current user stored in `localStorage('budget_user')`
- All JS modules are IIFEs: `API`, `UI`, `Charts`, `App`

## Key Patterns
- Bottom sheet modal reused for add/edit transactions
- Tab routing via CSS class toggle (`.tab-content.active`)
- Categories and users managed directly in Google Sheets
- Service worker: cache-first for assets, network-only for API calls
- Bump `CACHE_NAME` in `sw.js` when deploying changes

## Commands
- No build step. Open `index.html` or deploy to GitHub Pages.
- After changing `gas/Code.gs`: paste into Apps Script editor, deploy new version.

## Language
User communicates in Russian. UI text is in Russian.
