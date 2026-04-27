# Debts Feature — Design

**Date:** 2026-04-27
**Status:** Approved by user, pending spec review

## Goal

Add ability to track money lent to others and money borrowed from others. Each debt and each repayment must affect the user's balance (the operation is real cash flow), but debts must also live as first-class entities with their own dedicated tab so the user can quickly see "who owes me / whom I owe."

## Non-goals

- Multi-currency support.
- Reminders / notifications about overdue debts.
- Manual partial write-off / forgiveness flow (workaround: add a `DebtPayment` for the remaining amount with a comment).
- Reports or analytics specifically about debts beyond what the existing analytics tab provides.
- Editing of `DebtPayments` (delete and re-create instead).
- Per-person aggregation views (each debt is shown as a separate row).

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Hybrid model: debts are a separate entity AND each debt operation creates a corresponding `Transactions` row that affects the balance. | User wants both: balance must reflect the cash movement, but a quick overview of who owes whom is also required. |
| 2 | Counterparty stored as free text (no contacts list). | Simplest approach; aligns with the project's no-build-step minimalism. Risk of typos splitting one person's debts is acceptable for a personal app. |
| 3 | Each debt is its own entity (not just an aggregated stream of operations). Repayments are linked to a specific debt. | User wants to see "balance of this specific debt" with auto-close when fully repaid. |
| 4 | Debt-related transactions appear in the regular History and Analytics tabs. | User explicitly chose this — debts represent real cash flow and should be visible alongside other spending. |
| 5 | Dedicated 4th bottom-bar tab "Долги". | User chose this over an inline section on Home or an overlay screen. |
| 6 | Debts listed individually (no per-person grouping). | User chose flat list over grouping. |
| 7 | Status (`active` / `closed`) is computed on read, not stored. | Avoids drift if a payment is added/removed; single source of truth. |
| 8 | Transactions auto-created from debt operations cannot be edited or deleted from the History tab. Edit redirects to debt editor; delete is disabled. | Prevents desynchronization between `Debts` and `Transactions`. |
| 9 | The "Долги" category is hidden from the regular add-transaction category grid. | Forces all debt-category usage to go through the Debts tab, preventing accidental orphan transactions. |
| 10 | `Transactions.id` for debt-derived rows = the corresponding `Debts.id` or `DebtPayments.id`. | Avoids adding a second `payment_id` column; lookup by id finds both rows. |

## Data model

### New sheet: `Debts`

| column | type | notes |
|---|---|---|
| `id` | string (uuid) | client-generated |
| `counterparty` | string | free text, max 50 chars |
| `type` | enum | `lent` (I gave money) or `borrowed` (I took money) |
| `amount` | number | original debt amount, > 0 |
| `date` | date (YYYY-MM-DD) | when the debt was created |
| `comment` | string | optional, max 100 chars |

`status` is **not** stored — computed on read as `active` if `sum(payments.amount) < amount`, else `closed`.

### New sheet: `DebtPayments`

| column | type | notes |
|---|---|---|
| `id` | string (uuid) | client-generated |
| `debt_id` | string | foreign key to `Debts.id` |
| `amount` | number | > 0; for `lent` debts this is money received back, for `borrowed` debts this is money paid back |
| `date` | date | when the payment occurred |
| `comment` | string | optional, max 100 chars |

### Sheet migration: `Transactions`

Add an 8th column `debt_id` (string, may be empty). Empty for regular transactions; populated for transactions auto-created from debt operations.

For debt-derived rows:
- `Transactions.id` equals `Debts.id` (for the initial debt creation) **or** `DebtPayments.id` (for repayments). This dual-purpose id is what allows id-based deletion to find the paired row.
- `Transactions.category` = `"Долги"` for both creation and repayment rows.
- `Transactions.type`:
  - For `Debt(type=lent)` creation → `expense` (money leaves my wallet).
  - For `DebtPayment` of a `lent` debt → `income` (money returns to my wallet).
  - For `Debt(type=borrowed)` creation → `income` (money arrives in my wallet).
  - For `DebtPayment` of a `borrowed` debt → `expense` (money leaves my wallet).
- `Transactions.comment` = the `counterparty` name (for readability in History feed: "🤝 Маша −5000").

### Auto-managed category

On the first `addDebt` call (or via lazy creation), GAS ensures the `Categories` sheet contains:
- `(name="Долги", type="expense", icon="🤝")`
- `(name="Долги", type="income", icon="🤝")`

The frontend hides the "Долги" category from the regular add-transaction `category-grid` to prevent users from creating orphan debt-categorized transactions outside the Debts flow.

## API (GAS endpoints)

All write endpoints use `LockService` and run their multi-row writes atomically inside the lock.

### GET

- `getDebts()` — returns array of `{ id, counterparty, type, amount, date, comment, paid, status }` where `paid = sum(payments)` and `status = paid >= amount ? 'closed' : 'active'`. Computed server-side.
- `getDebtPayments(debt_id)` — returns array of `{ id, debt_id, amount, date, comment }`.

### POST

- `addDebt({ id, counterparty, type, amount, date, comment })`
  → Lock. Append to `Debts`. Append to `Transactions` (using the same `id`, `debt_id = id`, type/category as defined above). Ensure "Долги" category exists in `Categories`.

- `editDebt({ id, counterparty, type, amount, date, comment })`
  → Lock. Update row in `Debts`. Find row in `Transactions` where `id == body.id` and update its `amount`, `date`, `type` (in case `type` changed: `lent` ↔ `borrowed` flips expense/income), `comment` (= counterparty).

- `deleteDebt({ id })`
  → Lock.
  1. Find all `Transactions` rows where `debt_id == id` → delete (bottom-up to avoid index shifts).
  2. Find all `DebtPayments` rows where `debt_id == id` → delete (bottom-up).
  3. Delete the `Debts` row.

- `addDebtPayment({ id, debt_id, amount, date, comment })`
  → Lock. Verify `debt_id` exists in `Debts`. Append to `DebtPayments`. Append to `Transactions` (using same `id`, `debt_id = body.debt_id`, type opposite to the parent debt's type, category `"Долги"`, comment = parent's `counterparty`).

- `deleteDebtPayment({ id })`
  → Lock. Delete row from `DebtPayments` where `id == body.id`. Delete row from `Transactions` where `id == body.id`.

### Frontend wrapper (`js/api.js`)

Add: `getDebts`, `getDebtPayments(debtId)`, `addDebt(debt)`, `editDebt(debt)`, `deleteDebt(id)`, `addDebtPayment(payment)`, `deleteDebtPayment(id)`.

## UI

### Bottom navigation

Add a 4th tab button: `data-tab="debts"`, icon `🤝`, label `Долги`.

### `tab-debts` content

```
┌─ Сводка ────────────────────────┐
│ ┌──────────────┬─────────────┐ │
│ │ Должны мне   │ Я должен    │ │
│ │  +12 000     │  −5 000     │ │
│ └──────────────┴─────────────┘ │
└─────────────────────────────────┘

[+ Дал в долг]   [+ Взял в долг]

Фильтр: [ Все ] [ Активные ] [ Закрытые ]

── Активные ────────
┌─ 🤝 Маша                    ↗ ┐
│ +5 000 / 5 000 • 27 апр       │
│ "на ремонт авто"              │
└───────────────────────────────┘
…

── Закрытые ────── (свёрнуто)
[ Показать ]
```

Each card displays:
- Direction arrow: `↗` for `lent`, `↙` for `borrowed`.
- Counterparty name.
- Progress: `paid / amount` with color (green if `lent`, red if `borrowed`).
- Date created.
- Comment (if non-empty).

Tap on a card → expands to show:
- List of `DebtPayments` for that debt (each with `× delete` button).
- Button `+ Добавить возврат` (for `lent`) / `+ Добавить выплату` (for `borrowed`).
- Buttons `Редактировать` / `Удалить` for the debt itself.

Sort: active debts on top (date desc), closed section is collapsed by default.

### Bottom sheets

Reuse existing bottom-sheet styling. Two new variants:

**New debt sheet** (opened by `+ Дал в долг` / `+ Взял в долг`):
- Field "Кому" / "У кого" — text input with autocomplete suggestions sourced from previously used `counterparty` values in `Debts`.
- Amount input + calculator buttons (existing pattern).
- Date input.
- Comment input.
- Submit button "Добавить" / on edit "Сохранить".

**Add-payment sheet** (opened from inside an expanded debt card):
- Amount input (pre-filled with the remaining balance, editable) + calculator buttons.
- Date input (default today).
- Comment input.
- Submit button.

### Integration with existing tabs

**Home tab:**
- Balance card unchanged. Debt-derived `Transactions` count toward income/expense like any other row.
- "Последние операции" feed renders debt-derived rows with the 🤝 icon and the counterparty name as the visible label (instead of "Долги"), to give context: `🤝 Маша −5 000`.

**History tab:**
- Debt-derived rows appear in the list as normal.
- Filter chips (доход/расход) work normally.
- "Редактировать" on a debt-derived row → opens the Debts tab and expands the corresponding debt card (reusing the debt editor flow).
- "Удалить" on a debt-derived row → disabled (greyed out) with a tooltip / toast: "Удалите через вкладку Долги".

**Analytics tab:**
- "Долги" category appears in the donut and bar chart as a normal category. Drill-down works.
- No special handling required.

### New JS module: `js/debts.js`

IIFE pattern matching `API`, `UI`, `Charts`, `App`. Exports a public surface used by `app.js`:
- `loadDebts()` — fetches `getDebts`, renders the tab.
- `openCreateSheet(type)` — opens the new-debt bottom sheet for `lent` or `borrowed`.
- `openDebtDetail(debtId)` — used when navigating from History "Редактировать" on a debt-derived row.

`app.js` wires the 4th tab routing to `Debts.loadDebts()`. The existing category-grid render in `app.js` filters out `name === "Долги"`.

## Service worker

- Bump `CACHE_NAME` from `budget-v13` to `budget-v14`.
- Add `./js/debts.js` to the `ASSETS` array.

## Migration steps (manual, README)

1. Open the Google Spreadsheet.
2. In the `Transactions` sheet, add an 8th column with header `debt_id` (leave existing rows blank in this column).
3. Create a new sheet `Debts` with headers in row 1: `id, counterparty, type, amount, date, comment`.
4. Create a new sheet `DebtPayments` with headers in row 1: `id, debt_id, amount, date, comment`.
5. Replace `gas/Code.gs` content in the Apps Script editor and deploy a new version.
6. Hard-refresh the PWA (or wait for SW to update to `v14`).

## Error handling

- All multi-row writes wrapped in `LockService` to prevent race conditions across concurrent requests (consistent with current `editTransaction` / `deleteTransaction`).
- Server validates `amount > 0` and rejects negative or zero. Returns `{ status: 'error', message: '…' }` on validation failure.
- `addDebtPayment` rejects if `debt_id` does not exist in `Debts`.
- Frontend surfaces all errors via the existing `UI.showToast` mechanism.
- If a debt-derived `Transactions` row is missing for any debt (data corruption from external Sheet edits), `editDebt` / `deleteDebt` proceeds without the transaction-side update and the operation succeeds — the user can manually clean up. We do not raise on this case to avoid making the app unusable from a single hand-edit.

## Out of scope / explicit YAGNI

- No undo for debt deletion.
- No bulk operations (e.g., "close all debts with Маша").
- No reminders or due-date tracking.
- No export of debts as a separate report.
- No editing of `DebtPayments` (delete + re-add).
- No manual `status` override.

## Open questions

None at design-approval time.
