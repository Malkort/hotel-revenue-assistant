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

## Развёртывание на собственном Linux VPS (Docker)

Для этого способа нужен сервер Ubuntu 22.04/24.04 или другой Linux-сервер с Docker Compose, публичным IP-адресом и доменным именем. Docker-образ использует Playwright-образ с установленным Chromium, поэтому серверный сбор Google Travel также доступен.

### 1. Подготовить сервер и домен

1. Создайте VPS у выбранного провайдера и подключитесь к нему по SSH.
2. Установите Docker Engine и Docker Compose plugin по официальной инструкции для вашей версии Linux: [docs.docker.com/engine/install](https://docs.docker.com/engine/install/).
3. В DNS-панели домена создайте запись `A`, указывающую на публичный IPv4 сервера. Если на сервере настроен IPv6, при необходимости добавьте `AAAA`.
4. Разрешите входящие TCP-подключения на порты `80` и `443` в firewall сервера и панели VPS. Caddy использует их для HTTP и автоматического HTTPS.

### 2. Загрузить код на VPS

Установите Git, затем выполните:

```sh
git clone https://github.com/Malkort/hotel-revenue-assistant.git
cd hotel-revenue-assistant
```

Для приватного репозитория сначала настройте доступ к GitHub на сервере (например, deploy key с доступом только на чтение к этому репозиторию). Не помещайте GitHub-токены в команду `git clone`, историю shell или файлы проекта.

### 3. Настроить Supabase и переменные

1. Откройте проект Supabase → **SQL Editor**, выполните содержимое `schema.sql` для создания таблиц и записи Cosmonaut с фондом 92 номера и валютой KZT.
2. Скопируйте пример и откройте файл для редактирования:

```sh
cp .env.example .env.local
nano .env.local
```

Заполните его значениями своего Supabase-проекта и доменом, который направлен на VPS:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://ваш-проект.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш-anon-public-key
DOMAIN_NAME=hotel.example.com
```

Замените `hotel.example.com` на свой домен. Вставьте anon/public key из настроек API Supabase; **не используйте `service_role` key**. Сохраните файл, ограничьте права доступа (`chmod 600 .env.local`) и никогда не добавляйте его в Git или Docker-образ.

### 4. Собрать и запустить

Из корня проекта выполните:

```sh
docker compose --env-file .env.local up -d --build
docker compose ps
docker compose logs -f app caddy
```

Когда DNS уже обновился и порты 80/443 доступны, Caddy запросит и продлит TLS-сертификат автоматически. Откройте `https://hotel.example.com`. Остановить просмотр логов — `Ctrl+C`; контейнеры при этом продолжат работать. Чтобы остановить приложение:

```sh
docker compose down
```

Данные приложения находятся в Supabase, сертификаты и конфигурация Caddy — в Docker volumes; локальное удаление контейнеров не удаляет базу Supabase.

### 5. Обновить версию

Подключитесь к VPS, перейдите в каталог проекта и выполните:

```sh
git pull
docker compose --env-file .env.local up -d --build
```

Переменные окружения задаются на этапе сборки Next.js, поэтому после изменения Supabase URL/key требуется пересобрать образ той же командой.

### Запуск Docker без домена (для проверки)

На компьютере с Docker можно собрать и запустить образ локально. Передайте те же две переменные Supabase через build arguments и runtime environment; затем откройте `http://localhost:3000`. Для публичного сервера используйте описанную выше конфигурацию с Caddy и HTTPS, а не публикацию порта Next.js напрямую.

### Важно о доступе

У текущей версии приложения нет экрана входа: каждый, кто знает публичный URL, сможет открыть интерфейс. Не размещайте на публичном сайте конфиденциальные данные. API базы данных использует anon/public ключ Supabase; перед работой с реальными финансовыми данными настройте подходящие политики Supabase и добавьте аутентификацию. Ограничьте доступ к Supabase Row Level Security и не открывайте таблицы на запись без соответствующих правил.

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
