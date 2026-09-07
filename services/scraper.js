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
          '--disable-gpu',
          '--lang=uk-UA',
          '--window-size=1280,900'
        ]
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1280, height: 900 });
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );

      // Встановлення cookies згоди Google для уникнення блокування у Європі (Render Frankfurt)
      try {
        const domains = ['.google.com', '.google.de', '.google.com.ua'];
        for (const domain of domains) {
          await this.page.setCookie(
            { name: 'SOCS', value: 'CAESEwgDEgk2OTQ0NTMwNzEaAmVuIAEaBgiA_LyaBg', domain, path: '/' },
            { name: 'CONSENT', value: 'YES+cb.20230531-04-p0.uk+FX+917', domain, path: '/' }
          ).catch(() => {});
        }
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

        // Обробка вікна або сторінки згоди Google (cookies / consent) у європейському регіоні
        try {
          await delay(800);
          const isConsent = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, form[action*="consent"] button, input[type="submit"]'));
            for (const b of buttons) {
              const txt = (b.innerText || b.textContent || b.getAttribute('aria-label') || b.value || '').toLowerCase();
              if (
                txt.includes('прийняти') ||
                txt.includes('погодитися') ||
                txt.includes('accept all') ||
                txt.includes('i agree') ||
                txt.includes('alle akzeptieren') ||
                txt.includes('zustimmen') ||
                txt.includes('tout accepter')
              ) {
                b.click();
                return true;
              }
            }
            return false;
          }).catch(() => false);

          if (isConsent || this.page.url().includes('consent.google.com')) {
            await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await delay(1200);
          }
        } catch (e) {}

        // Очікування карток у стрічці (з запасом часу для повільних серверів)
        try {
          await this.page.waitForSelector('a.hfpxzc, div[role="feed"]', { timeout: 30000 });
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

            // 1. Прокрутка картки у видиму зону та DOM-клік для відкриття деталей
            await this.page.evaluate(el => {
              el.scrollIntoView({ behavior: 'instant', block: 'center' });
              el.click();
            }, card);

            // 2. Очікування оновлення панелі деталей під поточну картку
            let detailsLoaded = false;
            for (let waitStep = 0; waitStep < 20; waitStep++) {
              await delay(150);

              const matched = await this.page.evaluate((expectedName) => {
                const h1 = document.querySelector('h1.DUwDvf')?.innerText?.trim() || '';
                const exp = expectedName.trim();
                return h1 && (
                  h1.toLowerCase() === exp.toLowerCase() ||
                  h1.toLowerCase().includes(exp.toLowerCase()) ||
                  exp.toLowerCase().includes(h1.toLowerCase())
                );
              }, cardMeta.name);

              if (matched) {
                detailsLoaded = true;
                break;
              }

              // Запасна спроба кліку
              if (waitStep === 6 || waitStep === 14) {
                try {
                  await card.click().catch(() => {});
                  await this.page.evaluate(el => el.click(), card).catch(() => {});
                } catch (e) {}
              }
            }

            // 4. Надійний збір деталей із завантаженої картки
            const placeDetails = await this.page.evaluate((meta, cardEl) => {
              // Назва з панелі деталей
              const h1 = document.querySelector('h1.DUwDvf');
              const realName = h1 ? h1.innerText.trim() : meta.name;

              // Телефон
              let phone = null;
              const phoneEl = document.querySelector('button[data-item-id^="phone:"], button[aria-label*="Телефон" i], button[aria-label*="Phone" i], button[aria-label*="Telefon" i]');
              if (phoneEl) {
                const dataId = phoneEl.getAttribute('data-item-id') || '';
                const aria = phoneEl.getAttribute('aria-label') || '';
                const text = phoneEl.querySelector('.Io6YTe')?.innerText || phoneEl.innerText?.trim() || '';
                if (dataId.startsWith('phone:tel:')) {
                  phone = dataId.replace('phone:tel:', '').trim();
                } else if (aria.includes(':')) {
                  phone = aria.split(/:\s*/)[1]?.trim();
                } else if (text) {
                  phone = text.replace(/^[^0-9+]+/, '').trim();
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
              const addressEl = document.querySelector('button[data-item-id="address"], button[aria-label*="Адрес" i], button[aria-label*="Address" i], button[aria-label*="Adresse" i]');
              if (addressEl) {
                const aria = addressEl.getAttribute('aria-label') || '';
                const text = addressEl.querySelector('.Io6YTe')?.innerText || addressEl.innerText?.trim() || '';
                if (aria.includes(':')) {
                  address = aria.split(/:\s*/)[1]?.trim();
                } else if (text) {
                  address = text.replace(/^[^a-zA-Zа-яА-ЯіІїЇєЄ0-9]+/, '').trim();
                }
              }

              // Запасний збір адреси прямо з картки у стрічці пошуку
              if (!address || address === 'Адреса відсутня') {
                const container = cardEl ? (cardEl.closest('div.Nv2PK') || cardEl.parentElement) : null;
                if (container) {
                  const lines = (container.innerText || '').split('\n');
                  for (const l of lines) {
                    if (l.includes('·') || l.includes('вул') || l.includes('просп') || l.includes('площ') || l.includes('Str') || l.includes('street')) {
                      const parts = l.split('·');
                      const candidate = (parts[parts.length - 1] || '').trim();
                      if (candidate.length > 4 && candidate.length < 80) {
                        address = candidate;
                        break;
                      }
                    }
                  }
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
            }, cardMeta, card);

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
