# TASK LOGGER - ПОЛНЫЙ КОНТЕКСТ ПРОЕКТА

## 🎯 ОСНОВНАЯ ИНФОРМАЦИЯ
- **Проект**: Task Logger - система учета рабочих задач с игровыми элементами
- **Технологии**: Next.js 14, TypeScript, Supabase (PostgreSQL), Vercel
- **Текущий URL**: https://task-logger-1-i4pqox70u-dolgihegor2323-gmailcoms-projects.vercel.app
- **Локальная папка**: `C:\Users\ega\Downloads\task-logger (1)`

## 🗃️ АРХИТЕКТУРА БАЗЫ ДАННЫХ

### Основные таблицы:
```sql
offices              -- Офисы (новая система)
├── id (1, 2, 3...)
├── name ("Рассвет", "Заря", "Восход")
└── created_at

employees            -- Сотрудники  
├── id
├── user_id (UUID, связь с auth.users)
├── office_id (FK → offices.id) 
├── name
└── position

user_profiles        -- Профили пользователей
├── id (UUID, = auth.users.id)
├── office_id (FK → offices.id)
├── full_name
├── work_schedule
├── work_hours
└── office_name (computed)

task_types           -- Типы задач
├── id
├── name ("Звонки", "Консультации", etc.)
└── description

task_logs            -- Логи выполненных задач
├── employee_id (FK → employees.id)
├── task_type_id (FK → task_types.id)
├── units_completed
├── time_spent_minutes
├── work_date
├── notes
└── started_at

active_sessions      -- Активные сессии задач
break_logs           -- Логи перерывов  
employee_prizes      -- Выигранные призы
```

### Важные функции:
```sql
get_office_statistics(office_id INTEGER)
└── Возвращает: total_employees, working_employees, total_hours_today, avg_hours_today

get_leaderboard_with_current_user(current_user_id UUID)
└── Возвращает топ игроков с отметкой текущего пользователя
```

## 🚀 ИСТОРИЯ МИГРАЦИИ (КРИТИЧЕСКИ ВАЖНО!)

### ПРОБЛЕМА:
- Изначально была система **districts** (округа)
- Позже добавили систему **offices** (офисы)  
- Обе системы сосуществовали, создавая конфликты

### РЕШЕНИЕ:
1. ✅ Перенесли всех сотрудников и пользователей в offices
2. ✅ Создали функцию `get_office_statistics`
3. ✅ Удалили все district_id колонки, таблицы, функции, views
4. ✅ Обновили код с district_id → office_id

### ТЕКУЩЕЕ СОСТОЯНИЕ:
- 8 сотрудников в офисе "Рассвет" (ID: 1)
- 6 пользователей привязаны к офисам
- Все district-зависимости УДАЛЕНЫ

## 🎮 ИГРОВАЯ МЕХАНИКА

### Конфигурация очков:
```javascript
TASK_REWARDS = {
  "Консультации": 10,
  "Звонки": 5, 
  "Документооборот": 3,
  // и т.д. из GAME_CONFIG
}
```

### Достижения:
- `thousand_club`: 1000+ очков
- `multitasker`: 4+ задач одновременно

### Особенности:
- Максимум 5 активных задач
- Система перерывов и пауз
- Колесо фортуны (5% шанс)
- Пиксельный UI стиль

## 🔧 КЛЮЧЕВЫЕ ФАЙЛЫ

### Frontend:
- `app/page.tsx` - Главная страница (ОСНОВНОЙ ФАЙЛ)
- `components/stats-panel.tsx` - Статистика офиса
- `lib/supabase.ts` - Конфигурация БД
- `lib/game-config.ts` - Игровые настройки

### Database:
- `create-office-function-fixed.sql` - Рабочая функция статистики
- `final-cleanup-districts-fixed.sql` - Скрипт очистки от districts

## ⚠️ ИЗВЕСТНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

### 1. Office Statistics не загружается:
**Причина**: Нет функции `get_office_statistics`
**Решение**: Выполнить `create-office-function-fixed.sql`

### 2. Ошибка "district_id not found":  
**Причина**: Код ссылается на удаленные колонки
**Решение**: Заменить district_id → office_id в коде

### 3. Дублирование office statistics:
**Причина**: Два компонента показывают статистику
**Решение**: Удалить верхний блок, оставить terminal-style внизу

## 🎯 ТЕКУЩИЙ СТАТУС

### ✅ РАБОТАЕТ:
- Аутентификация через Supabase
- Создание и выполнение задач
- Система очков и достижений
- Офисная статистика
- Лидерборд
- Развертывание на Vercel

### 🔍 FALLBACK ЗНАЧЕНИЯ (если БД недоступна):
```javascript
office_stats: {
  total_employees: 3,
  working_employees: 1, 
  total_hours_today: 4.5,
  avg_hours_today: 1.5
}
```

## 📱 UI ОСОБЕННОСТИ

### Пиксельный стиль:
- Все карточки имеют `border-4 border-black`
- Тени: `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
- Декоративные пиксели по углам
- Цветовые схемы для разных состояний

### Состояния:
- 🟢 На работе (зеленый)
- ⏸️ На паузе (желтый)  
- 🔴 Не на работе (серый/красный)
- ☕ На перерыве (оранжевый)

## 🚨 КРИТИЧЕСКИЕ ЗАВИСИМОСТИ

### Supabase:
- URL: из переменных окружения
- Row Level Security включен
- Функции должны быть созданы в public schema

### Vercel:
- Автоматический деплой из Git
- Команда: `vercel --prod`

## 🔄 КОМАНДЫ ДЛЯ БЫСТРОГО ВОССТАНОВЛЕНИЯ

### Если база сломалась:
```sql
-- Проверить офисы
SELECT * FROM offices;

-- Проверить функцию статистики  
SELECT get_office_statistics(1);

-- Восстановить функцию
\i create-office-function-fixed.sql
```

### Если фронтенд сломался:
```bash
# Переразвернуть
vercel --prod

# Проверить логи в браузере  
F12 → Console → искать ошибки
```

## 💡 СОВЕТЫ ДЛЯ БУДУЩЕГО РАЗРАБОТЧИКА

1. **При ошибках БД** - сначала проверь наличие функций
2. **При UI проблемах** - проверь office_id vs district_id  
3. **При деплое** - всегда используй `vercel --prod`
4. **При изменении БД** - обнови функции и RLS политики
5. **Статистика офиса** - в development режиме показывает отладочную инфу

## 📞 КОНТАКТЫ И ДОСТУПЫ
- Supabase проект: из env переменных пользователя
- Vercel проект: dolgihegor2323-gmailcoms-projects
- Git репозиторий: локальная папка пользователя

---
**ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ**: Декабрь 2024  
**СТАТУС**: Миграция districts→offices ЗАВЕРШЕНА, всё работает ✅ 