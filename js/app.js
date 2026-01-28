/**
 * 羽球收支管理系統 - 主程式
 */

// ============================================================
// Firebase 初始化
// ============================================================
let db = null;
let auth = null;

function initFirebase() {
  if (typeof firebase === 'undefined' || typeof isFirebaseConfigured === 'undefined' || !isFirebaseConfigured()) {
    console.warn('Firebase 尚未設定，使用 mock 資料模式');
    return false;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log('Firebase 初始化成功');
    return true;
  } catch (error) {
    console.error('Firebase 初始化失敗:', error);
    return false;
  }
}

// ============================================================
// 狀態管理
// ============================================================
const state = {
  records: [],          // 所有記錄
  filteredRecords: [],  // 篩選後的記錄
  isLoggedIn: false,    // 登入狀態
  currentUser: null,    // 當前使用者
  isLoading: false,     // 載入狀態
  useFirebase: false,   // 是否使用 Firebase
  allowedEmails: [],    // 允許登入的 email 清單
};

// ============================================================
// Mock 資料（Firebase 未設定時使用）
// ============================================================
const mockData = [
  {
    id: '1',
    date: '2024/01/28',
    location: '台中市',
    name: '王小明',
    identity: '會員',
    item: '場地費',
    amountDue: 300,
    amountPaid: 300,
    status: '已繳清',
    note: ''
  },
  {
    id: '2',
    date: '2024/01/28',
    location: '台中市',
    name: '李大華',
    identity: '非會員',
    item: '場地費',
    amountDue: 350,
    amountPaid: 0,
    status: '未繳',
    note: '下次補繳'
  },
  {
    id: '3',
    date: '2024/01/21',
    location: '台中市',
    name: '張美玲',
    identity: '會員',
    item: '場地費',
    amountDue: 300,
    amountPaid: 300,
    status: '已繳清',
    note: ''
  },
  {
    id: '4',
    date: '2024/01/21',
    location: '台中市',
    name: '公費支出',
    identity: '-',
    item: '場地租金',
    amountDue: -2000,
    amountPaid: -2000,
    status: '已支付',
    note: '1月場地費'
  },
  {
    id: '5',
    date: '2024/01/14',
    location: '台中市',
    name: '陳志豪',
    identity: '會員',
    item: '場地費',
    amountDue: 300,
    amountPaid: 300,
    status: '已繳清',
    note: ''
  }
];

// ============================================================
// DOM 元素
// ============================================================
const elements = {
  // Stats
  statIncome: document.getElementById('stat-income'),
  statExpense: document.getElementById('stat-expense'),
  statBalance: document.getElementById('stat-balance'),

  // Table
  tableBody: document.getElementById('table-body'),
  emptyState: document.getElementById('empty-state'),
  loadingState: document.getElementById('loading-state'),
  colActions: document.getElementById('col-actions'),

  // Filters
  filterDateStart: document.getElementById('filter-date-start'),
  filterDateEnd: document.getElementById('filter-date-end'),
  filterName: document.getElementById('filter-name'),

  // Buttons
  btnLogin: document.getElementById('btn-login'),
  btnImport: document.getElementById('btn-import'),
  btnExport: document.getElementById('btn-export'),
  btnAdd: document.getElementById('btn-add'),

  // Containers
  authArea: document.getElementById('auth-area'),
  toastContainer: document.getElementById('toast-container'),
  dialogContainer: document.getElementById('dialog-container'),
};

// ============================================================
// Firestore 操作
// ============================================================
const Firestore = {
  async getAll() {
    if (!state.useFirebase) {
      return [...mockData];
    }
    const snapshot = await db.collection('accounting').orderBy('date', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async create(data) {
    if (!state.useFirebase) {
      const newRecord = { id: String(Date.now()), ...data, createdAt: new Date(), updatedAt: new Date() };
      mockData.unshift(newRecord);
      return newRecord.id;
    }
    const docRef = await db.collection('accounting').add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.currentUser?.email || 'unknown'
    });
    return docRef.id;
  },

  async update(id, data) {
    if (!state.useFirebase) {
      const index = mockData.findIndex(r => r.id === id);
      if (index !== -1) mockData[index] = { ...mockData[index], ...data, updatedAt: new Date() };
      return;
    }
    await db.collection('accounting').doc(id).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async delete(id) {
    if (!state.useFirebase) {
      const index = mockData.findIndex(r => r.id === id);
      if (index !== -1) mockData.splice(index, 1);
      return;
    }
    await db.collection('accounting').doc(id).delete();
  },

  async batchCreate(records) {
    if (!state.useFirebase) {
      records.forEach(record => {
        mockData.unshift({ id: String(Date.now() + Math.random()), ...record, createdAt: new Date(), updatedAt: new Date() });
      });
      return;
    }
    const batch = db.batch();
    records.forEach(record => {
      const docRef = db.collection('accounting').doc();
      batch.set(docRef, {
        ...record,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser?.email || 'unknown'
      });
    });
    await batch.commit();
  },

  async getAllowedEmails() {
    if (!state.useFirebase) return ['admin@example.com'];
    try {
      const doc = await db.collection('settings').doc('allowedEmails').get();
      if (doc.exists) return doc.data().emails || [];
    } catch (error) {
      console.error('取得白名單失敗:', error);
    }
    return [];
  }
};

// ============================================================
// Auth 操作
// ============================================================
const Auth = {
  async signIn() {
    if (!state.useFirebase) {
      state.isLoggedIn = true;
      state.currentUser = { email: 'admin@example.com', displayName: '測試管理員', photoURL: null };
      updateAuthUI();
      await loadData();
      showToast('success', '登入成功（測試模式）');
      return;
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      const allowed = await this.isAllowed(result.user.email);
      if (!allowed) {
        await auth.signOut();
        showToast('error', '權限不足，請聯絡管理員');
        return;
      }
      showToast('success', '登入成功');
    } catch (error) {
      console.error('登入失敗:', error);
      showToast('error', '登入失敗：' + error.message);
    }
  },

  async signOut() {
    if (!state.useFirebase) {
      state.isLoggedIn = false;
      state.currentUser = null;
      updateAuthUI();
      showToast('success', '已登出');
      return;
    }
    try {
      await auth.signOut();
      showToast('success', '已登出');
    } catch (error) {
      console.error('登出失敗:', error);
      showToast('error', '登出失敗');
    }
  },

  async isAllowed(email) {
    if (state.allowedEmails.length === 0) {
      state.allowedEmails = await Firestore.getAllowedEmails();
    }
    return state.allowedEmails.includes(email);
  },

  onAuthStateChanged(callback) {
    if (!state.useFirebase) {
      callback(null);
      return () => {};
    }
    return auth.onAuthStateChanged(callback);
  }
};

// ============================================================
// 工具函數
// ============================================================
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  const formatted = Math.abs(num).toLocaleString('zh-TW');
  return num < 0 ? `-$${formatted}` : `$${formatted}`;
}

function getStatusClass(status) {
  switch (status) {
    case '已繳清': return 'bg-emerald-100 text-emerald-700';
    case '已支付': return 'bg-blue-100 text-blue-700';
    case '未繳': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-500';
  }
}

function calculateStats(records) {
  let totalIncome = 0;
  let totalExpense = 0;
  records.forEach(record => {
    const amount = record.amountDue || 0;
    if (amount >= 0) totalIncome += amount;
    else totalExpense += Math.abs(amount);
  });
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
}

// ============================================================
// 渲染函數
// ============================================================
function renderStats() {
  const stats = calculateStats(state.filteredRecords);
  elements.statIncome.textContent = formatCurrency(stats.totalIncome);
  elements.statExpense.textContent = formatCurrency(stats.totalExpense);
  elements.statBalance.textContent = formatCurrency(stats.balance);
  elements.statBalance.className = stats.balance >= 0
    ? 'text-3xl font-bold text-blue-600 mt-2'
    : 'text-3xl font-bold text-rose-500 mt-2';
}

function renderTableRow(record) {
  const amountClass = record.amountDue < 0 ? 'text-rose-500' : 'text-slate-900';
  const paidClass = record.amountPaid < 0 ? 'text-rose-500' : 'text-slate-900';
  return `
    <tr class="hover:bg-slate-50 transition-colors" data-id="${record.id}">
      <td class="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">${record.date}</td>
      <td class="px-4 py-3 text-sm text-slate-900">${record.location || '-'}</td>
      <td class="px-4 py-3 text-sm text-slate-900 font-medium">${record.name}</td>
      <td class="px-4 py-3 text-sm text-slate-500">${record.identity || '-'}</td>
      <td class="px-4 py-3 text-sm text-slate-900">${record.item || '-'}</td>
      <td class="px-4 py-3 text-sm ${amountClass} text-right font-medium">${formatCurrency(record.amountDue)}</td>
      <td class="px-4 py-3 text-sm ${paidClass} text-right">${formatCurrency(record.amountPaid)}</td>
      <td class="px-4 py-3 text-sm">
        <span class="px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(record.status)}">${record.status || '-'}</span>
      </td>
      <td class="px-4 py-3 text-sm text-slate-500 max-w-[200px] truncate" title="${record.note || ''}">${record.note || '-'}</td>
      ${state.isLoggedIn ? `
        <td class="px-4 py-3 text-center">
          <div class="flex items-center justify-center gap-1">
            <button onclick="handleEdit('${record.id}')" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onclick="handleDelete('${record.id}')" class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="刪除">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      ` : ''}
    </tr>
  `;
}

function renderTable() {
  if (state.isLoading) {
    elements.tableBody.innerHTML = '';
    elements.emptyState.classList.add('hidden');
    elements.loadingState.classList.remove('hidden');
    return;
  }
  elements.loadingState.classList.add('hidden');
  if (state.filteredRecords.length === 0) {
    elements.tableBody.innerHTML = '';
    elements.emptyState.classList.remove('hidden');
    return;
  }
  elements.emptyState.classList.add('hidden');
  elements.tableBody.innerHTML = state.filteredRecords.map(renderTableRow).join('');
}

function updateAuthUI() {
  elements.colActions.classList.toggle('hidden', !state.isLoggedIn);
  elements.btnImport.classList.toggle('hidden', !state.isLoggedIn);
  elements.btnImport.classList.toggle('flex', state.isLoggedIn);
  elements.btnAdd.classList.toggle('hidden', !state.isLoggedIn);
  elements.btnAdd.classList.toggle('flex', state.isLoggedIn);

  if (state.isLoggedIn && state.currentUser) {
    elements.authArea.innerHTML = `
      <div class="flex items-center gap-3">
        ${state.currentUser.photoURL
          ? `<img src="${state.currentUser.photoURL}" alt="${state.currentUser.displayName || ''}" class="w-8 h-8 rounded-full border border-slate-200">`
          : `<div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">${(state.currentUser.displayName || state.currentUser.email || '?')[0].toUpperCase()}</div>`
        }
        <span class="text-sm text-slate-700 hidden sm:inline">${state.currentUser.displayName || state.currentUser.email}</span>
        <button id="btn-logout" class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          登出
        </button>
      </div>
    `;
    document.getElementById('btn-logout').addEventListener('click', handleLogout);
  } else {
    elements.authArea.innerHTML = `
      <button id="btn-login" class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
        登入
      </button>
    `;
    document.getElementById('btn-login').addEventListener('click', handleLogin);
  }
  renderTable();
}

// ============================================================
// 篩選功能
// ============================================================
function applyFilters() {
  const startDate = elements.filterDateStart.value;
  const endDate = elements.filterDateEnd.value;
  const nameQuery = elements.filterName.value.toLowerCase().trim();

  state.filteredRecords = state.records.filter(record => {
    const recordDate = record.date.replace(/\//g, '-');
    if (startDate && recordDate < startDate) return false;
    if (endDate && recordDate > endDate) return false;
    if (nameQuery && !record.name.toLowerCase().includes(nameQuery)) return false;
    return true;
  });
  renderStats();
  renderTable();
}

// ============================================================
// 資料載入
// ============================================================
async function loadData() {
  state.isLoading = true;
  renderTable();
  try {
    state.records = await Firestore.getAll();
    state.filteredRecords = [...state.records];
    renderStats();
  } catch (error) {
    console.error('載入資料失敗:', error);
    showToast('error', '載入資料失敗');
  } finally {
    state.isLoading = false;
    renderTable();
  }
}

// ============================================================
// 事件處理
// ============================================================
async function handleLogin() { await Auth.signIn(); }
async function handleLogout() { await Auth.signOut(); }

function handleEdit(id) {
  const record = state.records.find(r => r.id === id);
  if (record) showRecordDialog(record);
}

function handleDelete(id) {
  showConfirmDialog('確認刪除', '確定要刪除這筆記錄嗎？此操作無法復原。', async () => {
    try {
      await Firestore.delete(id);
      await loadData();
      showToast('success', '記錄已刪除');
    } catch (error) {
      console.error('刪除失敗:', error);
      showToast('error', '刪除失敗');
    }
  });
}

function handleExport() { exportToCSV(); }
function handleImport() { showImportDialog(); }
function handleAdd() { showRecordDialog(null); }

// ============================================================
// CSV 匯出
// ============================================================
function exportToCSV() {
  const headers = ['時間', '地點', '姓名', '身分', '項目', '應收', '已收', '狀態', '備註'];
  const rows = state.filteredRecords.map(r => [
    r.date, r.location || '', r.name, r.identity || '', r.item || '',
    r.amountDue || 0, r.amountPaid || 0, r.status || '', r.note || ''
  ]);
  const BOM = '\uFEFF';
  const csvContent = BOM + [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `羽球收支_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('success', 'CSV 匯出成功');
}

// ============================================================
// CSV 匯入
// ============================================================
function showImportDialog() {
  const dialog = document.createElement('div');
  dialog.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  dialog.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
      <h2 class="text-xl font-bold text-slate-900 mb-4">匯入 CSV</h2>
      <div class="space-y-4">
        <div class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
          <input type="file" id="csv-file" accept=".csv" class="hidden">
          <label for="csv-file" class="cursor-pointer">
            <svg class="mx-auto h-12 w-12 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p class="text-slate-600">點擊選擇 CSV 檔案</p>
          </label>
        </div>
        <div id="import-preview" class="hidden">
          <p class="text-sm font-medium text-slate-700 mb-2">預覽（前 5 筆）</p>
          <div class="max-h-48 overflow-auto border border-slate-200 rounded-lg">
            <table class="w-full text-xs">
              <thead id="preview-head" class="bg-slate-50"></thead>
              <tbody id="preview-body"></tbody>
            </table>
          </div>
          <p id="import-count" class="text-sm text-slate-500 mt-2"></p>
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button id="btn-import-cancel" class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">取消</button>
        <button id="btn-import-confirm" disabled class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">匯入</button>
      </div>
    </div>
  `;
  elements.dialogContainer.appendChild(dialog);

  let parsedRecords = [];

  document.getElementById('csv-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    parsedRecords = parseCSV(text);
    if (parsedRecords.length === 0) {
      showToast('error', 'CSV 檔案無有效資料');
      return;
    }
    document.getElementById('preview-head').innerHTML = `<tr><th class="px-2 py-1 text-left">日期</th><th class="px-2 py-1 text-left">姓名</th><th class="px-2 py-1 text-right">應收</th><th class="px-2 py-1 text-left">狀態</th></tr>`;
    document.getElementById('preview-body').innerHTML = parsedRecords.slice(0, 5).map(r => `<tr class="border-t border-slate-100"><td class="px-2 py-1">${r.date}</td><td class="px-2 py-1">${r.name}</td><td class="px-2 py-1 text-right">${r.amountDue}</td><td class="px-2 py-1">${r.status || '-'}</td></tr>`).join('');
    document.getElementById('import-count').textContent = `共 ${parsedRecords.length} 筆資料`;
    document.getElementById('import-preview').classList.remove('hidden');
    document.getElementById('btn-import-confirm').disabled = false;
  });

  document.getElementById('btn-import-cancel').addEventListener('click', () => dialog.remove());
  document.getElementById('btn-import-confirm').addEventListener('click', async () => {
    try {
      await Firestore.batchCreate(parsedRecords);
      await loadData();
      showToast('success', `成功匯入 ${parsedRecords.length} 筆資料`);
      dialog.remove();
    } catch (error) {
      console.error('匯入失敗:', error);
      showToast('error', '匯入失敗');
    }
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.remove(); });
}

function parseCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const fieldMap = { '時間': 'date', '地點': 'location', '姓名': 'name', '身分': 'identity', '項目': 'item', '應收': 'amountDue', '已收': 'amountPaid', '狀態': 'status', '備註': 'note' };

  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = [];
    let current = '', inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
      else current += char;
    }
    values.push(current.trim());

    const record = {};
    headers.forEach((header, i) => {
      const field = fieldMap[header];
      if (field) {
        let value = values[i]?.replace(/^"|"$/g, '') || '';
        if (['amountDue', 'amountPaid'].includes(field)) value = parseFloat(value) || 0;
        record[field] = value;
      }
    });
    return {
      date: record.date || '', location: record.location || '', name: record.name || '',
      identity: record.identity || '-', item: record.item || '', amountDue: record.amountDue || 0,
      amountPaid: record.amountPaid || 0, status: record.status || '-', note: record.note || ''
    };
  }).filter(r => r.date && r.name);
}

// ============================================================
// 記錄 Dialog
// ============================================================
function showRecordDialog(record = null) {
  const isEdit = !!record;
  const dialog = document.createElement('div');
  dialog.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  dialog.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl font-bold text-slate-900 mb-4">${isEdit ? '編輯記錄' : '新增記錄'}</h2>
      <form id="record-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">日期 <span class="text-rose-500">*</span></label>
            <input type="date" name="date" required value="${record?.date?.replace(/\//g, '-') || ''}" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">地點</label>
            <input type="text" name="location" value="${record?.location || ''}" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">姓名 <span class="text-rose-500">*</span></label>
            <input type="text" name="name" required value="${record?.name || ''}" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">身分</label>
            <select name="identity" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
              <option value="-" ${!record?.identity || record?.identity === '-' ? 'selected' : ''}>-</option>
              <option value="會員" ${record?.identity === '會員' ? 'selected' : ''}>會員</option>
              <option value="非會員" ${record?.identity === '非會員' ? 'selected' : ''}>非會員</option>
            </select>
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">項目</label>
          <input type="text" name="item" value="${record?.item || ''}" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">應收 <span class="text-rose-500">*</span></label>
            <input type="number" name="amountDue" required value="${record?.amountDue ?? ''}" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
            <p class="text-xs text-slate-400">負數表示支出</p>
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">已收</label>
            <input type="number" name="amountPaid" value="${record?.amountPaid ?? 0}" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">狀態</label>
          <select name="status" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
            <option value="-" ${!record?.status || record?.status === '-' ? 'selected' : ''}>-</option>
            <option value="已繳清" ${record?.status === '已繳清' ? 'selected' : ''}>已繳清</option>
            <option value="已支付" ${record?.status === '已支付' ? 'selected' : ''}>已支付</option>
            <option value="未繳" ${record?.status === '未繳' ? 'selected' : ''}>未繳</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">備註</label>
          <textarea name="note" rows="2" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">${record?.note || ''}</textarea>
        </div>
      </form>
      <div class="flex justify-end gap-3 mt-6">
        <button id="btn-dialog-cancel" class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">取消</button>
        <button id="btn-dialog-save" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">${isEdit ? '儲存' : '新增'}</button>
      </div>
    </div>
  `;
  elements.dialogContainer.appendChild(dialog);

  document.getElementById('btn-dialog-cancel').addEventListener('click', () => dialog.remove());
  document.getElementById('btn-dialog-save').addEventListener('click', async () => {
    const form = document.getElementById('record-form');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const formData = new FormData(form);
    const data = {
      date: formData.get('date').replace(/-/g, '/'),
      location: formData.get('location') || '',
      name: formData.get('name'),
      identity: formData.get('identity'),
      item: formData.get('item') || '',
      amountDue: parseFloat(formData.get('amountDue')) || 0,
      amountPaid: parseFloat(formData.get('amountPaid')) || 0,
      status: formData.get('status'),
      note: formData.get('note') || ''
    };
    try {
      if (isEdit) { await Firestore.update(record.id, data); showToast('success', '記錄已更新'); }
      else { await Firestore.create(data); showToast('success', '記錄已新增'); }
      await loadData();
      dialog.remove();
    } catch (error) {
      console.error('儲存失敗:', error);
      showToast('error', '儲存失敗');
    }
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.remove(); });
}

// ============================================================
// 確認 Dialog
// ============================================================
function showConfirmDialog(title, message, onConfirm) {
  const dialog = document.createElement('div');
  dialog.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  dialog.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
      <h2 class="text-xl font-bold text-slate-900 mb-2">${title}</h2>
      <p class="text-slate-600 mb-6">${message}</p>
      <div class="flex justify-end gap-3">
        <button id="btn-confirm-cancel" class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">取消</button>
        <button id="btn-confirm-ok" class="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors">確認</button>
      </div>
    </div>
  `;
  elements.dialogContainer.appendChild(dialog);
  document.getElementById('btn-confirm-cancel').addEventListener('click', () => dialog.remove());
  document.getElementById('btn-confirm-ok').addEventListener('click', () => { dialog.remove(); onConfirm(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.remove(); });
}

// ============================================================
// Toast 通知
// ============================================================
function showToast(type, message, duration = 3000) {
  const colors = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-blue-600', warning: 'bg-amber-500' };
  const icons = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />',
    error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />',
    info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
    warning: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />'
  };
  const toast = document.createElement('div');
  toast.className = `${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in`;
  toast.innerHTML = `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icons[type]}</svg><span class="text-sm">${message}</span>`;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => { toast.classList.add('animate-slide-out'); setTimeout(() => toast.remove(), 300); }, duration);
}

// ============================================================
// 初始化
// ============================================================
async function init() {
  state.useFirebase = initFirebase();
  if (!state.useFirebase) showToast('info', '使用測試模式（Firebase 未設定）', 5000);

  Auth.onAuthStateChanged(async (user) => {
    if (user) {
      const allowed = await Auth.isAllowed(user.email);
      if (allowed) { state.isLoggedIn = true; state.currentUser = user; }
      else { state.isLoggedIn = false; state.currentUser = null; }
    } else { state.isLoggedIn = false; state.currentUser = null; }
    updateAuthUI();
  });

  await loadData();

  elements.filterDateStart.addEventListener('change', applyFilters);
  elements.filterDateEnd.addEventListener('change', applyFilters);
  elements.filterName.addEventListener('input', applyFilters);
  elements.btnExport.addEventListener('click', handleExport);
  elements.btnImport.addEventListener('click', handleImport);
  elements.btnAdd.addEventListener('click', handleAdd);
}

document.addEventListener('DOMContentLoaded', init);
