@echo off
chcp 65001 > nul
title Lead Hunter - Локальний запуск
color 0B

echo ===================================================
echo   🚀 Google Maps Lead Finder — Локальний старт
echo ===================================================
echo.

:: 1. Перевірка наявності Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ПОМИЛКА] Node.js не знайдено на вашому комп'ютері!
    echo.
    echo Для запуску програми потрібен Node.js (версія 18 або новіша).
    echo Зараз відкриється сторінка завантаження: https://nodejs.org
    echo Встановіть версію LTS, перезапустіть цей файл і все запрацює.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)

:: 2. Перевірка наявності бібліотек node_modules
if not exist "node_modules\" (
    echo [ІНІЦІАЛІЗАЦІЯ] Встановлення необхідних компонентів (npm install)...
    echo Це потрібно зробити лише один раз при першому запуску...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo [ПОМИЛКА] Не вдалося встановити бібліотеки через npm install.
        echo Перевірте підключення до інтернету.
        pause
        exit /b 1
    )
    echo [УСПІХ] Компоненти успішно встановлено!
    echo.
)

:: 3. Перевірка папки для бази даних
if not exist "data\" mkdir data

:: 4. Відкриття сайту в браузері через 2 секунди
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: 5. Запуск сервера Node.js
echo [ЗАПУСК] Сервер стартує на http://localhost:3000 ...
echo [ІНФО] Не закривайте це чорне вікно, поки працюєте з програмою.
echo.
node server.js
pause
