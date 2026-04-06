// js/api.js
const API = (() => {
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
    // Assign rowNum based on array order (GAS returns in sheet order)
    if (Array.isArray(json.data)) {
      json.data.forEach((item, i) => { if (typeof item === 'object') item.rowNum = i; });
    }
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
    getUrl: () => localStorage.getItem('budget_api_url') || '',
    generateId,
    getTransactions: (month, user) => get({ action: 'transactions', month: month || 'all', user: user || 'all' }),
    getCategories: () => get({ action: 'categories' }),
    getSummary: (months, user) => get({ action: 'summary', months: months || 6, user: user || 'all' }),
    addCategory: (cat) => post({ action: 'addCategory', ...cat }),
    addTransaction: (tx) => post({ action: 'addTransaction', ...tx }),
    editTransaction: (tx) => post({ action: 'editTransaction', ...tx }),
    deleteTransaction: (id) => post({ action: 'deleteTransaction', id })
  };
})();
