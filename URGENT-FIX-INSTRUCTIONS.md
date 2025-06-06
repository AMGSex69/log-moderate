# 🚨 СРОЧНОЕ ИСПРАВЛЕНИЕ - Проблемы с новыми пользователями

## Проблемы:
1. ❌ Employee создается несколько раз (ID 144, 125, 126)
2. ❌ Ошибки 406 (Not Acceptable) при запросах к базе
3. ❌ Функция лидерборда отсутствует (404 ошибка)
4. ❌ Состояние работы сбрасывается после создания сессии
5. ❌ При обновлении страницы выбрасывает на выбор округа

## Решение:

### 1. 🔧 Применить SQL скрипт в Supabase

**⚠️ ВАЖНО:** Если получили ошибку CASCADE, используйте второй скрипт!

#### Вариант 1 (попробовать сначала):
Выполните SQL скрипт `fix-new-user-issues.sql` в Supabase SQL Editor

#### Вариант 2 (если ошибка CASCADE):
Если получили ошибку:
```
ERROR: cannot drop function handle_new_user() because other objects depend on it
HINT: Use DROP ... CASCADE to drop the dependent objects too.
```

Тогда используйте скрипт `fix-new-user-issues-safe.sql` - он использует CASCADE для принудительного удаления.

**Шаги:**
1. Перейдите в Supabase Dashboard → SQL Editor
2. Скопируйте весь контент файла `fix-new-user-issues-safe.sql`
3. Выполните скрипт
4. Проверьте, что все функции созданы успешно

### 2. 📱 Развернутая версия

Приложение обновлено: https://task-logger-1-j8qkhwlux-dolgihegor2323-gmailcoms-projects.vercel.app

### 3. 🔍 Что исправлено в коде:

#### **RLS Политики:**
- ✅ Исправлены политики для `employees` - разрешено создание и чтение
- ✅ Исправлены политики для `work_sessions` - правильная проверка владения
- ✅ Политики работают с триггерами и функциями

#### **Функции базы данных:**
- ✅ `get_leaderboard_with_current_user()` - создана функция лидерборда
- ✅ `get_or_create_employee_id()` - безопасное получение/создание employee
- ✅ `handle_new_user()` - исправлен триггер регистрации

#### **Клиентский код:**
- ✅ `authService.getEmployeeId()` использует новую безопасную функцию
- ✅ Добавлена обработка ошибок для лидерборда
- ✅ Защита от падения приложения при отсутствии функций

### 4. 🧪 Проверка после применения:

1. **Новая регистрация:** Пользователь должен создаваться с одним employee ID
2. **Рабочие сессии:** Должны работать без ошибок 406
3. **Лидерборд:** Не должно быть ошибок 404
4. **Переходы:** Не должно выбрасывать на выбор округа при обновлении

### 5. 🔄 Если проблемы остаются:

```sql
-- Проверить созданные функции
SELECT proname FROM pg_proc WHERE proname LIKE '%employee%' OR proname LIKE '%leaderboard%';

-- Проверить RLS политики
SELECT schemaname, tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('employees', 'work_sessions');

-- Очистить дублированные employees (ОСТОРОЖНО!)
DELETE FROM employees 
WHERE id NOT IN (
    SELECT MIN(id) FROM employees GROUP BY user_id
);
```

### 6. 📞 Поддержка:

Если проблемы не решены:
1. Проверьте логи Supabase в Dashboard → Logs
2. Проверьте консоль браузера на наличие ошибок
3. Убедитесь, что SQL скрипт выполнился без ошибок

---

**Статус:** ✅ Код обновлен, ⏳ Ожидается применение SQL скрипта 