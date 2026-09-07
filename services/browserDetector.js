const fs = require('fs');
const path = require('path');

/**
 * Автоматично знаходить шлях до виконуваного файлу Chromium / Edge / Chrome в системі (Windows та Linux).
 */
function findBrowserExecutable() {
  // 1. Якщо шлях задано через змінну оточення (наприклад, у Docker)
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // 2. Список стандартних шляхів на Windows та Linux
  const candidatePaths = [
    // Windows
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',

    // Linux (Docker, Hugging Face, Ubuntu, Debian)
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium'
  ];

  for (const p of candidatePaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error('Не знайдено встановлений браузер (Edge або Chromium). Вкажіть шлях через PUPPETEER_EXECUTABLE_PATH.');
}

module.exports = {
  findBrowserExecutable
};
