# Quick Start Guide - Task Logger

## 🚀 Быстрый старт для возобновления работы

### 1. Проверка окружения
```bash
# Убедитесь, что установлены:
node --version  # v18+
npm --version   # v9+
```

### 2. Установка зависимостей
```bash
cd task-logger
npm install
```

### 3. Переменные окружения
Создать `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://qodmtekryabmcnuvvbyf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Запуск приложения
```bash
npm run dev
# Откроется http://localhost:3000
```

## 🗄 Настройка базы данных (если нужно)

### Выполнить SQL скрипты в порядке:
1. `fix-avatar-column.sql` - добавляет avatar_url столбец
2. `fix-policies-cleanup.sql` - исправляет RLS политики
3. `fix-profile-policies.sql` - создает правильные политики

## 🔑 Доступы

### Супер-админ
- **Email**: egordolgih@mail.ru
- **Права**: Полный доступ к системе

### Тестовый пользователь
- Регистрация через `/register`
- Автоматически получает роль "Сотрудник"

## 📁 Ключевые файлы для понимания

### Основная логика
- `app/page.tsx` - главная страница (дашборд)
- `app/profile/page.tsx` - страница профиля
- `lib/auth.ts` - сервис авторизации
- `hooks/use-auth.ts` - хук авторизации

### Компоненты
- `components/avatar-upload-with-crop.tsx` - загрузка аватара
- `components/daily-task-stats.tsx` - статистика задач
- `components/navigation.tsx` - навигация

### Игровая логика
- `lib/game-config.ts` - настройки игры
- `lib/level-utils.ts` - расчет уровней

## 🐛 Решение частых проблем

### Ошибки авторизации
```bash
# Проверить переменные окружения
echo $NEXT_PUBLIC_SUPABASE_URL
```

### Ошибки базы данных
```sql
-- Проверить RLS политики
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### Ошибки сборки
```bash
# Очистить кеш
rm -rf .next
npm run build
```

## 🎯 Текущий статус

### Исправленные проблемы ✅
- Аватары: столбец avatar_url добавлен
- RLS политики: конфликтующие политики удалены
- Уровневая система: унифицирована до 100 уровней
- Профиль: сохранение работает корректно

### В разработке 🔄
- Колесо призов
- Система достижений
- Командные челленджи

## 📊 Проверка работоспособности

### Checklist
- [ ] Приложение запускается без ошибок
- [ ] Авторизация работает
- [ ] Профиль сохраняется
- [ ] Аватар загружается
- [ ] Статистика отображается

### URL для тестирования
- Локально: http://localhost:3000
- Продакшн: https://task-logger-1-86y1qgr7d-dolgihegor2323-gmailcoms-projects.vercel.app

## 📱 Deployment

### Vercel
```bash
vercel --prod
```

### Статус деплоя
- Проверить в Vercel Dashboard
- Логи ошибок в Vercel Functions
- Метрики в Vercel Analytics

---

**Последнее обновление**: Декабрь 2024
**Версия**: 1.0
**Статус**: Стабильная работа 