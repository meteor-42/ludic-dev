# Полное руководство по проекту Ludic-Dev

## Содержание
1. [Обзор проекта](#обзор-проекта)
2. [Архитектура](#архитектура)
3. [Технологический стек](#технологический-стек)
4. [Структура проекта](#структура-проекта)
5. [Схема базы данных](#схема-базы-данных)
6. [API эндпоинты](#api-эндпоинты)
7. [Аутентификация](#аутентификация)
8. [Фронтенд компоненты](#фронтенд-компоненты)
9. [Настройка окружения](#настройка-окружения)
10. [Запуск проекта](#запуск-проекта)
11. [Развертывание на AlmaLinux](#развертывание-на-almalinux)

---

## Обзор проекта

**Ludic-Dev** — это микросервис авторизации для букмекерской платформы с интеграцией PocketBase для аутентификации пользователей.

### Основные возможности:
- Регистрация и авторизация пользователей через PocketBase
- JWT-токены для безопасной аутентификации
- Управление кошельком пользователя
- Система ставок с отслеживанием статуса
- Темная/светлая тема интерфейса
- Адаптивный дизайн

---

## Архитектура

### Общая схема

```
┌─────────────────────────────────────────────────────────────┐
│                      КЛИЕНТ (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Auth       │  │  Dashboard  │  │  Betting    │          │
│  │  Context    │  │  Page       │  │  Components │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          │                                   │
│                   TanStack Query                             │
└──────────────────────────┼───────────────────────────────────┘
                           │
                    HTTP/REST API
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    СЕРВЕР (Express.js)                       │
│                          │                                   │
│  ┌───────────────────────┼───────────────────────────────┐   │
│  │              API Routes (routes.ts)                   │   │
│  │   /api/auth/*    /api/wallet    /api/bets            │   │
│  └───────────────────────┼───────────────────────────────┘   │
│                          │                                   │
│  ┌───────────────┐  ┌────┴────────┐  ┌───────────────┐      │
│  │  PocketBase   │  │  Storage    │  │  Drizzle ORM  │      │
│  │  SDK          │  │  Interface  │  │               │      │
│  └───────┬───────┘  └──────┬──────┘  └───────┬───────┘      │
└──────────┼─────────────────┼─────────────────┼───────────────┘
           │                 │                 │
           ▼                 │                 ▼
    ┌──────────────┐         │          ┌──────────────┐
    │  PocketBase  │         │          │  PostgreSQL  │
    │  (Users,     │         │          │  (Wallets,   │
    │   Auth)      │         │          │   Bets)      │
    └──────────────┘         │          └──────────────┘
                             │
                    ┌────────┴────────┐
                    │   In-Memory     │
                    │   Storage       │
                    │   (fallback)    │
                    └─────────────────┘
```

### Потоки данных

1. **Поток аутентификации:**
   - Пользователь вводит логин/пароль на странице входа
   - Запрос отправляется на `/api/auth/login`
   - Сервер обращается к PocketBase для верификации
   - При успехе возвращается JWT токен
   - Токен сохраняется в AuthContext и localStorage

2. **Поток создания ставки:**
   - Пользователь выбирает событие и вводит сумму
   - Проверка баланса кошелька
   - Создание записи ставки в PostgreSQL
   - Обновление баланса кошелька
   - Отображение подтверждения

---

## Технологический стек

### Frontend
| Технология | Назначение |
|------------|------------|
| **React** | UI библиотека |
| **Vite** | Сборщик и dev-сервер |
| **TypeScript** | Типизация |
| **shadcn/ui** | UI компоненты |
| **Tailwind CSS** | Стилизация |
| **Wouter** | Роутинг |
| **TanStack Query** | Управление серверным состоянием |
| **React Hook Form** | Работа с формами |
| **Zod** | Валидация данных |

### Backend
| Технология | Назначение |
|------------|------------|
| **Express.js** | HTTP сервер |
| **PocketBase SDK** | Интеграция с PocketBase |
| **Drizzle ORM** | Работа с PostgreSQL |
| **drizzle-zod** | Генерация схем валидации |
| **esbuild** | Сборка серверного кода |

### Базы данных
| БД | Назначение |
|----|------------|
| **PocketBase** | Пользователи и аутентификация |
| **PostgreSQL** | Кошельки и ставки |

---

## Структура проекта

```
ludic-dev/
├── client/                    # Фронтенд приложение
│   └── src/
│       ├── components/        # React компоненты
│       │   ├── ui/           # shadcn/ui компоненты
│       │   └── app-sidebar.tsx
│       ├── hooks/            # Кастомные хуки
│       │   └── use-toast.ts
│       ├── lib/              # Утилиты и контексты
│       │   ├── auth-context.tsx   # Контекст аутентификации
│       │   ├── theme-context.tsx  # Контекст темы
│       │   ├── queryClient.ts     # Настройка TanStack Query
│       │   └── utils.ts
│       ├── pages/            # Страницы приложения
│       │   ├── login.tsx         # Страница входа
│       │   ├── dashboard.tsx     # Главный дашборд
│       │   └── not-found.tsx
│       ├── App.tsx           # Корневой компонент
│       └── main.tsx          # Точка входа
├── server/                   # Бэкенд приложение
│   ├── routes.ts            # API маршруты
│   ├── storage.ts           # Интерфейс хранилища
│   ├── index.ts             # Точка входа сервера
│   └── vite.ts              # Интеграция с Vite
├── shared/                   # Общий код
│   └── schema.ts            # Типы и схемы Drizzle
├── docs/                     # Документация
│   └── FULL_GUIDE.md        # Это руководство
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── drizzle.config.ts
```

---

## Схема базы данных

### Таблица `wallets` (Кошельки)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | SERIAL PRIMARY KEY | Уникальный идентификатор |
| `user_id` | TEXT NOT NULL | ID пользователя из PocketBase |
| `balance` | DECIMAL(10,2) | Текущий баланс |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата последнего обновления |

### Таблица `bets` (Ставки)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | SERIAL PRIMARY KEY | Уникальный идентификатор |
| `user_id` | TEXT NOT NULL | ID пользователя |
| `event_name` | TEXT NOT NULL | Название события |
| `selection` | TEXT NOT NULL | Выбор пользователя |
| `odds` | DECIMAL(10,2) | Коэффициент |
| `amount` | DECIMAL(10,2) | Сумма ставки |
| `potential_win` | DECIMAL(10,2) | Потенциальный выигрыш |
| `status` | TEXT | Статус: pending/won/lost |
| `result` | TEXT | Результат события |
| `created_at` | TIMESTAMP | Дата создания |
| `settled_at` | TIMESTAMP | Дата расчета |

### Drizzle схема (shared/schema.ts)

```typescript
import { pgTable, text, serial, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bets = pgTable("bets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  eventName: text("event_name").notNull(),
  selection: text("selection").notNull(),
  odds: decimal("odds", { precision: 10, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  potentialWin: decimal("potential_win", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("pending"),
  result: text("result"),
  createdAt: timestamp("created_at").defaultNow(),
  settledAt: timestamp("settled_at"),
});

// Схемы валидации
export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true });
export const insertBetSchema = createInsertSchema(bets).omit({ id: true });

// Типы
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Bet = typeof bets.$inferSelect;
export type InsertBet = z.infer<typeof insertBetSchema>;
```

---

## API эндпоинты

### Аутентификация

#### `POST /api/auth/login`
Авторизация пользователя через PocketBase.

**Запрос:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Ответ (успех):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### `GET /api/auth/me`
Проверка текущего токена и получение данных пользователя.

**Заголовки:**
```
Authorization: Bearer <token>
```

**Ответ:**
```json
{
  "id": "abc123",
  "email": "user@example.com",
  "name": "John Doe"
}
```

#### `POST /api/auth/logout`
Выход из системы (инвалидация токена).

**Ответ:**
```json
{
  "success": true
}
```

### Кошелек

#### `GET /api/wallet`
Получение баланса кошелька текущего пользователя.

**Заголовки:**
```
Authorization: Bearer <token>
```

**Ответ:**
```json
{
  "id": 1,
  "userId": "abc123",
  "balance": "1000.00",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T12:30:00Z"
}
```

### Ставки

#### `GET /api/bets`
Получение списка ставок текущего пользователя.

**Ответ:**
```json
[
  {
    "id": 1,
    "userId": "abc123",
    "eventName": "Матч A vs B",
    "selection": "Победа A",
    "odds": "2.50",
    "amount": "100.00",
    "potentialWin": "250.00",
    "status": "pending",
    "createdAt": "2024-01-15T10:00:00Z"
  }
]
```

#### `POST /api/bets`
Создание новой ставки.

**Запрос:**
```json
{
  "eventName": "Матч A vs B",
  "selection": "Победа A",
  "odds": 2.50,
  "amount": 100.00
}
```

**Ответ:**
```json
{
  "id": 1,
  "userId": "abc123",
  "eventName": "Матч A vs B",
  "selection": "Победа A",
  "odds": "2.50",
  "amount": "100.00",
  "potentialWin": "250.00",
  "status": "pending",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

---

## Аутентификация

### Контекст авторизации (AuthContext)

Контекст управляет состоянием авторизации во всем приложении:

```typescript
// client/src/lib/auth-context.tsx
interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}
```

### Использование в компонентах

```tsx
import { useAuth } from "@/lib/auth-context";

function Dashboard() {
  const { user, logout, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return (
    <div>
      <p>Добро пожаловать, {user?.name}!</p>
      <Button onClick={logout}>Выйти</Button>
    </div>
  );
}
```

### JWT Токены

- Токены генерируются PocketBase при успешной авторизации
- Хранятся в localStorage для персистентности между сессиями
- Отправляются в заголовке `Authorization: Bearer <token>`
- Автоматически проверяются при загрузке приложения

---

## Фронтенд компоненты

### Ключевые файлы

| Файл | Назначение |
|------|------------|
| `App.tsx` | Корневой компонент, роутинг, провайдеры |
| `app-sidebar.tsx` | Боковая навигация |
| `login.tsx` | Форма входа |
| `dashboard.tsx` | Главная страница пользователя |
| `auth-context.tsx` | Контекст и хуки авторизации |
| `theme-context.tsx` | Переключение темной/светлой темы |

### Пример структуры App.tsx

```tsx
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SidebarProvider>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <main className="flex-1">
                <Switch>
                  <Route path="/login" component={Login} />
                  <Route path="/" component={Dashboard} />
                </Switch>
              </main>
            </div>
          </SidebarProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

---

## Настройка окружения

### Переменные окружения

Создайте файл `.env` со следующими переменными:

```env
# PocketBase
POCKETBASE_URL=https://your-pocketbase-instance.com

# PostgreSQL (автоматически предоставляется Replit)
DATABASE_URL=postgresql://...

# Сессии
SESSION_SECRET=your-super-secret-key
```

### PocketBase

1. Развернуть PocketBase (можно использовать pockethost.io)
2. Создать коллекцию `users` с полями:
   - `email` (text, required, unique)
   - `password` (password)
   - `name` (text)
3. Настроить правила доступа для коллекции
4. Скопировать URL в `POCKETBASE_URL`

---

## Запуск проекта

### Разработка

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev
```

Приложение будет доступно по адресу `http://localhost:5000`

### Миграции БД

```bash
# Генерация миграций
npm run db:generate

# Применение миграций
npm run db:push
```

### Сборка для продакшена

```bash
npm run build
npm start
```

---

## Развертывание на AlmaLinux

Это руководство описывает полный процесс развертывания проекта Ludic-Dev на сервере с AlmaLinux 8/9 (RHEL-совместимый дистрибутив).

### 1. Подготовка системы

#### Обновление системы и установка базовых пакетов

```bash
# Обновляем систему
sudo dnf update -y

# Устанавливаем EPEL репозиторий
sudo dnf install -y epel-release

# Устанавливаем базовые инструменты
sudo dnf install -y git curl wget unzip make gcc gcc-c++
```

### 2. Установка Node.js 20.x

```bash
# Добавляем NodeSource репозиторий
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -

# Устанавливаем Node.js
sudo dnf install -y nodejs

# Проверяем версию
node --version  # Ожидаем v20.x.x
npm --version
```

### 3. Установка и настройка PostgreSQL 15

```bash
# Добавляем официальный репозиторий PostgreSQL
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# Отключаем встроенный модуль PostgreSQL
sudo dnf -qy module disable postgresql

# Устанавливаем PostgreSQL 15
sudo dnf install -y postgresql15-server postgresql15

# Инициализируем базу данных
sudo /usr/pgsql-15/bin/postgresql-15-setup initdb

# Запускаем и включаем автозапуск
sudo systemctl start postgresql-15
sudo systemctl enable postgresql-15

# Создаём пользователя и базу данных
sudo -u postgres psql << EOF
CREATE USER ludic WITH PASSWORD 'your_secure_password';
CREATE DATABASE ludic_dev OWNER ludic;
GRANT ALL PRIVILEGES ON DATABASE ludic_dev TO ludic;
EOF
```

#### Настройка pg_hba.conf для локальных подключений

```bash
sudo nano /var/lib/pgsql/15/data/pg_hba.conf
```

Добавьте или измените строку:
```
# IPv4 local connections:
host    ludic_dev    ludic    127.0.0.1/32    scram-sha-256
```

```bash
sudo systemctl restart postgresql-15
```

### 4. Установка PocketBase

```bash
# Создаём директорию для PocketBase
sudo mkdir -p /opt/pocketbase
cd /opt/pocketbase

# Скачиваем последнюю версию (проверьте актуальную на github.com/pocketbase/pocketbase)
sudo wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.9/pocketbase_0.22.9_linux_amd64.zip

# Распаковываем
sudo unzip pocketbase_0.22.9_linux_amd64.zip
sudo rm pocketbase_0.22.9_linux_amd64.zip

# Создаём системного пользователя
sudo useradd -r -s /bin/false pocketbase
sudo chown -R pocketbase:pocketbase /opt/pocketbase
```

#### Systemd сервис для PocketBase

```bash
sudo nano /etc/systemd/system/pocketbase.service
```

```ini
[Unit]
Description=PocketBase Authentication Service
After=network.target

[Service]
Type=simple
User=pocketbase
Group=pocketbase
WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve --http=127.0.0.1:8090
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable pocketbase
sudo systemctl start pocketbase
```

### 5. Развертывание приложения Ludic-Dev

```bash
# Создаём пользователя для приложения
sudo useradd -r -m -s /bin/bash ludic

# Клонируем репозиторий
sudo mkdir -p /opt/ludic-dev
cd /opt/ludic-dev
sudo git clone https://github.com/meteor-42/ludic-dev.git .
sudo chown -R ludic:ludic /opt/ludic-dev

# Переключаемся на пользователя ludic
sudo -u ludic bash

# Устанавливаем зависимости
cd /opt/ludic-dev
npm install

# Собираем проект
npm run build
```

#### Создание файла окружения

```bash
sudo nano /opt/ludic-dev/.env
```

```env
NODE_ENV=production
PORT=5000

# PostgreSQL
DATABASE_URL=postgresql://ludic:your_secure_password@127.0.0.1:5432/ludic_dev

# PocketBase
POCKETBASE_URL=http://127.0.0.1:8090

# Сессии (сгенерируйте надёжный ключ)
SESSION_SECRET=your_very_long_and_secure_session_secret_key_here
```

```bash
sudo chown ludic:ludic /opt/ludic-dev/.env
sudo chmod 600 /opt/ludic-dev/.env
```

#### Применение миграций базы данных

```bash
sudo -u ludic bash -c "cd /opt/ludic-dev && npm run db:push"
```

#### Systemd сервис для приложения

```bash
sudo nano /etc/systemd/system/ludic-dev.service
```

```ini
[Unit]
Description=Ludic-Dev Betting Platform
After=network.target postgresql-15.service pocketbase.service
Requires=postgresql-15.service

[Service]
Type=simple
User=ludic
Group=ludic
WorkingDirectory=/opt/ludic-dev
EnvironmentFile=/opt/ludic-dev/.env
ExecStart=/usr/bin/node ./dist/index.js
Restart=always
RestartSec=10

# Безопасность
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/ludic-dev

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable ludic-dev
sudo systemctl start ludic-dev
```

### 6. Установка и настройка Nginx

```bash
# Устанавливаем Nginx
sudo dnf install -y nginx

# Включаем автозапуск
sudo systemctl enable nginx
```

#### Конфигурация Nginx

```bash
sudo nano /etc/nginx/conf.d/ludic-dev.conf
```

```nginx
upstream ludic_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;  # Замените на ваш домен

    # Редирект на HTTPS (после настройки SSL)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://ludic_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Статические файлы (опционально)
    location /assets {
        alias /opt/ludic-dev/dist/public/assets;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Проверяем конфигурацию
sudo nginx -t

# Перезапускаем Nginx
sudo systemctl restart nginx
```

### 7. Настройка SSL с Let's Encrypt

```bash
# Устанавливаем Certbot
sudo dnf install -y certbot python3-certbot-nginx

# Получаем сертификат
sudo certbot --nginx -d your-domain.com

# Автообновление (добавляется автоматически)
sudo systemctl enable certbot-renew.timer
```

### 8. Настройка Firewall (firewalld)

```bash
# Проверяем статус
sudo systemctl status firewalld

# Если не запущен
sudo systemctl enable firewalld
sudo systemctl start firewalld

# Открываем необходимые порты
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# НЕ открываем порты для PostgreSQL, PocketBase и приложения снаружи!
# Они работают только через localhost

# Применяем правила
sudo firewall-cmd --reload

# Проверяем
sudo firewall-cmd --list-all
```

### 9. Настройка SELinux

AlmaLinux по умолчанию использует SELinux в режиме enforcing. Необходимо настроить политики:

```bash
# Проверяем статус SELinux
getenforce

# Разрешаем Nginx подключаться к upstream серверам
sudo setsebool -P httpd_can_network_connect 1

# Разрешаем использование порта 5000 для HTTP
sudo semanage port -a -t http_port_t -p tcp 5000

# Если semanage не установлен
sudo dnf install -y policycoreutils-python-utils
```

### 10. Проверка работоспособности

```bash
# Проверяем статус всех сервисов
sudo systemctl status postgresql-15
sudo systemctl status pocketbase
sudo systemctl status ludic-dev
sudo systemctl status nginx

# Проверяем логи
sudo journalctl -u ludic-dev -f
sudo journalctl -u pocketbase -f

# Тестируем локально
curl http://127.0.0.1:5000/api/health

# Тестируем через Nginx
curl http://your-domain.com
```

### 11. Обновление приложения

Скрипт для обновления `/opt/ludic-dev/update.sh`:

```bash
#!/bin/bash
set -e

cd /opt/ludic-dev

# Получаем последние изменения
git pull origin main

# Устанавливаем зависимости
npm install

# Собираем проект
npm run build

# Применяем миграции
npm run db:push

# Перезапускаем сервис
sudo systemctl restart ludic-dev

echo "Обновление завершено!"
```

```bash
sudo chmod +x /opt/ludic-dev/update.sh
```

### 12. Мониторинг и логирование

#### Настройка logrotate

```bash
sudo nano /etc/logrotate.d/ludic-dev
```

```
/var/log/ludic-dev/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ludic ludic
    sharedscripts
    postrotate
        systemctl reload ludic-dev > /dev/null 2>&1 || true
    endscript
}
```

### Чек-лист после развертывания

- [ ] PostgreSQL 15 запущен и доступен
- [ ] PocketBase запущен на порту 8090
- [ ] Ludic-Dev запущен на порту 5000
- [ ] Nginx проксирует запросы
- [ ] SSL сертификат установлен
- [ ] Firewall настроен (только 80/443 открыты)
- [ ] SELinux настроен
- [ ] Приложение доступно по HTTPS

---

## Дополнительные заметки

### Масштабирование

Для масштабирования системы рекомендуется:

1. **Горизонтальное масштабирование сервера:**
   - Использовать балансировщик нагрузки
   - Redis для сессий между инстансами

2. **Оптимизация БД:**
   - Индексы на часто запрашиваемые поля
   - Connection pooling
   - Read replicas для чтения

3. **Кэширование:**
   - Redis для кэширования коэффициентов
   - CDN для статических ресурсов

### Безопасность

- Все пароли хешируются PocketBase
- JWT токены имеют ограниченный срок действия
- CORS настроен для конкретных доменов
- Rate limiting на API эндпоинтах
- Валидация всех входящих данных через Zod

---

*Документация создана на основе анализа репозитория [ludic-dev](https://github.com/meteor-42/ludic-dev)*
