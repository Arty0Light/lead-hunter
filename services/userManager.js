const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

/**
 * Менеджер користувачів (менеджерів) та обліку кількості дзвінків
 */
class UserManager {
  constructor() {
    this.users = [];
    this.ensureDataDir();
    this.loadFromDisk();
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, 'utf8');
        this.users = JSON.parse(raw);
        if (!Array.isArray(this.users)) this.users = [];
      } else {
        this.users = [];
      }
    } catch (err) {
      console.error('Помилка читання users.json:', err.message);
      this.users = [];
    }
  }

  saveToDisk() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2), 'utf8');
    } catch (err) {
      console.error('Помилка запису в users.json:', err.message);
    }
  }

  /**
   * Реєструє або повертає існуючого користувача за іменем
   * @param {string} rawName - ім'я користувача
   */
  registerOrGetUser(rawName) {
    if (!rawName || typeof rawName !== 'string') return null;
    const name = rawName.trim();
    if (!name) return null;

    let user = this.users.find(u => u.name.toLowerCase() === name.toLowerCase());
    const now = new Date().toLocaleString('uk-UA');

    if (!user) {
      user = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        callsCount: 0,
        firstSeenAt: now,
        lastActiveAt: now
      };
      this.users.push(user);
    } else {
      user.lastActiveAt = now;
    }

    this.saveToDisk();
    return user;
  }

  /**
   * Збільшує або зменшує лічильник дзвінків користувача
   * @param {string} userName
   * @param {boolean} isCalled - true для додавання, false для відкату
   */
  recordCall(userName, isCalled = true) {
    if (!userName || typeof userName !== 'string') return;
    const name = userName.trim();
    if (!name) return;

    let user = this.users.find(u => u.name.toLowerCase() === name.toLowerCase());
    const now = new Date().toLocaleString('uk-UA');

    if (!user) {
      user = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        callsCount: isCalled ? 1 : 0,
        firstSeenAt: now,
        lastActiveAt: now
      };
      this.users.push(user);
    } else {
      if (isCalled) {
        user.callsCount = (user.callsCount || 0) + 1;
      } else {
        user.callsCount = Math.max((user.callsCount || 0) - 1, 0);
      }
      user.lastActiveAt = now;
    }

    this.saveToDisk();
    return user;
  }

  /**
   * Повертає список усіх користувачів, відсортованих за кількістю дзвінків (Leaderboard)
   */
  getAllUsers() {
    return [...this.users].sort((a, b) => (b.callsCount || 0) - (a.callsCount || 0));
  }

  /**
   * Перерахунок статистики за реальною базою лідів
   */
  syncStats(leads) {
    if (!Array.isArray(leads)) return;
    const counts = {};
    leads.forEach(l => {
      if (l.called && l.calledBy) {
        counts[l.calledBy] = (counts[l.calledBy] || 0) + 1;
      }
    });

    this.users.forEach(u => {
      u.callsCount = counts[u.name] || 0;
    });

    // Додаємо тих, кого немає в users
    for (const [name, count] of Object.entries(counts)) {
      if (!this.users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        this.users.push({
          id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name,
          callsCount: count,
          firstSeenAt: new Date().toLocaleString('uk-UA'),
          lastActiveAt: new Date().toLocaleString('uk-UA')
        });
      }
    }

    this.saveToDisk();
  }
}

const userManager = new UserManager();

module.exports = {
  userManager
};
