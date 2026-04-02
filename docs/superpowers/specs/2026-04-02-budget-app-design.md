# Budget App — Design Spec

## Overview

A simple, mobile-first budget tracking web app for multiple users. No authentication, no backend server. Google Spreadsheet serves as the database, accessed via Google Apps Script deployed as a Web App. Frontend is static HTML/CSS/JS hosted on GitHub Pages.

## Goals

- Track income and expenses by category
- Support multiple users (no auth — user selected from dropdown, saved in localStorage)
- Add transactions in 1-2 taps
- Provide analytics: category breakdown, monthly trends
- Pleasant mobile-first UI

## Non-Goals

- Authentication / security
- Offline support
- Multi-currency
- Recurring transactions
- Budget limits / alerts

## Architecture

```
┌──────────────┐     fetch()      ┌──────────────────┐      Sheets API     ┌─────────────────┐
│   Frontend   │ ───────────────► │ Google Apps Script│ ──────────────────► │ Google Sheets   │
│  (GitHub     │ ◄─────────────── │   (Web App)       │ ◄────────────────── │  (Database)     │
│   Pages)     │     JSON          └──────────────────┘                     └─────────────────┘
└──────────────┘
```

### Frontend (Static SPA)

- **Stack:** Vanilla HTML, CSS, JavaScript. No build step, no framework.
- **Charts:** Chart.js loaded from CDN.
- **Hosting:** GitHub Pages from the `main` branch `/` root.
- **Structure:**
  ```
  /
  ├── index.html          # Single HTML file with all views
  ├── css/
  │   └── style.css       # All styles
  ├── js/
  │   ├── app.js          # Main app logic, routing, state
  │   ├── api.js          # Communication with GAS Web App
  │   ├── ui.js           # DOM manipulation helpers
  │   └── charts.js       # Chart.js wrapper for analytics
  ├── gas/
  │   └── Code.gs         # Google Apps Script source (for reference)
  └── docs/
      └── superpowers/
          └── specs/
              └── this file
  ```

### Google Apps Script (Web App API)

Deployed as a Web App with "Anyone" access. Provides two endpoints via `doGet` and `doPost`:

**GET endpoints** (via `action` query parameter):
- `?action=transactions&month=2026-04&user=all` — fetch transactions (filterable)
- `?action=categories` — fetch all categories
- `?action=users` — fetch all users
- `?action=summary&month=2026-04&user=all` — monthly summary (totals by category)

**POST endpoints** (via JSON body `action` field):
- `{action: "addTransaction", date, amount, type, category, user, comment}` — add transaction
- `{action: "deleteTransaction", rowIndex}` — delete transaction by row

**Response format:**
```json
{
  "status": "ok",
  "data": [...]
}
```

### Google Spreadsheet Structure

**Sheet: "Transactions"**
| Column | Type | Description |
|--------|------|-------------|
| date | string (YYYY-MM-DD) | Transaction date |
| amount | number | Positive for income, negative for expense |
| type | string | "income" or "expense" |
| category | string | Category name |
| user | string | User name |
| comment | string | Optional comment |

**Sheet: "Categories"**
| Column | Type | Description |
|--------|------|-------------|
| name | string | Category display name |
| type | string | "income" or "expense" |
| icon | string | Emoji icon |

Pre-populated default categories:
- Income: Зарплата 💰, Фриланс 💻, Подарок 🎁, Другое 📥
- Expense: Еда 🍔, Транспорт 🚌, Жильё 🏠, Развлечения 🎮, Здоровье 💊, Одежда 👕, Связь 📱, Подписки 📺, Другое 📤

**Sheet: "Users"**
| Column | Type | Description |
|--------|------|-------------|
| name | string | User display name |

Pre-populated: can be edited directly in the spreadsheet.

## UI Design

### Layout

Single-page app with bottom tab navigation (3 tabs):

```
┌─────────────────────────────┐
│        Header / Balance      │
├─────────────────────────────┤
│                              │
│        Content Area          │
│     (changes per tab)        │
│                              │
├─────────────────────────────┤
│  🏠 Home  │ 📋 History │ 📊 Analytics │
└─────────────────────────────┘
```

### Tab 1: Home (Default)

- **Balance card** at top: shows current month's income, expenses, and net balance
- **User selector**: dropdown in header, persisted to localStorage
- **Two large buttons**: "+ Доход" (green) and "- Расход" (red)
- **Recent transactions**: last 5 entries as a compact list

### Add Transaction Flow

Tapping "+ Доход" or "- Расход" opens a bottom sheet modal:

1. **Category grid** — 3-4 columns of emoji+label buttons. One tap to select.
2. **Amount input** — large numeric input, auto-focused. Numpad on mobile.
3. **Comment** — optional text input, collapsed by default.
4. **Date** — defaults to today, tappable to change.
5. **Submit** — large "Добавить" button.

Total interaction: tap button → tap category → type amount → tap submit = **3-4 taps**.

### Tab 2: History

- **Month selector** at top (< April 2026 >)
- **Filter chips**: by user, by type (income/expense)
- **Transaction list**: grouped by date, showing icon + category + amount + user
- **Swipe to delete** on each transaction (with confirmation)

### Tab 3: Analytics

- **Month/period selector** at top
- **Donut chart**: expense breakdown by category
- **Bar chart**: income vs expense by month (last 6 months)
- **Summary cards**: top spending category, average daily spend, savings rate

### Visual Style

- Clean, minimal design with rounded cards
- Color palette: white background, soft grays, green for income, red for expenses
- Large touch targets (min 44px)
- System font stack (no custom fonts to load)
- Smooth transitions between views
- Dark mode: not in v1

## Data Flow

### Adding a Transaction
1. User fills form in bottom sheet
2. Frontend sends POST to GAS Web App
3. GAS appends row to "Transactions" sheet
4. GAS returns success response
5. Frontend updates local state and UI optimistically

### Loading Data
1. On app load, frontend fetches categories, users, and current month transactions
2. Data is cached in memory; refreshed on tab focus or manual pull
3. Analytics tab fetches summary data when opened

## Error Handling

- Network errors: show toast notification "Ошибка сети, попробуйте ещё раз"
- GAS errors: show toast with error message from response
- Loading states: skeleton/spinner while data loads
- No retry logic (user can manually retry)

## Limitations

- Google Apps Script has a ~6-second execution limit for simple operations (sufficient)
- GAS Web App has daily quotas (~20,000 requests/day — more than enough)
- No real-time sync between users (data refreshed on load/focus)
- Concurrent writes could theoretically conflict but extremely unlikely with 2-3 users
