const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

/**
 * Сервіс для збереження та керування статусами дзвінків лідів
 */
class LeadStorage {
  constructor() {
    this.leads = [];
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
      if (fs.existsSync(LEADS_FILE)) {
        const raw = fs.readFileSync(LEADS_FILE, 'utf8');
        this.leads = JSON.parse(raw);
        if (!Array.isArray(this.leads)) {
          this.leads = [];
        }
      } else {
        this.leads = [];
      }
      // Нормалізація для підтримки нових статусів
      this.leads.forEach(l => {
        if (!l.callStatus) {
          l.callStatus = l.called ? 'called' : 'not_called';
        }
        if (l.notes === undefined) {
          l.notes = '';
        }
      });
    } catch (err) {
      console.error('Помилка читання файлу leads.json:', err.message);
      this.leads = [];
    }
  }

  saveToDisk() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(LEADS_FILE, JSON.stringify(this.leads, null, 2), 'utf8');
    } catch (err) {
      console.error('Помилка запису у leads.json:', err.message);
    }
  }

  /**
   * Генерує стабільний унікальний ключ для закладу
   */
  getLeadKey(place) {
    if (place.phone && place.phone !== 'Не вказано') {
      const cleanPhone = place.phone.replace(/[^\d]/g, '');
      if (cleanPhone.length >= 7) return `phone_${cleanPhone}`;
    }
    if (place.mapsUrl && place.mapsUrl.includes('data=')) {
      return `maps_${place.mapsUrl}`;
    }
    return `name_${(place.name || '').trim().toLowerCase()}_${(place.address || '').trim().toLowerCase()}`;
  }

  /**
   * Отримати всі збережені ліди
   */
  getAllLeads() {
    return this.leads;
  }

  /**
   * Додає або оновлює ліди в базі без втрати статусу "Дзвонили"
   * @param {Array} newPlaces - масив нових знайдених закладів
   * @returns {Array} оновлений масив збережених лідів
   */
  mergeLeads(newPlaces) {
    const existingMap = new Map();
    this.leads.forEach(l => {
      existingMap.set(l.uniqueKey, l);
    });

    let addedCount = 0;

    newPlaces.forEach(place => {
      const key = this.getLeadKey(place);
      const now = new Date().toISOString();

      if (existingMap.has(key)) {
        // Оновлюємо дані (адреса, рейтинг тощо), але зберігаємо статус дзвінка!
        const existing = existingMap.get(key);
        existing.phone = (place.phone && place.phone !== 'Не вказано') ? place.phone : existing.phone;
        existing.mapsUrl = place.mapsUrl || existing.mapsUrl;
        existing.rating = place.rating || existing.rating;
        existing.reviewsCount = place.reviewsCount || existing.reviewsCount;
        existing.website = place.website !== undefined ? place.website : existing.website;
        existing.websiteText = place.websiteText || existing.websiteText;
        existing.websiteStatus = place.websiteStatus || existing.websiteStatus;
        existing.searchCategory = place.searchCategory || existing.searchCategory;
        existing.updatedAt = now;
      } else {
        // Додаємо новий лід
        const newLead = {
          id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          uniqueKey: key,
          name: place.name,
          searchCategory: place.searchCategory || place.category || 'Загальна',
          phone: place.phone || 'Не вказано',
          address: place.address || '',
          mapsUrl: place.mapsUrl || '',
          website: place.website || null,
          hasOwnWebsite: place.hasOwnWebsite || false,
          websiteStatus: place.websiteStatus || 'NONE',
          websiteBadge: place.websiteBadge || 'danger',
          websiteText: place.websiteText || '❌ Сайт відсутній',
          platform: place.platform || null,
          category: place.category || null,
          explanation: place.explanation || '',
          rating: place.rating || '-',
          reviewsCount: place.reviewsCount || 0,
          scannedAt: place.scannedAt || new Date().toLocaleTimeString('uk-UA'),
          called: false, // За замовчуванням ще не дзвонили
          callStatus: 'not_called', // 'not_called' | 'called' | 'callback' | 'no_admin'
          calledAt: null,
          calledBy: null,
          notes: '',
          createdAt: now,
          updatedAt: now
        };
        this.leads.unshift(newLead);
        existingMap.set(key, newLead);
        addedCount++;
      }
    });

    this.saveToDisk();
    return this.leads;
  }

  /**
   * Перемикає або оновлює статус дзвінка
   * @param {string} id - ідентифікатор ліда
   * @param {Object|boolean} [options] - параметри або значення called
   * @param {string} [maybeNotes] - примітка (якщо options не об'єкт)
   * @param {string} [maybeCalledBy] - ім'я користувача (якщо options не об'єкт)
   */
  updateCallStatus(id, options = {}, maybeNotes = null, maybeCalledBy = null) {
    const lead = this.leads.find(l => l.id === id);
    if (!lead) return null;

    let targetStatus = null;
    let targetNotes = null;
    let userName = null;

    if (options && typeof options === 'object') {
      targetStatus = options.status || (options.called !== undefined ? (options.called ? 'called' : 'not_called') : null);
      targetNotes = options.notes;
      userName = options.userName || options.calledBy;
    } else {
      // Positional args (legacy)
      if (options === true) targetStatus = 'called';
      else if (options === false) targetStatus = 'not_called';
      targetNotes = maybeNotes;
      userName = maybeCalledBy;
    }

    const previousCalled = Boolean(lead.called);

    const validStatuses = ['not_called', 'called', 'callback', 'no_admin'];
    if (targetStatus && validStatuses.includes(targetStatus)) {
      lead.callStatus = targetStatus;
      lead.called = targetStatus !== 'not_called';
    } else if (targetStatus === null) {
      // Toggle
      if (lead.called) {
        lead.called = false;
        lead.callStatus = 'not_called';
      } else {
        lead.called = true;
        lead.callStatus = 'called';
      }
    }

    const { userManager } = require('./userManager');

    if (lead.called) {
      lead.calledAt = new Date().toLocaleString('uk-UA');
      if (userName && userName.trim()) {
        lead.calledBy = userName.trim();
      } else if (!lead.calledBy) {
        lead.calledBy = 'Менеджер';
      }
      // Збільшуємо лічильник користувача, якщо статус раніше був 'not_called'
      if (!previousCalled) {
        userManager.recordCall(lead.calledBy, true);
      }
    } else {
      // Зменшуємо лічильник, якщо статус скинуто на 'not_called'
      if (previousCalled && lead.calledBy) {
        userManager.recordCall(lead.calledBy, false);
      }
      lead.calledAt = null;
      lead.calledBy = null;
    }

    if (targetNotes !== null && targetNotes !== undefined) {
      lead.notes = String(targetNotes).trim();
    }

    lead.updatedAt = new Date().toISOString();
    this.saveToDisk();
    return lead;
  }

  /**
   * Очистити всю базу збережених лідів
   */
  clearAll() {
    this.leads = [];
    this.saveToDisk();
    return true;
  }
}

const leadStorage = new LeadStorage();

module.exports = {
  leadStorage
};
