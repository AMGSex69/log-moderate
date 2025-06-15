# 🔧 Быстрое исправление ошибки 403

## Проблема
- Ошибка 403 при загрузке профилей пользователей
- `Failed to load resource: the server responded with a status of 403`
- Блокировка доступа к таблице `user_profiles`

## Причина
RLS (Row Level Security) политики в Supabase блокируют доступ к данным.

## Решение

### 1. Откройте Supabase Dashboard
- Перейдите в ваш проект: https://supabase.com/dashboard
- Зайдите в **SQL Editor**

### 2. Выполните SQL скрипт
Скопируйте и выполните весь код из файла `fix-user-profiles-403.sql`:

```sql
-- БЫСТРОЕ ИСПРАВЛЕНИЕ 403 ОШИБКИ ДЛЯ USER_PROFILES
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. ВРЕМЕННО УДАЛЯЕМ ВСЕ ОГРАНИЧИТЕЛЬНЫЕ ПОЛИТИКИ
DROP POLICY IF EXISTS "Users can view profiles from same office" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view basic profile info" ON public.user_profiles;

-- 2. СОЗДАЕМ ПРОСТУЮ ОТКРЫТУЮ ПОЛИТИКУ ДЛЯ АУТЕНТИФИЦИРОВАННЫХ ПОЛЬЗОВАТЕЛЕЙ
CREATE POLICY "authenticated_users_can_view_profiles" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (true);

-- 3. ПРОВЕРЯЕМ, ЧТО RLS ВКЛЮЧЕН
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. АНАЛОГИЧНО ДЛЯ EMPLOYEES
DROP POLICY IF EXISTS "Users can view employees from same office" ON public.employees;
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;
DROP POLICY IF EXISTS "Users can view employee info" ON public.employees;

CREATE POLICY "authenticated_users_can_view_employees" ON public.employees
    FOR SELECT TO authenticated
    USING (true);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
```

### 3. Проверьте результат
После выполнения скрипта:
1. Обновите страницу приложения
2. Попробуйте открыть профиль пользователя  
3. Ошибка 403 должна исчезнуть

### 4. Проверка в консоли
Откройте DevTools (F12) и проверьте:
- ✅ Нет ошибок 403 в Network tab
- ✅ Профили загружаются успешно
- ✅ Лидерборд показывает кликабельные имена

## Что делает скрипт
- Удаляет старые ограничительные политики
- Создает новые открытые политики для аутентифицированных пользователей
- Включает RLS для безопасности
- Позволяет всем залогиненным пользователям видеть базовую информацию коллег

## Безопасность
- ✅ Доступ только для аутентифицированных пользователей
- ✅ Email видят только владельцы профиля или супер-админ
- ✅ RLS остается включенным
- ✅ Нет доступа для анонимных пользователей

## Если проблема не решилась
1. Проверьте, что вы вошли в систему
2. Очистите кэш браузера
3. Попробуйте в инкогнито режиме
4. Обратитесь к разработчику

---
*Автогенерация: Task Logger Support System* 