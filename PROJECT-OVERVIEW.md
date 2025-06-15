# Task Logger - Gamified Work Management System

## 📋 Общее описание

**Task Logger** - это система геймифицированного управления рабочими задачами, которая превращает работу в игру с RPG элементами. Сотрудники получают опыт, уровни, достижения и могут вращать колесо призов за выполнение задач.

### 🎮 Концепция геймификации
- **Уровневая система**: 100 уровней с прогрессивной сложностью
- **Очки опыта (XP)**: За выполнение задач
- **Монеты**: Внутренняя валюта за активность
- **Достижения**: За различные достижения в работе
- **Колесо призов**: Ежедневное вращение за активность
- **Стримы**: Система прерываний и поддержания концентрации

## 🚀 Технологический стек

### Frontend
- **Next.js 15** - React фреймворк с App Router
- **React 18** - UI библиотека
- **TypeScript** - Типизированный JavaScript
- **Tailwind CSS** - CSS фреймворк
- **Shadcn/ui** - Компонентная библиотека
- **Lucide React** - Иконки

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL база данных
  - Authentication
  - Row Level Security (RLS)
  - Storage для файлов
  - Real-time subscriptions

### Deployment
- **Vercel** - Хостинг и CI/CD
- **Git** - Контроль версий

## 🏗 Архитектура приложения

### Структура проекта
```
task-logger/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # Главная страница (дашборд)
│   ├── profile/                 # Профиль пользователя
│   ├── login/                   # Авторизация
│   ├── register/                # Регистрация
│   └── layout.tsx               # Общий лайаут
├── components/                   # React компоненты
│   ├── ui/                      # Базовые UI компоненты (shadcn)
│   ├── auth/                    # Компоненты авторизации
│   ├── navigation.tsx           # Навигация
│   ├── avatar-upload-with-crop.tsx  # Загрузка аватара с кропом
│   ├── daily-task-stats.tsx     # Статистика задач
│   ├── pixel-button.tsx         # Пиксельные кнопки
│   └── pixel-card.tsx           # Пиксельные карточки
├── hooks/                       # React хуки
│   ├── use-auth.ts             # Хук авторизации
│   └── use-toast.ts            # Хук уведомлений
├── lib/                         # Утилиты и сервисы
│   ├── auth.ts                 # Сервис авторизации
│   ├── supabase.ts             # Конфигурация Supabase
│   ├── game-config.ts          # Игровые настройки
│   ├── level-utils.ts          # Утилиты уровней
│   └── cache.ts                # Кеширование
└── styles/                      # Стили
    └── globals.css              # Глобальные стили
```

## 🗄 Структура базы данных

### Основные таблицы

#### `user_profiles`
```sql
- id (uuid, PK, FK to auth.users)
- full_name (text)
- position (text) 
- is_admin (boolean)
- work_schedule (text) -- "5/2", "6/1", etc.
- work_hours (integer) -- часов в день
- is_online (boolean)
- last_seen (timestamp)
- avatar_url (text) -- ссылка на аватар
- office_id (integer, FK to offices)
- created_at (timestamp)
- updated_at (timestamp)
```

#### `employees` 
```sql
- id (integer, PK)
- user_id (uuid, FK to auth.users)
- full_name (text)
- position (text)
- work_schedule (text)
- work_hours (integer)
- is_online (boolean)
- last_seen (timestamp)
- avatar_url (text)
- office_id (integer, FK to offices)
- created_at (timestamp)
- updated_at (timestamp)
```

#### `offices`
```sql
- id (integer, PK)
- name (text) -- "Рассвет", "Центральный", etc.
- description (text)
- created_at (timestamp)
```

#### `tasks`
```sql
- id (uuid, PK)
- user_id (uuid, FK to auth.users)
- title (text)
- description (text)
- status (text) -- "pending", "in_progress", "completed"
- priority (text) -- "low", "medium", "high"
- estimated_time (integer) -- в минутах
- actual_time (integer) -- в минутах
- xp_reward (integer) -- очки опыта
- coins_reward (integer) -- монеты
- created_at (timestamp)
- completed_at (timestamp)
```

#### `user_stats`
```sql
- id (uuid, PK)
- user_id (uuid, FK to auth.users)
- level (integer) -- текущий уровень
- xp (integer) -- текущий опыт
- total_xp (integer) -- общий опыт
- coins (integer) -- текущие монеты
- total_tasks (integer)
- total_time (integer) -- в минутах
- current_streak (integer) -- дней подряд
- achievements_count (integer)
- last_activity (timestamp)
```

#### `achievements`
```sql
- id (uuid, PK)
- user_id (uuid, FK to auth.users)
- title (text)
- description (text)
- icon (text) -- emoji или icon name
- unlocked_at (timestamp)
- xp_bonus (integer)
- coins_bonus (integer)
```

### Storage Buckets

#### `avatars`
- Публичный доступ
- Максимальный размер: 2MB
- Форматы: JPG, PNG, GIF, WebP
- Структура: `avatars/{user_id}-{timestamp}.{ext}`

## 🎮 Игровая механика

### Система уровней
- **100 уровней** всего
- **Прогрессивная сложность**: каждый уровень требует больше XP
- **Формула**: `baseXP * level^1.5 * difficultyMultiplier`
- **Базовые XP**: 100 для первого уровня

### Награды за задачи
- **XP**: зависит от сложности и времени выполнения
- **Монеты**: за завершение задач и достижения
- **Достижения**: за особые достижения (стримы, продуктивность)
- **Ежедневные бонусы**: за активность каждый день

### Статистика
- Общее количество задач
- Общее время работы
- Текущий стрим (дни подряд)
- Средняя продуктивность
- Достижения

## 🔐 Система безопасности (RLS)

### Row Level Security политики

#### `user_profiles`
```sql
-- Пользователи видят только свой профиль
"Users can view their own profile" FOR SELECT (auth.uid() = id)

-- Пользователи могут обновлять только свой профиль  
"Users can update their own profile" FOR UPDATE (auth.uid() = id)

-- Пользователи могут создавать только свой профиль
"Users can insert their own profile" FOR INSERT (auth.uid() = id)

-- Админы могут управлять всеми профилями
"Admins can manage all profiles" FOR ALL (user.email = 'egordolgih@mail.ru')

-- Пользователи видят коллег из своего офиса
"Users can view profiles from same office" FOR SELECT (office_id = get_user_office_id(auth.uid()))
```

#### `employees`
```sql
-- Аналогичные политики для employees таблицы
-- Связь через user_id вместо id
```

#### Storage policies
```sql
-- Загрузка аватаров только аутентифицированными пользователями
-- Публичный просмотр аватаров
-- Удаление только своих аватаров
```

## 🎨 Дизайн и UI

### Стиль: Pixel Art / Retro Gaming
- **Пиксельные границы**: `border-2 border-black`
- **Пиксельные тени**: `shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`
- **Яркие градиенты**: от фиолетового к розовому
- **Моноширинный шрифт**: `font-mono`
- **Эмодзи иконки**: для игрового настроения

### Основные компоненты
- **PixelButton**: кнопки в пиксельном стиле
- **PixelCard**: карточки с пиксельными границами
- **AvatarUploadWithCrop**: загрузка аватара с кропом
- **DailyTaskStats**: статистика в игровом стиле

## ⚙ Конфигурация и настройки

### Переменные окружения
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Игровая конфигурация (`lib/game-config.ts`)
```typescript
export const GAME_CONFIG = {
  levels: {
    maxLevel: 100,
    baseXP: 100,
    difficultyMultiplier: 1.2
  },
  rewards: {
    taskCompletion: { xp: 50, coins: 10 },
    dailyBonus: { xp: 100, coins: 50 },
    achievement: { xp: 200, coins: 100 }
  }
}
```

## 🛠 Установка и запуск

### Локальная разработка
```bash
npm install
npm run dev
```

### Сборка для продакшена
```bash
npm run build
npm start
```

### Развертывание на Vercel
```bash
vercel --prod
```

## 🐛 Известные проблемы и решения

### 1. Проблема с аватарами (РЕШЕНА)
**Проблема**: Ошибка "Could not find the 'avatar_url' column"
**Решение**: Выполнить `fix-avatar-column.sql`

### 2. Проблема с RLS политиками (РЕШЕНА)
**Проблема**: 400 ошибки при сохранении профиля
**Решение**: Выполнить `fix-policies-cleanup.sql`

### 3. Проблема с уровневой системой (РЕШЕНА)
**Проблема**: Несогласованность уровней между страницами
**Решение**: Обновлен `game-config.ts` и `level-utils.ts`

## 📊 Метрики и аналитика

### Отслеживаемые метрики
- Время выполнения задач
- Количество завершенных задач за день/неделю/месяц
- Прогресс по уровням
- Активность пользователей
- Использование достижений

### Статистика офиса
- Общее количество сотрудников
- Активные сотрудники сегодня
- Общее время работы за день
- Средняя продуктивность

## 🔄 Будущие улучшения

### Планируемые функции
1. **Командные челленджи**: соревнования между офисами
2. **Еженедельные квесты**: специальные задания на неделю
3. **Система рангов**: звания для опытных сотрудников
4. **Интеграция с календарем**: автоматическое планирование задач
5. **Мобильное приложение**: React Native версия
6. **Аналитика продуктивности**: графики и отчеты
7. **Система наставничества**: опытные помогают новичкам

### Техническое развитие
1. **Микросервисная архитектура**: разделение на сервисы
2. **GraphQL API**: более эффективные запросы
3. **WebSocket**: real-time обновления
4. **Кеширование**: Redis для производительности
5. **Тестирование**: Jest, Cypress для надежности

## 🏢 Бизнес логика

### Роли пользователей
- **Сотрудник**: основная роль, работа с задачами
- **Офис-админ**: управление сотрудниками офиса
- **Супер-админ** (`egordolgih@mail.ru`): полный доступ

### Рабочие графики
- **5/2**: пятидневка (пн-пт)
- **6/1**: шестидневка (пн-сб)
- **7/0**: семидневка
- **Гибкий**: индивидуальный график

### Система офисов
- **Рассвет**: главный офис
- **Центральный**: дополнительный офис
- Возможность добавления новых офисов

## 💾 Резервное копирование

### Суточные бекапы
- Автоматические бекапы Supabase
- Экспорт данных в JSON
- Резервные копии Storage

### Восстановление
- Инструкции по восстановлению из бекапа
- Проверка целостности данных
- Миграции схемы базы данных

## 📞 Контакты и поддержка

### Администратор системы
- **Email**: egordolgih@mail.ru
- **Роль**: Super Admin
- **Доступ**: Полный контроль системы

### Техническая документация
- **API документация**: `/api/docs`
- **Схема базы данных**: Supabase Dashboard
- **Мониторинг**: Vercel Analytics

---

**Дата создания документации**: Декабрь 2024
**Версия проекта**: 1.0
**Статус**: В активной разработке

---

*Этот документ содержит полную информацию о проекте Task Logger для возобновления работы с проектом в любое время.* 