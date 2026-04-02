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

    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || (a.rowNum || 0) - (b.rowNum || 0));
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

      const cat = categoryMap[tx.category] || { icon: '\u{1F4E6}', name: tx.category };
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
            <span class="transaction-item__meta">${tx.user}${tx.comment ? ' \u00b7 ' + tx.comment : ''}</span>
          </div>
          <span class="transaction-item__amount ${colorClass}">${sign}${formatMoney(tx.amount)}</span>
        </div>
        <div class="transaction-item__actions">
          <button class="btn-edit" data-id="${tx.id}">Редактировать</button>
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

  function renderCategoryGrid(container, categories, onSelect, onAdd) {
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

    // Add "+" button
    if (onAdd) {
      const addBtn = document.createElement('button');
      addBtn.className = 'category-grid__item category-grid__item--add';
      addBtn.innerHTML = '<span class="category-grid__icon">+</span><span class="category-grid__label">Новая</span>';
      addBtn.addEventListener('click', onAdd);
      container.appendChild(addBtn);
    }
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
