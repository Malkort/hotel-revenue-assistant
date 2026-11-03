# Hotel Revenue Assistant

Веб-приложение для календаря доходности отеля Cosmonaut: тарифы, загрузка, выручка и импорт CSV/Excel. Денежные значения рассчитываются в казахстанских тенге (₸ / KZT). Данные хранятся в Supabase, интерфейс запускается на Next.js.

## Требования

- Node.js 20 или 22 LTS и npm (Node.js устанавливается с официального сайта [nodejs.org](https://nodejs.org/)).
- Git — только если клонируете проект из GitHub; для архива исходников он не нужен.
- Для локального сбора тарифов Google Travel — Chromium, устанавливаемый командой Playwright ниже.

Проверить установку:

```text
node --version
npm --version
```

## Первый запуск на новом компьютере

### 1. Получить проект

Можно скачать ZIP из приватного GitHub-репозитория либо клонировать его в терминале:

```text
git clone <URL-репозитория>
cd hotel-revenue-assistant
```

Если проект получен архивом, распакуйте его и откройте терминал в папке, где находятся `package.json` и `README.md`.

### 2. Установить зависимости

```text
npm ci
npx playwright install chromium
```

На Linux при сообщении об отсутствующих системных библиотеках установите зависимости Chromium:

```text
npx playwright install --with-deps chromium
```

### 3. Подключить Supabase

Приложению нужны проект Supabase и две переменные: `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

1. Создайте проект Supabase или используйте уже имеющийся.
2. Откройте **SQL Editor**, выполните содержимое `schema.sql`. Скрипт создаёт таблицы, представление и запись Cosmonaut (92 номера, валюта KZT).
3. В настройках Supabase откройте данные API проекта и скопируйте Project URL и anon/public key.
4. Создайте локальный файл `.env.local` из шаблона `.env.example` и вставьте значения:

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

macOS / Linux:

```sh
cp .env.example .env.local
```

Затем откройте `.env.local` в редакторе и заполните:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://ваш-проект.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш-anon-public-key
```

Не добавляйте `service_role` key в `.env.local` или в настройки проекта. Файл `.env.local` исключён из Git; не отправляйте его другим людям и не загружайте в репозиторий.

### 4. Запустить приложение

Режим разработки с автоматическим обновлением:

```text
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000). Остановить сервер можно сочетанием `Ctrl+C` в терминале.

PowerShell, macOS Terminal и Linux shell выполняют приведённые команды одинаково; команды копирования `.env.local` указаны отдельно для каждой системы.

## Проверки и production-запуск на компьютере

Тесты:

```text
npm run test:calc
npm run test:import
npm run test:google-rates
npx tsc --noEmit
```

Production-сборка и запуск:

```text
npm run build
npm run start
```

Затем откройте [http://localhost:3000](http://localhost:3000).

## Деплой на Railway

В репозитории есть `Dockerfile` и `railway.json`. Контейнер включает совместимые с Playwright Chromium и системные библиотеки; Railway собирает приложение и запускает Next.js.

1. Сохраните проект в приватном GitHub-репозитории.
2. В Railway создайте проект через **Deploy from GitHub repo** и выберите этот репозиторий. При подключении GitHub разрешите доступ только к нужному репозиторию.
3. В настройках сервиса Railway добавьте переменные `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` со значениями из Supabase. Добавляйте их в Railway Variables вручную; не коммитьте `.env.local`.
4. Запустите деплой. Railway использует Dockerfile и проверяет готовность по `/`.
5. После успешного деплоя включите публичный домен в разделе **Networking / Public Networking** и откройте выданный URL.

Каждое новое изменение, отправленное в подключённую ветку GitHub, запускает новый деплой Railway. Для обновления зависимостей используйте `npm install`, проверьте приложение, затем сохраните изменения и отправьте их в GitHub.

### Важно о доступе

У текущей версии приложения нет экрана входа: каждый, кто знает публичный URL, сможет открыть интерфейс. Не размещайте на публичном сайте конфиденциальные данные. API базы данных использует anon/public ключ Supabase; перед работой с реальными финансовыми данными настройте подходящие политики Supabase и добавьте аутентификацию.

## Работа с календарём

- Номерной фонд — **92 номера**. Доступный фонд = 92 − OOO.
- Загрузка считается как проданные номера ÷ доступный фонд; можно ввести ручное значение.
- Выручка, ADR и RevPAR рассчитываются автоматически в тенге.
- «Тариф стандарт» можно обновлять по Google Travel: приоритет у официального тарифа, иначе берётся найденная цена партнёра. Даты без найденной цены не перезаписывают прежние значения.
- Импорт CSV/Excel принимает даты `дд.мм.гггг` и `гггг-мм-дд`. Числа без валютного знака считаются тенге; разрешены ₸/KZT, суммы с обозначением другой валюты отклоняются.

## Используемые команды

| Команда | Назначение |
|---|---|
| `npm run dev` | Локальный режим разработки |
| `npm run build` | Production-сборка |
| `npm run start` | Запуск готовой production-сборки |
| `npm run test:calc` | Тесты расчётов |
| `npm run test:import` | Тесты импорта CSV/Excel и валют |
| `npm run test:google-rates` | Тесты парсинга тарифов Google Travel |
