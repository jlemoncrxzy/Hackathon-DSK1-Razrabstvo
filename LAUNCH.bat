@echo off
chcp 65001 > nul
title ДСК · AI Sales Assistant

echo ============================================
echo   ДСК · AI Sales Assistant
echo ============================================
echo.

REM Проверка Python
where python >nul 2>nul
if errorlevel 1 (
    echo [!] Python не найден.
    echo     Установите Python 3.11 или новее с https://www.python.org/downloads/
    echo     Важно: при установке поставьте галочку "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

REM Создание виртуального окружения
if not exist ".venv" (
    echo [1/4] Создаю виртуальное окружение...
    python -m venv .venv
    if errorlevel 1 (
        echo [!] Не удалось создать окружение.
        pause
        exit /b 1
    )
)

REM Активация
call .venv\Scripts\activate.bat

REM Установка зависимостей
echo [2/4] Проверяю зависимости...
pip install --quiet --disable-pip-version-check -r backend/requirements.txt
if errorlevel 1 (
    echo [!] Ошибка установки зависимостей.
    pause
    exit /b 1
)

REM Запуск сервера в фоне
echo [3/4] Запускаю сервер...
start "" http://localhost:8000
echo [4/4] Готово! Браузер откроется автоматически.
echo.
echo Для остановки закройте это окно или нажмите Ctrl+C.
echo.
uvicorn main:app --host 127.0.0.1 --port 8000

pause