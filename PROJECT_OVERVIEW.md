# Task Logger - Система геймификации рабочих задач

## 🎯 Описание проекта
Task Logger - это современная веб-система для отслеживания и геймификации рабочих задач с элементами RPG. Сотрудники зарабатывают очки за выполненные задачи, получают достижения и участвуют в корпоративных соревнованиях.

## 🛠 Технический стек
- **Frontend:** Next.js 15, React 18, TypeScript
- **Styling:** Tailwind CSS + Pixel-art UI компоненты
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Деплой:** Vercel
- **Аутентификация:** Supabase Auth
- **Файловое хранилище:** Supabase Storage

## 📁 Структура проекта

### Основные страницы
```
app/
├── page.tsx                 # Главная страница (логин/рабочая область)
├── profile/page.tsx         # Профиль пользователя
├── admin/page.tsx          # Административная панель
└── api/keep-alive/route.ts # API для поддержания соединения
```

### Ключевые компоненты
```
components/
├── auth/
│   ├── auth-guard.tsx       # Защита роутов
│   ├── login-form.tsx      # Форма входа
│   └── register-form.tsx   # Форма регистрации
├── admin/
│   ├── admin-dashboard.tsx      # Главная админки
│   ├── employee-analytics.tsx   # Аналитика сотрудников
│   ├── task-analytics-new.tsx   # Детальная аналитика задач
│   └── enhanced-dashboard-v2.tsx # Расширенная панель
├── ui/                     # Базовые UI компоненты (shadcn/ui)
├── avatar-upload.tsx       # Загрузка аватаров
├── daily-task-stats.tsx    # Статистика по дням
├── pixel-card.tsx          # Карточки в пиксель-арт стиле
├── pixel-button.tsx        # Кнопки в пиксель-арт стиле
├── prize-wheel.tsx         # Колесо фортуны
├── task-form.tsx          # Форма добавления задач
└── work-session.tsx       # Управление рабочими сессиями
```

## 🎮 Основные функции

### Для сотрудников:
1. **Рабочие сессии**
   - Начало/конец рабочего дня
   - Отслеживание времени

2. **Управление задачами**
   - Добавление выполненных задач
   - Указание количества единиц и времени
   - Комментарии к задачам

3. **Профиль и статистика**
   - Загрузка аватара (файл или URL)
   - Редактирование ФИО и должности
   - Дневная статистика задач
   - Выбор конкретного дня для просмотра

4. **Геймификация**
   - Система очков (coins) за задачи
   - Уровни и прогресс
   - Достижения (ачивки)
   - Колесо фортуны с призами

5. **Офисная активность**
   - Лидерборд по офису
   - Статистика офиса
   - Рейтинг сотрудников

### Для администраторов:
1. **Управление пользователями**
   - Просмотр всех сотрудников
   - Изменение email и офиса
   - Управление правами

2. **Аналитика**
   - Общая статистика по компании
   - Детальная аналитика по задачам
   - Аналитика сотрудников
   - Графики и диаграммы

3. **Управление задачами**
   - Настройка типов задач
   - Настройка наград за задачи

## 🎨 Дизайн-система

### Пиксель-арт стиль:
- Черные границы (border-2 border-black)
- Ретро-цветовая палитра
- Pixel-perfect компоненты
- Градиентные фоны

### Основные компоненты:
- `PixelCard` - карточки с пиксельным стилем
- `PixelButton` - кнопки с вариантами (primary, secondary, danger)
- `CoinDisplay` - отображение очков с анимацией
- `LevelDisplay` - показ уровня пользователя

## 🗄 База данных (Supabase)

### Основные таблицы:
```sql
-- Профили пользователей
user_profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  position TEXT,
  office_id INTEGER,
  avatar_url TEXT,  -- Добавлено недавно
  created_at TIMESTAMP
)

-- Офисы
offices (
  id SERIAL PRIMARY KEY,
  name TEXT,
  address TEXT
)

-- Типы задач
task_types (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE,
  description TEXT
)

-- Логи задач
task_logs (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER,
  task_type_id INTEGER,
  units_completed INTEGER,
  time_spent_minutes INTEGER,
  work_date DATE,
  notes TEXT,
  created_at TIMESTAMP
)

-- Рабочие сессии
work_sessions (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER,
  date DATE,
  start_time TIME,
  end_time TIME,
  is_active BOOLEAN
)
```

### Storage buckets:
- `avatars` - хранение аватаров пользователей (public, 2MB limit)

### Функции базы данных:
- `get_leaderboard_with_current_user()` - лидерборд с текущим пользователем
- `get_office_statistics()` - статистика офиса

## ⚙️ Конфигурация игры

### Система очков (GAME_CONFIG):
```typescript
TASK_REWARDS = {
  "Звонок клиенту": 10,
  "Обработка заявки": 8,
  "Составление отчета": 15,
  // ... другие задачи
}

LEVELS = [
  { level: 1, min_coins: 0, title: "Новичок" },
  { level: 2, min_coins: 100, title: "Стажер" },
  // ... уровни до 50
]
```

### Группы задач:
- Клиентская работа (синий)
- Документооборот (зеленый)  
- Аналитика (фиолетовый)
- Техническая работа (оранжевый)

## 🎰 Система призов (Колесо фортуны)

### Категории призов:
- **Обычные (70%):** Кофе от босса, комплимент, мем дня
- **Редкие (22%):** Выбор обеда, лучшее место на парковке
- **Эпические (2.5%):** Бесплатный обед, час сна
- **Легендарные (0.5%):** Дополнительный выходной

## 🔐 Система безопасности

### Row Level Security (RLS):
- Пользователи видят только свои данные
- Админы имеют доступ ко всем данным
- Защищенные API endpoints

### Роли:
- `employee` - обычный сотрудник
- `admin` - администратор

## 📱 Особенности UI/UX

### Адаптивность:
- Мобильная версия для всех компонентов
- Гибкие сетки (grid-cols-1 md:grid-cols-4)
- Responsive navigation

### Интерактивность:
- Toast уведомления
- Анимированные переходы
- Real-time обновления
- Прогресс-бары и loading состояния

## 🚀 Деплой и среды

### Production:
- **URL:** https://task-logger-1-[hash]-dolgihegor2323-gmailcoms-projects.vercel.app
- **Деплой:** Автоматический через Vercel + GitHub

### Environment Variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 📋 Последние обновления

### v2.1 (Текущая версия):
- ✅ Система загрузки аватаров (файлы + URL)
- ✅ Дневная статистика задач вместо общей аналитики
- ✅ Быстрый доступ к "Сегодня" и "Вчера"
- ✅ Детальный список задач за выбранный день
- ✅ Исправлена колонка avatar_url в базе данных

### Ключевые изменения:
1. **AvatarUpload компонент** - полноценная загрузка аватаров
2. **DailyTaskStats компонент** - замена сложной аналитики на простую дневную
3. **Supabase Storage** - настроен bucket для аватаров

## 🔧 Настройка после деплоя

### 1. Выполнить в Supabase SQL Editor:
```sql
-- Добавить колонку для аватаров
ALTER TABLE user_profiles ADD COLUMN avatar_url TEXT;

-- Создать Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

-- Создать политики безопасности для Storage
-- (см. файл create-avatar-storage.sql)
```

### 2. Создать функции базы данных:
```sql
-- Лидерборд и статистика офиса
-- (см. файл create-leaderboard-functions.sql)
```

## 📝 Команды для разработки

```bash
# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev

# Сборка проекта
npm run build

# Деплой на Vercel
vercel --prod

# Git workflow
git add .
git commit -m "описание изменений"
git push origin main
```

## 🎯 Архитектурные принципы

1. **Component-first** - все UI элементы вынесены в переиспользуемые компоненты
2. **TypeScript-strict** - строгая типизация всех данных
3. **Mobile-first** - адаптивность заложена в основу
4. **Security-first** - RLS и защищенные API
5. **Performance** - оптимизированные запросы и кеширование
6. **User Experience** - интуитивный интерфейс с геймификацией

Этот файл содержит всю необходимую информацию для быстрого понимания и продолжения разработки проекта Task Logger. 