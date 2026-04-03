// js/charts.js
const Charts = (() => {
  let donutChart = null;
  let barChart = null;

  const COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#78716c'
  ];

  function renderDonut(canvasId, summaryData, onCategoryClick) {
    const canvas = document.getElementById(canvasId);
    if (donutChart) donutChart.destroy();

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
        onClick: (evt, elements) => {
          if (elements.length > 0 && onCategoryClick) {
            const idx = elements[0].index;
            onCategoryClick(entries[idx][0]);
          }
        },
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
        <div class="summary-card__value">${topCategory ? topCategory[0] : '\u2014'}</div>
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
