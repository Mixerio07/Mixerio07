# Развёртывание корпоративного портала КОНТЭК на своём хостинге

## Что понадобится

1. **Node.js 20+** (проверка: `node -v`)
2. **MySQL 8** (или совместимая БД — MariaDB 10.5+, TiDB). Подойдёт база на том же хостинге или managed-MySQL.
3. Доступ по SSH к серверу (для VPS) или панель хостинга с поддержкой Node.js-приложений.

## Шаг 1. Загрузите файлы на сервер

Загрузите весь проект (из архива) на сервер, например в `/var/www/kontek-portal`.
Папку `node_modules` можно не загружать — она будет собрана на сервере.

## Шаг 2. Создайте базу данных

```sql
CREATE DATABASE kontek_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kontek'@'%' IDENTIFIED BY 'СТОЙКИЙ_ПАРОЛЬ';
GRANT ALL PRIVILEGES ON kontek_portal.* TO 'kontek'@'%';
FLUSH PRIVILEGES;
```

## Шаг 3. Настройте переменные окружения

Скопируйте `.env.production.example` в `.env` и заполните:

```bash
cp .env.production.example .env
nano .env
```

Обязательно поменяйте:
- `APP_SECRET` — длинная случайная строка (секрет сессий);
- `DATABASE_URL` — строка подключения к вашей БД;
- `ADMIN_PASSWORD` — пароль первого администратора (логин: `admin`).

## Шаг 4. Установите зависимости и соберите проект

```bash
npm ci
npm run build
```

## Шаг 5. Создайте таблицы в базе

```bash
npm run db:push
```

(Если появится вопрос про truncate на существующей базе — отвечайте внимательно, на пустой базе вопросов не будет.)

## Шаг 6. Запустите

```bash
NODE_ENV=production npm start
```

Сервер поднимется на порту 3000. При первом запуске автоматически создаётся
администратор: логин **admin**, пароль — из `ADMIN_PASSWORD`.

## Шаг 7. Постоянный запуск (systemd или pm2)

Вариант с pm2:

```bash
npm i -g pm2
pm2 start "npm start" --name kontek-portal
pm2 save && pm2 startup
```

Вариант systemd — создайте `/etc/systemd/system/kontek.service`:

```ini
[Unit]
Description=KONTEK Portal
After=network.target mysql.service

[Service]
WorkingDirectory=/var/www/kontek-portal
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now kontek
```

## Шаг 8. Проксирование через Nginx (домен + HTTPS)

```nginx
server {
    listen 80;
    server_name portal.vash-domen.ru;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

HTTPS бесплатно: `certbot --nginx -d portal.vash-domen.ru`

## Первый вход

1. Откройте `https://portal.vash-domen.ru/login`
2. Войдите: логин `admin`, пароль из `ADMIN_PASSWORD`
3. Сразу смените пароль и заведите сотрудников: раздел **Сотрудники → Добавить сотрудника**
4. Назначьте роли: Сотрудник / Руководитель / Администратор

## Замечания

- Вход через Kimi на самостоятельном хостинге не используется — работает локальная авторизация (логин/пароль).
- Публичный сайт-визитка доступен на главной странице (`/`), портал — на `/portal`.
- Документы хранятся в базе (base64), лимит файла — 5 МБ.
