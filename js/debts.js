// js/debts.js
const Debts = (() => {
  let debts = [];
  let editingDebtId = null;
  let editingPaymentDebtId = null;
  let currentFilter = 'all';

  async function load() {
    const list = document.getElementById('debts-list');
    UI.showLoading(list);
    try {
      debts = await API.getDebts();
      renderSummary();
      await renderList();
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    }
  }

  function renderSummary() {
    const lent = debts
      .filter(d => d.type === 'lent' && d.status === 'active')
      .reduce((acc, d) => acc + (d.amount - d.paid), 0);
    const borrowed = debts
      .filter(d => d.type === 'borrowed' && d.status === 'active')
      .reduce((acc, d) => acc + (d.amount - d.paid), 0);
    document.getElementById('debts-summary-lent').textContent = '+' + UI.formatMoney(lent);
    document.getElementById('debts-summary-borrowed').textContent = '−' + UI.formatMoney(borrowed);
  }

  async function renderList() {
    const container = document.getElementById('debts-list');
    container.innerHTML = '';

    let filtered = debts;
    if (currentFilter === 'active') filtered = debts.filter(d => d.status === 'active');
    if (currentFilter === 'closed') filtered = debts.filter(d => d.status === 'closed');

    if (filtered.length === 0) {
      container.innerHTML = '<div class="debts-empty">Нет долгов</div>';
      return;
    }

    const active = filtered.filter(d => d.status === 'active').sort((a, b) => b.date.localeCompare(a.date));
    const closed = filtered.filter(d => d.status === 'closed').sort((a, b) => b.date.localeCompare(a.date));

    if (active.length > 0 && currentFilter !== 'closed') {
      container.appendChild(makeSectionTitle('Активные'));
      active.forEach(d => container.appendChild(makeCard(d)));
    }

    if (closed.length > 0 && currentFilter !== 'active') {
      container.appendChild(makeSectionTitle('Закрытые'));
      closed.forEach(d => container.appendChild(makeCard(d)));
    }
  }

  function makeSectionTitle(text) {
    const el = document.createElement('div');
    el.className = 'debts-list__section-title';
    el.textContent = text;
    return el;
  }

  function makeCard(debt) {
    const card = document.createElement('div');
    card.className = 'debt-card' + (debt.status === 'closed' ? ' debt-card--closed' : '');
    card.dataset.id = debt.id;

    const arrow = debt.type === 'lent' ? '↗' : '↙';
    const arrowClass = debt.type === 'lent' ? 'debt-card__arrow--lent' : 'debt-card__arrow--borrowed';
    const sign = debt.type === 'lent' ? '+' : '−';
    const dateStr = UI.formatDate(debt.date);
    const commentHTML = debt.comment ? `<div class="debt-card__comment">${escapeHtml(debt.comment)}</div>` : '';

    card.innerHTML = `
      <div class="debt-card__head">
        <span class="debt-card__arrow ${arrowClass}">${arrow}</span>
        <div class="debt-card__main">
          <div class="debt-card__name">${escapeHtml(debt.counterparty)}</div>
          <div class="debt-card__progress">${sign}${UI.formatMoney(debt.paid)} / ${UI.formatMoney(debt.amount)} • ${dateStr}</div>
          ${commentHTML}
        </div>
      </div>
      <div class="debt-card__details" data-debt-id="${debt.id}"></div>
    `;

    card.querySelector('.debt-card__head').addEventListener('click', () => toggleCard(card, debt));
    return card;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  async function toggleCard(card, debt) {
    const wasExpanded = card.classList.contains('expanded');
    document.querySelectorAll('.debt-card').forEach(c => c.classList.remove('expanded'));
    if (wasExpanded) return;
    card.classList.add('expanded');
    await renderDetails(card, debt);
  }

  async function renderDetails(card, debt) {
    const details = card.querySelector('.debt-card__details');
    details.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const payments = await API.getDebtPayments(debt.id);
      const sortedPayments = payments.slice().sort((a, b) => b.date.localeCompare(a.date));

      const paymentsHTML = sortedPayments.length === 0
        ? '<div class="debt-payment" style="color:#9ca3af">Возвратов пока нет</div>'
        : sortedPayments.map(p => `
            <div class="debt-payment" data-payment-id="${p.id}">
              <div>
                <div>${UI.formatMoney(p.amount)} • ${UI.formatDate(p.date)}</div>
                ${p.comment ? `<div style="font-size:12px;color:#9ca3af">${escapeHtml(p.comment)}</div>` : ''}
              </div>
              <button class="debt-payment__delete" data-payment-id="${p.id}" title="Удалить возврат">×</button>
            </div>`).join('');

      const remaining = Math.max(0, debt.amount - debt.paid);
      const addPaymentLabel = debt.type === 'lent' ? '+ Добавить возврат' : '+ Добавить выплату';

      details.innerHTML = `
        ${paymentsHTML}
        <div class="debt-card__actions">
          <button class="debt-card__btn--primary" data-action="add-payment" ${debt.status === 'closed' ? 'disabled' : ''}>${addPaymentLabel}</button>
          <button data-action="edit">Редактировать</button>
          <button class="debt-card__btn--danger" data-action="delete">Удалить</button>
        </div>
      `;

      details.querySelector('[data-action="add-payment"]').addEventListener('click', () => openPaymentSheet(debt, remaining));
      details.querySelector('[data-action="edit"]').addEventListener('click', () => openDebtSheet(debt.type, debt));
      details.querySelector('[data-action="delete"]').addEventListener('click', () => deleteDebt(debt));
      details.querySelectorAll('.debt-payment__delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          deletePayment(btn.dataset.paymentId);
        });
      });
    } catch (err) {
      details.innerHTML = `<div style="color:#ef4444">Ошибка: ${escapeHtml(err.message)}</div>`;
    }
  }

  function openDebtSheet(type, editDebt) {
    editingDebtId = editDebt ? editDebt.id : null;
    const sheet = document.getElementById('debt-sheet');
    document.getElementById('debt-sheet-title').textContent = editDebt
      ? 'Редактировать долг'
      : (type === 'lent' ? 'Дал в долг' : 'Взял в долг');

    document.getElementById('debt-counterparty').value = editDebt ? editDebt.counterparty : '';
    document.getElementById('debt-amount').value = editDebt ? editDebt.amount : '';
    document.getElementById('debt-comment').value = editDebt ? (editDebt.comment || '') : '';
    document.getElementById('debt-date').value = editDebt ? editDebt.date : new Date().toISOString().slice(0, 10);
    document.getElementById('debt-submit').textContent = editDebt ? 'Сохранить' : 'Добавить';
    document.getElementById('debt-calc-result').textContent = '';
    document.getElementById('debt-counterparty-suggest').classList.remove('active');

    sheet.dataset.mode = 'debt';
    sheet.dataset.type = type;
    document.getElementById('debt-counterparty-group').style.display = '';
    sheet.classList.add('active');
    setTimeout(() => document.getElementById('debt-counterparty').focus(), 300);
  }

  function closeDebtSheet() {
    document.getElementById('debt-sheet').classList.remove('active');
    editingDebtId = null;
    editingPaymentDebtId = null;
  }

  function evalAmount(expr) {
    const cleaned = String(expr).replace(/[^0-9+\-*/().,]/g, '').replace(/,/g, '.');
    if (!cleaned) return NaN;
    try {
      const result = Function('"use strict"; return (' + cleaned + ')')();
      return typeof result === 'number' && isFinite(result) ? result : NaN;
    } catch (e) {
      return NaN;
    }
  }

  async function submitDebt() {
    const sheet = document.getElementById('debt-sheet');
    const mode = sheet.dataset.mode;

    if (mode === 'payment') {
      return submitPayment();
    }

    const type = sheet.dataset.type;
    const counterparty = document.getElementById('debt-counterparty').value.trim();
    const amount = evalAmount(document.getElementById('debt-amount').value.trim());
    const date = document.getElementById('debt-date').value;
    const comment = document.getElementById('debt-comment').value.trim();

    if (!counterparty) { UI.showToast('Введите имя'); return; }
    if (!amount || amount <= 0) { UI.showToast('Введите сумму'); return; }
    if (!date) { UI.showToast('Введите дату'); return; }

    const btn = document.getElementById('debt-submit');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      const payload = { id: editingDebtId || API.generateId(), counterparty, type, amount, date, comment };
      if (editingDebtId) {
        await API.editDebt(payload);
      } else {
        await API.addDebt(payload);
      }
      closeDebtSheet();
      UI.showToast(editingDebtId ? 'Сохранено' : 'Добавлено');
      await load();
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = editingDebtId ? 'Сохранить' : 'Добавить';
    }
  }

  function openPaymentSheet(debt, remaining) {
    editingPaymentDebtId = debt.id;
    const sheet = document.getElementById('debt-sheet');
    document.getElementById('debt-sheet-title').textContent = debt.type === 'lent' ? 'Возврат от ' + debt.counterparty : 'Выплата ' + debt.counterparty;

    const cpGroup = document.getElementById('debt-counterparty-group');
    cpGroup.style.display = 'none';

    document.getElementById('debt-amount').value = remaining || '';
    document.getElementById('debt-comment').value = '';
    document.getElementById('debt-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('debt-submit').textContent = 'Добавить';
    document.getElementById('debt-calc-result').textContent = '';

    sheet.dataset.mode = 'payment';
    sheet.classList.add('active');
    setTimeout(() => document.getElementById('debt-amount').focus(), 300);
  }

  async function submitPayment() {
    const amount = evalAmount(document.getElementById('debt-amount').value.trim());
    const date = document.getElementById('debt-date').value;
    const comment = document.getElementById('debt-comment').value.trim();

    if (!amount || amount <= 0) { UI.showToast('Введите сумму'); return; }
    if (!date) { UI.showToast('Введите дату'); return; }
    if (!editingPaymentDebtId) { UI.showToast('Долг не выбран'); return; }

    const btn = document.getElementById('debt-submit');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      await API.addDebtPayment({
        id: API.generateId(),
        debt_id: editingPaymentDebtId,
        amount,
        date,
        comment
      });
      closeDebtSheet();
      UI.showToast('Добавлено');
      await load();
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Добавить';
    }
  }

  async function deletePayment(paymentId) {
    if (!confirm('Удалить возврат?')) return;
    try {
      await API.deleteDebtPayment(paymentId);
      UI.showToast('Удалено');
      await load();
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    }
  }

  async function deleteDebt(debt) {
    if (!confirm('Удалить долг и все связанные операции?')) return;
    try {
      await API.deleteDebt(debt.id);
      UI.showToast('Удалено');
      await load();
    } catch (err) {
      UI.showToast('Ошибка: ' + err.message);
    }
  }

  async function openDebtById(debtId) {
    if (debts.length === 0) await load();
    const debt = debts.find(d => d.id === debtId);
    if (!debt) { UI.showToast('Долг не найден'); return; }
    App.switchTab('debts');
    setTimeout(() => {
      const card = document.querySelector(`.debt-card[data-id="${debt.id}"]`);
      if (card) {
        toggleCard(card, debt);
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  }

  function init() {
    document.getElementById('btn-debt-lent').addEventListener('click', () => openDebtSheet('lent'));
    document.getElementById('btn-debt-borrowed').addEventListener('click', () => openDebtSheet('borrowed'));

    document.querySelectorAll('[data-debt-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-debt-filter]').forEach(c => c.classList.remove('chip--active'));
        chip.classList.add('chip--active');
        currentFilter = chip.dataset.debtFilter;
        renderList();
      });
    });

    document.querySelectorAll('.debts-summary__card').forEach(card => {
      card.addEventListener('click', () => {
        const f = card.dataset.filter;
        const allChips = document.querySelectorAll('[data-debt-filter]');
        allChips.forEach(c => c.classList.remove('chip--active'));
        const activeChip = document.querySelector('[data-debt-filter="active"]');
        activeChip.classList.add('chip--active');
        currentFilter = 'active';
        renderList().then(() => {
          const targetType = f;
          const firstCard = Array.from(document.querySelectorAll('.debt-card')).find(el => {
            const arrow = el.querySelector('.debt-card__arrow');
            return arrow && (targetType === 'lent' ? arrow.classList.contains('debt-card__arrow--lent') : arrow.classList.contains('debt-card__arrow--borrowed'));
          });
          if (firstCard) firstCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    });

    document.querySelector('#debt-sheet .bottom-sheet__overlay').addEventListener('click', closeDebtSheet);
    document.getElementById('debt-submit').addEventListener('click', submitDebt);

    document.querySelectorAll('[data-debt-op]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('debt-amount');
        input.value += btn.dataset.debtOp;
        input.focus();
        input.dispatchEvent(new Event('input'));
      });
    });

    document.getElementById('debt-amount').addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const resultEl = document.getElementById('debt-calc-result');
      if (/[+\-*/]/.test(val)) {
        const result = evalAmount(val);
        resultEl.textContent = isNaN(result) ? '' : '= ' + UI.formatMoney(Math.round(result * 100) / 100);
      } else {
        resultEl.textContent = '';
      }
    });

    const cpInput = document.getElementById('debt-counterparty');
    const cpSuggest = document.getElementById('debt-counterparty-suggest');
    cpInput.addEventListener('input', () => {
      const v = cpInput.value.trim().toLowerCase();
      if (!v) { cpSuggest.classList.remove('active'); return; }
      const seen = new Set();
      const matches = debts
        .map(d => d.counterparty)
        .filter(name => {
          if (seen.has(name)) return false;
          seen.add(name);
          return name.toLowerCase().includes(v);
        })
        .slice(0, 5);
      if (matches.length === 0) { cpSuggest.classList.remove('active'); return; }
      cpSuggest.innerHTML = matches.map(n => `<div class="autocomplete-item">${escapeHtml(n)}</div>`).join('');
      cpSuggest.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          cpInput.value = item.textContent;
          cpSuggest.classList.remove('active');
        });
      });
      cpSuggest.classList.add('active');
    });
    cpInput.addEventListener('blur', () => setTimeout(() => cpSuggest.classList.remove('active'), 150));
  }

  document.addEventListener('DOMContentLoaded', init);

  return { load, openDebtSheet, openDebtById };
})();
