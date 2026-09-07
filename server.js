const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { GoogleMapsScraper } = require('./services/scraper');
const { OBLASTS_OF_UKRAINE, POPULAR_CATEGORIES } = require('./services/geoPresets');
const { exportToExcel, exportToCsv, exportToJson } = require('./services/exporter');
const { leadStorage } = require('./services/leadStorage');
const { userManager } = require('./services/userManager');

const app = express();
// Підтримка порта за замовчуванням 7860 для Hugging Face Spaces або 3000 локально
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  next();
});

app.use(cors());
app.use(express.json({ limit: '256kb' }));

// Захист від пошукових роботів та ботів-сканерів (Anti-Crawler)
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow: /\n');
});

// Захист від масового парсингу та DoS (Global API Rate Limiting: 120 запитів/хв на IP)
const apiRateLimits = new Map(); // ip -> { count, resetAt }
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let record = apiRateLimits.get(clientIp);
  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + 60 * 1000 };
    apiRateLimits.set(clientIp, record);
    return next();
  }
  record.count++;
  if (record.count > 120) {
    return res.status(429).json({ 
      error: 'Забагато запитів до API з вашої IP-адреси. Захист від автоматичного збору даних активний. Спробуйте через 1 хвилину.' 
    });
  }
  return next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Безпечні облікові дані адміністратора (можна перевизначити через змінні середовища)
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'adminsonly',
  password: process.env.ADMIN_PASSWORD || 'dolar14uero'
};

// Безпечне порівняння рядків з постійним часом виконання (захист від timing attacks)
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Захист від підбору паролів (Brute-force Protection / Rate Limiting)
const loginAttempts = new Map(); // ip -> { count, lockedUntil }

function isRateLimited(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (record.lockedUntil && now < record.lockedUntil) {
    return true;
  }
  if (record.lockedUntil && now >= record.lockedUntil) {
    loginAttempts.delete(ip);
    return false;
  }
  return false;
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 5 * 60 * 1000; // Блокування на 5 хвилин
  }
  loginAttempts.set(ip, record);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// Автоматичне очищення застарілих записів ліміту кожні 10 хвилин
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts.entries()) {
    if (rec.lockedUntil && now >= rec.lockedUntil) {
      loginAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000);

// Сховище сесій адміна з часом життя (TTL: 24 години)
const adminSessions = new Map(); // token -> { createdAt, expiresAt }
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (now > session.expiresAt) {
      adminSessions.delete(token);
    }
  }
}
setInterval(cleanExpiredSessions, 15 * 60 * 1000);

// Сховище активних завдань пошуку
const activeJobs = new Map();

// 1. Реєстрація / вхід звичайного користувача (менеджера) за іменем
app.post('/api/auth/register-user', (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: "Будь ласка, введіть ваше ім'я." });
  }
  const cleanName = name.trim().replace(/[\x00-\x1F\x7F]/g, ''); // видалення керуючих символів
  if (cleanName.length > 50) {
    return res.status(400).json({ error: "Ім'я занадто довге (максимум 50 символів)." });
  }
  const user = userManager.registerOrGetUser(cleanName);
  res.json({ success: true, user });
});

// 2. Вхід в адмін-панель із захистом від підбору та timing attack
app.post('/api/admin/login', (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (isRateLimited(clientIp)) {
    return res.status(429).json({ 
      error: 'Забагато невдалих спроб входу. Зачекайте 5 хвилин перед повторною спробою.' 
    });
  }

  const { username, password } = req.body || {};
  if (typeof username === 'string' && typeof password === 'string' &&
      safeCompare(username, ADMIN_CREDENTIALS.username) && 
      safeCompare(password, ADMIN_CREDENTIALS.password)) {
    
    clearLoginAttempts(clientIp);
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    adminSessions.set(token, {
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS
    });
    return res.json({ success: true, token });
  }

  recordFailedLogin(clientIp);
  res.status(401).json({ error: 'Невірний логін або пароль адміністратора.' });
});

// 2.1 Вихід з адмін-панелі
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    adminSessions.delete(token);
  }
  res.json({ success: true });
});

// Middleware перевірки авторизації адміна з валідацією терміну сесії
function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token && adminSessions.has(token)) {
    const session = adminSessions.get(token);
    if (Date.now() < session.expiresAt) {
      return next();
    } else {
      adminSessions.delete(token);
      return res.status(401).json({ error: 'Термін дії сесії адміна вичерпано. Увійдіть знову.' });
    }
  }
  return res.status(403).json({ error: 'Доступ заборонено. Потрібна авторизація адміністратора.' });
}

// 3. Статистика для адмін-панелі
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const allLeads = leadStorage.getAllLeads();
  userManager.syncStats(allLeads);

  const users = userManager.getAllUsers();
  const calledLeads = allLeads.filter(l => l.called);
  const callbackLeads = allLeads.filter(l => l.callStatus === 'callback');
  const noAdminLeads = allLeads.filter(l => l.callStatus === 'no_admin');
  const successCalledLeads = allLeads.filter(l => l.callStatus === 'called' || (l.called && !l.callStatus));

  // Останні здійснені дзвінки та взаємодії
  const recentCalls = calledLeads
    .map(l => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      searchCategory: l.searchCategory,
      callStatus: l.callStatus || 'called',
      notes: l.notes || '',
      calledBy: l.calledBy || 'Невідомо',
      calledAt: l.calledAt,
      address: l.address,
      mapsUrl: l.mapsUrl
    }))
    .reverse()
    .slice(0, 50);

  res.json({
    users,
    totalUsers: users.length,
    totalLeads: allLeads.length,
    totalCalled: calledLeads.length,
    totalSuccessCalled: successCalledLeads.length,
    totalCallback: callbackLeads.length,
    totalNoAdmin: noAdminLeads.length,
    totalPending: allLeads.length - calledLeads.length,
    recentCalls
  });
});

// Захисний ключ команди для деплою в інтернет (APP_SECRET)
const APP_SECRET = (process.env.APP_SECRET || 'dolar14').trim();

function verifyTeamAccess(req) {
  if (!APP_SECRET) return true;
  // Якщо запит містить валідний токен адміністратора, доступ автоматично дозволено
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || req.query.adminToken;
  if (token && adminSessions.has(token)) {
    const session = adminSessions.get(token);
    if (Date.now() < session.expiresAt) return true;
  }
  const provided = req.headers['x-app-secret'] || req.query.secret || req.body?.appSecret || '';
  return safeCompare(provided, APP_SECRET);
}

// Middleware для захисту контактної бази лідів від неавторизованого викрадення (Anti-Theft)
function requireLeadAccess(req, res, next) {
  if (!verifyTeamAccess(req)) {
    return res.status(401).json({ error: 'Потрібен дійсний ключ команди (APP_SECRET) для доступу до сервісу.' });
  }

  // 1. Доступ за токеном адміністратора
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || req.query.adminToken;
  if (token && adminSessions.has(token)) {
    const session = adminSessions.get(token);
    if (Date.now() < session.expiresAt) {
      return next();
    }
  }

  // 2. Доступ для менеджера за зареєстрованим або переданим іменем
  const rawUserName = req.headers['x-user-name'] || req.query.userName || req.body?.userName;
  let userName = '';
  if (rawUserName) {
    try {
      userName = decodeURIComponent(String(rawUserName)).trim();
    } catch (e) {
      userName = String(rawUserName).trim();
    }
  }

  if (userName) {
    const cleanName = userName.slice(0, 50).replace(/[\x00-\x1F\x7F]/g, '').trim();
    if (cleanName) {
      return next();
    }
  }

  // Запит без імені користувача та без адмін-токена (наприклад сторонній бот/сканер без реєстрації)
  return res.status(401).json({ 
    error: 'Доступ до бази лідів обмежено. Будь ласка, введіть ваше ім\'я або авторизуйтесь як адміністратор.' 
  });
}

// 4. Отримання пресетів
app.get('/api/presets', (req, res) => {
  res.json({
    oblasts: OBLASTS_OF_UKRAINE,
    categories: POPULAR_CATEGORIES
  });
});

// 5. Отримання всіх збережених лідів (Захищено від викрадення)
app.get('/api/leads', requireLeadAccess, (req, res) => {
  res.json({
    leads: leadStorage.getAllLeads()
  });
});

// 6. Перемикання або оновлення статусу дзвінка з фіксацією імені менеджера (із санітизацією)
app.post('/api/leads/:id/call', (req, res) => {
  const { id } = req.params;
  const { status, called, notes, userName } = req.body || {};

  // Валідація статусу
  const allowedStatuses = ['not_called', 'called', 'callback', 'no_admin'];
  const cleanStatus = allowedStatuses.includes(status) ? status : undefined;

  // Санітизація коментаря та імені користувача
  let cleanNotes = undefined;
  if (typeof notes === 'string') {
    cleanNotes = notes.slice(0, 1000).replace(/[\x00-\x1F\x7F]/g, ' ').trim();
  }

  let cleanUserName = undefined;
  if (typeof userName === 'string') {
    cleanUserName = userName.slice(0, 50).replace(/[\x00-\x1F\x7F]/g, '').trim();
  }

  const updated = leadStorage.updateCallStatus(id, { 
    status: cleanStatus, 
    called: typeof called === 'boolean' ? called : undefined, 
    notes: cleanNotes, 
    userName: cleanUserName 
  });

  if (!updated) {
    return res.status(404).json({ error: 'Лід не знайдено' });
  }
  res.json({ success: true, lead: updated });
});

// 7. Очищення бази лідів (Тільки для адміністратора)
app.delete('/api/leads', requireAdmin, (req, res) => {
  leadStorage.clearAll();
  res.json({ success: true, message: 'Базу лідів успішно очищено.' });
});

// 8. Запуск нового пошуку (з блокуванням паралельних запусків для захисту від перевантаження пам'яті)
app.post('/api/search', requireLeadAccess, async (req, res) => {
  // Перевірка наявності вже активного сканування (захист від вичерпання RAM / DoS)
  const isAlreadyRunning = Array.from(activeJobs.values()).some(j => j.status === 'running');
  if (isAlreadyRunning) {
    return res.status(409).json({ 
      error: 'Зараз уже виконується інше сканування. Будь ласка, зачекайте його завершення або зупиніть поточне перед запуском нового.' 
    });
  }

  const { categories, category, oblast, city, customLocation, limit = 50, filterMode = 'all_no_website' } = req.body || {};

  let catList = [];
  if (Array.isArray(categories)) {
    catList = categories.map(c => String(c).trim()).filter(Boolean);
  } else if (typeof categories === 'string' && categories.trim()) {
    catList = categories.split(',').map(c => c.trim()).filter(Boolean);
  } else if (typeof category === 'string' && category.trim()) {
    catList = category.split(',').map(c => c.trim()).filter(Boolean);
  }

  // Обмеження кількості та довжини категорій
  catList = catList
    .slice(0, 20)
    .map(c => c.slice(0, 80).replace(/[\x00-\x1F\x7F]/g, '').trim())
    .filter(Boolean);

  if (catList.length === 0) {
    return res.status(400).json({ error: 'Будь ласка, оберіть або вкажіть хоча б одну категорію бізнесу.' });
  }

  let location = '';
  if (customLocation && typeof customLocation === 'string' && customLocation.trim()) {
    location = customLocation.trim();
  } else {
    const parts = [];
    if (city && typeof city === 'string' && city.trim()) parts.push(city.trim());
    if (oblast && typeof oblast === 'string' && oblast.trim()) parts.push(oblast.trim());
    location = parts.join(', ');
  }

  location = location.slice(0, 150).replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!location) {
    location = 'Україна';
  }

  const allowedFilterModes = ['all_no_website', 'strict_none', 'third_party_only', 'all'];
  const cleanFilterMode = allowedFilterModes.includes(filterMode) ? filterMode : 'all_no_website';
  const cleanLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 5), 200);

  // Очищення старих завдань із пам'яті (зберігаємо не більше 5 останніх)
  if (activeJobs.size > 8) {
    const keysToDelete = Array.from(activeJobs.keys()).slice(0, activeJobs.size - 5);
    keysToDelete.forEach(k => activeJobs.delete(k));
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const scraper = new GoogleMapsScraper();

  const job = {
    id: jobId,
    categories: catList,
    location,
    limit: cleanLimit,
    filterMode: cleanFilterMode,
    scraper,
    results: [],
    status: 'running',
    startedAt: new Date()
  };

  activeJobs.set(jobId, job);

  // Запуск скрапера
  (async () => {
    try {
      scraper.on('place', place => {
        leadStorage.mergeLeads([place]);
        const allLeads = leadStorage.getAllLeads();
        const savedLead = allLeads.find(l => l.name === place.name) || place;
        job.results.push(savedLead);
      });

      scraper.on('done', () => {
        job.status = 'completed';
      });

      scraper.on('error', () => {
        job.status = 'error';
      });

      await scraper.search({
        categories: job.categories,
        location: job.location,
        limit: job.limit,
        filterMode: job.filterMode
      });
    } catch (err) {
      console.error(`[Job ${jobId}] Помилка під час пошуку:`, err.message);
    }
  })();

  res.json({
    jobId,
    status: 'started',
    categories: job.categories,
    location: job.location,
    limit: job.limit
  });
});

// 9. Потоковий ендпоінт Server-Sent Events (SSE)
app.get('/api/stream/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = activeJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Завдання пошуку не знайдено.' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('connected', { jobId, status: job.status });

  if (job.results.length > 0) {
    job.results.forEach(place => sendEvent('place', place));
  }

  const onPlace = place => {
    const allLeads = leadStorage.getAllLeads();
    const savedLead = allLeads.find(l => l.name === place.name) || place;
    sendEvent('place', savedLead);
  };
  const onProgress = progress => sendEvent('progress', progress);
  const onStatus = status => sendEvent('status', status);
  const onLog = log => sendEvent('log', log);
  const onSkipped = skip => sendEvent('skipped', skip);
  const onDone = done => {
    sendEvent('done', done);
    cleanup();
  };
  const onError = err => {
    sendEvent('error', err);
    cleanup();
  };

  const scraper = job.scraper;
  scraper.on('place', onPlace);
  scraper.on('progress', onProgress);
  scraper.on('status', onStatus);
  scraper.on('log', onLog);
  scraper.on('skipped', onSkipped);
  scraper.on('done', onDone);
  scraper.on('error', onError);

  function cleanup() {
    scraper.removeListener('place', onPlace);
    scraper.removeListener('progress', onProgress);
    scraper.removeListener('status', onStatus);
    scraper.removeListener('log', onLog);
    scraper.removeListener('skipped', onSkipped);
    scraper.removeListener('done', onDone);
    scraper.removeListener('error', onError);
  }

  req.on('close', () => {
    cleanup();
  });
});

// 10. Зупинка завдання
app.post('/api/stop/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = activeJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Завдання не знайдено' });

  job.scraper.abort();
  job.status = 'aborted';
  res.json({ success: true, message: 'Сканування зупинено.' });
});

// 11. Експорт результатів (Захищено від викрадення)
app.get('/api/export/:format', requireLeadAccess, (req, res) => {
  const { format } = req.params;
  const { jobId } = req.query;

  let places = [];
  if (jobId && activeJobs.has(jobId)) {
    places = activeJobs.get(jobId).results;
  } else {
    places = leadStorage.getAllLeads();
  }

  if (!places || places.length === 0) {
    return res.status(400).send('Немає даних для експорту. Спочатку виконайте пошук.');
  }

  const dateStr = new Date().toISOString().slice(0, 10);

  if (format === 'xlsx') {
    const buffer = exportToExcel(places);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="google_maps_leads_${dateStr}.xlsx"`);
    return res.send(buffer);
  }

  if (format === 'csv') {
    const csv = exportToCsv(places);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="google_maps_leads_${dateStr}.csv"`);
    return res.send(csv);
  }

  if (format === 'json') {
    const json = exportToJson(places);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="google_maps_leads_${dateStr}.json"`);
    return res.send(json);
  }

  res.status(400).send('Невідомий формат. Доступні: xlsx, csv, json');
});

// Головна сторінка
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  🚀 Google Maps Lead Finder успішно запущено!     `);
  console.log(`  📍 Веб-панель доступна за адресою:               `);
  console.log(`     👉 http://localhost:${PORT}                   `);
  console.log(`  🔐 Адмін-панель:                                 `);
  console.log(`     Логін:  ${ADMIN_CREDENTIALS.username}         `);
  console.log(`     Пароль: ${ADMIN_CREDENTIALS.password}         `);
  console.log(`  🔑 Ключ команди (APP_SECRET):                    `);
  console.log(`     Пароль: ${APP_SECRET}                         `);
  console.log(`===================================================`);
});
