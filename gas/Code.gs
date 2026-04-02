const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // Replace after creating the sheet

function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function formatDate(value) {
  if (value instanceof Date) {
    var y = value.getFullYear();
    var m = String(value.getMonth() + 1).padStart(2, '0');
    var d = String(value.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  return String(value);
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
  const rows = data.slice(1);

  let filtered = rows;

  if (month && month !== 'all') {
    filtered = filtered.filter(row => formatDate(row[1]).startsWith(month));
  }

  if (user && user !== 'all') {
    filtered = filtered.filter(row => row[5] === user);
  }

  const transactions = filtered.map(row => ({
    id: row[0],
    date: formatDate(row[1]),
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
    const date = formatDate(row[1]);
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
      case 'editTransaction':
        result = editTransaction(body);
        break;
      case 'addCategory':
        result = addCategory(body);
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

function addCategory(body) {
  var sheet = getSheet('Categories');
  sheet.appendRow([body.name, body.type, body.icon || '📁']);
  return { status: 'ok' };
}

function editTransaction(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var sheet = getSheet('Transactions');
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === body.id) {
        var row = i + 1;
        sheet.getRange(row, 2).setValue(body.date);
        sheet.getRange(row, 3).setValue(Number(body.amount));
        sheet.getRange(row, 4).setValue(body.type);
        sheet.getRange(row, 5).setValue(body.category);
        sheet.getRange(row, 6).setValue(body.user);
        sheet.getRange(row, 7).setValue((body.comment || '').substring(0, 100));
        return { status: 'ok' };
      }
    }

    return { status: 'error', message: 'Transaction not found' };
  } finally {
    lock.releaseLock();
  }
}

function addTransaction(body) {
  const sheet = getSheet('Transactions');
  const comment = (body.comment || '').substring(0, 100);
  sheet.appendRow([body.id, body.date, Number(body.amount), body.type, body.category, body.user, comment]);
  return { status: 'ok' };
}

function deleteTransaction(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = getSheet('Transactions');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        return { status: 'ok' };
      }
    }

    return { status: 'error', message: 'Transaction not found' };
  } finally {
    lock.releaseLock();
  }
}
