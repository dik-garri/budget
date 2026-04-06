// js/app.js
const App = (() => {
  let currentTab = 'home';
  let currentMonth = new Date().toISOString().slice(0, 7);
  let transactions = [];
  let categories = [];
  let categoryMap = {};
  let sheetType = '';
  let selectedCategory = '';
  let editingTxId = null;

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
      categories = await API.getCategories();
      categoryMap = {};
      categories.forEach(c => { categoryMap[c.name] = c; });

      await loadHome();
    } catch (err) {
      UI.showToast('Ошибка загрузки: ' + err.message);
    } finally {
      const overlay = document.getElementById('loading-overlay');
      overlay.classList.add('hidden');
      setTimeout(() => overlay.remove(), 300);
    }
  }

  async function loadHome() {
    const recentList = document.getElementById('recent-list');
    UI.showLoading(recentList);
    try {
      transactions = await API.getTransactions(currentMonth, 'all');
      UI.renderBalanceCard(transactions);
      UI.renderTransactionList(recentList, transactions, categoryMap, { limit: 5 });
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    }
  }

  async function loadHistory() {
    document.getElementById('month-label').textContent = UI.getMonthLabel(currentMonth);
    const list = document.getElementById('history-list');
    UI.showLoading(list);

    try {
      transactions = await API.getTransactions(currentMonth, 'all');
      applyHistoryFilter();
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    }
  }

  function applyHistoryFilter() {
    const active = document.querySelector('.chip.chip--active');
    const typeFilter = active ? active.dataset.filter : 'all';
    const list = document.getElementById('history-list');

    let filtered = transactions;
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.type === typeFilter);
    }
    UI.renderTransactionList(list, filtered, categoryMap, { expandable: true });
    bindEditButtons(list);
    bindDeleteButtons(list);
  }

  async function loadAnalytics() {
    document.getElementById('category-detail').style.display = 'none';
    document.getElementById('analytics-summary').innerHTML = '';
    document.getElementById('chart-donut').style.display = 'none';
    document.getElementById('chart-bar').style.display = 'none';
    document.querySelector('.analytics-charts').insertAdjacentHTML('afterbegin', '<div id="analytics-spinner" class="loading-spinner"></div>');

    try {
      const summary = await API.getSummary(6, 'all');
      const spinner = document.getElementById('analytics-spinner');
      if (spinner) spinner.remove();
      Charts.renderDonut('chart-donut', summary, onCategoryClick);
      Charts.renderBar('chart-bar', summary);
      Charts.renderSummaryCards(document.getElementById('analytics-summary'), summary);
    } catch (err) {
      const spinner = document.getElementById('analytics-spinner');
      if (spinner) spinner.remove();
      UI.showToast('Ошибка: ' + err.message);
    }
  }

  async function onCategoryClick(categoryName) {
    const detail = document.getElementById('category-detail');
    const title = document.getElementById('category-detail-title');
    const list = document.getElementById('category-detail-list');

    title.textContent = categoryName;
    detail.style.display = '';
    UI.showLoading(list);

    try {
      const allTx = await API.getTransactions('all', 'all');
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const minDate = sixMonthsAgo.toISOString().slice(0, 10);

      const filtered = allTx.filter(tx => tx.category === categoryName && tx.date >= minDate);
      UI.renderTransactionList(list, filtered, categoryMap, {});

      detail.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    }
  }

  // --- Bottom sheet ---
  function openSheet(type, editTx) {
    sheetType = type;
    selectedCategory = editTx ? editTx.category : '';
    editingTxId = editTx ? editTx.id : null;
    const sheet = document.getElementById('bottom-sheet');

    if (editTx) {
      document.getElementById('sheet-title').textContent = 'Редактировать';
    } else {
      document.getElementById('sheet-title').textContent = type === 'income' ? 'Новый доход' : 'Новый расход';
    }

    const filtered = categories.filter(c => c.type === type);
    UI.renderCategoryGrid(document.getElementById('category-grid'), filtered, (name) => {
      selectedCategory = name;
    }, () => openCategoryDialog(type));

    if (editTx) {
      const gridItems = document.querySelectorAll('.category-grid__item');
      gridItems.forEach(btn => {
        if (btn.querySelector('.category-grid__label').textContent === editTx.category) {
          btn.classList.add('selected');
        }
      });
    }

    document.getElementById('input-amount').value = editTx ? editTx.amount : '';
    document.getElementById('input-comment').value = editTx ? editTx.comment : '';
    document.getElementById('input-date').value = editTx ? editTx.date : new Date().toISOString().slice(0, 10);

    document.getElementById('btn-submit').textContent = editTx ? 'Сохранить' : 'Добавить';

    sheet.classList.add('active');
    setTimeout(() => document.getElementById('input-amount').focus(), 300);
  }

  function closeSheet() {
    document.getElementById('bottom-sheet').classList.remove('active');
  }

  // --- Add category dialog ---
  function openCategoryDialog(type) {
    document.getElementById('cat-icon').value = '';
    document.getElementById('cat-name').value = '';
    const dialog = document.getElementById('category-dialog');
    dialog.classList.add('active');
    dialog.dataset.type = type;
    setTimeout(() => document.getElementById('cat-icon').focus(), 200);
  }

  function closeCategoryDialog() {
    document.getElementById('category-dialog').classList.remove('active');
  }

  async function saveCategory() {
    const dialog = document.getElementById('category-dialog');
    const icon = document.getElementById('cat-icon').value.trim() || '\u{1F4C1}';
    const name = document.getElementById('cat-name').value.trim();
    if (!name) {
      UI.showToast('Введите название');
      return;
    }

    const type = dialog.dataset.type;
    const btn = document.getElementById('cat-save');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      await API.addCategory({ name, type, icon });
      categories.push({ name, type, icon });
      categoryMap[name] = { name, type, icon };
      closeCategoryDialog();
      const filtered = categories.filter(c => c.type === type);
      UI.renderCategoryGrid(document.getElementById('category-grid'), filtered, (n) => {
        selectedCategory = n;
      }, () => openCategoryDialog(type));
      selectedCategory = name;
      const gridItems = document.querySelectorAll('.category-grid__item');
      gridItems.forEach(b => {
        const label = b.querySelector('.category-grid__label');
        if (label && label.textContent === name) b.classList.add('selected');
      });
      UI.showToast('Категория добавлена');
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Добавить';
    }
  }

  function evalAmount(expr) {
    const cleaned = expr.replace(/[^0-9+\-*/().,]/g, '').replace(/,/g, '.');
    if (!cleaned) return NaN;
    try {
      const result = Function('"use strict"; return (' + cleaned + ')')();
      return typeof result === 'number' && isFinite(result) ? result : NaN;
    } catch (e) {
      return NaN;
    }
  }

  async function submitTransaction() {
    const raw = document.getElementById('input-amount').value.trim();
    const amount = evalAmount(raw);
    if (!amount || amount <= 0) {
      UI.showToast('Введите сумму');
      return;
    }
    if (!selectedCategory) {
      UI.showToast('Выберите категорию');
      return;
    }

    const tx = {
      id: editingTxId || API.generateId(),
      date: document.getElementById('input-date').value,
      amount: amount,
      type: sheetType,
      category: selectedCategory,
      user: '',
      comment: document.getElementById('input-comment').value.trim()
    };

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      if (editingTxId) {
        await API.editTransaction(tx);
      } else {
        await API.addTransaction(tx);
      }
      closeSheet();
      UI.showToast(editingTxId ? 'Сохранено!' : 'Добавлено!');
      switchTab(currentTab);
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Добавить';
    }
  }

  // --- Edit ---
  function bindEditButtons(container) {
    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const tx = transactions.find(t => t.id === id);
        if (tx) openSheet(tx.type, tx);
      });
    });
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

    // Calculator buttons
    document.querySelectorAll('.calc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('input-amount');
        input.value += btn.dataset.op;
        input.focus();
        input.dispatchEvent(new Event('input'));
      });
    });

    // Calculator preview
    document.getElementById('input-amount').addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const resultEl = document.getElementById('calc-result');
      if (/[+\-*/]/.test(val)) {
        const result = evalAmount(val);
        resultEl.textContent = isNaN(result) ? '' : '= ' + UI.formatMoney(Math.round(result * 100) / 100);
      } else {
        resultEl.textContent = '';
      }
    });

    // Category dialog
    document.querySelector('.dialog__overlay').addEventListener('click', closeCategoryDialog);
    document.getElementById('cat-cancel').addEventListener('click', closeCategoryDialog);
    document.getElementById('cat-save').addEventListener('click', saveCategory);

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

    // Refresh on visibility
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) switchTab(currentTab);
    });

    loadInitialData();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { switchTab };
})();
