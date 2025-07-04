# 🎮 Task Logger - Система учёта рабочего времени с геймификацией

Современное веб-приложение для отслеживания рабочих задач с элементами игры, построенное на Next.js 15 и Supabase.

## ✨ Особенности

- **🎯 Трекинг задач** - отслеживание времени выполнения различных типов задач
- **🎮 Геймификация** - система очков, уровней и достижений
- **👥 Командная работа** - статистика по всем сотрудникам и лидерборды
- **📊 Аналитика** - подробная статистика и отчёты
- **⏰ Учёт рабочего времени** - отметки прихода/ухода и контроль перерывов
- **🏆 Достижения** - система наград и призов
- **📱 Адаптивный дизайн** - работает на всех устройствах

## 🛠 Технологии

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, Radix UI, Lucide Icons
- **База данных**: Supabase (PostgreSQL)
- **Аутентификация**: Supabase Auth
- **Развёртывание**: Vercel
- **Стилизация**: Pixel-art стиль для игрового интерфейса

## 🚀 Быстрый старт

### 1. Клонирование проекта

```bash
git clone <repository-url>
cd task-logger
npm install --force  # --force нужен для совместимости с React 19
```

### 2. Настройка Supabase

**Обязательно выполните этот шаг для работы приложения!**

Следуйте подробному руководству в файле [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

Краткий алгоритм:
1. Создайте проект на [supabase.com](https://supabase.com)
2. Выполните SQL-скрипт из файла `database-setup.sql`
3. Получите API ключи из Settings → API
4. Создайте файл `.env.local` с вашими ключами

### 3. Настройка переменных окружения

Создайте файл `.env.local` в корне проекта:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Запуск локально

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## 📋 Структура базы данных

### Основные таблицы

- **`employees`** - профили сотрудников
- **`task_types`** - типы задач (Разработка, Тестирование, Документация, и т.д.)
- **`task_logs`** - логи выполненных задач с временем
- **`work_sessions`** - рабочие смены и сессии
- **`employee_prizes`** - призы и достижения

### Предустановленные типы задач

- Разработка
- Тестирование  
- Документация
- Анализ
- Дизайн
- Планирование
- Код ревью
- Настройка
- Исправление багов
- Оптимизация
- Интеграция
- Деплой
- Обучение
- Консультации
- Митинги

## 🎮 Система геймификации

### Очки за задачи
- **Разработка**: 8 очков за единицу
- **Код ревью**: 7 очков за единицу
- **Исправление багов**: 6 очков за единицу
- **Тестирование**: 5 очков за единицу
- **Документация**: 4 очка за единицу
- **Остальные задачи**: 5 очков за единицу

### Бонусы
- **Скоростной бонус**: +20% за выполнение быстрее среднего
- **Объёмный бонус**: +10% за большое количество единиц
- **Марафонский бонус**: +15% за долгое выполнение

### Достижения
- **Трудяга**: выполнить 5 сложных задач за день
- **Скоростной демон**: выполнить 15 задач за день  
- **Мастер разнообразия**: выполнить задачи из 5 разных групп
- **Мультизадачник**: работать над 3+ задачами одновременно
- **Клуб тысячи**: заработать 1000+ очков

## 📊 Возможности аналитики

- **Личная статистика** - индивидуальные показатели продуктивности
- **Командные отчёты** - общая статистика по всем сотрудникам
- **Лидерборды** - рейтинги по различным метрикам
- **Аналитика по задачам** - детальная статистика по типам задач
- **Временные отчёты** - данные за день/неделю/месяц

## 🚀 Развёртывание на Vercel

### Автоматическое развёртывание

1. Подключите репозиторий к Vercel
2. Добавьте переменные окружения в Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Vercel автоматически разместит приложение

### Команды для развёртывания

```bash
# Сборка проекта
npm run build

# Экспорт статических файлов
npm run export
```

## 🔧 Разработка

### Установка зависимостей

```bash
npm install --force
```

### Запуск в режиме разработки

```bash
npm run dev
```

### Сборка для продакшена

```bash
npm run build
npm start
```

### Линтинг и форматирование

```bash
npm run lint
npm run lint:fix
```

## 📁 Структура проекта

```
task-logger/
├── app/                    # Next.js App Router
│   ├── admin/             # Административная панель
│   ├── profile/           # Профиль пользователя
│   └── page.tsx           # Главная страница
├── components/            # React компоненты
│   ├── ui/               # UI компоненты (кнопки, карточки)
│   ├── admin/            # Админ компоненты
│   └── auth/             # Компоненты аутентификации
├── hooks/                # Custom React хуки
├── lib/                  # Утилиты и конфигурация
│   ├── supabase.ts       # Клиент Supabase
│   ├── auth.ts           # Сервис аутентификации
│   ├── game-config.ts    # Конфигурация игры
│   └── reward-system.ts  # Система наград
├── database-setup.sql    # SQL скрипт для настройки БД
└── SUPABASE_SETUP.md    # Руководство по настройке
```

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции (`git checkout -b feature/amazing-feature`)
3. Сделайте коммит (`git commit -m 'Add some amazing feature'`)
4. Запушьте в ветку (`git push origin feature/amazing-feature`)
5. Создайте Pull Request

## 📝 Лицензия

Этот проект распространяется под лицензией MIT. См. файл `LICENSE` для подробностей.

## 🆘 Поддержка

Если у вас возникли проблемы:

1. Проверьте [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) для настройки базы данных
2. Убедитесь, что все переменные окружения установлены корректно
3. Проверьте консоль браузера на наличие ошибок
4. Создайте issue в репозитории с описанием проблемы

---

**Примечание**: Для полной функциональности приложения необходимо настроить Supabase согласно инструкциям в SUPABASE_SETUP.md #   l o g - m o d e r a t e  
 