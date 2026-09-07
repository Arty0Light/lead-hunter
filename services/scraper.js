const puppeteer = require('puppeteer-core');
const { EventEmitter } = require('events');
const { findBrowserExecutable } = require('./browserDetector');
const { classifyWebsite } = require('./classifier');

const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Клас скрапера Google Maps для пошуку бізнесів
 */
class GoogleMapsScraper extends EventEmitter {
  constructor() {
    super();
    this.isAborted = false;
    this.browser = null;
    this.page = null;
  }

  /**
   * Зупиняє активне сканування
   */
  abort() {
    this.isAborted = true;
    this.emit('log', { level: 'info', message: 'Отримано команду зупинки сканування.' });
  }

  /**
   * Запускає пошук бізнесів за однією або кількома категоріями та локацією
   * @param {Object} options
   * @param {string|string[]} options.categories - назва або масив назв категорій (напр. ["салони краси", "барбершопи"])
   * @param {string} [options.category] - застарілий одиночний параметр для сумісності
   * @param {string} options.location - локація (напр. "Львів", "Київська область")
   * @param {number} [options.limit=50] - загальний ліміт цільових бізнесів
   * @param {string} [options.filterMode='all_no_website'] - режим фільтру
   */
  async search({ categories, category, location, limit = 50, filterMode = 'all_no_website' }) {
    this.isAborted = false;

    // Нормалізація списку категорій
    let catList = [];
    if (Array.isArray(categories)) {
      catList = categories.filter(c => c && typeof c === 'string' && c.trim());
    } else if (typeof categories === 'string' && categories.trim()) {
      catList = categories.split(',').map(c => c.trim()).filter(Boolean);
    } else if (category && typeof category === 'string' && category.trim()) {
      catList = category.split(',').map(c => c.trim()).filter(Boolean);
    }

    if (catList.length === 0) {
      catList = ['бізнес'];
    }

    // Видаляємо дублікати категорій
    catList = [...new Set(catList)];

    const executablePath = findBrowserExecutable();
    this.emit('status', {
      status: 'starting',
      message: `Ініціалізація браузера. Категорій для пошуку: ${catList.length} (${catList.join(', ')})...`
    });

    const foundPlaces = [];
    const processedNames = new Set();
    let totalScanned = 0;

    try {
      this.browser = await puppeteer.launch({
        executablePath,
        headless: "new",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--lang=uk-UA',
          '--window-size=1280,900',
          '--js-flags=--max-old-space-size=256'
        ]
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1280, height: 900 });
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );

      // Блокування важких ресурсів для максимальної швидкодії
      await this.page.setRequestInterception(true);
      this.page.on('request', req => {
        const resourceType = req.resourceType();
        if (['image', 'media', 'font'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Встановлення cookies згоди Google для уникнення блокування у Європі (Render Frankfurt)
      try {
        await this.page.setCookie(
          { name: 'SOCS', value: 'CAESEwgDEgk2OTQ0NTMwNzEaAmVuIAEaBgiA_LyaBg', domain: '.google.com', path: '/' },
          { name: 'CONSENT', value: 'YES+cb.20230531-04-p0.uk+FX+917', domain: '.google.com', path: '/' }
        );
      } catch (e) {}

      // Послідовний пошук за кожною обраною категорією
      for (let catIndex = 0; catIndex < catList.length; catIndex++) {
        if (this.isAborted || foundPlaces.length >= limit) break;

        const currentCat = catList[catIndex];
        const searchQuery = `${currentCat} ${location}`.trim();

        this.emit('status', {
          status: 'navigating',
          message: `[${catIndex + 1}/${catList.length}] Пошук категорії: "${currentCat}" у "${location}"...`
        });

        const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}?hl=uk`;
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });

        // Обробка вікна згоди Google (cookies / consent) якщо з'явиться
        try {
          const consentButtons = await this.page.$$(
            'button[aria-label*="Прийняти" i], button[aria-label*="Accept" i], button[aria-label*="akzeptieren" i], button[aria-label*="Zustimmen" i], form[action*="consent"] button'
          );
          for (const btn of consentButtons) {
            await btn.click().catch(() => {});
            await delay(400);
          }
        } catch (e) {}

        // Очікування карток у стрічці
        try {
          await this.page.waitForSelector('a.hfpxzc', { timeout: 12000 });
        } catch (e) {
          this.emit('log', {
            level: 'warn',
            message: `За категорією "${currentCat}" результатів не виявлено або стрічка не завантажилась.`
          });
          continue;
        }

        let scrollRetries = 0;
        const maxScrollRetries = 4;

        while (!this.isAborted && foundPlaces.length < limit) {
          const cardElements = await this.page.$$('a.hfpxzc');
          if (cardElements.length === 0) break;

          let newCardFoundInIteration = false;

          for (let i = 0; i < cardElements.length; i++) {
            if (this.isAborted || foundPlaces.length >= limit) break;

            const card = cardElements[i];

            // Метадані картки
            const cardMeta = await this.page.evaluate(el => {
              const name = el.getAttribute('aria-label') || '';
              const href = el.getAttribute('href') || '';
              return { name, href };
            }, card);

            if (!cardMeta.name || processedNames.has(cardMeta.name)) {
              continue;
            }

            newCardFoundInIteration = true;
            processedNames.add(cardMeta.name);
            totalScanned++;

            this.emit('progress', {
              scanned: totalScanned,
              found: foundPlaces.length,
              currentPlace: cardMeta.name,
              category: currentCat,
              categoryIndex: catIndex + 1,
              categoryTotal: catList.length,
              status: `[Категорія ${catIndex + 1}/${catList.length}: ${currentCat}] Обробка картки...`
            });

            // 1. Прокрутка картки у видиму зону
            await this.page.evaluate(el => {
              el.scrollIntoView({ behavior: 'instant', block: 'center' });
            }, card);
            await delay(150);

            // 2. Реальний клік мишею по координатах картки
            let clicked = false;
            try {
              const box = await card.boundingBox();
              if (box && box.width > 0 && box.height > 0) {
                await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                clicked = true;
              }
            } catch (e) {}

            if (!clicked) {
              try {
                await card.click({ delay: 30 });
                clicked = true;
              } catch (e) {
                await this.page.evaluate(el => el.click(), card);
              }
            }

            // 3. Очікування оновлення та завантаження панелі деталей
            let detailsLoaded = false;
            for (let waitStep = 0; waitStep < 16; waitStep++) {
              await delay(180);

              const hasDetail = await this.page.evaluate(() => {
                const phone = document.querySelector('button[data-item-id^="phone:"]');
                const address = document.querySelector('button[data-item-id="address"]');
                const website = document.querySelector('a[data-item-id="authority"]');
                const h1 = document.querySelector('h1.DUwDvf');
                return !!(phone || address || website || (h1 && h1.innerText.trim()));
              });

              if (hasDetail) {
                detailsLoaded = true;
                break;
              }

              // Повторний клік при повільному завантаженні (Render Free Tier)
              if (waitStep === 6) {
                try {
                  const box = await card.boundingBox();
                  if (box) {
                    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                  } else {
                    await this.page.evaluate(el => el.click(), card);
                  }
                } catch (e) {}
              }
            }

            // 4. Надійний збір деталей із завантаженої картки
            const placeDetails = await this.page.evaluate((meta) => {
              // Назва з панелі деталей
              const h1 = document.querySelector('h1.DUwDvf');
              const realName = h1 ? h1.innerText.trim() : meta.name;

              // Телефон
              let phone = null;
              const phoneEl = document.querySelector('button[data-item-id^="phone:"], button[aria-label*="Телефон" i], button[aria-label*="Phone" i]');
              if (phoneEl) {
                const dataId = phoneEl.getAttribute('data-item-id') || '';
                const aria = phoneEl.getAttribute('aria-label') || '';
                const text = phoneEl.innerText?.trim() || '';
                if (dataId.startsWith('phone:tel:')) {
                  phone = dataId.replace('phone:tel:', '').trim();
                } else if (aria.includes(':')) {
                  phone = aria.split(':')[1]?.trim();
                } else if (text) {
                  phone = text.replace(/^\s*/, '').trim();
                }
              }

              // Запасний пошук телефону в тексті деталей
              if (!phone) {
                const allElements = Array.from(document.querySelectorAll('button, div[role="region"] div, a'));
                for (const el of allElements) {
                  const text = el.innerText || '';
                  const phoneMatch = text.match(/(?:\+?380|0)\s*\(?\d{2}\)?\s*\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
                  if (phoneMatch && text.length < 35) {
                    phone = phoneMatch[0].trim();
                    break;
                  }
                }
              }

              // Адреса
              let address = '';
              const addressEl = document.querySelector('button[data-item-id="address"], button[aria-label*="Адреса" i], button[aria-label*="Address" i]');
              if (addressEl) {
                const aria = addressEl.getAttribute('aria-label') || '';
                const text = addressEl.innerText?.trim() || '';
                if (aria.toLowerCase().startsWith('адреса:')) {
                  address = aria.replace(/^адреса:\s*/i, '').trim();
                } else if (text) {
                  address = text.replace(/^\s*/, '').trim();
                }
              }

              // Веб-сайт
              let website = null;
              const websiteEl = document.querySelector('a[data-item-id="authority"], a[aria-label*="Сайт" i], a[aria-label*="Website" i]');
              if (websiteEl) {
                website = websiteEl.getAttribute('href') || websiteEl.innerText?.trim();
              }

              // Рейтинг та відгуки
              let rating = '-';
              let reviewsCount = 0;
              const ratingContainer = document.querySelector('div.F7nice, div[role="main"] span.ceNzKf');
              if (ratingContainer) {
                const rSpan = ratingContainer.querySelector('span.ceNzKf, span.MW4etd') || ratingContainer;
                rating = rSpan.innerText?.trim() || rSpan.getAttribute('aria-label') || '-';
                const revSpan = ratingContainer.querySelector('span:last-child') || document.querySelector('span.UY7F9');
                if (revSpan) {
                  const rMatch = (revSpan.innerText || '').match(/\d+/);
                  if (rMatch) reviewsCount = parseInt(rMatch[0], 10);
                }
              }

              const currentUrl = window.location.href;
              const mapsUrl = (currentUrl.includes('/maps/place/') ? currentUrl : meta.href) || meta.href || currentUrl;

              return {
                name: realName || meta.name,
                phone: phone || 'Не вказано',
                website,
                address: address || 'Адреса відсутня',
                rating,
                reviewsCount,
                mapsUrl
              };
            }, cardMeta);

            // Класифікація сайту
            const classified = classifyWebsite(placeDetails.website);

            // Якщо картка взагалі не завантажилася (немає ні телефону, ні адреси, ні сайту) — пропускаємо для запобігання хибних лідів
            if (placeDetails.phone === 'Не вказано' && placeDetails.address === 'Адреса відсутня' && !placeDetails.website) {
              this.emit('skipped', {
                name: placeDetails.name,
                reason: 'Деталі картки не завантажились або відсутні дані'
              });
              continue;
            }

            // Фільтрація
            let shouldInclude = false;
            if (filterMode === 'all') {
              shouldInclude = true;
            } else if (filterMode === 'all_no_website') {
              shouldInclude = !classified.hasOwnWebsite;
            } else if (filterMode === 'only_no_link') {
              shouldInclude = (classified.status === 'NONE');
            } else if (filterMode === 'only_third_party') {
              shouldInclude = (classified.status === 'THIRD_PARTY');
            }

            const record = {
              id: foundPlaces.length + 1,
              name: placeDetails.name,
              searchCategory: currentCat, // Категорія під якою знайдено
              phone: placeDetails.phone,
              address: placeDetails.address,
              mapsUrl: placeDetails.mapsUrl,
              website: classified.url,
              hasOwnWebsite: classified.hasOwnWebsite,
              websiteStatus: classified.status,
              websiteBadge: classified.badge,
              websiteText: classified.statusText,
              platform: classified.platform,
              category: classified.category,
              explanation: classified.explanation,
              rating: placeDetails.rating,
              reviewsCount: placeDetails.reviewsCount,
              scannedAt: new Date().toLocaleTimeString('uk-UA')
            };

            if (shouldInclude) {
              foundPlaces.push(record);
              this.emit('place', record);
            } else {
              this.emit('skipped', {
                name: placeDetails.name,
                reason: 'Має власний веб-сайт',
                website: placeDetails.website
              });
            }

            this.emit('progress', {
              scanned: totalScanned,
              found: foundPlaces.length,
              currentPlace: placeDetails.name,
              category: currentCat,
              categoryIndex: catIndex + 1,
              categoryTotal: catList.length,
              status: shouldInclude ? '✅ Знайдено цільовий заклад' : '⏭️ Пропущено (має власний сайт)'
            });
          }

          // Довантаження прокруткою
          if (foundPlaces.length < limit && !this.isAborted) {
            await this.page.evaluate(() => {
              const feed = document.querySelector('div[role="feed"]');
              if (feed) {
                feed.scrollTop = feed.scrollHeight;
              }
            });

            await delay(1600);

            const isEndReached = await this.page.evaluate(() => {
              const text = document.body.innerText || '';
              return text.includes('Ви дійшли до кінця списку') || text.includes("You've reached the end of the list");
            });

            if (isEndReached) break;

            if (!newCardFoundInIteration) {
              scrollRetries++;
              if (scrollRetries >= maxScrollRetries) break;
            } else {
              scrollRetries = 0;
            }
          }
        }
      }

      this.emit('done', {
        totalScanned,
        totalFound: foundPlaces.length,
        places: foundPlaces,
        isAborted: this.isAborted
      });

      return foundPlaces;

    } catch (err) {
      this.emit('error', { message: err.message, stack: err.stack });
      throw err;
    } finally {
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (e) {}
        this.browser = null;
        this.page = null;
      }
    }
  }
}

module.exports = {
  GoogleMapsScraper
};
