// Client-side Application Logic for Google Maps Lead Finder
// Supports Multi-Category, Persistent Storage, Call Tracking, User Auth & Admin Panel

let currentJobId = null;
let eventSource = null;
let allPlaces = [];
let presetsData = null;
let selectedCategories = new Set();
let currentUserName = localStorage.getItem('leadHunter_userName') || '';
let currentAppSecret = localStorage.getItem('leadHunter_appSecret') || '';

// DOM Elements: User & Header
const currentUserNameEl = document.getElementById('currentUserName');
const changeUserBtn = document.getElementById('changeUserBtn');
const userNameModal = document.getElementById('userNameModal');
const userNameForm = document.getElementById('userNameForm');
const userNameInput = document.getElementById('userNameInput');
const appSecretInput = document.getElementById('appSecretInput');

// DOM Elements: Admin Modal
const openAdminBtn = document.getElementById('openAdminBtn');
const adminModal = document.getElementById('adminModal');
const closeAdminBtn = document.getElementById('closeAdminBtn');
const closeAdminLoginBtn = document.getElementById('closeAdminLoginBtn');
const adminLoginView = document.getElementById('adminLoginView');
const adminDashboardView = document.getElementById('adminDashboardView');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminUsernameInput = document.getElementById('adminUsername');
const adminPasswordInput = document.getElementById('adminPassword');
const adminLoginError = document.getElementById('adminLoginError');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const refreshAdminStatsBtn = document.getElementById('refreshAdminStatsBtn');

const adminStatUsers = document.getElementById('adminStatUsers');
const adminStatLeads = document.getElementById('adminStatLeads');
const adminStatCalled = document.getElementById('adminStatCalled');
const adminStatPending = document.getElementById('adminStatPending');
const adminUsersTableBody = document.getElementById('adminUsersTableBody');
const adminCallsTableBody = document.getElementById('adminCallsTableBody');

// DOM Elements: Search Form
const searchForm = document.getElementById('searchForm');
const categoryInput = document.getElementById('categoryInput');
const categoryPillsContainer = document.getElementById('categoryPills');
const selectedCategoriesBadge = document.getElementById('selectedCategoriesBadge');
const selectAllCatsBtn = document.getElementById('selectAllCatsBtn');
const clearAllCatsBtn = document.getElementById('clearAllCatsBtn');

const oblastSelect = document.getElementById('oblastSelect');
const cityInput = document.getElementById('cityInput');
const cityDatalist = document.getElementById('cityDatalist');
const limitSelect = document.getElementById('limitSelect');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const startIcon = document.getElementById('startIcon');
const spinnerIcon = document.getElementById('spinnerIcon');

const statusIndicator = document.getElementById('statusIndicator');
const statusPing = document.getElementById('statusPing');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressCurrentPlace = document.getElementById('progressCurrentPlace');
const progressStats = document.getElementById('progressStats');

const countFound = document.getElementById('countFound');
const countPending = document.getElementById('countPending');
const countCalled = document.getElementById('countCalled');
const countCallback = document.getElementById('countCallback');
const countNoAdmin = document.getElementById('countNoAdmin');
const countWithPhone = document.getElementById('countWithPhone');

const pillCountPending = document.getElementById('pillCountPending');
const pillCountCalled = document.getElementById('pillCountCalled');
const pillCountCallback = document.getElementById('pillCountCallback');
const pillCountNoAdmin = document.getElementById('pillCountNoAdmin');

const placesTableBody = document.getElementById('placesTableBody');
const emptyRow = document.getElementById('emptyRow');
const tableShowingCount = document.getElementById('tableShowingCount');
const tableSearch = document.getElementById('tableSearch');
const phoneOnlyFilter = document.getElementById('phoneOnlyFilter');
const callStatusFilter = document.getElementById('callStatusFilter');

const exportXlsxBtn = document.getElementById('exportXlsxBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const copyPhonesBtn = document.getElementById('copyPhonesBtn');
const adminClearDatabaseBtn = document.getElementById('adminClearDatabaseBtn');

// DOM Elements: Note / Comment Modal
const noteModal = document.getElementById('noteModal');
const noteModalTitle = document.getElementById('noteModalTitle');
const noteModalSubtitle = document.getElementById('noteModalSubtitle');
const noteModalForm = document.getElementById('noteModalForm');
const noteModalLeadId = document.getElementById('noteModalLeadId');
const noteModalInput = document.getElementById('noteModalInput');
const closeNoteModalBtn = document.getElementById('closeNoteModalBtn');
const cancelNoteModalBtn = document.getElementById('cancelNoteModalBtn');

// DOM Elements: Custom Problem Modal & Confirmation Modal
const problemModal = document.getElementById('problemModal');
const problemTitle = document.getElementById('problemTitle');
const problemMessage = document.getElementById('problemMessage');
const problemAdviceBox = document.getElementById('problemAdviceBox');
const problemAdviceText = document.getElementById('problemAdviceText');
const problemIconContainer = document.getElementById('problemIconContainer');
const problemPrimaryBtn = document.getElementById('problemPrimaryBtn');
const problemSecondaryBtn = document.getElementById('problemSecondaryBtn');
const closeProblemModalBtn = document.getElementById('closeProblemModalBtn');

const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');

// 0. Кастомна система спливаючих сповіщень (Toasts)
function showToast(message, type = 'info', title = null, duration = 4200) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  
  let bgBorderClass = 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-black/50';
  let icon = 'ℹ️';
  let defaultTitle = 'Повідомлення';

  if (type === 'error') {
    bgBorderClass = 'bg-slate-900/95 border-rose-500/50 text-rose-100 shadow-rose-950/40 border-l-4 border-l-rose-500';
    icon = '❌';
    defaultTitle = 'Помилка';
  } else if (type === 'warning') {
    bgBorderClass = 'bg-slate-900/95 border-amber-500/50 text-amber-100 shadow-amber-950/40 border-l-4 border-l-amber-500';
    icon = '⚠️';
    defaultTitle = 'Увага';
  } else if (type === 'success') {
    bgBorderClass = 'bg-slate-900/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/40 border-l-4 border-l-emerald-500';
    icon = '✅';
    defaultTitle = 'Успішно';
  }

  toast.className = `pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md text-xs toast-in transition ${bgBorderClass}`;
  
  toast.innerHTML = `
    <span class="text-base shrink-0 select-none mt-0.5">${icon}</span>
    <div class="flex-1 space-y-0.5 pr-1">
      <div class="font-bold tracking-tight text-white">${escapeHtml(title || defaultTitle)}</div>
      <div class="text-[11px] leading-relaxed text-slate-300 opacity-95">${escapeHtml(message)}</div>
    </div>
    <button type="button" class="text-slate-400 hover:text-white transition text-xs shrink-0 select-none p-1 rounded-lg hover:bg-slate-800">✕</button>
  `;

  const closeBtn = toast.querySelector('button');
  const dismiss = () => {
    toast.classList.remove('toast-in');
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 260);
  };

  closeBtn.addEventListener('click', dismiss);
  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  container.appendChild(toast);
}

// 0.1 Кастомне діалогове вікно опису проблеми (Problem Modal)
function showProblemDialog({ 
  title = 'Виникла проблема', 
  message = '', 
  advice = '', 
  type = 'error', 
  primaryBtnText = 'Зрозуміло',
  secondaryBtnText = null,
  onPrimary = null,
  onSecondary = null 
}) {
  if (!problemModal) return;

  problemTitle.textContent = title;
  problemMessage.textContent = message;

  if (advice) {
    problemAdviceText.textContent = advice;
    problemAdviceBox.classList.remove('hidden');
  } else {
    problemAdviceBox.classList.add('hidden');
  }

  if (type === 'warning') {
    problemIconContainer.textContent = '⚡';
    problemIconContainer.className = 'w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-2xl';
  } else {
    problemIconContainer.textContent = '⚠️';
    problemIconContainer.className = 'w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 text-2xl';
  }

  problemPrimaryBtn.textContent = primaryBtnText;
  problemPrimaryBtn.onclick = () => {
    closeProblemDialog();
    if (onPrimary) onPrimary();
  };

  if (secondaryBtnText) {
    problemSecondaryBtn.textContent = secondaryBtnText;
    problemSecondaryBtn.classList.remove('hidden');
    problemSecondaryBtn.onclick = () => {
      closeProblemDialog();
      if (onSecondary) onSecondary();
    };
  } else {
    problemSecondaryBtn.classList.add('hidden');
  }

  problemModal.classList.remove('hidden');
}

function closeProblemDialog() {
  if (problemModal) problemModal.classList.add('hidden');
}

if (closeProblemModalBtn) {
  closeProblemModalBtn.addEventListener('click', closeProblemDialog);
}

// 0.2 Кастомне діалогове вікно підтвердження (Confirmation Modal)
function showConfirmDialog({ title, message, okText = 'Підтвердити', cancelText = 'Скасувати' }) {
  return new Promise(resolve => {
    if (!confirmModal) {
      resolve(confirm(message));
      return;
    }

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOkBtn.textContent = okText;
    confirmCancelBtn.textContent = cancelText;

    const cleanup = () => {
      confirmModal.classList.add('hidden');
      confirmOkBtn.onclick = null;
      confirmCancelBtn.onclick = null;
    };

    confirmOkBtn.onclick = () => {
      cleanup();
      resolve(true);
    };

    confirmCancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };

    confirmModal.classList.remove('hidden');
  });
}

// 0.3 Локальне збереження та відновлення стану (Кеш лідів та форми для захисту від втрати при F5 / оновленні сторінки)
function saveLocalLeads() {
  try {
    localStorage.setItem('leadHunter_savedLeads', JSON.stringify(allPlaces));
  } catch (e) {
    console.warn('Не вдалося зберегти ліди в localStorage:', e);
  }
}

function loadLocalLeads() {
  try {
    const raw = localStorage.getItem('leadHunter_savedLeads');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Помилка читання localStorage:', e);
  }
  return [];
}

function saveSearchFormState() {
  try {
    const state = {
      city: cityInput ? cityInput.value : '',
      oblast: oblastSelect ? oblastSelect.value : '',
      limit: limitSelect ? limitSelect.value : '40',
      filterMode: document.querySelector('input[name="filterMode"]:checked')?.value || 'all_no_website',
      categories: Array.from(selectedCategories)
    };
    localStorage.setItem('leadHunter_searchState', JSON.stringify(state));
  } catch (e) {}
}

function restoreSearchFormState() {
  try {
    const raw = localStorage.getItem('leadHunter_searchState');
    if (raw) {
      const state = JSON.parse(raw);
      if (state.city && cityInput) cityInput.value = state.city;
      if (state.oblast && oblastSelect) oblastSelect.value = state.oblast;
      if (state.limit && limitSelect) limitSelect.value = state.limit;
      if (state.filterMode) {
        const radio = document.querySelector(`input[name="filterMode"][value="${state.filterMode}"]`);
        if (radio) radio.checked = true;
      }
      if (Array.isArray(state.categories) && state.categories.length > 0) {
        selectedCategories = new Set(state.categories);
      }
    }
  } catch (e) {}
}

function mergeServerAndLocalLeads(serverLeads) {
  const map = new Map();

  // Спочатку беремо наявні локальні ліди
  allPlaces.forEach(lead => {
    const key = lead.uniqueKey || (lead.phone && lead.phone !== 'Не вказано' ? `phone_${lead.phone}` : lead.name);
    map.set(key, lead);
  });

  // Оновлюємо або додаємо з сервера (зберігаючи актуальні статуси дзвінків та нотатки)
  serverLeads.forEach(sLead => {
    const key = sLead.uniqueKey || (sLead.phone && sLead.phone !== 'Не вказано' ? `phone_${sLead.phone}` : sLead.name);
    if (map.has(key)) {
      const local = map.get(key);
      const serverTime = new Date(sLead.updatedAt || sLead.calledAt || 0).getTime();
      const localTime = new Date(local.updatedAt || local.calledAt || 0).getTime();
      if (serverTime >= localTime) {
        map.set(key, { ...local, ...sLead });
      } else {
        map.set(key, { ...sLead, ...local });
      }
    } else {
      map.set(key, sLead);
    }
  });

  allPlaces = Array.from(map.values());
}

async function syncLeadsToServer(leads) {
  if (!leads || leads.length === 0) return;
  try {
    await fetch('/api/leads/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-secret': currentAppSecret || '',
        'x-user-name': encodeURIComponent(currentUserName || 'User')
      },
      body: JSON.stringify({ leads })
    });
  } catch (e) {
    console.warn('Помилка синхронізації з сервером:', e);
  }
}

// Ініціалізація
document.addEventListener('DOMContentLoaded', async () => {
  initUserSession();

  // 1. Негайно відновлюємо ліди з локального сховища браузера (миттєве відображення без втрати)
  const localLeads = loadLocalLeads();
  if (localLeads.length > 0) {
    allPlaces = localLeads;
    updateCounters();
    renderTableRows();
    statusText.textContent = `Збережено: ${allPlaces.length} лідів`;
  }

  // 2. Відновлюємо налаштування форми пошуку (місто, категорія тощо)
  restoreSearchFormState();

  await loadPresets();
  await loadSavedLeads();
  setupEventListeners();
});

// 1. Управління сесією користувача (ім'я менеджера та ключ команди)
function initUserSession() {
  if (currentUserName && currentUserName.trim() && currentAppSecret && currentAppSecret.trim()) {
    currentUserNameEl.textContent = currentUserName;
    registerUserOnServer(currentUserName);
  } else {
    showUserNameModal();
  }
}

function showUserNameModal() {
  userNameInput.value = currentUserName || '';
  if (appSecretInput) appSecretInput.value = currentAppSecret || '';
  userNameModal.classList.remove('hidden');
  if (!currentUserName) {
    setTimeout(() => userNameInput.focus(), 100);
  } else if (appSecretInput && !currentAppSecret) {
    setTimeout(() => appSecretInput.focus(), 100);
  }
}

function hideUserNameModal() {
  userNameModal.classList.add('hidden');
}

async function registerUserOnServer(name) {
  try {
    await fetch('/api/auth/register-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
  } catch (e) {}
}

userNameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = userNameInput.value.trim();
  if (!name) {
    userNameInput.focus();
    return;
  }

  const secret = appSecretInput ? appSecretInput.value.trim() : '';
  if (!secret) {
    showCustomNotification('Будь ласка, введіть ключ доступу команди (APP_SECRET)', 'warning');
    if (appSecretInput) appSecretInput.focus();
    return;
  }

  currentAppSecret = secret;
  localStorage.setItem('leadHunter_appSecret', currentAppSecret);

  currentUserName = name;
  localStorage.setItem('leadHunter_userName', currentUserName);
  currentUserNameEl.textContent = currentUserName;
  hideUserNameModal();
  await registerUserOnServer(currentUserName);
  await loadSavedLeads();
});

changeUserBtn.addEventListener('click', showUserNameModal);

// 2. Управління Адмін-Панеллю
openAdminBtn.addEventListener('click', () => {
  adminModal.classList.remove('hidden');
  const token = sessionStorage.getItem('leadHunter_adminToken');
  if (token) {
    showAdminDashboard();
  } else {
    showAdminLogin();
  }
});

closeAdminBtn.addEventListener('click', () => adminModal.classList.add('hidden'));
closeAdminLoginBtn.addEventListener('click', () => adminModal.classList.add('hidden'));

function showAdminLogin() {
  adminLoginView.classList.remove('hidden');
  adminDashboardView.classList.add('hidden');
  adminLoginError.classList.add('hidden');
  adminUsernameInput.value = '';
  adminPasswordInput.value = '';
  setTimeout(() => adminUsernameInput.focus(), 100);
}

function showAdminDashboard() {
  adminLoginView.classList.add('hidden');
  adminDashboardView.classList.remove('hidden');
  loadAdminStats();
}

adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  adminLoginError.classList.add('hidden');

  const username = adminUsernameInput.value.trim();
  const password = adminPasswordInput.value.trim();

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Помилка авторизації');
    }

    sessionStorage.setItem('leadHunter_adminToken', data.token);
    showAdminDashboard();
  } catch (err) {
    adminLoginError.textContent = err.message;
    adminLoginError.classList.remove('hidden');
  }
});

adminLogoutBtn.addEventListener('click', async () => {
  const token = sessionStorage.getItem('leadHunter_adminToken');
  if (token) {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {}
  }
  sessionStorage.removeItem('leadHunter_adminToken');
  showAdminLogin();
});

refreshAdminStatsBtn.addEventListener('click', loadAdminStats);

async function loadAdminStats() {
  const token = sessionStorage.getItem('leadHunter_adminToken');
  if (!token) {
    showAdminLogin();
    return;
  }

  try {
    const res = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem('leadHunter_adminToken');
      showAdminLogin();
      return;
    }

    const data = await res.json();

    adminStatUsers.textContent = data.totalUsers || 0;
    adminStatLeads.textContent = data.totalLeads || 0;
    adminStatCalled.textContent = data.totalCalled || 0;
    adminStatPending.textContent = data.totalPending || 0;

    // Рендеринг таблиці менеджерів (із захистом від XSS)
    adminUsersTableBody.innerHTML = '';
    if (Array.isArray(data.users) && data.users.length > 0) {
      data.users.forEach((u, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition';
        tr.innerHTML = `
          <td class="py-2.5 px-3 text-slate-400 font-mono">${idx + 1}</td>
          <td class="py-2.5 px-3 font-semibold text-slate-100 flex items-center gap-1.5">
            <span>👤</span> <span>${escapeHtml(u.name)}</span>
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              📞 ${Number(u.callsCount) || 0}
            </span>
          </td>
          <td class="py-2.5 px-3 text-slate-400 text-[11px]">${escapeHtml(u.firstSeenAt || '-')}</td>
          <td class="py-2.5 px-3 text-slate-300 text-[11px]">${escapeHtml(u.lastActiveAt || '-')}</td>
        `;
        adminUsersTableBody.appendChild(tr);
      });
    } else {
      adminUsersTableBody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500">Менеджерів ще немає</td></tr>`;
    }

    // Рендеринг журналу останніх дзвінків
    adminCallsTableBody.innerHTML = '';
    if (Array.isArray(data.recentCalls) && data.recentCalls.length > 0) {
      data.recentCalls.forEach((call) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition';

        let statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ Дзвонили</span>';
        if (call.callStatus === 'callback') {
          statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">🟡 Передзвонити</span>';
        } else if (call.callStatus === 'no_admin') {
          statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">🔴 Немає адміна</span>';
        }

        tr.innerHTML = `
          <td class="py-2 px-3">
            <div class="font-medium text-slate-200">${escapeHtml(call.name)}</div>
            ${call.notes ? `<div class="text-[10px] text-amber-300 italic mt-0.5">💬 ${escapeHtml(call.notes)}</div>` : ''}
          </td>
          <td class="py-2 px-3 font-mono text-emerald-400">${escapeHtml(call.phone)}</td>
          <td class="py-2 px-3">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
              ${escapeHtml(call.calledBy)}
            </span>
          </td>
          <td class="py-2 px-3 text-slate-400 text-[11px]">${escapeHtml(call.calledAt)}</td>
          <td class="py-2 px-3">${statusBadge}</td>
        `;
        adminCallsTableBody.appendChild(tr);
      });
    } else {
      adminCallsTableBody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500">Дзвінків ще не зафіксовано</td></tr>`;
    }

  } catch (err) {
    console.error('Помилка завантаження адмін-статистики:', err);
  }
}

// 3. Завантаження лідів із сервера (з авторизаційними даними)
async function loadSavedLeads() {
  try {
    const headers = {
      'x-app-secret': currentAppSecret || ''
    };
    if (currentUserName) {
      headers['x-user-name'] = encodeURIComponent(currentUserName);
    }
    const token = sessionStorage.getItem('leadHunter_adminToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/leads', { headers });
    if (res.ok) {
      const data = await res.json();
      const serverLeads = Array.isArray(data.leads) ? data.leads : [];

      // Розумне об'єднання даних сервера та локального сховища
      mergeServerAndLocalLeads(serverLeads);
      saveLocalLeads();
      updateCounters();
      renderTableRows();

      if (allPlaces.length > 0) {
        statusText.textContent = `База: ${allPlaces.length} збережених лідів`;
      }

      // Якщо у клієнта є ліди, а на сервері пусто (після перезапуску сервера) — синхронізуємо!
      if (allPlaces.length > 0 && serverLeads.length === 0) {
        syncLeadsToServer(allPlaces);
      }
    } else if (res.status === 401) {
      if (!currentUserName || !currentAppSecret) {
        showUserNameModal();
      } else {
        showCustomNotification('Ключ команди недійсний. Введіть актуальний пароль.', 'error');
        showUserNameModal();
      }
    }
  } catch (err) {
    console.error('Помилка завантаження лідів:', err);
  }
}

// 4. Пресети категорій та областей
async function loadPresets() {
  try {
    const res = await fetch('/api/presets');
    presetsData = await res.json();

    if (presetsData.categories) {
      categoryPillsContainer.innerHTML = '';
      if (presetsData.categories.length > 0 && selectedCategories.size === 0) {
        selectedCategories.add(presetsData.categories[0].query);
      }

      presetsData.categories.forEach((cat) => {
        const isSelected = selectedCategories.has(cat.query);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `category-pill px-3 py-1.5 rounded-lg border text-xs transition flex items-center gap-1.5 ${
          isSelected 
            ? 'active' 
            : 'bg-slate-950 border-slate-700/80 text-slate-300 hover:bg-slate-800/80 hover:text-white'
        }`;
        btn.setAttribute('data-query', cat.query);
        btn.innerHTML = `
          <span>${cat.icon}</span> 
          <span>${cat.title}</span>
          <span class="check-icon text-indigo-200 text-[10px] font-bold ml-0.5">✓</span>
        `;

        btn.addEventListener('click', () => {
          toggleCategory(cat.query, btn);
        });

        categoryPillsContainer.appendChild(btn);
      });

      updateCategoriesBadge();
    }

    if (presetsData.oblasts) {
      presetsData.oblasts.forEach(obl => {
        const opt = document.createElement('option');
        opt.value = obl.name;
        opt.textContent = obl.name;
        oblastSelect.appendChild(opt);
      });
    }

  } catch (err) {
    console.error('Помилка завантаження пресетів:', err);
  }
}

function toggleCategory(query, btnEl) {
  if (selectedCategories.has(query)) {
    selectedCategories.delete(query);
    btnEl.classList.remove('active');
    btnEl.classList.add('bg-slate-950', 'border-slate-700/80', 'text-slate-300');
  } else {
    selectedCategories.add(query);
    btnEl.classList.add('active');
    btnEl.classList.remove('bg-slate-950', 'border-slate-700/80', 'text-slate-300');
  }
  updateCategoriesBadge();
}

function updateCategoriesBadge() {
  const count = selectedCategories.size;
  selectedCategoriesBadge.textContent = `Обрано: ${count}`;
  if (count > 0) {
    selectedCategoriesBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30';
  } else {
    selectedCategoriesBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20';
  }
  saveSearchFormState();
}

function handleSelectAllCategories() {
  if (!presetsData || !presetsData.categories) return;
  selectedCategories.clear();
  document.querySelectorAll('.category-pill').forEach(btn => {
    const query = btn.getAttribute('data-query');
    if (query) {
      selectedCategories.add(query);
      btn.classList.add('active');
      btn.classList.remove('bg-slate-950', 'border-slate-700/80', 'text-slate-300');
    }
  });
  updateCategoriesBadge();
}

function handleClearAllCategories() {
  selectedCategories.clear();
  document.querySelectorAll('.category-pill').forEach(btn => {
    btn.classList.remove('active');
    btn.classList.add('bg-slate-950', 'border-slate-700/80', 'text-slate-300');
  });
  categoryInput.value = '';
  updateCategoriesBadge();
}

oblastSelect.addEventListener('change', () => {
  const selectedOblastName = oblastSelect.value;
  cityDatalist.innerHTML = '';
  if (!selectedOblastName || !presetsData) return;

  const oblast = presetsData.oblasts.find(o => o.name === selectedOblastName);
  if (oblast && oblast.cities) {
    oblast.cities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      cityDatalist.appendChild(opt);
    });
    cityInput.value = oblast.center;
  }
  saveSearchFormState();
});

function setupEventListeners() {
  searchForm.addEventListener('submit', handleStartSearch);
  stopBtn.addEventListener('click', handleStopSearch);
  tableSearch.addEventListener('input', renderTableRows);
  phoneOnlyFilter.addEventListener('change', renderTableRows);

  if (cityInput) cityInput.addEventListener('input', saveSearchFormState);
  if (limitSelect) limitSelect.addEventListener('change', saveSearchFormState);
  document.querySelectorAll('input[name="filterMode"]').forEach(r => {
    r.addEventListener('change', saveSearchFormState);
  });
  
  callStatusFilter.addEventListener('change', () => {
    updateQuickStatusPills(callStatusFilter.value);
    renderTableRows();
  });

  // Швидкі кнопки фільтрів статусів дзвінків
  document.querySelectorAll('.quick-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filterVal = btn.getAttribute('data-status-filter');
      callStatusFilter.value = filterVal;
      updateQuickStatusPills(filterVal);
      renderTableRows();
    });
  });

  // Модальне вікно коментаря/передзвону
  closeNoteModalBtn.addEventListener('click', closeNoteModal);
  cancelNoteModalBtn.addEventListener('click', closeNoteModal);
  noteModal.addEventListener('click', (e) => {
    if (e.target === noteModal) closeNoteModal();
  });
  noteModalForm.addEventListener('submit', handleSaveNoteModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (noteModal && !noteModal.classList.contains('hidden')) closeNoteModal();
      if (adminModal && !adminModal.classList.contains('hidden')) adminModal.classList.add('hidden');
    }
  });

  selectAllCatsBtn.addEventListener('click', handleSelectAllCategories);
  clearAllCatsBtn.addEventListener('click', handleClearAllCategories);

  exportXlsxBtn.addEventListener('click', () => triggerExport('xlsx'));
  exportCsvBtn.addEventListener('click', () => triggerExport('csv'));
  copyPhonesBtn.addEventListener('click', handleCopyAllPhones);
  if (adminClearDatabaseBtn) {
    adminClearDatabaseBtn.addEventListener('click', handleClearDatabase);
  }
}

function updateQuickStatusPills(activeFilter) {
  document.querySelectorAll('.quick-status-btn').forEach(btn => {
    const val = btn.getAttribute('data-status-filter');
    if (val === activeFilter) {
      btn.classList.add('active', 'bg-brand-500/20', 'text-brand-300', 'border-brand-500/40');
      btn.classList.remove('bg-slate-900', 'text-slate-300', 'border-slate-700/80');
    } else {
      btn.classList.remove('active', 'bg-brand-500/20', 'text-brand-300', 'border-brand-500/40');
      btn.classList.add('bg-slate-900', 'text-slate-300', 'border-slate-700/80');
    }
  });
}

// 5. Запуск та управління скрапінгом
async function handleStartSearch(e) {
  e.preventDefault();

  if (!currentUserName) {
    showToast("Введіть ваше ім'я менеджера для початку пошуку.", "warning", "Потрібна реєстрація");
    showUserNameModal();
    return;
  }

  const categoriesList = Array.from(selectedCategories);
  const customInputText = categoryInput.value.trim();
  if (customInputText) {
    const extra = customInputText.split(',').map(s => s.trim()).filter(Boolean);
    extra.forEach(c => {
      if (!categoriesList.includes(c)) categoriesList.push(c);
    });
  }

  if (categoriesList.length === 0) {
    showToast('Будь ласка, оберіть хоча б одну категорію бізнесу зі списку або введіть власну.', 'warning', 'Категорія не обрана');
    return;
  }

  const oblast = oblastSelect.value;
  const city = cityInput.value.trim();
  const limit = parseInt(limitSelect.value, 10) || 40;
  const filterMode = document.querySelector('input[name="filterMode"]:checked')?.value || 'all_no_website';

  setSearchingState(true);
  progressContainer.classList.remove('hidden');
  progressBar.style.width = '4%';
  progressCurrentPlace.textContent = `Запуск пошуку за ${categoriesList.length} категоріями...`;
  progressStats.textContent = `Оброблено: 0 | Знайдено: 0`;

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-name': encodeURIComponent(currentUserName),
        'x-app-secret': currentAppSecret || ''
      },
      body: JSON.stringify({ 
        categories: categoriesList, 
        oblast, 
        city, 
        limit, 
        filterMode,
        userName: currentUserName,
        appSecret: currentAppSecret || ''
      })
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409) {
        showProblemDialog({
          title: 'Сканування вже виконується',
          message: data.error || 'Зараз уже виконується інше сканування.',
          advice: 'Для захисту оперативної пам’яті сервера від зависання дозволено лише 1 активний процес пошуку. Ви можете дочекатися завершення або примусово зупинити поточний процес.',
          type: 'warning',
          primaryBtnText: 'Зачекати',
          secondaryBtnText: 'Зупинити активний пошук',
          onSecondary: handleStopSearch
        });
      } else if (res.status === 429) {
        showProblemDialog({
          title: 'Перевищено ліміт запитів',
          message: data.error || 'Забагато запитів з вашої IP-адреси.',
          advice: 'Спрацював захист від автоматичного парсингу та навантаження. Зачекайте 1-5 хвилин.',
          type: 'error'
        });
      } else if (res.status === 401) {
        showProblemDialog({
          title: 'Потрібен ключ доступу',
          message: data.error || 'Необхідно вказати ім\'я та дійсний ключ команди (APP_SECRET).',
          advice: 'Введіть пароль команди, який вам повідомив адміністратор проєкту.',
          type: 'warning',
          primaryBtnText: 'Ввести ключ команди',
          onPrimary: showUserNameModal
        });
      } else {
        showProblemDialog({
          title: 'Помилка запуску сканування',
          message: data.error || 'Не вдалося запустити пошук.',
          advice: 'Перевірте вибір категорії, локації та наявність з’єднання з інтернетом.',
          type: 'error'
        });
      }
      setSearchingState(false);
      return;
    }

    currentJobId = data.jobId;
    connectToStream(currentJobId, limit, categoriesList.length);
    showToast(`Пошук успішно запущено для ${categoriesList.length} категорій!`, 'info', 'Сканування Google Maps', 3000);

  } catch (err) {
    showProblemDialog({
      title: 'Збій зв’язку з сервером',
      message: err.message || 'Не вдалося надіслати запит на сервер.',
      advice: 'Перевірте, чи працює бекенд і чи є стабільне підключення до мережі.',
      type: 'error'
    });
    setSearchingState(false);
  }
}

function connectToStream(jobId, limitTarget, totalCats) {
  if (eventSource) eventSource.close();

  eventSource = new EventSource(`/api/stream/${jobId}`);

  eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    const percent = Math.min(Math.round((data.found / limitTarget) * 100), 98);
    progressBar.style.width = `${Math.max(percent, 6)}%`;

    const catPrefix = data.category ? `[${data.categoryIndex}/${data.categoryTotal || totalCats}: ${data.category}] ` : '';
    progressCurrentPlace.textContent = `${catPrefix}${data.currentPlace || 'Завантаження карток...'}`;
    progressStats.textContent = `Оброблено: ${data.scanned} | Знайдено: ${data.found} з ${limitTarget}`;
  });

  eventSource.addEventListener('status', (e) => {
    const data = JSON.parse(e.data);
    statusText.textContent = data.message;
  });

  eventSource.addEventListener('place', (e) => {
    const place = JSON.parse(e.data);
    const existingIdx = allPlaces.findIndex(p => p.id === place.id || (p.name === place.name && p.address === place.address));
    if (existingIdx !== -1) {
      allPlaces[existingIdx] = { ...allPlaces[existingIdx], ...place };
    } else {
      allPlaces.unshift(place);
    }
    saveLocalLeads();
    updateCounters();
    renderTableRows();
  });

  eventSource.addEventListener('done', (e) => {
    const data = JSON.parse(e.data);
    progressBar.style.width = '100%';
    progressCurrentPlace.textContent = 'Пошук завершено!';
    progressStats.textContent = `Оброблено: ${data.totalScanned} | Знайдено: ${data.totalFound}`;
    statusText.textContent = `Завершено (${data.totalFound} знайдено)`;
    setSearchingState(false);
    if (eventSource) eventSource.close();
  });

  eventSource.addEventListener('error', (e) => {
    console.error('Помилка SSE:', e);
    setSearchingState(false);
    if (eventSource) eventSource.close();
  });
}

async function handleStopSearch() {
  try {
    statusText.textContent = 'Зупинка пошуку...';
    const target = currentJobId || 'all';
    await fetch(`/api/stop/${target}`, { 
      method: 'POST',
      headers: {
        'x-app-secret': currentAppSecret || '',
        'x-user-name': encodeURIComponent(currentUserName || 'User')
      }
    });
  } catch (err) {}
  setSearchingState(false);
  if (eventSource) eventSource.close();
}

function setSearchingState(isSearching) {
  if (isSearching) {
    startBtn.disabled = true;
    startBtn.classList.add('opacity-70', 'cursor-not-allowed');
    startIcon.classList.add('hidden');
    spinnerIcon.classList.remove('hidden');

    stopBtn.classList.remove('hidden');
    statusPing.classList.remove('hidden');
    statusDot.classList.replace('bg-emerald-500', 'bg-amber-400');
    statusText.textContent = 'Йде пошук у Google Maps...';
  } else {
    startBtn.disabled = false;
    startBtn.classList.remove('opacity-70', 'cursor-not-allowed');
    startIcon.classList.remove('hidden');
    spinnerIcon.classList.add('hidden');

    stopBtn.classList.add('hidden');
    statusPing.classList.add('hidden');
    statusDot.classList.replace('bg-amber-400', 'bg-emerald-500');
  }
}

// 6. Управління статусом дзвінка (Дзвонили, Передзвонити, Немає адміна, Не дзвонили)
window.handleStatusChange = async function(id, newStatus) {
  if (!currentUserName) {
    showUserNameModal();
    return;
  }

  const lead = allPlaces.find(p => p.id === id);
  if (!lead) return;

  const previousCalled = Boolean(lead.called);
  const previousStatus = lead.callStatus || (previousCalled ? 'called' : 'not_called');
  const previousCalledBy = lead.calledBy;
  const previousCalledAt = lead.calledAt;

  // Оптимістичне оновлення
  lead.callStatus = newStatus;
  lead.called = newStatus !== 'not_called';

  if (lead.called) {
    lead.calledBy = currentUserName;
    lead.calledAt = new Date().toLocaleString('uk-UA');
  } else {
    lead.calledBy = null;
    lead.calledAt = null;
  }
  lead.updatedAt = new Date().toISOString();

  saveLocalLeads();
  updateCounters();
  renderTableRows();

  // Якщо статус "Попросили передзвонити" або "Немає адміна", і ще немає нотатки — відкриваємо модалку для введення коментаря
  if ((newStatus === 'callback' || newStatus === 'no_admin') && !lead.notes) {
    openNoteModal(id);
  }

  try {
    const res = await fetch(`/api/leads/${id}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: newStatus,
        userName: currentUserName 
      })
    });

    if (!res.ok) throw new Error('Помилка оновлення');
  } catch (err) {
    console.error('Помилка запису статусу дзвінка:', err);
    lead.called = previousCalled;
    lead.callStatus = previousStatus;
    lead.calledBy = previousCalledBy;
    lead.calledAt = previousCalledAt;
    saveLocalLeads();
    updateCounters();
    renderTableRows();
    showToast('Не вдалося зафіксувати статус дзвінка на сервері. Перевірте зв’язок.', 'error', 'Помилка оновлення');
  }
};

// Модальне вікно для додавання/редагування нотатки
window.openNoteModal = function(id) {
  const lead = allPlaces.find(p => String(p.id) === String(id));
  if (!lead) return;

  noteModalLeadId.value = id;
  noteModalInput.value = lead.notes || '';
  noteModalTitle.textContent = `Коментар: ${lead.name}`;

  if (lead.callStatus === 'callback') {
    noteModalSubtitle.textContent = 'Вкажіть час передзвону або додаткові деталі:';
    noteModalInput.placeholder = 'Наприклад: Передзвонити завтра після 14:00, попросити власника...';
  } else if (lead.callStatus === 'no_admin') {
    noteModalSubtitle.textContent = 'Вкажіть, чому немає адміністратора чи коли він буде:';
    noteModalInput.placeholder = 'Наприклад: Адміністратор на лікарняному, вийде у понеділок...';
  } else {
    noteModalSubtitle.textContent = 'Вкажіть деталі бесіди або домовленості:';
    noteModalInput.placeholder = 'Наприклад: Зацікавились сайтом, скинув комерційну пропозицію...';
  }

  noteModal.classList.remove('hidden');
  setTimeout(() => noteModalInput.focus(), 60);
};

function closeNoteModal() {
  noteModal.classList.add('hidden');
}

async function handleSaveNoteModal(e) {
  e.preventDefault();
  const id = noteModalLeadId.value;
  const noteText = noteModalInput.value.trim();
  const lead = allPlaces.find(p => String(p.id) === String(id));
  if (!lead) {
    closeNoteModal();
    return;
  }

  const prevNotes = lead.notes;
  lead.notes = noteText;
  lead.updatedAt = new Date().toISOString();
  saveLocalLeads();
  renderTableRows();
  closeNoteModal();

  try {
    const res = await fetch(`/api/leads/${id}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        notes: noteText,
        userName: currentUserName 
      })
    });
    if (!res.ok) throw new Error('Помилка запису коментаря');
    showToast('Коментар успішно зафіксовано в базі.', 'success', 'Збережено', 2500);
  } catch (err) {
    console.error('Помилка збереження коментаря:', err);
    lead.notes = prevNotes;
    saveLocalLeads();
    renderTableRows();
    showToast('Не вдалося зберегти коментар на сервері. Спробуйте пізніше.', 'error', 'Помилка коментаря');
  }
}

// 7. Очищення всієї бази лідів (Тільки для адміністратора)
async function handleClearDatabase() {
  const token = sessionStorage.getItem('leadHunter_adminToken');
  if (!token) {
    showToast('Очищення бази доступне лише з Адмін-панелі після авторизації.', 'warning', 'Обмеження доступу');
    return;
  }

  if (allPlaces.length === 0) {
    showToast('База лідів уже порожня.', 'info', 'Очищення бази');
    return;
  }

  const confirmed = await showConfirmDialog({
    title: 'Повне очищення бази лідів',
    message: '⚠️ УВАГА! Ви дійсно бажаєте безповоротно видалити ВСЮ збережену базу лідів та історію дзвінків? Цю дію неможливо буде скасувати.',
    okText: 'Так, видалити всю базу',
    cancelText: 'Скасувати'
  });

  if (!confirmed) return;

  try {
    const res = await fetch('/api/leads', { 
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      allPlaces = [];
      localStorage.removeItem('leadHunter_savedLeads');
      updateCounters();
      renderTableRows();
      loadAdminStats();
      statusText.textContent = 'Базу лідів очищено';
      showToast('Базу збережених лідів та історію дзвінків успішно очищено!', 'success', 'Базу видалено');
    } else {
      const data = await res.json();
      showProblemDialog({
        title: 'Не вдалося очистити базу',
        message: data.error || 'Помилка сервера при спробі видалення.',
        advice: 'Перевірте валідність сесії адміністратора або перезавантажте сторінку.',
        type: 'error'
      });
    }
  } catch (err) {
    showProblemDialog({
      title: 'Збій з’єднання',
      message: err.message || 'Не вдалося виконати запит до сервера.',
      advice: 'Перевірте інтернет-з’єднання та роботу бекенду.',
      type: 'error'
    });
  }
}

// Лічильники
function updateCounters() {
  const total = allPlaces.length;
  const withPhone = allPlaces.filter(p => p.phone && p.phone !== 'Не вказано').length;
  
  let calledCount = 0;
  let pendingCount = 0;
  let callbackCount = 0;
  let noAdminCount = 0;

  allPlaces.forEach(p => {
    const st = p.callStatus || (p.called ? 'called' : 'not_called');
    if (st === 'called') calledCount++;
    else if (st === 'callback') callbackCount++;
    else if (st === 'no_admin') noAdminCount++;
    else pendingCount++;
  });

  countFound.textContent = total;
  countPending.textContent = pendingCount;
  countCalled.textContent = calledCount;
  countCallback.textContent = callbackCount;
  countNoAdmin.textContent = noAdminCount;
  countWithPhone.textContent = withPhone;

  if (pillCountPending) pillCountPending.textContent = pendingCount;
  if (pillCountCalled) pillCountCalled.textContent = calledCount;
  if (pillCountCallback) pillCountCallback.textContent = callbackCount;
  if (pillCountNoAdmin) pillCountNoAdmin.textContent = noAdminCount;
}

// 8. Рендеринг рядків таблиці
function renderTableRows() {
  const searchTerm = tableSearch.value.trim().toLowerCase();
  const phoneOnly = phoneOnlyFilter.checked;
  const callFilter = callStatusFilter.value;

  const filtered = allPlaces.filter(p => {
    if (phoneOnly && (!p.phone || p.phone === 'Не вказано')) return false;

    const currentStatus = p.callStatus || (p.called ? 'called' : 'not_called');

    if (callFilter === 'not_called' && currentStatus !== 'not_called') return false;
    if (callFilter === 'called' && currentStatus !== 'called') return false;
    if (callFilter === 'callback' && currentStatus !== 'callback') return false;
    if (callFilter === 'no_admin' && currentStatus !== 'no_admin') return false;
    if (callFilter === 'any_called' && currentStatus === 'not_called') return false;
    if (callFilter === 'pending' && currentStatus !== 'not_called') return false;

    if (searchTerm) {
      const matchName = (p.name || '').toLowerCase().includes(searchTerm);
      const matchPhone = (p.phone || '').toLowerCase().includes(searchTerm);
      const matchAddr = (p.address || '').toLowerCase().includes(searchTerm);
      const matchCat = (p.searchCategory || '').toLowerCase().includes(searchTerm);
      const matchStatus = (p.websiteText || '').toLowerCase().includes(searchTerm);
      const matchCaller = (p.calledBy || '').toLowerCase().includes(searchTerm);
      const matchNotes = (p.notes || '').toLowerCase().includes(searchTerm);
      return matchName || matchPhone || matchAddr || matchCat || matchStatus || matchCaller || matchNotes;
    }

    return true;
  });

  tableShowingCount.textContent = `Показано: ${filtered.length} з ${allPlaces.length} лідів у базі`;

  if (filtered.length === 0) {
    placesTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="py-12 text-center text-slate-500">
          ${allPlaces.length === 0 ? 'Результати ще відсутні' : 'Нічого не знайдено за цим фільтром'}
        </td>
      </tr>
    `;
    return;
  }

  placesTableBody.innerHTML = '';

  filtered.forEach((p, idx) => {
    const tr = document.createElement('tr');
    
    const status = p.callStatus || (p.called ? 'called' : 'not_called');
    let rowBgClass = '';
    let statusSelectClass = '';

    if (status === 'callback') {
      rowBgClass = 'bg-amber-950/20 border-l-4 border-l-amber-500';
      statusSelectClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40 focus:ring-amber-500';
    } else if (status === 'no_admin') {
      rowBgClass = 'bg-rose-950/20 border-l-4 border-l-rose-500';
      statusSelectClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40 focus:ring-rose-500';
    } else if (status === 'called') {
      rowBgClass = 'bg-emerald-950/15 border-l-4 border-l-emerald-500';
      statusSelectClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 focus:ring-emerald-500';
    } else {
      rowBgClass = 'border-l-4 border-l-transparent';
      statusSelectClass = 'bg-slate-900 text-slate-300 border-slate-700/80 focus:ring-brand-500';
    }

    tr.className = `hover:bg-slate-800/40 transition border-b border-slate-800/50 ${rowBgClass}`;

    let badgeClass = 'badge-danger';
    if (p.websiteStatus === 'THIRD_PARTY') badgeClass = 'badge-warning';
    if (p.websiteStatus === 'OWN_WEBSITE') badgeClass = 'badge-success';

    let websiteHtml = '';
    if (p.website) {
      websiteHtml = `
        <div class="flex flex-col gap-1">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass} w-fit">
            ${p.websiteText}
          </span>
          <a href="${sanitizeUrl(p.website)}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:text-indigo-300 hover:underline truncate max-w-[190px] inline-block text-[11px]" title="${escapeHtml(p.website)}">
            🔗 ${escapeHtml(p.website)}
          </a>
        </div>
      `;
    } else {
      websiteHtml = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}">
          ❌ Сайт відсутній
        </span>
      `;
    }

    let phoneHtml = '';
    if (p.phone && p.phone !== 'Не вказано') {
      const cleanDigits = p.phone.replace(/[^\d+]/g, '');
      phoneHtml = `
        <div class="flex items-center gap-2">
          <a href="tel:${cleanDigits}" class="font-medium text-emerald-400 hover:text-emerald-300 tracking-wide font-mono text-xs">
            ${p.phone}
          </a>
          <button 
            type="button" 
            onclick="copyToClipboard('${cleanDigits}', this)" 
            title="Скопіювати телефон" 
            class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      `;
    } else {
      phoneHtml = `<span class="text-slate-500 italic">Не вказано</span>`;
    }

    // Інтерактивний контролер статусу дзвінка
    const callStatusHtml = `
      <div class="flex flex-col items-center gap-1 min-w-[165px]">
        <div class="flex items-center gap-1 w-full justify-center">
          <select 
            onchange="handleStatusChange('${p.id}', this.value)" 
            class="text-xs font-semibold py-1 px-2 rounded-lg border cursor-pointer transition focus:outline-none focus:ring-1 ${statusSelectClass}"
          >
            <option value="not_called" ${status === 'not_called' ? 'selected' : ''}>⚪ Не дзвонили</option>
            <option value="called" ${status === 'called' ? 'selected' : ''}>✅ Дзвонили</option>
            <option value="callback" ${status === 'callback' ? 'selected' : ''}>🟡 Передзвонити</option>
            <option value="no_admin" ${status === 'no_admin' ? 'selected' : ''}>🔴 Немає адміна</option>
          </select>
          <button 
            type="button" 
            onclick="openNoteModal('${p.id}')" 
            title="${p.notes ? 'Редагувати примітку: ' + escapeHtml(p.notes) : 'Додати примітку / деталі'}"
            class="p-1 rounded-lg ${p.notes ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700'} transition"
          >
            📝
          </button>
        </div>
        ${p.calledBy ? `
          <div class="text-[10px] text-slate-400 flex items-center gap-1 justify-center">
            <span class="text-indigo-300 font-medium">👤 ${escapeHtml(p.calledBy)}</span>
            ${p.calledAt ? `<span class="text-slate-500">(${p.calledAt.split(',')[1] || p.calledAt})</span>` : ''}
          </div>
        ` : ''}
        ${p.notes ? `
          <div onclick="openNoteModal('${p.id}')" class="text-[10px] text-amber-300/90 bg-amber-950/40 border border-amber-800/50 rounded px-2 py-0.5 text-center max-w-[190px] truncate cursor-pointer hover:bg-amber-900/40 transition" title="Натисніть для редагування: ${escapeHtml(p.notes)}">
            💬 ${escapeHtml(p.notes)}
          </div>
        ` : ''}
      </div>
    `;

    const catHtml = `
      <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60 whitespace-nowrap">
        ${p.searchCategory || 'Загальна'}
      </span>
    `;

    tr.innerHTML = `
      <td class="py-3 px-4 text-center text-slate-500 font-mono">${idx + 1}</td>
      <td class="py-3 px-4">
        <div class="font-semibold text-slate-100 text-sm">${escapeHtml(p.name)}</div>
        <div class="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
          ${p.rating !== '-' ? `⭐ <span class="text-amber-400 font-medium">${p.rating}</span>` : ''}
          ${p.reviewsCount ? `<span class="text-slate-500">(${p.reviewsCount} відгуків)</span>` : ''}
        </div>
      </td>
      <td class="py-3 px-4">${catHtml}</td>
      <td class="py-3 px-4 text-center whitespace-nowrap">${callStatusHtml}</td>
      <td class="py-3 px-4 whitespace-nowrap">${phoneHtml}</td>
      <td class="py-3 px-4">${websiteHtml}</td>
      <td class="py-3 px-4 text-slate-300 max-w-[210px] truncate" title="${escapeHtml(p.address)}">
        ${escapeHtml(p.address) || '<span class="text-slate-600">—</span>'}
      </td>
      <td class="py-3 px-4 text-center">
        <a 
          href="${sanitizeUrl(p.mapsUrl)}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition text-xs font-medium border border-slate-700"
        >
          <span>Карта</span>
          <svg class="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </td>
    `;

    placesTableBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  // Дозволяємо лише безпечні протоколи http та https
  if (/^https?:\/\//i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  return '#';
}

window.copyToClipboard = function(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const originalSvg = btn.innerHTML;
    btn.innerHTML = `<span class="text-emerald-400 text-[10px] font-bold">✓</span>`;
    setTimeout(() => {
      btn.innerHTML = originalSvg;
    }, 1500);
  });
};

function handleCopyAllPhones() {
  const phones = allPlaces
    .map(p => p.phone)
    .filter(phone => phone && phone !== 'Не вказано');

  const uniquePhones = [...new Set(phones)];
  if (uniquePhones.length === 0) {
    showToast('У поточній базі немає доступних номерів телефонів для копіювання.', 'warning', 'Номери відсутні');
    return;
  }

  navigator.clipboard.writeText(uniquePhones.join('\n')).then(() => {
    showToast(`Успішно скопійовано ${uniquePhones.length} унікальних номерів телефонів у буфер обміну!`, 'success', 'Буфер обміну');
  }).catch(() => {
    showToast('Не вдалося отримати доступ до буфера обміну браузера.', 'error', 'Помилка');
  });
}

function triggerExport(format) {
  if (allPlaces.length === 0) {
    showToast('Немає даних для експорту. Спочатку виконайте пошук або змініть фільтри.', 'warning', 'Експорт недоступний');
    return;
  }

  const token = sessionStorage.getItem('leadHunter_adminToken') || '';
  const queryParams = new URLSearchParams();
  if (currentJobId) queryParams.set('jobId', currentJobId);
  if (currentUserName) queryParams.set('userName', currentUserName);
  if (currentAppSecret) queryParams.set('secret', currentAppSecret);
  if (token) queryParams.set('adminToken', token);

  const url = `/api/export/${format}?${queryParams.toString()}`;
  window.open(url, '_blank');
  showToast(`Файл ${format.toUpperCase()} формується та завантажується...`, 'info', 'Експорт бази');
}
