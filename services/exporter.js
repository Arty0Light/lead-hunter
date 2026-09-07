const XLSX = require('xlsx');

/**
 * Експортує результати пошуку в буфер Excel (.xlsx)
 * @param {Array} places - масив об'єктів знайдених закладів
 * @returns {Buffer} бінарний буфер файлу XLSX
 */
function exportToExcel(places) {
  const data = places.map((p, idx) => ({
    '№': idx + 1,
    'Назва бізнесу': p.name,
    'Категорія бізнесу': p.searchCategory || p.category || 'Загальна',
    'Номер телефону': p.phone,
    'Статус дзвінка': p.callStatus === 'callback' ? '🟡 Попросили передзвонити' : (p.callStatus === 'no_admin' ? '🔴 Немає адміністратора' : (p.called ? '✅ Дзвонили' : '⚪ Не дзвонили')),
    'Хто дзвонив': p.calledBy || '-',
    'Дата дзвінка': p.calledAt || '-',
    'Статус сайту': p.websiteText,
    'Сторонній сервіс / соцмережа': p.platform ? `${p.platform} (${p.category || ''})` : 'Немає',
    'Посилання на сайт / соцмережу': p.website || 'Відсутнє',
    'Посилання на Google Maps': p.mapsUrl,
    'Адреса': p.address,
    'Рейтинг': p.rating,
    'Кількість відгуків': p.reviewsCount,
    'Примітки': p.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Налаштування ширини колонок для зручного перегляду в Excel
  worksheet['!cols'] = [
    { wch: 5 },   // №
    { wch: 32 },  // Назва бізнесу
    { wch: 22 },  // Категорія бізнесу
    { wch: 18 },  // Номер телефону
    { wch: 18 },  // Статус дзвінка
    { wch: 18 },  // Хто дзвонив
    { wch: 20 },  // Дата дзвінка
    { wch: 22 },  // Статус сайту
    { wch: 28 },  // Сторонній сервіс
    { wch: 38 },  // Посилання на сайт
    { wch: 45 },  // Посилання на Google Maps
    { wch: 45 },  // Адреса
    { wch: 10 },  // Рейтинг
    { wch: 18 },  // Кількість відгуків
    { wch: 25 }   // Примітки
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'База лідів');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Експортує результати пошуку в рядок CSV з UTF-8 BOM
 * (UTF-8 BOM гарантує правильне відкриття українських літер в Excel)
 * @param {Array} places
 * @returns {string} CSV вміст з BOM
 */
function exportToCsv(places) {
  const headers = [
    '№',
    'Назва бізнесу',
    'Категорія бізнесу',
    'Номер телефону',
    'Статус дзвінка',
    'Хто дзвонив',
    'Дата дзвінка',
    'Статус сайту',
    'Сторонній сервіс / соцмережа',
    'Посилання на сайт / соцмережу',
    'Посилання на Google Maps',
    'Адреса',
    'Рейтинг',
    'Кількість відгуків',
    'Примітки'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = [headers.map(escapeCsv).join(',')];

  places.forEach((p, idx) => {
    rows.push([
      idx + 1,
      escapeCsv(p.name),
      escapeCsv(p.searchCategory || p.category || 'Загальна'),
      escapeCsv(p.phone),
      escapeCsv(p.callStatus === 'callback' ? 'Попросили передзвонити' : (p.callStatus === 'no_admin' ? 'Немає адміністратора' : (p.called ? 'Дзвонили' : 'Не дзвонили'))),
      escapeCsv(p.calledBy || '-'),
      escapeCsv(p.calledAt || '-'),
      escapeCsv(p.websiteText),
      escapeCsv(p.platform ? `${p.platform} (${p.category || ''})` : 'Немає'),
      escapeCsv(p.website || 'Відсутнє'),
      escapeCsv(p.mapsUrl),
      escapeCsv(p.address),
      escapeCsv(p.rating),
      escapeCsv(p.reviewsCount),
      escapeCsv(p.notes || '')
    ].join(','));
  });

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Експорт в JSON
 * @param {Array} places
 * @returns {string}
 */
function exportToJson(places) {
  return JSON.stringify(places, null, 2);
}

module.exports = {
  exportToExcel,
  exportToCsv,
  exportToJson
};
