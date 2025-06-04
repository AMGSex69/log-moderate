# 🚀 Краткое руководство по развертыванию Task Logger

## 📋 Пошаговое развертывание

### 1. Настройка базы данных Supabase

1. **Откройте Supabase SQL Editor**
2. **Выполните полный скрипт настройки**:
   ```sql
   -- Скопируйте и выполните содержимое файла:
   -- database-complete-setup.sql
   ```
3. **Проверьте успешность выполнения** - должно появиться сообщение:
   ```
   База данных Task Logger успешно настроена!
   ```

### 2. Создание записей сотрудников

1. **Выполните скрипт исправления**:
   ```sql
   -- Скопируйте и выполните содержимое файла:
   -- fix-employee-record-final.sql
   ```
2. **Проверьте результат** - должно показать:
   ```
   ✅ Записи сотрудников успешно созданы и проверены!
   ```

### 3. Проверка переменных окружения

Убедитесь, что в вашем `.env.local` есть:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Проверка работоспособности

1. **Запустите приложение локально**:
   ```bash
   npm run dev
   ```

2. **Откройте приложение** и проверьте:
   - ✅ Авторизация работает
   - ✅ Профиль загружается
   - ✅ Нет ошибок 406/400 в консоли
   - ✅ Компоненты отображаются корректно

### 5. Развертывание на Vercel

1. **Добавьте переменные окружения** в настройках Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Разверните приложение**:
   ```bash
   vercel --prod
   ```

## ✅ Чек-лист развертывания

### База данных
- [ ] Выполнен `database-complete-setup.sql`
- [ ] Созданы 7 таблиц (employees, task_types, task_logs, work_sessions, active_sessions, break_logs, employee_prizes)
- [ ] Загружены 15 типов задач
- [ ] Созданы триггеры и функции
- [ ] Настроены RLS политики
- [ ] Выполнен `fix-employee-record-final.sql`
- [ ] Созданы записи сотрудников для всех пользователей

### Код
- [ ] Обновлены импорты в компонентах
- [ ] Используется новая типизация из `database-types.ts`
- [ ] Компоненты работают с `DatabaseService`
- [ ] Нет ошибок TypeScript
- [ ] Приложение собирается без ошибок

### Развертывание
- [ ] Переменные окружения настроены
- [ ] Vercel развертывание успешно
- [ ] Приложение работает в production
- [ ] Авторизация работает
- [ ] Нет ошибок в браузере

## 🔧 Быстрое исправление проблем

### Ошибка 406 "Not Acceptable"
```sql
-- Выполните в Supabase SQL Editor:
-- fix-employee-record-final.sql
```

### Ошибка "Employee not found"
```sql
-- Проверьте записи сотрудников:
SELECT * FROM employees WHERE user_id = 'your-user-id';

-- Если записи нет, создайте вручную:
INSERT INTO employees (user_id, full_name, email, position) 
VALUES ('your-user-id', 'Ваше имя', 'your@email.com', 'Сотрудник');
```

### Ошибки типизации
```typescript
// Обновите импорты:
import type { Employee, TaskLog } from "@/lib/database-types"
import { DatabaseService } from "@/lib/database-service"
```

### RLS блокирует запросы
```sql
-- Временно отключите RLS для отладки:
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
-- Не забудьте включить обратно:
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
```

## 📊 Проверка работы

### 1. Тестирование API
```typescript
// В консоли браузера:
const { data, error } = await supabase.from('employees').select('*').limit(1)
console.log('Данные:', data, 'Ошибка:', error)
```

### 2. Проверка аутентификации
```typescript
// В консоли браузера:
const { data: { user } } = await supabase.auth.getUser()
console.log('Пользователь:', user)
```

### 3. Проверка записи сотрудника
```sql
-- В Supabase SQL Editor:
SELECT e.*, au.email as auth_email 
FROM employees e 
JOIN auth.users au ON e.user_id = au.id 
LIMIT 5;
```

## 🆘 Контакты для поддержки

- **Документация**: `DATABASE_INTEGRATION.md`
- **Схема БД**: `database-complete-setup.sql`
- **Исправления**: `fix-employee-record-final.sql`
- **Типизация**: `lib/database-types.ts`
- **Сервис БД**: `lib/database-service.ts`

---

**Время развертывания**: ~10-15 минут  
**Версия**: 2.0  
**Статус**: ✅ Готово к production 