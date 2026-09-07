const fs = require('fs');
const path = require('path');
const { GoogleMapsScraper } = require('./services/scraper');
const { exportToExcel, exportToCsv, exportToJson } = require('./services/exporter');

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    category: '',
    location: '',
    city: '',
    oblast: '',
    limit: 30,
    filter: 'all_no_website',
    out: 'results.xlsx'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const val = args[i + 1];

    if (arg === '--category' || arg === '-c') {
      params.category = val;
      i++;
    } else if (arg === '--location' || arg === '-l') {
      params.location = val;
      i++;
    } else if (arg === '--city') {
      params.city = val;
      i++;
    } else if (arg === '--oblast') {
      params.oblast = val;
      i++;
    } else if (arg === '--limit' || arg === '-n') {
      params.limit = parseInt(val, 10) || 30;
      i++;
    } else if (arg === '--filter' || arg === '-f') {
      params.filter = val;
      i++;
    } else if (arg === '--out' || arg === '-o') {
      params.out = val;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!params.location) {
    const locParts = [params.city, params.oblast].filter(Boolean);
    params.location = locParts.length ? locParts.join(', ') : 'Україна';
  }

  return params;
}

function printHelp() {
  console.log(`
============================================================
   Google Maps Business Finder (CLI версія)
============================================================
Використання:
  node cli.js --category <назва> --city <місто> [опції]

Опції:
  -c, --category   Категорія бізнесу (напр. "салони краси", "ресторани", "СТО") [ОБОВ'ЯЗКОВО]
  -l, --location   Локація пошуку (напр. "Львів", "Київська область, Біла Церква")
      --city       Місто (напр. "Тернопіль")
      --oblast     Область (напр. "Тернопільська область")
  -n, --limit      Максимальна кількість знайдених цільових закладів (за замовчуванням: 30)
  -f, --filter     Режим фільтрації:
                     - all_no_website (за замовчуванням: без сайту або соцмережі/агрегатори)
                     - only_no_link (тільки без посилання взагалі)
                     - only_third_party (тільки з посиланнями на соцмережі/агрегатори)
                     - all (всі знайдені бізнеси)
  -o, --out        Шлях до файлу експорту (.xlsx, .csv, .json). За замовчуванням: results.xlsx
  -h, --help       Показати цю довідку

Приклади:
  node cli.js -c "салони краси" --city "Львів" -n 20 -o lviv_salons.xlsx
  node cli.js -c "ресторани" -l "Івано-Франківськ" -f only_no_link -o restaurants.csv
============================================================
`);
}

async function run() {
  const params = parseArgs();

  if (!params.category) {
    console.error('❌ Помилка: Не вказано категорію бізнесу (--category).');
    printHelp();
    process.exit(1);
  }

  console.log(`\n🔍 Запуск пошуку:`);
  console.log(`   Категорія: ${params.category}`);
  console.log(`   Локація:   ${params.location}`);
  console.log(`   Ліміт:     ${params.limit}`);
  console.log(`   Фільтр:    ${params.filter}`);
  console.log(`   Вихід:     ${params.out}\n`);

  const scraper = new GoogleMapsScraper();

  scraper.on('status', s => console.log(`ℹ️  ${s.message}`));
  scraper.on('progress', p => {
    process.stdout.write(`\r⏳ Оброблено: ${p.scanned} | Знайдено цільових: ${p.found} | [${p.currentPlace}]`);
  });

  scraper.on('place', p => {
    console.log(`\n🎯 Знайдено: "${p.name}"`);
    console.log(`   📞 Телефон: ${p.phone}`);
    console.log(`   🌐 Статус сайту: ${p.websiteText}`);
    if (p.website) console.log(`   🔗 Посилання: ${p.website}`);
    console.log(`   📍 Адреса: ${p.address}`);
    console.log(`   🗺️  Карта: ${p.mapsUrl}`);
  });

  scraper.on('error', err => {
    console.error(`\n❌ Помилка скрапера:`, err.message);
  });

  try {
    const places = await scraper.search({
      category: params.category,
      location: params.location,
      limit: params.limit,
      filterMode: params.filter
    });

    console.log(`\n\n✅ Сканування завершено! Знайдено закладів: ${places.length}`);

    if (places.length > 0) {
      const ext = path.extname(params.out).toLowerCase();
      let fileData;

      if (ext === '.csv') {
        fileData = exportToCsv(places);
        fs.writeFileSync(params.out, fileData, 'utf8');
      } else if (ext === '.json') {
        fileData = exportToJson(places);
        fs.writeFileSync(params.out, fileData, 'utf8');
      } else {
        // За замовчуванням .xlsx
        fileData = exportToExcel(places);
        fs.writeFileSync(params.out, fileData);
      }

      console.log(`📁 Результати успішно збережено у файл: ${path.resolve(params.out)}`);
    } else {
      console.log('⚠️  Цільових закладів за цим запитом не знайдено.');
    }
  } catch (err) {
    console.error('❌ Критична помилка:', err.message);
    process.exit(1);
  }
}

run();
