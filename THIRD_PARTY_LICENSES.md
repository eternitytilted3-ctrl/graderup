# Third-party licenses

Полный список транзитивных зависимостей: `npx license-checker --summary` (или `npm ls --all`).
Ниже — прямые зависимости и все сторонние ресурсы, которые использует GraderUP.

## npm — runtime

| Пакет | Версия | Лицензия | Назначение |
|---|---|---|---|
| next | 16.3.6 | MIT | Фреймворк (SSR, route handlers) |
| react / react-dom | 19.3.0 | MIT | UI |
| drizzle-orm | 0.45.3 | Apache-2.0 | ORM / SQL builder |
| pg | 8.23.0 | MIT | Драйвер PostgreSQL |
| zod | 4.6.5 | MIT | Валидация |
| @node-rs/argon2 | 2.2.1 | MIT | Хеширование паролей (argon2id) |
| decimal.js | 10.6.0 | MIT | Денежная арифметика |
| lucide-react | 1.48.0 | ISC | Иконки |
| clsx | 2.1.1 | MIT | Утилита классов |
| server-only | 0.0.1 | MIT | Защита серверных модулей от импорта в клиент |

## npm — dev / build

| Пакет | Версия | Лицензия |
|---|---|---|
| tailwindcss, @tailwindcss/postcss | 4.3.3 | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| drizzle-kit | 0.31.11 | MIT |
| tsx | 4.23.15 | MIT |
| vitest | 5.0.1 | MIT |
| @playwright/test | 1.63.0 | Apache-2.0 |
| eslint | 9.39.5 | MIT |
| eslint-config-next | 16.3.6 | MIT |
| dotenv | 18.0.3 | BSD-2-Clause |

## Шрифты

| Шрифт | Лицензия | Источник |
|---|---|---|
| Inter | SIL Open Font License 1.1 | Google Fonts, загружается и раздаётся самим приложением через `next/font` |
| Oswald | SIL Open Font License 1.1 | Google Fonts, через `next/font` |

## Иконки / UI-библиотеки

- Lucide (ISC) — все иконки интерфейса.
- UI-компоненты (Button, Modal, Toast, ...) написаны в этом репозитории, сторонних UI-китов нет.

## Изображения

- Все изображения предметов, кейсов, логотип, фавикон и топографический фон — **оригинальные SVG**, сгенерированные скриптом `scripts/generate-assets.mjs` этого репозитория. Сторонних изображений нет.
- OpenGraph-картинка рисуется кодом (`src/app/opengraph-image.tsx`).
- Названия оружия в демо-данных (AK-47, AWP и т. п.) — общие обозначения моделей; названия раскрасок (finish) вымышлены.
- ⚠️ Картинки и названия скинов CS2 принадлежат Valve Corporation. Подставлять их (например, через CDN Steam) можно только после юридической проверки прав на использование.

## Внешние API (опциональные, выключены по умолчанию)

| Сервис | Где используется | Примечание |
|---|---|---|
| Steam OpenID 2.0 / Steam Web API | `SteamAuthProvider` | Нужен `STEAM_API_KEY`; соблюдайте Steam Web API Terms of Use |
| Skinport Items API | `SkinportPriceProvider` | Публичный, с ограничением частоты; проверьте их Terms перед коммерческим использованием |
| Steam Community Market `priceoverview` | `SteamMarketPriceProvider` | Неофициальный эндпоинт, строгие ограничения частоты |
| Платёжный провайдер | `RealPaymentProvider` | Шаблон адаптера, подключается отдельно |
| KYC-провайдер | `src/server/compliance/kyc.ts` | Hook, подключается отдельно |
