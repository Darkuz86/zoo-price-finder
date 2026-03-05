# Deploy guide (ZooStatus price list)

Этот проект — статический фронтенд (Vite build). Результат сборки — папка `dist/`, её и нужно выкладывать на веб‑сервер.

## Требования

- Node.js **18+** (рекомендуется **22**, как в CI)
- npm (идёт вместе с Node)

## Сборка

### В корень домена/поддомена

```sh
npm ci
npm run build
```

### В подпапку существующего сайта

Нужно собрать с `BASE_URL=/имя-папки/`, чтобы корректно работали ссылки/роутинг.

Linux/macOS:

```sh
BASE_URL=/zoo-price-finder/ npm run build
```

Windows (PowerShell):

```powershell
$env:BASE_URL="/zoo-price-finder/"; npm run build
```

Windows (cmd.exe):

```bat
set BASE_URL=/zoo-price-finder/ && npm run build
```

## Что выкладывать

- На сервер копируется **вся папка** `dist/` (содержимое `dist` становится статикой сайта).
- В проекте есть страница `price-list.html` (лежит в `dist/price-list.html` после сборки). Переход на `/` редиректит на неё.

## Настройка веб‑сервера (SPA fallback)

Если сервер отдаёт 404 на “внутренние” URL, нужно сделать fallback на `index.html`.

### Nginx (корень)

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### Nginx (подпапка)

Предполагаем, что файлы лежат в `/var/www/html/zoo-price-finder/` (то есть `dist/*` скопирован в эту папку).

```nginx
location /zoo-price-finder/ {
  root /var/www/html;
  try_files $uri $uri/ /zoo-price-finder/index.html;
}
```

### Apache (.htaccess) (подпапка)

Положить файл `.htaccess` рядом с `index.html` (в папку деплоя):

```apache
RewriteEngine On
RewriteBase /zoo-price-finder/
RewriteRule ^index\\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /zoo-price-finder/index.html [L]
```

## Релизы (опционально)

В репозитории настроен workflow релизов: при пуше тега `vX.Y.Z` собирается проект и в GitHub Release прикрепляется архив `zoo-price-finder-dist.zip` с `dist/`.

Если нужно собирать релиз в подпапку — можно задать переменную репозитория **`BASE_URL`** (GitHub → Settings → Secrets and variables → Actions → Variables).
