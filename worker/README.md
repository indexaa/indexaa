# Как включить заявки в Telegram и посты канала (бесплатно, ~15 минут)

## 1. Бот для заявок
1. Напишите [@BotFather](https://t.me/BotFather) → `/newbot` → получите **токен** вида `123456:ABC...`.
2. Напишите своему новому боту любое сообщение.
3. Откройте в браузере `https://api.telegram.org/bot<ТОКЕН>/getUpdates` и найдите `"chat":{"id":123456789` — это **chat_id**.

## 2. Cloudflare Worker
1. Зарегистрируйтесь на [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Create Worker**.
2. Назовите, например, `indexaa` → **Deploy** → **Edit code**, вставьте содержимое `worker.js` → **Deploy**.
3. **Settings → Variables and Secrets**:
   - `TG_BOT_TOKEN` (Secret) — токен бота
   - `TG_CHAT_ID` (Secret) — ваш chat_id
   - `CHANNEL` (Text) — `indexagafonov`
   - `ALLOWED_ORIGIN` (Text) — адрес сайта, например `https://indexaa.ru` (или `*` для проверки)
4. Скопируйте адрес Worker'а (`https://indexaa.<ваше-имя>.workers.dev`).

## 3. Подключить к сайту
В `config.js` впишите `WORKER_URL: 'https://indexaa.<ваше-имя>.workers.dev'`.

Проверка: откройте `<WORKER_URL>/posts` — должен прийти список постов.

## Ещё два пункта в config.js
- `CALENDAR_URL` — зарегистрируйтесь на [cal.com](https://cal.com), создайте встречу «Созвон 30 минут», вставьте ссылку.
- `YANDEX_METRIKA_ID` — создайте счётчик на [metrika.yandex.ru](https://metrika.yandex.ru), вставьте номер.
  Цели для настройки (тип «JavaScript-событие»): `audit_done`, `result_contact`, `audit_pdf`, `lead_sent`, `calendar_click`, `package_click`.
