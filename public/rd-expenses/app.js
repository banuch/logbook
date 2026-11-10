/* Wintek R&D Expense Tracker
 * Offline-first, single-device expense tracker for R&D projects.
 * Data lives in IndexedDB; bills are stored as compressed data URLs so that
 * the JSON backup is fully self-contained.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const DEFAULT_CATEGORIES = [
    'Electronic components',
    'PCB fabrication & assembly',
    'Enclosure / mechanical / 3D printing',
    'Tools & test equipment',
    'Development boards & modules',
    'SIM cards & data plans',
    'Cloud, server & software',
    'Certification & testing',
    'Field trials & travel',
    'Courier & shipping',
    'Consumables',
    'Contractor / labour',
    'Miscellaneous',
  ];
  const PAYMENT_MODES = ['UPI', 'Bank transfer', 'Card', 'Cash', 'Cheque', 'Credit (pay later)'];
  const PAYMENT_STATUSES = ['Paid', 'Pending', 'Reimbursable', 'Reimbursed'];
  const MAX_IMAGE_DIM = 1600;

  // ---------------------------------------------------------------------------
  // Storage (IndexedDB)
  // ---------------------------------------------------------------------------
  const DB_NAME = 'wintek-rd-expenses';
  const DB_VERSION = 1;
  let db;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('expenses')) d.createObjectStore('expenses', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  const getAll = (store) => tx(store, 'readonly', (s) => s.getAll());
  const put = (store, value) => tx(store, 'readwrite', (s) => s.put(value));
  const del = (store, key) => tx(store, 'readwrite', (s) => s.delete(key));
  const clearStore = (store) => tx(store, 'readwrite', (s) => s.clear());

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const state = {
    projects: [],
    expenses: [],
    settings: { company: 'Wintek Solutions', gstin: '', categories: DEFAULT_CATEGORIES.slice(), people: [] },
  };
  let editingExpense = null; // expense object being edited (or null for new)
  let pendingBills = [];     // bills attached in the open dialog
  let editingProject = null;

  async function loadState() {
    const [projects, expenses, meta] = await Promise.all([getAll('projects'), getAll('expenses'), getAll('meta')]);
    state.projects = projects;
    state.expenses = expenses;
    const settings = meta.find((m) => m.key === 'settings');
    if (settings) Object.assign(state.settings, settings.value);
  }
  const saveSettings = () => put('meta', { key: 'settings', value: state.settings });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const fmt = (n) => inr.format(n || 0);
  const fmt0 = (n) => inr0.format(n || 0);
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const today = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  };
  const monthKey = (iso) => (iso || '').slice(0, 7);
  const monthLabel = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const projectById = (id) => state.projects.find((p) => p.id === id);
  const projectLabel = (id) => {
    const p = projectById(id);
    return p ? `${p.code} · ${p.name}` : '(deleted project)';
  };
  const sum = (arr) => arr.reduce((a, e) => a + (e.total || 0), 0);

  function computeTotals(e) {
    const qty = Number(e.qty) || 0;
    const unit = Number(e.unitPrice) || 0;
    const gst = Number(e.gst) || 0;
    const ship = Number(e.shipping) || 0;
    const base = round2(qty * unit);
    const gstAmt = round2(base * gst / 100);
    return { base, gstAmt, total: round2(base + gstAmt + ship) };
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function fillSelect(sel, options, { all, value } = {}) {
    const prev = value !== undefined ? value : sel.value;
    sel.innerHTML = (all ? `<option value="">${esc(all)}</option>` : '') +
      options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}">${esc(l)}</option>`;
      }).join('');
    if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }

  function download(filename, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  // Downscale photos of bills so storage doesn't explode.
  async function fileToBill(file) {
    const raw = await readFileAsDataUrl(file);
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      return { id: uid(), name: file.name, type: file.type || 'application/octet-stream', data: raw };
    }
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = raw;
    });
    const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
    if (scale === 1 && raw.length < 400_000) {
      return { id: uid(), name: file.name, type: file.type, data: raw };
    }
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { id: uid(), name: file.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.8) };
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  function showView(name) {
    $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    render();
  }
  const currentView = () => ($('.tabs button.active') || {}).dataset?.view || 'dashboard';

  function render() {
    refreshLookups();
    const v = currentView();
    if (v === 'dashboard') renderDashboard();
    if (v === 'expenses') renderExpenses();
    if (v === 'projects') renderProjects();
    if (v === 'reports') renderReport();
    if (v === 'settings') renderSettings();
  }

  function refreshLookups() {
    const projOpts = state.projects
      .slice().sort((a, b) => a.code.localeCompare(b.code))
      .map((p) => [p.id, `${p.code} · ${p.name}`]);
    fillSelect($('#f-project'), projOpts, { all: 'All projects' });
    fillSelect($('#r-project'), projOpts, { all: 'All projects' });
    fillSelect($('#f-category'), state.settings.categories, { all: 'All categories' });
    fillSelect($('#f-status'), PAYMENT_STATUSES, { all: 'All payment statuses' });
    const vendors = [...new Set(state.expenses.map((e) => e.vendor).filter(Boolean))].sort();
    $('#vendor-list').innerHTML = vendors.map((v) => `<option value="${esc(v)}">`).join('');
    $('#people-list').innerHTML = state.settings.people.map((v) => `<option value="${esc(v)}">`).join('');
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  function barRow(label, value, max, extra = '', cls = '') {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return `<div class="bar-row">
      <div class="bar-label"><span>${esc(label)}</span><span>${extra || fmt0(value)}</span></div>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct.toFixed(1)}%"></div></div>
    </div>`;
  }

  function renderDashboard() {
    const ex = state.expenses;
    const total = sum(ex);
    const thisMonth = monthKey(today());
    const monthTotal = sum(ex.filter((e) => monthKey(e.date) === thisMonth));
    const pending = ex.filter((e) => e.paymentStatus === 'Pending');
    const reimb = ex.filter((e) => e.paymentStatus === 'Reimbursable');
    const gstTotal = ex.reduce((a, e) => a + (e.gstAmt || 0), 0);
    const missingBills = ex.filter((e) => !(e.bills && e.bills.length)).length;
    const active = state.projects.filter((p) => p.status === 'Active').length;

    $('#dash-stats').innerHTML = [
      ['Total R&D spend', fmt0(total), `${ex.length} entries`],
      ['This month', fmt0(monthTotal), monthLabel(thisMonth)],
      ['Pending payments', fmt0(sum(pending)), `${pending.length} unpaid`],
      ['To reimburse', fmt0(sum(reimb)), `${reimb.length} entries`],
      ['GST paid (input)', fmt0(gstTotal), 'claimable if registered'],
      ['Projects', String(state.projects.length), `${active} active · ${missingBills} entries w/o bill`],
    ].map(([l, v, s]) => `<div class="stat"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${esc(s)}</div></div>`).join('');

    // project vs budget
    const projRows = state.projects.map((p) => {
      const spent = sum(ex.filter((e) => e.projectId === p.id));
      return { p, spent };
    }).sort((a, b) => b.spent - a.spent);
    const maxSpent = Math.max(1, ...projRows.map((r) => Math.max(r.spent, r.p.budget || 0)));
    $('#dash-projects').innerHTML = projRows.length ? projRows.map(({ p, spent }) => {
      const budget = Number(p.budget) || 0;
      if (budget > 0) {
        const ratio = spent / budget;
        const cls = ratio > 1 ? 'over' : ratio > 0.85 ? 'near' : '';
        return barRow(`${p.code} · ${p.name}`, spent, budget, `${fmt0(spent)} / ${fmt0(budget)} (${Math.round(ratio * 100)}%)`, cls);
      }
      return barRow(`${p.code} · ${p.name}`, spent, maxSpent, `${fmt0(spent)} · no budget`);
    }).join('') : '<div class="empty">No projects yet. Add one under Projects.</div>';

    // categories
    const byCat = groupBy(ex, (e) => e.category);
    const catRows = Object.entries(byCat).map(([k, v]) => [k, sum(v)]).sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(1, ...catRows.map((r) => r[1]));
    $('#dash-categories').innerHTML = catRows.length
      ? catRows.map(([k, v]) => barRow(k, v, maxCat, `${fmt0(v)} · ${total ? Math.round(v / total * 100) : 0}%`)).join('')
      : '<div class="empty">No expenses yet.</div>';

    // monthly
    const months = [];
    const d = new Date();
    for (let i = 11; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
    }
    const mVals = months.map((m) => sum(ex.filter((e) => monthKey(e.date) === m)));
    const mMax = Math.max(1, ...mVals);
    $('#dash-monthly').innerHTML = months.map((m, i) =>
      `<div class="col" title="${monthLabel(m)}: ${fmt0(mVals[i])}"><div class="b" style="height:${(mVals[i] / mMax * 100).toFixed(1)}%"></div><small>${monthLabel(m)}</small></div>`
    ).join('');

    const recent = ex.slice().sort(sortByDateDesc).slice(0, 6);
    $('#dash-recent').innerHTML = recent.length ? recent.map(expenseItemHtml).join('') : '<div class="empty">No expenses yet. Tap “+ Expense” to add your first bill.</div>';
    bindExpenseItems($('#dash-recent'));
  }

  function groupBy(arr, fn) {
    return arr.reduce((acc, x) => {
      const k = fn(x) || '—';
      (acc[k] ||= []).push(x);
      return acc;
    }, {});
  }
  const sortByDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0);

  // ---------------------------------------------------------------------------
  // Expenses list
  // ---------------------------------------------------------------------------
  function expenseItemHtml(e) {
    const bills = e.bills?.length ? `📎 ${e.bills.length}` : '<span title="No bill attached">⚠ no bill</span>';
    const right = [e.vendor ? esc(e.vendor) : '', bills].filter(Boolean).join(' · ');
    return `<div class="exp-item" data-id="${e.id}">
      <div class="title">${esc(e.item)}<span class="badge ${esc(e.paymentStatus)}">${esc(e.paymentStatus)}</span></div>
      <div class="amt">${fmt(e.total)}</div>
      <div class="meta">${fmtDate(e.date)} · ${esc(projectLabel(e.projectId))} · ${esc(e.category)}</div>
      <div class="meta" style="text-align:right">${right}</div>
    </div>`;
  }
  function bindExpenseItems(root) {
    $$('.exp-item', root).forEach((el) => el.addEventListener('click', () => {
      const e = state.expenses.find((x) => x.id === el.dataset.id);
      if (e) openExpenseDialog(e);
    }));
  }

  function filteredExpenses({ q, project, category, status, from, to }) {
    q = (q || '').trim().toLowerCase();
    return state.expenses.filter((e) => {
      if (project && e.projectId !== project) return false;
      if (category && e.category !== category) return false;
      if (status && e.paymentStatus !== status) return false;
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      if (q) {
        const hay = [e.item, e.vendor, e.invoiceNo, e.notes, e.paidBy, e.paymentRef, e.category, projectLabel(e.projectId)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort(sortByDateDesc);
  }

  function renderExpenses() {
    const list = filteredExpenses({
      q: $('#f-search').value, project: $('#f-project').value, category: $('#f-category').value,
      status: $('#f-status').value, from: $('#f-from').value, to: $('#f-to').value,
    });
    $('#exp-summary').textContent = `${list.length} entr${list.length === 1 ? 'y' : 'ies'} · Total ${fmt(sum(list))}`;
    $('#exp-list').innerHTML = list.length ? list.map(expenseItemHtml).join('') : '<div class="empty">No matching expenses.</div>';
    bindExpenseItems($('#exp-list'));
  }

  // ---------------------------------------------------------------------------
  // Expense dialog
  // ---------------------------------------------------------------------------
  function openExpenseDialog(expense = null) {
    if (!state.projects.length) {
      toast('Add a project first');
      showView('projects');
      openProjectDialog();
      return;
    }
    editingExpense = expense;
    pendingBills = expense?.bills ? expense.bills.slice() : [];
    const f = $('#form-expense');
    f.reset();
    const activeProjects = state.projects
      .filter((p) => p.status !== 'Completed' || p.id === expense?.projectId)
      .sort((a, b) => a.code.localeCompare(b.code));
    fillSelect(f.projectId, activeProjects.map((p) => [p.id, `${p.code} · ${p.name}`]));
    const cats = state.settings.categories.slice();
    if (expense?.category && !cats.includes(expense.category)) cats.push(expense.category);
    fillSelect(f.category, cats);
    fillSelect(f.paymentMode, PAYMENT_MODES);
    fillSelect(f.paymentStatus, PAYMENT_STATUSES);

    const last = state.expenses.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    const v = expense || {
      date: today(),
      projectId: (last && projectById(last.projectId) && activeProjects.some((p) => p.id === last.projectId)) ? last.projectId : activeProjects[0]?.id,
      category: cats[0], qty: 1, unitPrice: 0, gst: 18, shipping: 0,
      paymentMode: 'UPI', paymentStatus: 'Paid', paidBy: last?.paidBy || '',
    };
    for (const k of ['date', 'projectId', 'category', 'item', 'vendor', 'invoiceNo', 'qty', 'unitPrice', 'gst', 'shipping', 'paymentMode', 'paymentStatus', 'paidBy', 'paymentRef', 'notes']) {
      if (f[k] && v[k] !== undefined) f[k].value = v[k];
    }
    $('#dlg-expense-title').textContent = expense ? 'Edit expense' : 'Add expense';
    $('#exp-delete').hidden = !expense;
    updateTotalPreview();
    renderBillPreview();
    $('#dlg-expense').showModal();
  }

  function updateTotalPreview() {
    const f = $('#form-expense');
    const t = computeTotals({ qty: f.qty.value, unitPrice: f.unitPrice.value, gst: f.gst.value, shipping: f.shipping.value });
    $('#exp-total').textContent = fmt(t.total);
    $('#exp-breakup').textContent = `(base ${fmt(t.base)} + GST ${fmt(t.gstAmt)}${Number(f.shipping.value) ? ` + other ${fmt(Number(f.shipping.value))}` : ''})`;
  }

  function renderBillPreview() {
    const box = $('#bill-preview');
    box.innerHTML = pendingBills.map((b) => `<div class="bill-thumb" data-id="${b.id}" title="${esc(b.name)}">
      ${b.type.startsWith('image/') ? `<img src="${b.data}" alt="${esc(b.name)}">` : `<span>📄<br>${esc(b.name.slice(0, 18))}</span>`}
      <button type="button" class="x" data-remove="${b.id}" aria-label="Remove">×</button>
    </div>`).join('') || '<span class="muted" style="font-size:13px">No bill attached. Snap a photo of the invoice for your accounts.</span>';
    $$('.bill-thumb', box).forEach((el) => el.addEventListener('click', (ev) => {
      const rm = ev.target.closest('[data-remove]');
      if (rm) {
        pendingBills = pendingBills.filter((b) => b.id !== rm.dataset.remove);
        renderBillPreview();
        return;
      }
      const b = pendingBills.find((x) => x.id === el.dataset.id);
      if (b) viewBill(b);
    }));
  }

  function viewBill(b) {
    const body = $('#bill-view-body');
    if (b.type.startsWith('image/')) body.innerHTML = `<img src="${b.data}" alt="${esc(b.name)}">`;
    else if (b.type === 'application/pdf') body.innerHTML = `<iframe src="${b.data}" title="${esc(b.name)}"></iframe>`;
    else body.innerHTML = `<p>${esc(b.name)}</p>`;
    const dl = document.createElement('p');
    const a = document.createElement('a');
    a.href = b.data; a.download = b.name; a.textContent = `Download ${b.name}`;
    dl.appendChild(a);
    body.appendChild(dl);
    $('#dlg-bill').showModal();
  }

  async function addBillFiles(files) {
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) { toast(`${file.name} is larger than 15 MB`); continue; }
      try { pendingBills.push(await fileToBill(file)); } catch { toast(`Could not read ${file.name}`); }
    }
    renderBillPreview();
  }

  async function saveExpense(ev) {
    ev.preventDefault();
    const f = $('#form-expense');
    if (!f.reportValidity()) return;
    const data = Object.fromEntries(new FormData(f).entries());
    for (const k of ['qty', 'unitPrice', 'gst', 'shipping']) data[k] = Number(data[k]) || 0;
    data.item = data.item.trim();
    data.vendor = (data.vendor || '').trim();
    data.paidBy = (data.paidBy || '').trim();
    const totals = computeTotals(data);
    const record = {
      ...(editingExpense || { id: uid(), createdAt: Date.now() }),
      ...data, ...totals,
      bills: pendingBills,
      updatedAt: Date.now(),
    };
    try {
      await put('expenses', record);
    } catch (err) {
      toast('Save failed: storage may be full');
      console.error(err);
      return;
    }
    const i = state.expenses.findIndex((e) => e.id === record.id);
    if (i >= 0) state.expenses[i] = record; else state.expenses.push(record);
    if (data.paidBy && !state.settings.people.includes(data.paidBy)) {
      state.settings.people.push(data.paidBy);
      await saveSettings();
    }
    $('#dlg-expense').close();
    toast(editingExpense ? 'Expense updated' : 'Expense added');
    render();
  }

  async function deleteExpense() {
    if (!editingExpense || !confirm(`Delete “${editingExpense.item}”? This cannot be undone.`)) return;
    await del('expenses', editingExpense.id);
    state.expenses = state.expenses.filter((e) => e.id !== editingExpense.id);
    $('#dlg-expense').close();
    toast('Expense deleted');
    render();
  }

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------
  function renderProjects() {
    const order = { Active: 0, 'On hold': 1, Completed: 2 };
    const list = state.projects.slice().sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.code.localeCompare(b.code));
    $('#proj-list').innerHTML = list.length ? list.map((p) => {
      const ex = state.expenses.filter((e) => e.projectId === p.id);
      const spent = sum(ex);
      const budget = Number(p.budget) || 0;
      const ratio = budget ? spent / budget : 0;
      const cls = ratio > 1 ? 'over' : ratio > 0.85 ? 'near' : '';
      return `<div class="proj-card" data-id="${p.id}">
        <div class="code">${esc(p.code)} <span class="badge">${esc(p.status)}</span></div>
        <h4>${esc(p.name)}</h4>
        ${p.description ? `<div class="muted" style="font-size:13px">${esc(p.description)}</div>` : ''}
        ${budget ? `<div class="bar-track" style="margin-top:8px"><div class="bar-fill ${cls}" style="width:${Math.min(100, ratio * 100).toFixed(1)}%"></div></div>` : ''}
        <div class="nums"><span>Spent ${fmt0(spent)}</span><span>${budget ? `Budget ${fmt0(budget)}` : 'No budget'}</span></div>
        <div class="nums muted"><span>${ex.length} entries</span><span>${budget ? `${budget - spent >= 0 ? 'Left' : 'Over'} ${fmt0(Math.abs(budget - spent))}` : ''}</span></div>
      </div>`;
    }).join('') : '<div class="empty">No projects yet. Create one for each product you are developing (e.g. IoT energy meter, GPS tracker).</div>';
    $$('.proj-card').forEach((el) => el.addEventListener('click', () => openProjectDialog(projectById(el.dataset.id))));
  }

  function openProjectDialog(project = null) {
    editingProject = project;
    const f = $('#form-project');
    f.reset();
    const v = project || { status: 'Active', startDate: today(), budget: 0 };
    for (const k of ['code', 'name', 'budget', 'status', 'startDate', 'client', 'description']) {
      if (v[k] !== undefined) f[k].value = v[k];
    }
    $('#dlg-project-title').textContent = project ? 'Edit project' : 'Add project';
    $('#proj-delete').hidden = !project;
    $('#dlg-project').showModal();
  }

  async function saveProject(ev) {
    ev.preventDefault();
    const f = $('#form-project');
    if (!f.reportValidity()) return;
    const data = Object.fromEntries(new FormData(f).entries());
    data.code = data.code.trim().toUpperCase();
    data.name = data.name.trim();
    data.budget = Number(data.budget) || 0;
    if (state.projects.some((p) => p.code === data.code && p.id !== editingProject?.id)) {
      toast(`Project code ${data.code} already exists`);
      return;
    }
    const record = { ...(editingProject || { id: uid(), createdAt: Date.now() }), ...data };
    await put('projects', record);
    const i = state.projects.findIndex((p) => p.id === record.id);
    if (i >= 0) state.projects[i] = record; else state.projects.push(record);
    $('#dlg-project').close();
    toast(editingProject ? 'Project updated' : 'Project added');
    render();
  }

  async function deleteProject() {
    if (!editingProject) return;
    const count = state.expenses.filter((e) => e.projectId === editingProject.id).length;
    if (count) {
      alert(`This project has ${count} expense entries. Move or delete them first, or mark the project as Completed.`);
      return;
    }
    if (!confirm(`Delete project ${editingProject.code}?`)) return;
    await del('projects', editingProject.id);
    state.projects = state.projects.filter((p) => p.id !== editingProject.id);
    $('#dlg-project').close();
    render();
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  function reportData() {
    const project = $('#r-project').value;
    const from = $('#r-from').value;
    const to = $('#r-to').value;
    const group = $('#r-group').value;
    const list = filteredExpenses({ project, from, to }).reverse(); // oldest first
    const keyFn = {
      category: (e) => e.category,
      project: (e) => projectLabel(e.projectId),
      month: (e) => monthKey(e.date),
      vendor: (e) => e.vendor || '(no vendor)',
      paidBy: (e) => e.paidBy || '(not specified)',
    }[group];
    const groups = groupBy(list, keyFn);
    const rows = Object.entries(groups).map(([k, items]) => ({
      key: group === 'month' ? monthLabel(k) : k,
      sortKey: k,
      count: items.length,
      base: items.reduce((a, e) => a + (e.base || 0), 0),
      gst: items.reduce((a, e) => a + (e.gstAmt || 0), 0),
      other: items.reduce((a, e) => a + (Number(e.shipping) || 0), 0),
      total: sum(items),
    }));
    if (group === 'month') rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    else rows.sort((a, b) => b.total - a.total);
    return { project, from, to, group, list, rows };
  }

  function renderReport() {
    const { project, from, to, group, list, rows } = reportData();
    const p = project ? projectById(project) : null;
    const period = from || to ? `${from ? fmtDate(from) : 'start'} to ${to ? fmtDate(to) : 'today'}` : 'All dates';
    const groupName = $('#r-group').selectedOptions[0].textContent.replace('Group by ', '');
    const tot = (k) => rows.reduce((a, r) => a + r[k], 0);
    const pending = sum(list.filter((e) => e.paymentStatus === 'Pending'));
    const reimb = sum(list.filter((e) => e.paymentStatus === 'Reimbursable'));
    const noBill = list.filter((e) => !(e.bills && e.bills.length)).length;

    $('#report-out').innerHTML = `
      <div class="report-head">
        <div>
          <h2>${esc(state.settings.company)} — R&amp;D Expenditure Statement</h2>
          ${state.settings.gstin ? `<div class="muted">GSTIN: ${esc(state.settings.gstin)}</div>` : ''}
          <div class="muted">Project: ${p ? esc(`${p.code} · ${p.name}`) : 'All projects'} · Period: ${esc(period)}</div>
        </div>
        <div class="muted">Generated ${fmtDate(today())}</div>
      </div>
      ${p && p.budget ? `<p>Budget ${fmt(p.budget)} · Spent ${fmt(tot('total'))} · ${p.budget - tot('total') >= 0 ? 'Balance' : 'Over budget'} ${fmt(Math.abs(p.budget - tot('total')))}</p>` : ''}
      <h3>Summary by ${esc(groupName)}</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>${esc(groupName)}</th><th class="num">Entries</th><th class="num">Base</th><th class="num">GST</th><th class="num">Other</th><th class="num">Total</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${esc(r.key)}</td><td class="num">${r.count}</td><td class="num">${fmt(r.base)}</td><td class="num">${fmt(r.gst)}</td><td class="num">${fmt(r.other)}</td><td class="num">${fmt(r.total)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No expenses in this selection.</td></tr>'}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${list.length}</td><td class="num">${fmt(tot('base'))}</td><td class="num">${fmt(tot('gst'))}</td><td class="num">${fmt(tot('other'))}</td><td class="num">${fmt(tot('total'))}</td></tr></tfoot>
      </table></div>
      <p class="muted">Pending payments: ${fmt(pending)} · Reimbursable to staff: ${fmt(reimb)} · Entries without bill: ${noBill}</p>
      <h3>Detailed ledger</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Date</th><th>Project</th><th>Category</th><th>Item</th><th>Vendor</th><th>Invoice</th><th class="num">Qty</th><th class="num">GST</th><th class="num">Total</th><th>Payment</th><th>Bill</th></tr></thead>
        <tbody>${list.map((e, i) => `<tr>
          <td>${i + 1}</td><td>${fmtDate(e.date)}</td><td>${esc(projectById(e.projectId)?.code || '—')}</td><td>${esc(e.category)}</td>
          <td>${esc(e.item)}</td><td>${esc(e.vendor)}</td><td>${esc(e.invoiceNo)}</td><td class="num">${e.qty}</td>
          <td class="num">${fmt(e.gstAmt)}</td><td class="num">${fmt(e.total)}</td>
          <td>${esc(e.paymentStatus)} · ${esc(e.paymentMode)}${e.paidBy ? ` · ${esc(e.paidBy)}` : ''}${e.paymentRef ? `<br><small class="muted">${esc(e.paymentRef)}</small>` : ''}</td>
          <td>${e.bills?.length ? `✔ ${e.bills.length}` : '—'}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }

  function csvCell(v) {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function exportCsv() {
    const { list } = reportData();
    const head = ['Date', 'Project code', 'Project name', 'Category', 'Item', 'Vendor', 'Invoice no', 'Qty', 'Unit price', 'Base amount', 'GST %', 'GST amount', 'Shipping/other', 'Total', 'Payment mode', 'Payment status', 'Paid by', 'Payment ref', 'Bills attached', 'Notes'];
    const lines = [head.join(',')].concat(list.map((e) => {
      const p = projectById(e.projectId);
      return [fmtDate(e.date), p?.code, p?.name, e.category, e.item, e.vendor, e.invoiceNo, e.qty, e.unitPrice, e.base, e.gst, e.gstAmt, e.shipping, e.total, e.paymentMode, e.paymentStatus, e.paidBy, e.paymentRef, e.bills?.length || 0, e.notes].map(csvCell).join(',');
    }));
    // BOM so Excel opens ₹ and Indian text correctly
    download(`wintek-rd-expenses-${today()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  function renderChips(el, items, onRemove) {
    el.innerHTML = items.map((c, i) => `<span class="chip">${esc(c)}<button type="button" data-i="${i}" aria-label="Remove ${esc(c)}">×</button></span>`).join('') || '<span class="muted">None</span>';
    $$('button', el).forEach((b) => b.addEventListener('click', () => onRemove(Number(b.dataset.i))));
  }
  async function renderSettings() {
    $('#s-company').value = state.settings.company;
    $('#s-gstin').value = state.settings.gstin;
    renderChips($('#s-categories'), state.settings.categories, async (i) => {
      const c = state.settings.categories[i];
      const used = state.expenses.filter((e) => e.category === c).length;
      if (used && !confirm(`“${c}” is used by ${used} expense(s). Remove from the list anyway? Existing entries keep it.`)) return;
      state.settings.categories.splice(i, 1);
      await saveSettings();
      renderSettings();
    });
    renderChips($('#s-people'), state.settings.people, async (i) => {
      state.settings.people.splice(i, 1);
      await saveSettings();
      renderSettings();
    });
    if (navigator.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      $('#s-storage').textContent = `Storage used: ${(usage / 1048576).toFixed(1)} MB of ${(quota / 1048576).toFixed(0)} MB available.`;
    }
  }

  async function backup() {
    const payload = {
      app: 'wintek-rd-expenses', version: 1, exportedAt: new Date().toISOString(),
      settings: state.settings, projects: state.projects, expenses: state.expenses,
    };
    download(`wintek-rd-backup-${today()}.json`, JSON.stringify(payload), 'application/json');
    state.settings.lastBackup = Date.now();
    await saveSettings();
  }

  async function restore(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { toast('Not a valid backup file'); return; }
    if (data.app !== 'wintek-rd-expenses' || !Array.isArray(data.projects) || !Array.isArray(data.expenses)) {
      toast('Not a Wintek R&D backup file');
      return;
    }
    if (!confirm(`Restore backup from ${data.exportedAt?.slice(0, 10) || 'unknown date'}? This replaces ALL current data (${data.projects.length} projects, ${data.expenses.length} expenses).`)) return;
    await clearStore('projects');
    await clearStore('expenses');
    for (const p of data.projects) await put('projects', p);
    for (const e of data.expenses) await put('expenses', e);
    state.settings = { ...state.settings, ...(data.settings || {}) };
    await saveSettings();
    await loadState();
    toast('Backup restored');
    render();
  }

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------
  function bind() {
    $$('.tabs button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
    $('#btn-add-expense').addEventListener('click', () => openExpenseDialog());
    $('#btn-add-project').addEventListener('click', () => openProjectDialog());

    const f = $('#form-expense');
    f.addEventListener('submit', saveExpense);
    ['qty', 'unitPrice', 'gst', 'shipping'].forEach((k) => f[k].addEventListener('input', updateTotalPreview));
    $('#exp-cancel').addEventListener('click', () => $('#dlg-expense').close());
    $('#exp-delete').addEventListener('click', deleteExpense);
    $('#bill-camera').addEventListener('change', (e) => { addBillFiles([...e.target.files]); e.target.value = ''; });
    $('#bill-files').addEventListener('change', (e) => { addBillFiles([...e.target.files]); e.target.value = ''; });
    $('#bill-close').addEventListener('click', () => $('#dlg-bill').close());

    $('#form-project').addEventListener('submit', saveProject);
    $('#proj-cancel').addEventListener('click', () => $('#dlg-project').close());
    $('#proj-delete').addEventListener('click', deleteProject);

    ['#f-search', '#f-project', '#f-category', '#f-status', '#f-from', '#f-to'].forEach((s) =>
      $(s).addEventListener('input', renderExpenses));
    $('#f-clear').addEventListener('click', () => {
      ['#f-search', '#f-project', '#f-category', '#f-status', '#f-from', '#f-to'].forEach((s) => { $(s).value = ''; });
      renderExpenses();
    });

    ['#r-project', '#r-from', '#r-to', '#r-group'].forEach((s) => $(s).addEventListener('input', renderReport));
    $('#r-csv').addEventListener('click', exportCsv);
    $('#r-print').addEventListener('click', () => window.print());

    $('#s-save-company').addEventListener('click', async () => {
      state.settings.company = $('#s-company').value.trim() || 'Wintek Solutions';
      state.settings.gstin = $('#s-gstin').value.trim().toUpperCase();
      await saveSettings();
      toast('Saved');
    });
    const addTo = (listKey, inputSel) => async () => {
      const v = $(inputSel).value.trim();
      if (!v || state.settings[listKey].includes(v)) return;
      state.settings[listKey].push(v);
      $(inputSel).value = '';
      await saveSettings();
      renderSettings();
    };
    $('#s-add-cat').addEventListener('click', addTo('categories', '#s-new-cat'));
    $('#s-add-person').addEventListener('click', addTo('people', '#s-new-person'));
    $('#s-backup').addEventListener('click', backup);
    $('#s-restore').addEventListener('change', (e) => { if (e.target.files[0]) restore(e.target.files[0]); e.target.value = ''; });

    window.addEventListener('hashchange', () => {
      const v = location.hash.slice(1);
      if ($(`#view-${v}`)) showView(v);
    });
  }

  async function init() {
    try {
      db = await openDb();
      await loadState();
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    } catch (err) {
      document.querySelector('main').innerHTML = `<div class="card">Could not open local storage: ${esc(err?.message || err)}. Private/incognito mode may block it.</div>`;
      return;
    }
    bind();
    const start = location.hash.slice(1);
    showView($(`#view-${start}`) ? start : 'dashboard');

    const lb = state.settings.lastBackup;
    if (state.expenses.length >= 5 && (!lb || Date.now() - lb > 7 * 864e5)) {
      setTimeout(() => toast('Reminder: download a backup from Settings'), 1200);
    }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // exposed for tests
  window.__wintek = { computeTotals, csvCell, state };
  init();
})();
