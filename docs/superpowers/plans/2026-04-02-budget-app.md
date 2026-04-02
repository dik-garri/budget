# Budget App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first budget tracking SPA with Google Sheets as the database.

**Architecture:** Static frontend (vanilla HTML/CSS/JS) communicates with Google Apps Script Web App which reads/writes Google Sheets. Hosted on GitHub Pages.

**Tech Stack:** Vanilla JS, Chart.js (CDN), Google Apps Script, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-04-02-budget-app-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `index.html` | Single HTML page: app shell, all view templates, bottom sheet modal |
| `css/style.css` | All styles: layout, components, mobile-first responsive, animations |
| `js/api.js` | GAS Web App communication: fetch wrappers for all endpoints |
| `js/app.js` | App state, tab routing, initialization, event wiring |
| `js/ui.js` | DOM rendering functions: transaction list, balance card, filters |
| `js/charts.js` | Chart.js wrappers: donut chart, bar chart |
| `gas/Code.gs` | Google Apps Script: doGet, doPost, sheet operations |

---

### Task 1: Google Apps Script API

**Files:**
- Create: `gas/Code.gs`

This file is deployed manually into Google Apps Script editor. It lives in the repo for reference.

- [ ] **Step 1: Write doGet handler**

```javascript
// gas/Code.gs

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // Replace after creating the sheet

function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function doGet(e) {
  const action = e.parameter.action;
  let result;

  try {
    switch (action) {
      case 'transactions':
        result = getTransactions(e.parameter.month, e.parameter.user);
        break;
      case 'categories':
        result = getCategories();
        break;
      case 'users':
        result = getUsers();
        break;
      case 'summary':
        result = getSummary(parseInt(e.parameter.months) || 6, e.parameter.user);
        break;
      default:
        result = { status: 'error', message: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { status: 'error', message: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTransactions(month, user) {
  const sheet = getSheet('Transactions');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  let filtered = rows;

  if (month && month !== 'all') {
    filtered = filtered.filter(row => String(row[1]).startsWith(month));
  }

  if (user && user !== 'all') {
    filtered = filtered.filter(row => row[5] === user);
  }

  const transactions = filtered.map(row => ({
    id: row[0],
    date: row[1],
    amount: row[2],
    type: row[3],
    category: row[4],
    user: row[5],
    comment: row[6] || ''
  }));

  return { status: 'ok', data: transactions };
}

function getCategories() {
  const sheet = getSheet('Categories');
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);

  const categories = rows.map(row => ({
    name: row[0],
    type: row[1],
    icon: row[2]
  }));

  return { status: 'ok', data: categories };
}

function getUsers() {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);

  return { status: 'ok', data: rows.map(row => row[0]) };
}

function getSummary(months, user) {
  const sheet = getSheet('Transactions');
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);

  const now = new Date();
  const summaryByMonth = {};

  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    summaryByMonth[key] = { month: key, income: 0, expense: 0, byCategory: {} };
  }

  rows.forEach(row => {
    const date = String(row[1]);
    const monthKey = date.substring(0, 7);
    if (!summaryByMonth[monthKey]) return;
    if (user && user !== 'all' && row[5] !== user) return;

    const amount = Number(row[2]);
    const type = row[3];
    const category = row[4];

    if (type === 'income') {
      summaryByMonth[monthKey].income += amount;
    } else {
      summaryByMonth[monthKey].expense += amount;
    }

    if (!summaryByMonth[monthKey].byCategory[category]) {
      summaryByMonth[monthKey].byCategory[category] = { income: 0, expense: 0 };
    }
    summaryByMonth[monthKey].byCategory[category][type] += amount;
  });

  const sorted = Object.values(summaryByMonth).sort((a, b) => a.month.localeCompare(b.month));
  return { status: 'ok', data: sorted };
}
```

- [ ] **Step 2: Write doPost handler**

Append to `gas/Code.gs`:

```javascript
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  let result;
  try {
    switch (body.action) {
      case 'addTransaction':
        result = addTransaction(body);
        break;
      case 'deleteTransaction':
        result = deleteTransaction(body.id);
        break;
      default:
        result = { status: 'error', message: 'Unknown action: ' + body.action };
    }
  } catch (err) {
    result = { status: 'error', message: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function addTransaction(body) {
  const sheet = getSheet('Transactions');
  const comment = (body.comment || '').substring(0, 100);
  sheet.appendRow([body.id, body.date, Number(body.amount), body.type, body.category, body.user, comment]);
  return { status: 'ok' };
}

function deleteTransaction(id) {
  const sheet = getSheet('Transactions');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { status: 'ok' };
    }
  }

  return { status: 'error', message: 'Transaction not found' };
}
```

- [ ] **Step 3: Commit**

```bash
git add gas/Code.gs
git commit -m "feat: add Google Apps Script API for budget app"
```

---

### Task 2: HTML Shell & CSS Foundation

**Files:**
- Create: `index.html`
- Create: `css/style.css`

- [ ] **Step 1: Write index.html with app shell**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Budget</title>
  <link rel="stylesheet" href="css/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head>
<body>
  <div id="app">
    <!-- Header -->
    <header class="header">
      <h1 class="header__title">Budget</h1>
      <select id="user-select" class="header__user-select"></select>
    </header>

    <!-- Tab: Home -->
    <main id="tab-home" class="tab-content active">
      <div class="balance-card">
        <div class="balance-card__row">
          <span class="balance-card__label">Доходы</span>
          <span id="balance-income" class="balance-card__value balance-card__value--income">0</span>
        </div>
        <div class="balance-card__row">
          <span class="balance-card__label">Расходы</span>
          <span id="balance-expense" class="balance-card__value balance-card__value--expense">0</span>
        </div>
        <div class="balance-card__row balance-card__row--total">
          <span class="balance-card__label">Баланс</span>
          <span id="balance-total" class="balance-card__value">0</span>
        </div>
      </div>

      <div class="action-buttons">
        <button id="btn-income" class="action-btn action-btn--income">+ Доход</button>
        <button id="btn-expense" class="action-btn action-btn--expense">&minus; Расход</button>
      </div>

      <section class="recent-transactions">
        <h2 class="section-title">Последние операции</h2>
        <div id="recent-list" class="transaction-list"></div>
      </section>
    </main>

    <!-- Tab: History -->
    <main id="tab-history" class="tab-content">
      <div class="month-selector">
        <button id="month-prev" class="month-selector__btn">&lt;</button>
        <span id="month-label" class="month-selector__label"></span>
        <button id="month-next" class="month-selector__btn">&gt;</button>
      </div>
      <div class="filter-chips">
        <button class="chip chip--active" data-filter="all">Все</button>
        <button class="chip" data-filter="income">Доходы</button>
        <button class="chip" data-filter="expense">Расходы</button>
      </div>
      <div class="filter-chips">
        <select id="history-user-filter" class="history-user-select">
          <option value="all">Все пользователи</option>
        </select>
      </div>
      <div id="history-list" class="transaction-list"></div>
    </main>

    <!-- Tab: Analytics -->
    <main id="tab-analytics" class="tab-content">
      <div class="analytics-charts">
        <div class="chart-card">
          <h3 class="chart-card__title">Расходы по категориям</h3>
          <canvas id="chart-donut"></canvas>
        </div>
        <div class="chart-card">
          <h3 class="chart-card__title">Доходы и расходы</h3>
          <canvas id="chart-bar"></canvas>
        </div>
      </div>
      <div id="analytics-summary" class="summary-cards"></div>
    </main>

    <!-- Bottom Sheet Modal -->
    <div id="bottom-sheet" class="bottom-sheet">
      <div class="bottom-sheet__overlay"></div>
      <div class="bottom-sheet__content">
        <div class="bottom-sheet__handle"></div>
        <h2 id="sheet-title" class="bottom-sheet__title">Новый расход</h2>

        <div id="category-grid" class="category-grid"></div>

        <div class="form-group">
          <input id="input-amount" type="number" inputmode="decimal" class="input-amount" placeholder="Сумма">
        </div>

        <div class="form-group">
          <input id="input-comment" type="text" class="input-comment" placeholder="Комментарий (необязательно)" maxlength="100">
        </div>

        <div class="form-group">
          <input id="input-date" type="date" class="input-date">
        </div>

        <button id="btn-submit" class="btn-submit">Добавить</button>
      </div>
    </div>

    <!-- Toast -->
    <div id="toast" class="toast"></div>

    <!-- Tab Bar -->
    <nav class="tab-bar">
      <button class="tab-bar__btn tab-bar__btn--active" data-tab="home">
        <span class="tab-bar__icon">&#x1F3E0;</span>
        <span class="tab-bar__label">Главная</span>
      </button>
      <button class="tab-bar__btn" data-tab="history">
        <span class="tab-bar__icon">&#x1F4CB;</span>
        <span class="tab-bar__label">История</span>
      </button>
      <button class="tab-bar__btn" data-tab="analytics">
        <span class="tab-bar__icon">&#x1F4CA;</span>
        <span class="tab-bar__label">Аналитика</span>
      </button>
    </nav>
  </div>

  <script src="js/api.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/charts.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write CSS foundation**

Write `css/style.css` with:
- CSS custom properties for colors (--color-income: #22c55e, --color-expense: #ef4444, --color-bg: #f8f9fa, --color-card: #fff, --color-text: #1a1a1a, --color-text-secondary: #6b7280, --color-border: #e5e7eb)
- System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Base reset (box-sizing, margin, padding)
- `.header` — sticky top, flex row, space-between
- `.tab-content` — hidden by default, `.tab-content.active` shown
- `.tab-bar` — fixed bottom, flex row, 3 equal buttons, 56px height, safe-area-inset-bottom padding
- `.balance-card` — rounded card with shadow, padding 16px
- `.action-buttons` — flex row, gap 12px, two equal-width buttons 56px tall
- `.action-btn--income` — green bg, `.action-btn--expense` — red bg, both white text, rounded 12px
- `.transaction-list` — list of `.transaction-item` rows (flex, icon+text left, amount right)
- `.bottom-sheet` — full-screen overlay + slide-up panel from bottom, hidden by default
- `.bottom-sheet.active` — visible with transition
- `.category-grid` — CSS grid, 4 columns, gap 8px, each cell 64px tall with emoji + small label
- `.category-grid__item.selected` — highlighted border
- `.input-amount` — large font (24px), centered, full-width, border-bottom only
- `.btn-submit` — full-width, 48px, rounded, colored by transaction type
- `.month-selector` — flex row, centered, prev/next buttons + month label
- `.filter-chips` — horizontal flex, `.chip` pill-shaped buttons
- `.chart-card` — rounded card with title + canvas
- `.summary-cards` — grid of stat cards
- `.toast` — fixed bottom (above tab bar), slide-up animation, auto-hide
- Body padding-bottom for tab bar (56px + safe area)
- All touch targets minimum 44px
- Max-width 480px centered for tablet/desktop

Full CSS file content (~300 lines) — write complete styles for all components listed above.

- [ ] **Step 3: Verify HTML renders**

```bash
open index.html
```

Visually confirm: header, empty balance card, two buttons, tab bar visible. No JS errors in console.

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: add HTML shell and CSS foundation"
```

---

### Task 3: API Module

**Files:**
- Create: `js/api.js`

- [ ] **Step 1: Write API module**

```javascript
// js/api.js
const API = (() => {
  // This URL is set after deploying GAS Web App
  const BASE_URL = localStorage.getItem('budget_api_url') || '';

  function setUrl(url) {
    localStorage.setItem('budget_api_url', url);
    location.reload();
  }

  async function get(params) {
    if (!BASE_URL) throw new Error('API URL not configured');
    const url = new URL(BASE_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { redirect: 'follow' });
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message || 'API error');
    return json.data;
  }

  async function post(body) {
    if (!BASE_URL) throw new Error('API URL not configured');
    const res = await fetch(BASE_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message || 'API error');
    return json;
  }

  function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
  }

  return {
    setUrl,
    getUrl: () => BASE_URL,
    generateId,
    getTransactions: (month, user) => get({ action: 'transactions', month: month || 'all', user: user || 'all' }),
    getCategories: () => get({ action: 'categories' }),
    getUsers: () => get({ action: 'users' }),
    getSummary: (months, user) => get({ action: 'summary', months: months || 6, user: user || 'all' }),
    addTransaction: (tx) => post({ action: 'addTransaction', ...tx }),
    deleteTransaction: (id) => post({ action: 'deleteTransaction', id })
  };
})();
```

Note: `Content-Type: 'text/plain'` avoids CORS preflight. GAS doPost parses `e.postData.contents` as JSON regardless.

- [ ] **Step 2: Commit**

```bash
git add js/api.js
git commit -m "feat: add API communication module"
```

---

### Task 4: UI Rendering Module

**Files:**
- Create: `js/ui.js`

- [ ] **Step 1: Write UI module**

```javascript
// js/ui.js
const UI = (() => {
  function formatMoney(amount) {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  function getMonthLabel(yearMonth) {
    const [y, m] = yearMonth.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1);
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  }

  function renderBalanceCard(transactions) {
    let income = 0, expense = 0;
    transactions.forEach(tx => {
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    });
    document.getElementById('balance-income').textContent = formatMoney(income);
    document.getElementById('balance-expense').textContent = formatMoney(expense);
    const total = income - expense;
    const el = document.getElementById('balance-total');
    el.textContent = (total >= 0 ? '+' : '') + formatMoney(total);
    el.className = 'balance-card__value ' + (total >= 0 ? 'balance-card__value--income' : 'balance-card__value--expense');
  }

  function renderTransactionList(container, transactions, categoryMap, options = {}) {
    container.innerHTML = '';
    if (transactions.length === 0) {
      container.innerHTML = '<div class="empty-state">Нет операций</div>';
      return;
    }

    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const items = options.limit ? sorted.slice(0, options.limit) : sorted;

    let currentDate = '';
    items.forEach(tx => {
      if (tx.date !== currentDate && !options.limit) {
        currentDate = tx.date;
        const dateHeader = document.createElement('div');
        dateHeader.className = 'transaction-date-header';
        dateHeader.textContent = formatDate(tx.date);
        container.appendChild(dateHeader);
      }

      const cat = categoryMap[tx.category] || { icon: '📦', name: tx.category };
      const item = document.createElement('div');
      item.className = 'transaction-item';
      item.dataset.id = tx.id;

      const sign = tx.type === 'income' ? '+' : '-';
      const colorClass = tx.type === 'income' ? 'transaction-item__amount--income' : 'transaction-item__amount--expense';

      item.innerHTML = `
        <div class="transaction-item__main">
          <span class="transaction-item__icon">${cat.icon}</span>
          <div class="transaction-item__info">
            <span class="transaction-item__category">${cat.name}</span>
            <span class="transaction-item__meta">${tx.user}${tx.comment ? ' · ' + tx.comment : ''}</span>
          </div>
          <span class="transaction-item__amount ${colorClass}">${sign}${formatMoney(tx.amount)}</span>
        </div>
        <div class="transaction-item__actions">
          <button class="btn-delete" data-id="${tx.id}">Удалить</button>
        </div>
      `;

      if (options.expandable) {
        item.querySelector('.transaction-item__main').addEventListener('click', () => {
          item.classList.toggle('expanded');
        });
      }

      container.appendChild(item);
    });
  }

  function renderCategoryGrid(container, categories, onSelect) {
    container.innerHTML = '';
    let selectedEl = null;

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-grid__item';
      btn.innerHTML = `<span class="category-grid__icon">${cat.icon}</span><span class="category-grid__label">${cat.name}</span>`;
      btn.addEventListener('click', () => {
        if (selectedEl) selectedEl.classList.remove('selected');
        btn.classList.add('selected');
        selectedEl = btn;
        onSelect(cat.name);
      });
      container.appendChild(btn);
    });
  }

  function renderUserSelect(selectEl, users, current) {
    selectEl.innerHTML = '';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      if (u === current) opt.selected = true;
      selectEl.appendChild(opt);
    });
  }

  function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), duration);
  }

  function showLoading(container) {
    container.innerHTML = '<div class="loading-spinner"></div>';
  }

  return {
    formatMoney,
    formatDate,
    getMonthLabel,
    renderBalanceCard,
    renderTransactionList,
    renderCategoryGrid,
    renderUserSelect,
    showToast,
    showLoading
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/ui.js
git commit -m "feat: add UI rendering module"
```

---

### Task 5: Charts Module

**Files:**
- Create: `js/charts.js`

- [ ] **Step 1: Write charts module**

```javascript
// js/charts.js
const Charts = (() => {
  let donutChart = null;
  let barChart = null;

  const COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#78716c'
  ];

  function renderDonut(canvasId, summaryData) {
    const canvas = document.getElementById(canvasId);
    if (donutChart) donutChart.destroy();

    // Aggregate expense by category across all months
    const byCat = {};
    summaryData.forEach(month => {
      Object.entries(month.byCategory || {}).forEach(([cat, vals]) => {
        byCat[cat] = (byCat[cat] || 0) + (vals.expense || 0);
      });
    });

    const entries = Object.entries(byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      canvas.style.display = 'none';
      return;
    }
    canvas.style.display = '';

    donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: entries.map(([k]) => k),
        datasets: [{
          data: entries.map(([, v]) => v),
          backgroundColor: COLORS.slice(0, entries.length)
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } }
        }
      }
    });
  }

  function renderBar(canvasId, summaryData) {
    const canvas = document.getElementById(canvasId);
    if (barChart) barChart.destroy();

    if (summaryData.length === 0) {
      canvas.style.display = 'none';
      return;
    }
    canvas.style.display = '';

    barChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: summaryData.map(m => {
          const [y, mo] = m.month.split('-');
          return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('ru-RU', { month: 'short' });
        }),
        datasets: [
          {
            label: 'Доходы',
            data: summaryData.map(m => m.income),
            backgroundColor: '#22c55e'
          },
          {
            label: 'Расходы',
            data: summaryData.map(m => m.expense),
            backgroundColor: '#ef4444'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true }
        },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } }
        }
      }
    });
  }

  function renderSummaryCards(container, summaryData) {
    // Current month is last in array
    const current = summaryData[summaryData.length - 1];
    if (!current) {
      container.innerHTML = '';
      return;
    }

    const topCategory = Object.entries(current.byCategory || {})
      .filter(([, v]) => v.expense > 0)
      .sort((a, b) => b[1].expense - a[1].expense)[0];

    const daysInMonth = new Date(
      parseInt(current.month.split('-')[0]),
      parseInt(current.month.split('-')[1]),
      0
    ).getDate();
    const avgDaily = current.expense / daysInMonth;
    const savingsRate = current.income > 0
      ? Math.round((current.income - current.expense) / current.income * 100)
      : 0;

    container.innerHTML = `
      <div class="summary-card">
        <div class="summary-card__label">Топ расходов</div>
        <div class="summary-card__value">${topCategory ? topCategory[0] : '—'}</div>
      </div>
      <div class="summary-card">
        <div class="summary-card__label">Среднее в день</div>
        <div class="summary-card__value">${UI.formatMoney(Math.round(avgDaily))}</div>
      </div>
      <div class="summary-card">
        <div class="summary-card__label">Сбережения</div>
        <div class="summary-card__value">${savingsRate}%</div>
      </div>
    `;
  }

  return { renderDonut, renderBar, renderSummaryCards };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/charts.js
git commit -m "feat: add Chart.js wrapper for analytics"
```

---

### Task 6: App Main Module — State, Routing, Events

**Files:**
- Create: `js/app.js`

- [ ] **Step 1: Write app.js — state and initialization**

```javascript
// js/app.js
const App = (() => {
  // State
  let currentTab = 'home';
  let currentUser = localStorage.getItem('budget_user') || '';
  let currentMonth = new Date().toISOString().slice(0, 7); // "2026-04"
  let transactions = [];
  let categories = [];
  let users = [];
  let categoryMap = {}; // name -> {icon, type}
  let sheetType = ''; // 'income' or 'expense' for bottom sheet
  let selectedCategory = '';

  // --- Tab routing ---
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.querySelectorAll('.tab-bar__btn').forEach(el => {
      el.classList.toggle('tab-bar__btn--active', el.dataset.tab === tab);
    });

    if (tab === 'home') loadHome();
    if (tab === 'history') loadHistory();
    if (tab === 'analytics') loadAnalytics();
  }

  // --- Data loading ---
  async function loadInitialData() {
    try {
      [categories, users] = await Promise.all([
        API.getCategories(),
        API.getUsers()
      ]);
      categoryMap = {};
      categories.forEach(c => { categoryMap[c.name] = c; });

      if (users.length > 0) {
        if (!currentUser || !users.includes(currentUser)) {
          currentUser = users[0];
          localStorage.setItem('budget_user', currentUser);
        }
        UI.renderUserSelect(document.getElementById('user-select'), users, currentUser);
      }

      await loadHome();
    } catch (err) {
      UI.showToast('Ошибка загрузки: ' + err.message);
    }
  }

  async function loadHome() {
    try {
      transactions = await API.getTransactions(currentMonth, 'all');
      UI.renderBalanceCard(transactions);
      const recentList = document.getElementById('recent-list');
      UI.renderTransactionList(recentList, transactions, categoryMap, { limit: 5 });
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    }
  }

  async function loadHistory() {
    document.getElementById('month-label').textContent = UI.getMonthLabel(currentMonth);
    // Populate user filter
    const userSelect = document.getElementById('history-user-filter');
    if (userSelect.options.length <= 1) {
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u;
        opt.textContent = u;
        userSelect.appendChild(opt);
      });
    }
    const list = document.getElementById('history-list');
    UI.showLoading(list);

    try {
      transactions = await API.getTransactions(currentMonth, 'all');
      UI.renderTransactionList(list, transactions, categoryMap, { expandable: true });
      bindDeleteButtons(list);
      applyHistoryFilter();
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    }
  }

  function applyHistoryFilter() {
    const active = document.querySelector('.chip.chip--active');
    const typeFilter = active ? active.dataset.filter : 'all';
    const userFilter = document.getElementById('history-user-filter').value;
    const list = document.getElementById('history-list');

    let filtered = transactions;
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.type === typeFilter);
    }
    if (userFilter !== 'all') {
      filtered = filtered.filter(tx => tx.user === userFilter);
    }
    UI.renderTransactionList(list, filtered, categoryMap, { expandable: true });
    bindDeleteButtons(list);
  }

  async function loadAnalytics() {
    try {
      const summary = await API.getSummary(6, currentUser);
      Charts.renderDonut('chart-donut', summary);
      Charts.renderBar('chart-bar', summary);
      Charts.renderSummaryCards(document.getElementById('analytics-summary'), summary);
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    }
  }

  // --- Bottom sheet ---
  function openSheet(type) {
    sheetType = type;
    selectedCategory = '';
    const sheet = document.getElementById('bottom-sheet');
    document.getElementById('sheet-title').textContent = type === 'income' ? 'Новый доход' : 'Новый расход';

    const filtered = categories.filter(c => c.type === type);
    UI.renderCategoryGrid(document.getElementById('category-grid'), filtered, (name) => {
      selectedCategory = name;
    });

    document.getElementById('input-amount').value = '';
    document.getElementById('input-comment').value = '';
    document.getElementById('input-date').value = new Date().toISOString().slice(0, 10);

    sheet.classList.add('active');
    setTimeout(() => document.getElementById('input-amount').focus(), 300);
  }

  function closeSheet() {
    document.getElementById('bottom-sheet').classList.remove('active');
  }

  async function submitTransaction() {
    const amount = parseFloat(document.getElementById('input-amount').value);
    if (!amount || amount <= 0) {
      UI.showToast('Введите сумму');
      return;
    }
    if (!selectedCategory) {
      UI.showToast('Выберите категорию');
      return;
    }

    const tx = {
      id: API.generateId(),
      date: document.getElementById('input-date').value,
      amount: amount,
      type: sheetType,
      category: selectedCategory,
      user: currentUser,
      comment: document.getElementById('input-comment').value.trim()
    };

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      await API.addTransaction(tx);
      closeSheet();
      UI.showToast('Добавлено!');
      switchTab(currentTab); // reload current tab
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Добавить';
    }
  }

  // --- Delete ---
  function bindDeleteButtons(container) {
    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Удалить операцию?')) return;

        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          await API.deleteTransaction(id);
          UI.showToast('Удалено');
          switchTab(currentTab);
        } catch (err) {
          UI.showToast('Ошибка: ' + err.message);
          btn.disabled = false;
        }
      });
    });
  }

  // --- Month navigation ---
  function changeMonth(delta) {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    currentMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    loadHistory();
  }

  // --- Init ---
  function init() {
    // Check API URL
    if (!API.getUrl()) {
      const url = prompt('Введите URL Google Apps Script Web App:');
      if (url) API.setUrl(url);
      return;
    }

    // Tab navigation
    document.querySelectorAll('.tab-bar__btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Action buttons
    document.getElementById('btn-income').addEventListener('click', () => openSheet('income'));
    document.getElementById('btn-expense').addEventListener('click', () => openSheet('expense'));

    // Bottom sheet
    document.querySelector('.bottom-sheet__overlay').addEventListener('click', closeSheet);
    document.getElementById('btn-submit').addEventListener('click', submitTransaction);

    // User select
    document.getElementById('user-select').addEventListener('change', (e) => {
      currentUser = e.target.value;
      localStorage.setItem('budget_user', currentUser);
      switchTab(currentTab);
    });

    // Month navigation
    document.getElementById('month-prev').addEventListener('click', () => changeMonth(-1));
    document.getElementById('month-next').addEventListener('click', () => changeMonth(1));

    // Filter chips
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip--active'));
        chip.classList.add('chip--active');
        applyHistoryFilter();
      });
    });

    // History user filter
    document.getElementById('history-user-filter').addEventListener('change', applyHistoryFilter);

    // Refresh on visibility
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) switchTab(currentTab);
    });

    loadInitialData();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { switchTab };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/app.js
git commit -m "feat: add main app module with routing, state, and events"
```

---

### Task 7: Complete CSS Styles

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Write complete CSS**

Write the full `css/style.css` file with all component styles as specified in Task 2 Step 2. This is separated into its own task because it requires seeing the actual HTML structure from Tasks 2 and 6 to be precise.

Key additions beyond the foundation:
- `.transaction-item__actions` — hidden by default, shown when `.expanded`
- `.btn-delete` — red text button inside expanded row
- `.transaction-date-header` — sticky date header in history list
- `.loading-spinner` — CSS-only spinner animation
- `.empty-state` — centered gray text
- `.bottom-sheet__content` — max-height 85vh, overflow-y auto
- `.bottom-sheet__handle` — small gray pill at top for visual affordance
- `.history-user-select` — styled select for user filter in history tab
- Transitions: bottom-sheet slide-up 300ms, toast slide-up 200ms, chip color 150ms
- Media query for tablets: center content with max-width

- [ ] **Step 2: Verify all views render correctly**

```bash
open index.html
```

Check all 3 tabs, bottom sheet, toast. No broken layouts.

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: complete all CSS styles for budget app"
```

---

### Task 8: Setup Instructions & Initial Commit

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README with setup instructions**

```markdown
# Budget

Simple mobile-first budget tracking app. Google Sheets as database.

## Setup

### 1. Create Google Spreadsheet

Create a new Google Spreadsheet with 3 sheets:

- **Transactions** — headers in row 1: `id`, `date`, `amount`, `type`, `category`, `user`, `comment`
- **Categories** — headers in row 1: `name`, `type`, `icon`. Pre-populate with categories (see below).
- **Users** — header in row 1: `name`. Add user names.

Default categories to add:

| name | type | icon |
|------|------|------|
| Зарплата | income | 💰 |
| Фриланс | income | 💻 |
| Подарок | income | 🎁 |
| Другое | income | 📥 |
| Еда | expense | 🍔 |
| Транспорт | expense | 🚌 |
| Жильё | expense | 🏠 |
| Развлечения | expense | 🎮 |
| Здоровье | expense | 💊 |
| Одежда | expense | 👕 |
| Связь | expense | 📱 |
| Подписки | expense | 📺 |
| Другое | expense | 📤 |

### 2. Deploy Google Apps Script

1. Open the spreadsheet → Extensions → Apps Script
2. Copy contents of `gas/Code.gs` into the script editor
3. Replace `YOUR_SPREADSHEET_ID` with your spreadsheet ID (from the URL)
4. Deploy → New deployment → Web app → "Anyone" access
5. Copy the deployment URL

### 3. Run the app

1. Open `index.html` in a browser (or deploy to GitHub Pages)
2. On first load, paste the GAS Web App URL when prompted
3. Start tracking!
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add setup instructions"
```

---

### Task 9: End-to-End Manual Test

- [ ] **Step 1: Create a test Google Spreadsheet**

Follow README instructions to create the spreadsheet, deploy GAS, and get the URL.

- [ ] **Step 2: Open app and configure**

Open `index.html` in Chrome mobile emulator (DevTools → Toggle Device Toolbar → iPhone 12 Pro). Enter the GAS URL when prompted.

- [ ] **Step 3: Verify all functionality**

1. Home tab: balance shows 0/0/0, user dropdown works
2. Add income: tap "+ Доход" → select category → enter amount → submit → appears in recent list
3. Add expense: tap "- Расход" → select category → enter amount → submit → balance updates
4. History tab: transactions visible, month navigation works, filter chips work
5. Delete: tap transaction → tap delete → confirm → removed
6. Analytics: charts render with data, summary cards show values

- [ ] **Step 4: Fix any issues found**

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: address issues found in manual testing"
```
