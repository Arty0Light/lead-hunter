/**
 * Модуль класифікації веб-сайтів бізнесу.
 * Визначає, чи є у бізнесу власний повноцінний сайт,
 * чи сайт відсутній, чи це сторонній агрегатор / соцмережа / система онлайн-запису.
 */

// База правил для детекції сторонніх сервісів
const THIRD_PARTY_RULES = [
  // Соцмережі
  { pattern: /instagram\.com|instagr\.am/i, platform: 'Instagram', category: 'Соціальна мережа', icon: '📸' },
  { pattern: /facebook\.com|fb\.me|fb\.com/i, platform: 'Facebook', category: 'Соціальна мережа', icon: '👥' },
  { pattern: /tiktok\.com/i, platform: 'TikTok', category: 'Соціальна мережа', icon: '🎵' },
  { pattern: /t\.me|telegram\.me/i, platform: 'Telegram', category: 'Месенджер', icon: '✈️' },
  { pattern: /viber\.click|chats\.viber\.com/i, platform: 'Viber', category: 'Месенджер', icon: '💬' },
  { pattern: /wa\.me|whatsapp\.com/i, platform: 'WhatsApp', category: 'Месенджер', icon: '🟢' },
  { pattern: /youtube\.com|youtu\.be/i, platform: 'YouTube', category: 'Відеохостинг', icon: '▶️' },
  { pattern: /linkedin\.com/i, platform: 'LinkedIn', category: 'Соціальна мережа', icon: '💼' },
  { pattern: /twitter\.com|x\.com/i, platform: 'X (Twitter)', category: 'Соціальна мережа', icon: '🐦' },

  // Готельні сервіси та агрегатори бронювання
  { pattern: /booking\.com/i, platform: 'Booking.com', category: 'Бронювання житла', icon: '🏨' },
  { pattern: /tripadvisor\.(com|ua|ru|co\.[a-z]+)/i, platform: 'TripAdvisor', category: 'Агрегатор відгуків', icon: '🦉' },
  { pattern: /hotels\.com/i, platform: 'Hotels.com', category: 'Бронювання житла', icon: '🏨' },
  { pattern: /airbnb\.(com|ua|ru)/i, platform: 'Airbnb', category: 'Оренда житла', icon: '🏡' },
  { pattern: /agoda\.com/i, platform: 'Agoda', category: 'Бронювання житла', icon: '🏨' },
  { pattern: /expedia\.(com|co\.[a-z]+)/i, platform: 'Expedia', category: 'Бронювання подорожей', icon: '✈️' },
  { pattern: /karpaty\.info/i, platform: 'Karpaty.info', category: 'Туристичний каталог', icon: '🌲' },
  { pattern: /doba\.ua/i, platform: 'Doba.ua', category: 'Подобова оренда', icon: '🔑' },
  { pattern: /otelms\.com/i, platform: 'OtelMS', category: 'Модуль бронювання', icon: '🛎️' },

  // CRM запису, салони краси, медичні сервіси
  { pattern: /alteg\.io|yclients\.com/i, platform: 'Altegio / Yclients', category: 'Онлайн-запис CRM', icon: '💅' },
  { pattern: /dikidi\.(net|ru|online)/i, platform: 'Dikidi', category: 'Онлайн-запис CRM', icon: '📅' },
  { pattern: /easyweek\.(io|com\.ua)/i, platform: 'EasyWeek', category: 'Онлайн-запис CRM', icon: '🗓️' },
  { pattern: /bumpix\.net/i, platform: 'Bumpix', category: 'Онлайн-запис CRM', icon: '⏱️' },
  { pattern: /beautyprosoftware\.com|appointer\.com\.ua/i, platform: 'BeautyPro / Appointer', category: 'CRM послуг', icon: '💄' },
  { pattern: /barb\.ua/i, platform: 'Barb.ua', category: 'Каталог майстрів краси', icon: '💇' },
  { pattern: /beautynailhairsalons\.com/i, platform: 'BeautyNailHairSalons', category: 'Каталог краси', icon: '💅' },
  { pattern: /cbox\.mobi/i, platform: 'Cbox Mobile', category: 'Мобільний запис', icon: '📱' },
  { pattern: /doc\.ua/i, platform: 'Doc.ua', category: 'Медичний сервіс', icon: '🩺' },
  { pattern: /tabletki\.ua/i, platform: 'Tabletki.ua', category: 'Аптечний агрегатор', icon: '💊' },
  { pattern: /helsi\.me/i, platform: 'Helsi.me', category: 'Медичний портал', icon: '🏥' },
  { pattern: /likarni\.com/i, platform: 'Likarni.com', category: 'Медичний каталог', icon: '👨‍⚕️' },

  // Ресторани, доставка, меню
  { pattern: /choiceqr\.com/i, platform: 'Choice QR Menu', category: 'QR-меню ресторану', icon: '🍽️' },
  { pattern: /joinposter\.com|posterpos\.com/i, platform: 'Poster POS Menu', category: 'Меню ресторану', icon: '📋' },
  { pattern: /expirenza\.com/i, platform: 'Expirenza', category: 'Електронне меню', icon: '🍷' },
  { pattern: /reston\.ua/i, platform: 'RestOn', category: 'Бронювання столів', icon: '🍽️' },
  { pattern: /resto\.ua/i, platform: 'Resto.ua', category: 'Каталог ресторанів', icon: '🍴' },
  { pattern: /glovoapp\.com/i, platform: 'Glovo', category: 'Сервіс доставки', icon: '🛵' },
  { pattern: /bolt\.eu.*food/i, platform: 'Bolt Food', category: 'Сервіс доставки', icon: '🍔' },
  { pattern: /ubereats\.com/i, platform: 'Uber Eats', category: 'Сервіс доставки', icon: '🥡' },

  // Link-in-bio сервіси
  { pattern: /linktr\.ee/i, platform: 'Linktree', category: 'Мультипосилання', icon: '🌲' },
  { pattern: /taplink\.(cc|ws|at)/i, platform: 'Taplink', category: 'Мультипосилання', icon: '🔗' },
  { pattern: /mssg\.me/i, platform: 'MSSG.me', category: 'Мультипосилання', icon: '📲' },
  { pattern: /heylink\.me/i, platform: 'HeyLink', category: 'Мультипосилання', icon: '🔗' },
  { pattern: /bio\.link/i, platform: 'Bio.link', category: 'Мультипосилання', icon: '🔗' },
  { pattern: /beacons\.ai/i, platform: 'Beacons', category: 'Мультипосилання', icon: '🔗' },
  { pattern: /contactinbio\.com/i, platform: 'ContactInBio', category: 'Мультипосилання', icon: '🔗' },

  // Каталоги та шаблони Google
  { pattern: /business\.site/i, platform: 'Google Business Site', category: 'Картка Google Business', icon: '🏢' },
  { pattern: /top20\.ua/i, platform: 'Top20', category: 'Міський довідник', icon: '📖' },
  { pattern: /list\.in\.ua/i, platform: 'List.in.ua', category: 'Довідник підприємств', icon: '📑' },
  { pattern: /prom\.ua/i, platform: 'Prom.ua', category: 'Маркетплейс', icon: '🛍️' },
  { pattern: /zakupka\.com/i, platform: 'Zakupka', category: 'Маркетплейс', icon: '🛒' },
  { pattern: /olx\.ua/i, platform: 'OLX', category: 'Дошка оголошень', icon: '📢' },
  { pattern: /yellowpages\.ua/i, platform: 'YellowPages', category: 'Бізнес-довідник', icon: '📒' },
  { pattern: /mapia\.ua/i, platform: 'Mapia.ua', category: 'Міський довідник', icon: '🗺️' }
];

/**
 * Очищує та нормалізує URL-адресу сайту
 */
function cleanUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let url = rawUrl.trim();
  if (!url || url === '#' || url === 'about:blank') return null;

  // Витяг реального URL, якщо Google перенаправляє через /url?q=...
  if (url.includes('google.com/url?') || url.includes('/url?q=')) {
    try {
      const match = url.match(/[?&]q=([^&]+)/);
      if (match && match[1]) {
        url = decodeURIComponent(match[1]);
      }
    } catch (e) {}
  }

  // Додавання протоколу за потреби
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  return url;
}

/**
 * Класифікує вказане посилання.
 * @param {string|null} rawUrl - вхідне посилання на веб-сайт
 * @returns {Object} результат класифікації
 */
function classifyWebsite(rawUrl) {
  const url = cleanUrl(rawUrl);

  // 1. Посилання взагалі відсутнє
  if (!url) {
    return {
      hasOwnWebsite: false,
      status: 'NONE',
      badge: 'danger',
      statusText: '❌ Сайт відсутній',
      platform: null,
      category: null,
      icon: '❌',
      url: null,
      explanation: 'У бізнесу не вказано жодного сайту чи посилання.'
    };
  }

  // 2. Перевірка на сторонній сервіс / соцмережу / агрегатор
  for (const rule of THIRD_PARTY_RULES) {
    if (rule.pattern.test(url)) {
      return {
        hasOwnWebsite: false, // Вважається що ВЛАСНОГО сайту немає!
        status: 'THIRD_PARTY',
        badge: 'warning',
        statusText: `📱 ${rule.platform}`,
        platform: rule.platform,
        category: rule.category,
        icon: rule.icon,
        url: url,
        explanation: `Власного сайту немає, вказано сторонній сервіс: ${rule.platform} (${rule.category}).`
      };
    }
  }

  // 3. Повноцінний власний сайт бізнесу
  let hostname = '';
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    hostname = url;
  }

  return {
    hasOwnWebsite: true,
    status: 'OWN_WEBSITE',
    badge: 'success',
    statusText: '🌐 Власний сайт',
    platform: hostname,
    category: 'Офіційний сайт',
    icon: '🌐',
    url: url,
    explanation: `У бізнесу є власний автономний веб-сайт: ${hostname}.`
  };
}

module.exports = {
  cleanUrl,
  classifyWebsite,
  THIRD_PARTY_RULES
};
