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
12. [Оптимизация производительности](#оптимизация-производительности)
13. [Настройка Redis](#настройка-redis)
14. [Nginx Load Balancer (несколько серверов)](#nginx-load-balancer-несколько-серверов)
15. [Мониторинг (Prometheus + Grafana)](#мониторинг-prometheus--grafana)

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

### Общая схема (Production с несколькими серверами)

```
                              ┌─────────────────────────────────────────┐
                              │           КЛИЕНТЫ (React SPA)           │
                              │  Браузеры / Мобильные приложения        │
                              └────────────────────┬────────────────────┘
                                                   │
                                            HTTPS (443)
                                                   │
                              ┌────────────────────▼────────────────────┐
                              │        NGINX LOAD BALANCER              │
                              │   (SSL Termination, Static Files)       │
                              │         IP: 10.0.0.1                    │
                              └────────────────────┬────────────────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    │                              │                              │
              ┌─────▼─────┐                  ┌─────▼─────┐                  ┌─────▼─────┐
              │ APP SRV 1 │                  │ APP SRV 2 │                  │ APP SRV 3 │
              │ 10.0.0.10 │                  │ 10.0.0.11 │                  │ 10.0.0.12 │
              └─────┬─────┘                  └─────┬─────┘                  └─────┬─────┘
                    │                              │                              │
    ┌───────────────┼───────────────┐  ┌───────────┼───────────┐  ┌───────────────┼───────────────┐
    │               │               │  │           │           │  │               │               │
    │  ┌────────────▼────────────┐  │  │  ┌────────▼────────┐  │  │  ┌────────────▼────────────┐  │
    │  │   PM2 CLUSTER MODE      │  │  │  │   PM2 CLUSTER   │  │  │  │   PM2 CLUSTER MODE      │  │
    │  │   (4 Node.js процесса)  │  │  │  │   (4 процесса)  │  │  │  │   (4 Node.js процесса)  │  │
    │  │   Express.js :5000      │  │  │  │   Express :5000 │  │  │  │   Express.js :5000      │  │
    │  └─────────────────────────┘  │  │  └─────────────────┘  │  │  └─────────────────────────┘  │
    │               │               │  │           │           │  │               │               │
    └───────────────┼───────────────┘  └───────────┼───────────┘  └───────────────┼───────────────┘
                    │                              │                              │
                    └──────────────────────────────┼──────────────────────────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    │                              │                              │
              ┌─────▼─────┐                  ┌─────▼─────┐                  ┌─────▼─────┐
              │   REDIS   │                  │ POSTGRES  │                  │POCKETBASE │
              │ 10.0.0.20 │                  │ 10.0.0.21 │                  │ 10.0.0.22 │
              │  :6379    │                  │  :5432    │                  │  :8090    │
              └───────────┘                  └───────────┘                  └───────────┘
                   │                              │                              │
                   │                              │                              │
         ┌─────────┴─────────┐          ┌────────┴────────┐           ┌─────────┴─────────┐
         │ - Сессии          │          │ - wallets       │           │ - users           │
         │ - Кэш данных      │          │ - bets          │           │ - auth tokens     │
         │ - Rate limiting   │          │ - transactions  │           │ - profiles        │
         │ - Pub/Sub         │          └─────────────────┘           └───────────────────┘
         └───────────────────┘
```

### Схема для одного сервера (Development / Small Production)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              КЛИЕНТ (React)                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Auth Context   │  │  Dashboard      │  │  Betting        │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           └────────────────────┼────────────────────┘                       │
│                          TanStack Query                                     │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
                          HTTPS (port 443)
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                     NGINX (Reverse Proxy + SSL)                             │
│                          localhost:80/443                                   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                          HTTP (port 5000)
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                      PM2 CLUSTER (Express.js)                               │
│                         localhost:5000                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    API Routes (routes.ts)                            │   │
│  │        /api/auth/*        /api/wallet        /api/bets               │   │
│  └────────────────────────────────┬─────────────────────────────────────┘   │
│                                   │                                         │
│  ┌─────────────┐  ┌───────────────┼───────────────┐  ┌─────────────┐       │
│  │ PocketBase  │  │          Storage              │  │ Drizzle ORM │       │
│  │ SDK         │  │          Interface            │  │             │       │
│  └──────┬──────┘  └───────────────┬───────────────┘  └──────┬──────┘       │
└─────────┼─────────────────────────┼─────────────────────────┼───────────────┘
          │                         │                         │
          │              ┌──────────┴──────────┐              │
          │              │                     │              │
    ┌─────▼─────┐  ┌─────▼─────┐         ┌─────▼─────┐  ┌─────▼─────┐
    │POCKETBASE │  │   REDIS   │         │   REDIS   │  │ POSTGRES  │
    │  :8090    │  │  :6379    │         │  (cache)  │  │  :5432    │
    └───────────┘  └───────────┘         └───────────┘  └───────────┘
         │              │                      │              │
         │         Сессии, кэш,           Rate limit      wallets,
       users       Pub/Sub                                 bets
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

## Оптимизация производительности

### Ожидаемые показатели

#### Базовая производительность (без оптимизации)

| Компонент | Пропускная способность | Условия |
|-----------|------------------------|---------|
| **Express.js + Node.js** | 5,000-15,000 RPS | Простые API запросы, 1 ядро |
| **PostgreSQL 15** | 10,000-50,000 QPS | Простые SELECT с индексами |
| **PocketBase** | 2,000-5,000 RPS | Аутентификация |
| **Nginx** | 50,000+ RPS | Статика и проксирование |

#### Реалистичные цифры для продакшена

На сервере **4 vCPU / 8 GB RAM**:

| Метрика | Значение |
|---------|----------|
| Одновременных пользователей | 500-2,000 |
| Запросов в секунду | 1,000-3,000 |
| Время ответа API | 10-50 мс |
| Ставок в минуту | 5,000-10,000 |

### Узкие места системы

1. **PocketBase** (~2-5K RPS) - самое слабое звено, но достаточно для большинства проектов
2. **Node.js** - однопоточный по умолчанию
3. **PostgreSQL** - при сложных JOIN запросах производительность падает
4. **Сессии в памяти** - не масштабируются горизонтально

### Оптимизация 1: PM2 Cluster Mode

PM2 позволяет запускать Node.js на всех ядрах процессора (прирост x3-4 на 4-ядерном сервере).

#### Установка PM2

```bash
# Глобальная установка
sudo npm install -g pm2

# Создаём конфигурацию
sudo nano /opt/ludic-dev/ecosystem.config.js
```

#### Конфигурация PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ludic-dev',
    script: './dist/index.js',
    instances: 'max',           // Использовать все ядра
    exec_mode: 'cluster',       // Режим кластера
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_file: '/opt/ludic-dev/.env',
    
    // Автоперезапуск
    max_memory_restart: '500M',
    restart_delay: 3000,
    
    // Логирование
    log_file: '/var/log/ludic-dev/combined.log',
    error_file: '/var/log/ludic-dev/error.log',
    out_file: '/var/log/ludic-dev/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Мониторинг
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

#### Запуск с PM2

```bash
# Создаём директорию для логов
sudo mkdir -p /var/log/ludic-dev
sudo chown ludic:ludic /var/log/ludic-dev

# Запускаем
cd /opt/ludic-dev
pm2 start ecosystem.config.js

# Настраиваем автозапуск
pm2 startup systemd -u ludic --hp /home/ludic
pm2 save

# Полезные команды
pm2 status              # Статус процессов
pm2 monit               # Мониторинг в реальном времени
pm2 logs ludic-dev      # Просмотр логов
pm2 reload ludic-dev    # Graceful перезапуск
```

#### Обновление systemd для PM2

```bash
sudo nano /etc/systemd/system/ludic-dev.service
```

```ini
[Unit]
Description=Ludic-Dev via PM2
After=network.target postgresql-15.service pocketbase.service redis.service

[Service]
Type=forking
User=ludic
Group=ludic
Environment=PM2_HOME=/home/ludic/.pm2
ExecStart=/usr/bin/pm2 start /opt/ludic-dev/ecosystem.config.js
ExecReload=/usr/bin/pm2 reload ludic-dev
ExecStop=/usr/bin/pm2 stop ludic-dev
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Оптимизация 2: Индексы PostgreSQL

```sql
-- Создаём индексы для оптимизации запросов
CREATE INDEX CONCURRENTLY idx_bets_user_id ON bets(user_id);
CREATE INDEX CONCURRENTLY idx_bets_status ON bets(status);
CREATE INDEX CONCURRENTLY idx_bets_created_at ON bets(created_at DESC);
CREATE INDEX CONCURRENTLY idx_bets_user_status ON bets(user_id, status);
CREATE INDEX CONCURRENTLY idx_wallets_user_id ON wallets(user_id);

-- Составной индекс для частых запросов
CREATE INDEX CONCURRENTLY idx_bets_user_pending 
ON bets(user_id, created_at DESC) 
WHERE status = 'pending';
```

### Оптимизация 3: Connection Pooling (PgBouncer)

```bash
# Установка PgBouncer
sudo dnf install -y pgbouncer

# Конфигурация
sudo nano /etc/pgbouncer/pgbouncer.ini
```

```ini
[databases]
ludic_dev = host=127.0.0.1 port=5432 dbname=ludic_dev

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
```

```bash
# Файл пользователей
sudo nano /etc/pgbouncer/userlist.txt
```

```
"ludic" "your_secure_password"
```

```bash
# Запуск
sudo systemctl enable pgbouncer
sudo systemctl start pgbouncer
```

Обновите `DATABASE_URL` в `.env`:
```env
DATABASE_URL=postgresql://ludic:your_secure_password@127.0.0.1:6432/ludic_dev
```

### Оптимизация 4: Gzip сжатие в Nginx

```nginx
# Добавьте в /etc/nginx/nginx.conf в блок http {}
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_types text/plain text/css text/xml text/javascript 
           application/javascript application/json application/xml;
gzip_comp_level 6;
```

### Оптимизация 5: Кэширование статики

```nginx
# В /etc/nginx/conf.d/ludic-dev.conf
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
    access_log off;
}
```

### Сравнение производительности

| Конфигурация | RPS | Latency (p99) |
|--------------|-----|---------------|
| Базовая (1 процесс) | 1,500 | 120ms |
| PM2 Cluster (4 ядра) | 5,500 | 45ms |
| + Redis сессии | 6,200 | 35ms |
| + PgBouncer | 7,000 | 28ms |
| + Gzip + кэш | 8,500 | 22ms |

---

## Настройка Redis

Redis используется для:
- Хранения сессий пользователей (масштабирование)
- Кэширования данных (коэффициенты, события)
- Rate limiting
- Pub/Sub для real-time уведомлений

### 1. Установка Redis на AlmaLinux

```bash
# Включаем модуль Redis
sudo dnf module enable redis:7 -y

# Устанавливаем Redis
sudo dnf install -y redis

# Запускаем и включаем автозапуск
sudo systemctl enable redis
sudo systemctl start redis

# Проверяем
redis-cli ping  # Ожидаем: PONG
```

### 2. Настройка Redis для продакшена

```bash
sudo nano /etc/redis/redis.conf
```

#### Основные настройки

```conf
# Сеть - только localhost
bind 127.0.0.1
port 6379

# Защита паролем
requirepass your_redis_secure_password

# Персистентность (RDB + AOF)
save 900 1
save 300 10
save 60 10000

appendonly yes
appendfsync everysec

# Память
maxmemory 512mb
maxmemory-policy allkeys-lru

# Безопасность
protected-mode yes
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command DEBUG ""

# Логирование
loglevel notice
logfile /var/log/redis/redis.log

# Производительность
tcp-keepalive 300
timeout 0
```

```bash
# Перезапускаем Redis
sudo systemctl restart redis

# Проверяем с паролем
redis-cli -a your_redis_secure_password ping
```

### 3. Интеграция Redis в приложение

#### Установка пакетов

```bash
cd /opt/ludic-dev
npm install redis connect-redis ioredis
```

#### Обновление .env

```env
# Redis
REDIS_URL=redis://:your_redis_secure_password@127.0.0.1:6379
```

#### Создание Redis клиента

Создайте файл `server/redis.ts`:

```typescript
import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

export async function initRedis() {
  await redisClient.connect();
}

// Утилиты для кэширования
export async function getCache<T>(key: string): Promise<T | null> {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
}

export async function setCache(
  key: string, 
  value: any, 
  ttlSeconds: number = 300
): Promise<void> {
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
}

export async function deleteCache(key: string): Promise<void> {
  await redisClient.del(key);
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  const keys = await redisClient.keys(pattern);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
}
```

#### Настройка сессий с Redis

Обновите `server/index.ts`:

```typescript
import session from 'express-session';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';

// Создаём Redis клиент для сессий
const redisClient = createClient({
  url: process.env.REDIS_URL,
});
redisClient.connect().catch(console.error);

// Настраиваем хранилище сессий
const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'ludic:sess:',
  ttl: 86400, // 24 часа
});

app.use(session({
  store: redisStore,
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 часа
    sameSite: 'lax',
  },
}));
```

### 4. Кэширование данных

#### Пример: кэширование списка событий

```typescript
import { getCache, setCache } from './redis';

// В routes.ts
app.get('/api/events', async (req, res) => {
  const cacheKey = 'events:list';
  
  // Пробуем получить из кэша
  const cached = await getCache<Event[]>(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  // Если нет в кэше - запрашиваем из БД
  const events = await storage.getEvents();
  
  // Сохраняем в кэш на 60 секунд
  await setCache(cacheKey, events, 60);
  
  res.json(events);
});
```

#### Пример: кэширование баланса кошелька

```typescript
app.get('/api/wallet', async (req, res) => {
  const userId = req.user.id;
  const cacheKey = `wallet:${userId}`;
  
  const cached = await getCache<Wallet>(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  const wallet = await storage.getWallet(userId);
  await setCache(cacheKey, wallet, 30); // 30 секунд
  
  res.json(wallet);
});

// Инвалидация при изменении баланса
app.post('/api/bets', async (req, res) => {
  const userId = req.user.id;
  
  // ... создание ставки ...
  
  // Инвалидируем кэш кошелька
  await deleteCache(`wallet:${userId}`);
  
  res.json(bet);
});
```

### 5. Rate Limiting с Redis

```bash
npm install rate-limiter-flexible
```

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redisClient } from './redis';

// Лимит: 100 запросов в минуту
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ludic:ratelimit',
  points: 100,        // Количество запросов
  duration: 60,       // За 60 секунд
  blockDuration: 60,  // Блокировка на 60 секунд при превышении
});

// Middleware
export async function rateLimitMiddleware(req, res, next) {
  try {
    const key = req.ip || req.user?.id || 'anonymous';
    await rateLimiter.consume(key);
    next();
  } catch (err) {
    res.status(429).json({ 
      error: 'Too many requests',
      retryAfter: Math.ceil(err.msBeforeNext / 1000)
    });
  }
}

// Применяем к API
app.use('/api/', rateLimitMiddleware);
```

### 6. Real-time уведомления (Pub/Sub)

```typescript
import { createClient } from 'redis';

// Создаём отдельные клиенты для pub/sub
const publisher = createClient({ url: process.env.REDIS_URL });
const subscriber = createClient({ url: process.env.REDIS_URL });

await publisher.connect();
await subscriber.connect();

// Публикация события (например, результат ставки)
export async function publishBetResult(userId: string, bet: Bet) {
  await publisher.publish(`user:${userId}:bets`, JSON.stringify({
    type: 'BET_SETTLED',
    data: bet,
  }));
}

// Подписка на события (для WebSocket)
export async function subscribeToUserEvents(userId: string, callback: (msg: string) => void) {
  await subscriber.subscribe(`user:${userId}:bets`, callback);
}
```

### 7. Мониторинг Redis

```bash
# Статистика
redis-cli -a your_redis_secure_password INFO stats

# Использование памяти
redis-cli -a your_redis_secure_password INFO memory

# Мониторинг в реальном времени
redis-cli -a your_redis_secure_password MONITOR

# Просмотр ключей сессий
redis-cli -a your_redis_secure_password KEYS "ludic:sess:*"

# Количество ключей
redis-cli -a your_redis_secure_password DBSIZE
```

### 8. Systemd для Redis (проверка)

```bash
# Проверяем статус
sudo systemctl status redis

# Логи
sudo journalctl -u redis -f
```

### Redis: Чек-лист

- [ ] Redis установлен и запущен
- [ ] Пароль настроен в redis.conf
- [ ] REDIS_URL добавлен в .env
- [ ] Сессии хранятся в Redis
- [ ] Кэширование настроено для частых запросов
- [ ] Rate limiting работает
- [ ] Firewall НЕ открывает порт 6379 наружу

---

## Nginx Load Balancer (несколько серверов)

### 1. Обзор архитектуры

При высокой нагрузке один сервер не справляется. Решение — несколько app-серверов за балансировщиком:

```
                        Интернет
                            │
                    ┌───────▼───────┐
                    │  NGINX LB     │  ◄── SSL Termination
                    │  10.0.0.1     │      Статика
                    └───────┬───────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
    ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │  APP SRV 1  │  │  APP SRV 2  │  │  APP SRV 3  │
    │  10.0.0.10  │  │  10.0.0.11  │  │  10.0.0.12  │
    │  PM2 :5000  │  │  PM2 :5000  │  │  PM2 :5000  │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           └────────────────┼────────────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
    ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │    REDIS    │  │  POSTGRES   │  │ POCKETBASE  │
    │  10.0.0.20  │  │  10.0.0.21  │  │  10.0.0.22  │
    └─────────────┘  └─────────────┘  └─────────────┘
```

**Ключевые принципы:**
- Балансировщик (Nginx) распределяет запросы между app-серверами
- Все app-серверы используют ОБЩИЙ Redis, PostgreSQL и PocketBase
- Сессии хранятся в Redis → пользователь может попасть на любой сервер
- Статика и SSL обрабатываются на балансировщике

### 2. Настройка сервера-балансировщика

#### Установка Nginx

```bash
# AlmaLinux/RHEL
sudo dnf install nginx -y
sudo systemctl enable nginx
```

#### Основная конфигурация

```nginx
# /etc/nginx/nginx.conf

user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Логирование
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'upstream: $upstream_addr rt=$request_time';

    access_log /var/log/nginx/access.log main;

    # Оптимизация
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json 
               application/javascript application/xml;

    # Ограничение размера запроса
    client_max_body_size 10M;

    include /etc/nginx/conf.d/*.conf;
}
```

### 3. Конфигурация upstream

```nginx
# /etc/nginx/conf.d/ludic-upstream.conf

# Upstream группа app-серверов
upstream ludic_backend {
    # Алгоритм балансировки (см. ниже)
    least_conn;
    
    # App серверы с весами
    server 10.0.0.10:5000 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.0.11:5000 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.0.12:5000 weight=2 max_fails=3 fail_timeout=30s;
    
    # Backup сервер (используется если основные недоступны)
    # server 10.0.0.13:5000 backup;
    
    # Keepalive соединения к бэкендам
    keepalive 32;
}
```

### 4. Алгоритмы балансировки

| Алгоритм | Описание | Когда использовать |
|----------|----------|-------------------|
| `round-robin` | По очереди (по умолчанию) | Одинаковые серверы, stateless |
| `least_conn` | На сервер с меньшим числом соединений | Разная длительность запросов |
| `ip_hash` | По IP клиента (sticky) | Когда нужна привязка к серверу |
| `hash $request_uri` | По URL | Кэширование на серверах |

```nginx
# Round Robin (по умолчанию)
upstream backend {
    server 10.0.0.10:5000;
    server 10.0.0.11:5000;
}

# Least Connections - рекомендуется
upstream backend {
    least_conn;
    server 10.0.0.10:5000;
    server 10.0.0.11:5000;
}

# IP Hash (sticky sessions по IP)
upstream backend {
    ip_hash;
    server 10.0.0.10:5000;
    server 10.0.0.11:5000;
}
```

### 5. Конфигурация виртуального хоста

```nginx
# /etc/nginx/conf.d/ludic.conf

server {
    listen 80;
    server_name ludic.example.com;
    
    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ludic.example.com;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/ludic.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ludic.example.com/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Статические файлы (обслуживаются балансировщиком)
    location /assets/ {
        root /var/www/ludic/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API и приложение → upstream
    location / {
        proxy_pass http://ludic_backend;
        
        # Заголовки для бэкенда
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket поддержка
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Буферизация
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Health check endpoint (не логируем)
    location /health {
        access_log off;
        proxy_pass http://ludic_backend;
    }
}
```

### 6. Health Checks

```nginx
# Пассивные health checks (встроено в Nginx)
upstream ludic_backend {
    server 10.0.0.10:5000 max_fails=3 fail_timeout=30s;
    server 10.0.0.11:5000 max_fails=3 fail_timeout=30s;
}

# Активные health checks (Nginx Plus или через скрипт)
# Для бесплатного Nginx используем внешний мониторинг
```

**Endpoint для проверки на app-сервере:**

```typescript
// server/routes.ts
app.get('/health', (req, res) => {
  // Проверяем подключение к БД
  try {
    // Простая проверка
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: process.env.SERVER_ID || 'unknown'
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy' });
  }
});
```

### 7. Sticky Sessions (если нужно)

Если приложение требует привязки клиента к серверу:

```nginx
upstream ludic_backend {
    ip_hash;  # Простой sticky по IP
    
    server 10.0.0.10:5000;
    server 10.0.0.11:5000;
}

# Или через cookie (Nginx Plus)
# upstream ludic_backend {
#     sticky cookie srv_id expires=1h;
#     server 10.0.0.10:5000;
#     server 10.0.0.11:5000;
# }
```

**Важно:** При использовании Redis для сессий sticky sessions НЕ нужны!

### 8. Настройка App-серверов

На каждом app-сервере (10.0.0.10, 10.0.0.11, 10.0.0.12):

#### Переменные окружения

```bash
# /opt/ludic/.env на каждом сервере

# Уникальный ID сервера (для логов)
SERVER_ID=app-srv-1

# Общий Redis (на отдельном сервере)
REDIS_URL=redis://:password@10.0.0.20:6379

# Общий PostgreSQL (на отдельном сервере)
DATABASE_URL=postgresql://ludic:password@10.0.0.21:5432/ludic_db

# Общий PocketBase
POCKETBASE_URL=http://10.0.0.22:8090

# Важно: одинаковый секрет для сессий на всех серверах!
SESSION_SECRET=your-same-secret-on-all-servers
```

#### PM2 конфигурация

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ludic-app',
    script: 'dist/index.js',
    instances: 'max',  // Все ядра CPU
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
```

#### Синхронизация кода

```bash
# Используем rsync для деплоя на все серверы
#!/bin/bash
SERVERS=("10.0.0.10" "10.0.0.11" "10.0.0.12")

for server in "${SERVERS[@]}"; do
    echo "Deploying to $server..."
    rsync -avz --delete \
        --exclude 'node_modules' \
        --exclude '.env' \
        /path/to/ludic/ \
        deploy@$server:/opt/ludic/
    
    ssh deploy@$server "cd /opt/ludic && npm install --production && pm2 restart ludic-app"
done
```

### 9. Настройка общих сервисов

#### Redis (10.0.0.20)

```bash
# /etc/redis/redis.conf
bind 10.0.0.20 127.0.0.1
requirepass your_redis_secure_password
maxmemory 2gb
maxmemory-policy allkeys-lru

# Firewall: разрешить только app-серверы
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.0.10" port protocol="tcp" port="6379" accept'
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.0.11" port protocol="tcp" port="6379" accept'
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.0.12" port protocol="tcp" port="6379" accept'
sudo firewall-cmd --reload
```

#### PostgreSQL (10.0.0.21)

```bash
# /var/lib/pgsql/data/postgresql.conf
listen_addresses = '10.0.0.21,127.0.0.1'
max_connections = 200

# /var/lib/pgsql/data/pg_hba.conf
host    ludic_db    ludic    10.0.0.10/32    scram-sha-256
host    ludic_db    ludic    10.0.0.11/32    scram-sha-256
host    ludic_db    ludic    10.0.0.12/32    scram-sha-256
```

### 10. Мониторинг

#### Логи балансировщика

```bash
# Просмотр распределения по серверам
tail -f /var/log/nginx/access.log | grep "upstream:"

# Ошибки
tail -f /var/log/nginx/error.log
```

#### Статистика Nginx

```nginx
# /etc/nginx/conf.d/status.conf
server {
    listen 127.0.0.1:8080;
    
    location /nginx_status {
        stub_status on;
        allow 127.0.0.1;
        deny all;
    }
}
```

### 11. Чек-лист развертывания

#### Балансировщик (10.0.0.1)
- [ ] Nginx установлен и настроен
- [ ] SSL сертификаты получены (certbot)
- [ ] Upstream настроен с правильными IP
- [ ] Firewall открыт только для 80/443

#### App-серверы (10.0.0.10-12)
- [ ] Код синхронизирован на всех серверах
- [ ] PM2 запущен в cluster mode
- [ ] .env одинаковый SESSION_SECRET
- [ ] .env указывает на общие Redis/PostgreSQL
- [ ] Firewall открыт только для порта 5000 с балансировщика

#### Общие сервисы
- [ ] Redis доступен со всех app-серверов
- [ ] PostgreSQL доступен со всех app-серверов  
- [ ] PocketBase доступен со всех app-серверов
- [ ] Firewall ограничивает доступ только app-серверами

#### Тестирование
- [ ] Приложение работает через балансировщик
- [ ] Сессии сохраняются при переключении между серверами
- [ ] При отключении одного сервера трафик идет на другие
- [ ] Health checks работают

---

## Дополнительные заметки

### Краткая сводка по разделам

| Задача | Раздел документации |
|--------|---------------------|
| Развернуть на одном сервере | [11. Развертывание на AlmaLinux](#развертывание-на-almalinux) |
| Оптимизировать производительность | [12. Оптимизация производительности](#оптимизация-производительности) |
| Настроить кэширование и сессии | [13. Настройка Redis](#настройка-redis) |
| Масштабировать на несколько серверов | [14. Nginx Load Balancer](#nginx-load-balancer-несколько-серверов) |

### Путь развертывания

```
Development → Single Server (AlmaLinux) → Multi-Server (Load Balancer)
     │              │                            │
     │              ├── PM2 cluster              ├── 3+ app серверов
     │              ├── Nginx reverse proxy      ├── Nginx балансировщик
     │              ├── Redis (локальный)        ├── Redis (отдельный сервер)
     │              └── PostgreSQL (локальный)   ├── PostgreSQL (отдельный)
     │                                           └── PocketBase (отдельный)
     │
   localhost:5000
```

### Безопасность (сводка)

| Компонент | Меры защиты |
|-----------|-------------|
| Пароли | Хешируются PocketBase |
| Токены | JWT с ограниченным сроком действия |
| API | Rate limiting через Redis, валидация через Zod |
| CORS | Настроен для конкретных доменов |
| БД/Redis | Доступны только с app-серверов (firewall) |
| ОС | SELinux в режиме enforcing |

### Мониторинг (рекомендации)

- **Приложение:** PM2 мониторинг (`pm2 monit`, `pm2 logs`)
- **Nginx:** access.log с upstream информацией, stub_status
- **PostgreSQL:** pg_stat_statements для анализа запросов
- **Redis:** `redis-cli INFO`, `MONITOR`
- **Система:** Prometheus + Grafana для метрик

### Полезные команды

```bash
# Статус всех сервисов
pm2 status && systemctl status nginx redis postgresql

# Логи приложения
pm2 logs ludic-app --lines 100

# Проверка подключений к БД
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Redis статистика
redis-cli -a password INFO stats | grep -E "connected_clients|used_memory_human"

# Nginx активные соединения
curl -s http://127.0.0.1:8080/nginx_status
```

---

## 15. Мониторинг (Prometheus + Grafana)

Для глубокого анализа производительности и состояния системы рекомендуется использовать связку Prometheus для сбора метрик и Grafana для визуализации.

### 15.1. Установка и настройка экспортера метрик

В Node.js приложении необходимо установить библиотеку `prom-client` для сбора метрик:

```bash
npm install prom-client
```

В код сервера (`server/index.ts`) нужно добавить endpoint `/metrics`:

```typescript
import client from 'prom-client';

// Сбор стандартных метрик (CPU, Memory, Event Loop)
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

// Пример кастомной метрики: длительность запросов
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 500]
});

// Middleware для измерения времени ответа
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.path, code: res.statusCode });
  });
  next();
});

// Endpoint для Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

### 15.2. Конфигурация Prometheus

Создайте файл `prometheus.yml` на сервере мониторинга:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'ludic-dev-backend'
    scrape_interval: 5s
    static_configs:
      - targets: ['10.0.0.10:5000', '10.0.0.11:5000'] # IP-адреса ваших серверов приложений
```

### 15.3. Настройка Grafana

1.  **Установка:** Разверните Grafana (например, через Docker или пакетный менеджер).
2.  **Data Source:** Добавьте новый источник данных типа **Prometheus**.
    *   URL: `http://localhost:9090` (адрес вашего Prometheus сервера).
3.  **Дашборды:**
    *   Импортируйте готовый дашборд для **Node.js** (ID: `11159` - Node.js Application Dashboard).
    *   Создайте панели для бизнес-метрик: количество ставок, сумма депозитов, ошибки авторизации.

### 15.4. Ключевые метрики для отслеживания

*   **Node.js Process:**
    *   `process_cpu_user_seconds_total`: Нагрузка на CPU.
    *   `nodejs_heap_size_used_bytes`: Использование памяти (поиск утечек).
    *   `nodejs_eventloop_lag_seconds`: Лаг событийного цикла (важно для Express!).
*   **Business Logic:**
    *   `http_request_duration_ms`: Время ответа API (95-й и 99-й перцентили).
    *   `http_requests_total{code="500"}`: Количество ошибок сервера.

---

*Документация создана на основе анализа репозитория [ludic-dev](https://github.com/meteor-42/ludic-dev)*
