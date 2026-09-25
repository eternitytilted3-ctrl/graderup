# GraderUP

Full-stack платформа: **кейсы, апгрейд, инвентарь, аккаунты, баланс, награды, платежи, админ-панель**.
Тёмный дизайн с тактическим CS2-настроением, UI на русском.

- **Frontend + Backend:** Next.js 16 (App Router, TypeScript). Route handlers `/api/*` — тонкие контроллеры, вся логика в `src/server/services`.
- **БД:** PostgreSQL 14+ через Drizzle ORM, миграции в `src/server/db/migrations`.
- **Безопасность:** все игровые и денежные расчёты только на сервере, в транзакциях БД с блокировками строк.

> ⚠️ **Юридическое предупреждение.** Платные случайные механики (loot boxes), операции с реальными деньгами и вывод средств регулируются по-разному в разных странах. Юридические страницы — **шаблоны**; перед запуском их должен проверить юрист (см. [Compliance](#compliance)). Проект не заявляет о наличии лицензий.

---

## Требования

- Node.js **20.9+** (проверено на 22)
- PostgreSQL **14+** (локально или `docker compose up -d`)
- npm 10+

## Быстрый старт

```bash
npm install
cp .env.example .env            # заполните SESSION_SECRET и PAYMENT_SECRET (openssl rand -hex 32)
docker compose up -d            # или используйте свой PostgreSQL
npm run db:migrate              # применить миграции
npm run db:seed                 # 12 кейсов, 64 предмета, demo-пользователи и история
npm run dev                     # http://localhost:3000
```

Сид скачивает **реальные скины CS2** (~9 000 шт.: названия, редкости, картинки со Steam CDN) из открытой базы [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API) и цены Skinport в рублях. Без интернета используются сгенерированные демо-предметы (`SEED_REAL_SKINS=false` — принудительно).

**Валюта сайта — коины `C`**: 1 C = 1 ₽ пополнения. Все суммы в БД хранятся в коинах.

**Вход — через Steam** (OpenID, ключ не нужен; `STEAM_API_KEY` добавляет ник и аватар). Регистрация по email отключена (`EMAIL_REGISTRATION_ENABLED=false`); вход по email остаётся для администраторов — ссылка «Вход по email» на странице авторизации.

Учётные записи после сида:

| Роль | Логин | Пароль |
|---|---|---|
| superadmin | `admin@graderup.local` | `Admin12345!` |
| пользователь | `demo@graderup.local` (или `demo`) | `Demo12345!` |

Пароли задаются `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD`. **В production не запускайте seed** (или смените пароли сразу).

## Переменные окружения

См. `.env.example` (секреты в Git не коммитятся, `.env` в `.gitignore`).

| Переменная | Обязательна | Описание |
|---|---|---|
| `DATABASE_URL` | да | строка подключения PostgreSQL |
| `SESSION_SECRET` | да | ≥32 символа |
| `APP_URL` | да | публичный URL (cookies, CSRF-проверка Origin, redirect'ы, sitemap) |
| `API_URL` | нет | для внешних клиентов; в монолите = `APP_URL/api` |
| `PAYMENT_PROVIDER` | да | `mock` \| `real` |
| `PAYMENT_SECRET` | да | секрет HMAC подписи webhook |
| `ALLOW_MOCK_PAYMENTS_IN_PRODUCTION` | нет | разрешить mock-платежи при `NODE_ENV=production` (только стенды!) |
| `REAL_PAYMENT_API_URL/_API_KEY/_MERCHANT_ID` | для real | реквизиты провайдера |
| `STEAM_AUTH_ENABLED`, `STEAM_API_KEY` | нет | вход через Steam (OpenID 2.0); `STEAM_CLIENT_ID/SECRET` зарезервированы |
| `PRICE_PROVIDER`, `PRICE_CURRENCY` | нет | синхронизация рыночных цен скинов (RUB): `auto` (market.csgo.com → Skinport) \| `marketcsgo` \| `skinport` \| `steam` \| `mock` |
| `TRUST_PROXY` | нет | см. «Деплой» |
| `FEATURE_WITHDRAW` | нет | `false` отключает вывод |
| `MIN_AGE`, `RESTRICTED_COUNTRIES`, `COUNTRY_HEADER` | нет | возраст/гео-ограничения |
| `KYC_PROVIDER`, `KYC_WITHDRAW_THRESHOLD` | нет | KYC-хуки |
| `DB_POOL_MAX` | нет | размер пула (по умолчанию 20) |

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер |
| `npm run build` / `npm start` | production-сборка и запуск |
| `npm run db:generate` | сгенерировать миграцию после изменения `schema.ts` |
| `npm run db:migrate` | применить миграции |
| `npm run db:seed` | демо-данные (только в пустую БД) |
| `npm run db:reset` | удалить схему → migrate → seed (запрещено в production) |
| `npm run admin:create -- --email a@b.c --username boss --password 'Str0ngPass'` | создать superadmin |
| `npm run admin:create -- --promote username` | повысить существующего пользователя |
| `npm run prices:sync` (`-- --dry-run`) | синхронизировать цены предметов с маркетом |
| `npm run skins:import` (`-- --rebuild-cases`) | обновить каталог скинов CS2 и цены (и пересобрать кейсы) |
| `npm run assets:generate` | перегенерировать оригинальные SVG-ассеты |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | unit + интеграционные тесты (нужна `TEST_DATABASE_URL`, **БД очищается**) |
| `npm run test:e2e` | Playwright E2E против запущенного сервера (`E2E_BASE_URL`) |

## Архитектура

```
src/
  app/(site)/…          публичные и пользовательские страницы
  app/admin/…           админ-панель (guard: роль admin/superadmin)
  app/api/…             REST API (тонкие контроллеры)
  server/
    db/                 schema.ts, client.ts, migrations/
    http/               route() wrapper: auth, роли, CSRF, rate limit, zod, idempotency, ошибки
    auth/               сессии, argon2id, AuthProvider (Email, Steam)
    services/           ledger, cases, inventory, upgrade(+formula), rewards, promocodes,
                        payments, withdrawals, profile, stats, admin, settings, log
    payments/           PaymentProvider: Mock / Real
    pricing/            PriceProvider: Skinport / Steam Market / Mock + sync
    compliance/         KYC/AML хуки, возраст/регион
    security/           rate limit (Postgres), crypto RNG, IP
  components/ui|domain|admin
  config/               env.ts (валидация ENV), legal.ts (юр. параметры-плейсхолдеры)
  content/legal.ts      тексты юр. шаблонов
```

### Игровая логика (только сервер)

- **Открытие кейса** (`services/cases.ts`): lock пользователя → кейс и цена из БД → `crypto.randomInt(sumWeights)` → списание через ledger → `user_items` + `case_openings` → ответ. Лента рулетки строится сервером вокруг выигрыша, анимация — только визуализация.
- **Upgrade** (`services/upgrade.ts` + `upgradeFormula.ts`): `chance = clamp(source / target × (1 − houseEdge) × 100, minChance, maxChance)`, параметры — в настройке `upgrade` (админка). Бросок `randomInt(1 000 000)`, победа при `roll < chance × 10 000`. Исходный предмет блокируется `SELECT … FOR UPDATE`.
- **Ledger** (`services/ledger.ts`): единственное место изменения баланса; каждая операция пишет `transactions` с `balance_before/after`. `CHECK (balance >= 0)` в БД.
- **Защита от гонок**: каждая операция сначала блокирует строку пользователя (одинаковый порядок блокировок → без deadlock'ов), условные UPDATE (`status='available'`), UNIQUE-ограничения (`reward_claims`, `promocode_uses`, `upgrades.source_user_item_id`), `Idempotency-Key` для повторов, `lock_timeout`.
- **Платежи**: баланс начисляется только в обработчике подписанного webhook (`pending → completed` один раз). Mock-провайдер имитирует hosted checkout и шлёт подписанный webhook через тот же путь.

### Безопасность (кратко)

SQLi — параметризованные запросы Drizzle; XSS — React-экранирование + CSP; CSRF — `SameSite=Lax` + проверка Origin + double-submit токен; IDOR — все запросы фильтруются по `session.userId`; rate limit в Postgres (работает на нескольких инстансах); brute force — лимиты по IP и аккаунту + временная блокировка после 5 ошибок; цены/шансы/результаты с клиента не принимаются; ошибки отдаются как `{error:{code,message}}` без stack trace; admin API — проверка роли + `admin_logs` в той же транзакции.

### Анимации и звуки

Рулетка и шкала апгрейда анимируются через Web Animations API (работают и при включённом «уменьшении движения» в ОС), картинки ленты предзагружаются до старта. Звуки синтезируются Web Audio API (без аудиофайлов), переключатель звука — на странице кейса и апгрейда. Кнопки апгрейда ×2 / ×5 / ×10 / 30% / 50% / 75% подбирают цель на сервере (`GET /api/upgrade/auto-target`).

### CS2-скины и рыночные цены

У предмета есть `market_hash_name`, `market_price`, `price_source`, `price_updated_at`, `price_locked`.
`PriceProvider` (`src/server/pricing`) отдаёт цены по `market_hash_name`; `syncPrices()` применяет наценку/минимум из настройки `pricing` и обновляет `items.price` (кроме `price_locked`).

1. В админке → «Предметы» укажите у предмета точный `market_hash_name` (например `AK-47 | Redline (Field-Tested)`) и при необходимости https-URL картинки.
2. В «Настройках» → `pricing`: `provider` (`auto` = market.csgo.com → Skinport, либо `marketcsgo`/`skinport`/`steam`), `markupPercent`, `minPrice` (или `PRICE_PROVIDER` в ENV).
3. «Синхронизировать цены» в админке или `npm run prices:sync` по cron (например раз в час).
4. После синхронизации проверьте RTP кейсов в редакторе — цены влияют на экономику.

Новый источник цен = класс, реализующий `PriceProvider.fetchPrices(names)`, и строка в `getPriceProvider()`.
⚠️ Изображения и названия скинов принадлежат Valve — используйте их только после проверки прав.

## Деплой (production)

1. PostgreSQL + `DATABASE_URL`; секреты — через переменные окружения платформы.
2. `npm ci && npm run build && npm run db:migrate && npm start` (порт `PORT`, по умолчанию 3000).
3. Поставьте перед приложением reverse proxy (nginx/Caddy/CDN) с HTTPS. Proxy **должен перезаписывать** `X-Forwarded-For`/`X-Real-IP` реальным адресом клиента (`proxy_set_header X-Real-IP $remote_addr;`) — от этого зависят rate limit и логи.
4. `APP_URL` = публичный https-адрес (cookies получают `Secure`, включается HSTS).
5. `PAYMENT_PROVIDER=real` + реализация `RealPaymentProvider`; webhook: `POST {APP_URL}/api/payments/webhook/real`.
6. Создайте администратора: `npm run admin:create -- --email … --username … --password …`.
7. Cron: `npm run prices:sync` (если используете рыночные цены).

### VPS одной командой (Docker)

`docker-compose.prod.yml` поднимает PostgreSQL, приложение и nginx (перезаписывает `X-Real-IP`) на порту `PORT` (по умолчанию 4555). Наружу открыт только nginx.

```bash
git clone -b claude/gaming-platform-cases-inventory-is3k9h https://github.com/eternitytilted3-ctrl/graderup.git /opt/graderup
cd /opt/graderup
PUBLIC_HOST=45.131.186.197 PORT=4555 bash deploy/setup-vps.sh   # Docker, секреты, сборка, миграции, seed
bash deploy/update.sh                                            # обновление: git pull + пересборка
docker compose -f docker-compose.prod.yml logs -f app            # логи
docker compose -f docker-compose.prod.yml --env-file .env.production exec app npm run prices:update  # свежие цены (RUB) + пересчёт кейсов
```

`deploy/setup-vps.sh` создаёт `.env.production` (gitignored) со случайными секретами и паролем администратора (`SEED_ADMIN_PASSWORD`), `SEED_DEMO=false` (без демо-пользователей и демо-дропов). Mock-платежи и mock-вывод скинов в production выключены — подключите реальные ключи Pally/AnyPay/xRocket в `.env.production` и выполните `bash deploy/update.sh`. Для HTTPS привяжите домен и поставьте TLS (например, Caddy/certbot) перед nginx, затем смените `APP_URL` на `https://…`.

## Симуляция активности (только тест)

`npm run sim` — боты (`bot_001…`, `@sim.graderup.local`) по-настоящему открывают кейсы, делают апгрейды, продают и выводят скины (через mock-провайдер) и держат присутствие онлайн. Онлайн, лента дропов и статистика растут от этих реальных действий в **тестовой** базе. С `NODE_ENV=production` скрипт не запускается.

```bash
npm run sim                              # 40 ботов, тик каждые 2 с, до Ctrl+C
npm run sim -- --bots=80 --interval=1
npm run sim -- --burst=2000              # быстро прогнать 2000 действий
npm run sim -- --cleanup                 # «припарковать» ботов (бан)
```

## Тесты

- `tests/unit` — формула апгрейда, распределение, weighted pick, деньги, окна наград.
- `tests/integration` — на реальной БД: параллельные открытия не уходят в минус, 20 параллельных продаж одного предмета → 1 успех, двойной апгрейд, IDOR, повтор daily/promo, replay webhook, подделка подписи.
- `tests/e2e` — Playwright: полный путь пользователя, админка (предупреждение о сумме вероятностей, audit корректировки баланса), CSRF/IDOR/манипуляции ценой, idempotency, заголовки безопасности, отсутствие горизонтального скролла на 320–1440px.

```bash
npm test
npm run build && npm start &          # затем:
npm run test:e2e                      # CHROME_PATH=/path/to/chrome при необходимости
```

## Compliance

- `src/config/legal.ts` — оператор, юрисдикция, контакты, лицензия (`null`, пока не получена).
- Страницы: `/terms`, `/privacy`, `/cookies`, `/aml`, `/refund`, `/responsible`, `/risk` — шаблоны с пометками `[ПРОВЕРИТЬ]`.
- Возраст: чекбокс при регистрации + `MIN_AGE`; гео-блок: `RESTRICTED_COUNTRIES` + `COUNTRY_HEADER` (например `cf-ipcountry`).
- KYC/AML: `src/server/compliance/kyc.ts` (`KycProvider`, `assertWithdrawalAllowed`, `amlScreen`).
- Платёжный провайдер заменяемый (`PaymentProvider`).

## Что требует внешних сервисов

| Функция | Что нужно |
|---|---|
| Реальные платежи | договор с провайдером + реализация `RealPaymentProvider` (создание платежа, схема подписи webhook) |
| Вывод средств | выплаты выполняются вне системы; админка фиксирует одобрение/отклонение |
| Вход через Steam | `STEAM_AUTH_ENABLED=true`, `STEAM_API_KEY` |
| Рыночные цены скинов | `PRICE_PROVIDER=auto` (market.csgo.com → Skinport, RUB) — соблюдайте их условия. Обновить цены и кейсы: `npm run prices:update` |
| KYC/AML | интеграция с KYC-вендором |
| Email (подтверждение/сброс пароля) | SMTP-провайдер — не реализовано |
| Юридические тексты | проверка юристом |

## Доступ по локальной сети / Radmin VPN

1. Запустите `npm run dev` (или `npm run dev:lan`). Dev-сервер уже разрешает адреса Radmin (`26.x`, `25.x`) и обычных LAN-сетей; другие хосты добавьте в `DEV_ALLOWED_ORIGINS`.
2. Откройте порт в брандмауэре (PowerShell **от администратора**):
   ```powershell
   New-NetFirewallRule -DisplayName "GraderUP 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   # если раньше закрыли окно-запрос брандмауэра для Node.js — удалите блокирующие правила:
   Get-NetFirewallRule | Where-Object { $_.DisplayName -like '*Node*' -and $_.Action -eq 'Block' } | Remove-NetFirewallRule
   ```
3. Проверка с другого ПК: `Test-NetConnection <ваш-IP> -Port 3000` → `TcpTestSucceeded : True`.
4. Чтобы работал вход через Steam у всех, укажите `APP_URL=http://<ваш-IP>:3000` и открывайте сайт по этому адресу (не по localhost).

Cookies получают флаг `Secure` только когда `APP_URL` начинается с `https://`, поэтому вход работает и по обычному `http://` в локальной сети.
