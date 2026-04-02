// js/app.js
const App = (() => {
  let currentTab = 'home';
  let currentUser = localStorage.getItem('budget_user') || '';
  let currentMonth = new Date().toISOString().slice(0, 7);
  let transactions = [];
  let categories = [];
  let users = [];
  let categoryMap = {};
  let sheetType = '';
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
      switchTab(currentTab);
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
