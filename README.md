# Budget

Simple mobile-first budget tracking app. Google Sheets as database. Installable as PWA.

## Setup

### 1. Create Google Spreadsheet

Create a new Google Spreadsheet with 3 sheets:

- **Transactions** — headers in row 1: `id`, `date`, `amount`, `type`, `category`, `user`, `comment`
- **Categories** — headers in row 1: `name`, `type`, `icon`. Pre-populate with categories (see below).
- **Users** — header in row 1: `name`. Add user names.

Default categories to add:


| name        | type    | icon |
| ----------- | ------- | ---- |
| Зарплата    | income  | 💰   |
| Фриланс     | income  | 💻   |
| Подарок     | income  | 🎁   |
| Другое      | income  | 📥   |
| Еда         | expense | 🍔   |
| Транспорт   | expense | 🚌   |
| Жильё       | expense | 🏠   |
| Развлечения | expense | 🎮   |
| Здоровье    | expense | 💊   |
| Одежда      | expense | 👕   |
| Связь       | expense | 📱   |
| Подписки    | expense | 📺   |
| Пожертвования | expense | 🙏 |
| Планы       | expense | 📋   |
| Карманные   | expense | 💵   |
| Другое      | expense | 📤   |


### 2. Deploy Google Apps Script

1. Open the spreadsheet → Extensions → Apps Script
2. Copy contents of `gas/Code.gs` into the script editor
3. Replace `YOUR_SPREADSHEET_ID` with your spreadsheet ID (from the URL: `https://docs.google.com/spreadsheets/d/ЭТОТ_ID/edit`)
4. Deploy → New deployment → Web app → "Anyone" access
5. Copy the deployment URL

### 3. Run the app

1. Open `index.html` in a browser (or deploy to GitHub Pages)
2. On first load, paste the GAS Web App URL when prompted
3. Start tracking!

### 4. Install on mobile (PWA)

- **Android:** open in Chrome → menu (⋮) → "Install app"
- **iOS:** open in Safari → Share (↑) → "Add to Home Screen"
