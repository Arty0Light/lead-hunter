# Офіційний базовий образ Node.js для Linux
FROM node:20-bookworm-slim

# Встановлення Chromium та необхідних шрифтів для безголового браузера
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    fonts-liberation \
    ca-certificates \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Вказуємо шлях до встановленого Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=10000 \
    NODE_ENV=production

WORKDIR /app

# Копіювання та встановлення залежностей
COPY package*.json ./
RUN npm install --omit=dev

# Копіювання вихідного коду
COPY . .

# Створення папки для даних та надання прав доступу
RUN mkdir -p /app/data && chmod -R 777 /app/data

# Порт для Render.com (10000) та локального використання
EXPOSE 10000 3000 7860

CMD ["node", "server.js"]
