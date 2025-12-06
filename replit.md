# Betting Platform - Authentication Microservice

## Overview
Микросервис авторизации для букмекерской платформы с интеграцией PocketBase для аутентификации пользователей.

## Architecture
- **Frontend**: React + Vite + shadcn/ui + Tailwind CSS
- **Backend**: Express.js с интеграцией PocketBase
- **Auth**: PocketBase users collection с JWT токенами
- **Future**: PostgreSQL для данных о ставках и транзакциях

## Key Files
- `client/src/App.tsx` - Основной роутинг и layout
- `client/src/lib/auth-context.tsx` - Контекст авторизации
- `client/src/lib/theme-context.tsx` - Темная/светлая тема
- `client/src/pages/login.tsx` - Страница входа
- `client/src/pages/dashboard.tsx` - Дашборд пользователя
- `client/src/components/app-sidebar.tsx` - Навигация
- `server/routes.ts` - API эндпоинты авторизации
- `shared/schema.ts` - Типы и схемы валидации

## API Endpoints
- `POST /api/auth/login` - Авторизация через PocketBase
- `GET /api/auth/me` - Проверка токена
- `POST /api/auth/logout` - Выход из системы

## Environment Variables
- `POCKETBASE_URL` - URL PocketBase сервера

## Recent Changes
- 2024-12-06: Создан микросервис авторизации с PocketBase
- Добавлена страница логина с валидацией форм
- Реализован защищенный дашборд с sidebar навигацией
- Добавлена поддержка темной темы

## User Preferences
- Русский язык интерфейса
- Минимальный MVP для масштабирования букмекерской платформы

## Architecture
See `docs/architecture.md` for detailed diagrams and scaling plan.
