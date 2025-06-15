-- ИСПРАВЛЕНИЕ RLS ДЛЯ СУЩЕСТВУЮЩЕЙ ТАБЛИЦЫ USER_PROFILES
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. ПРОВЕРЯЕМ СТРУКТУРУ
SELECT 'Проверяем таблицу user_profiles:' as step_1;

SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_profiles';

-- 2. УДАЛЯЕМ ВСЕ СТАРЫЕ ПОЛИТИКИ ДЛЯ USER_PROFILES
DROP POLICY IF EXISTS "Users can view profiles from same office" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view basic profile info" ON public.user_profiles;
DROP POLICY IF EXISTS "authenticated_users_can_view_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "open_access_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_open_read_access" ON public.user_profiles;

-- 3. ВКЛЮЧАЕМ RLS И СОЗДАЕМ ОТКРЫТУЮ ПОЛИТИКУ
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_read_access" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (true);

-- 4. ТАКЖЕ ИСПРАВЛЯЕМ ДЛЯ EMPLOYEES
DROP POLICY IF EXISTS "Users can view employees from same office" ON public.employees;
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;
DROP POLICY IF EXISTS "Users can view employee info" ON public.employees;
DROP POLICY IF EXISTS "authenticated_users_can_view_employees" ON public.employees;
DROP POLICY IF EXISTS "open_access_employees" ON public.employees;
DROP POLICY IF EXISTS "employees_open_read_access" ON public.employees;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_read_access" ON public.employees
    FOR SELECT TO authenticated
    USING (true);

-- 5. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
SELECT 'Политики для user_profiles:' as step_5;

SELECT 
    schemaname, 
    tablename, 
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'employees')
ORDER BY tablename, policyname;

-- 6. ТЕСТИРУЕМ ДОСТУП
SELECT 'Тест доступа:' as step_6;

SELECT 
    'user_profiles' as table_name,
    COUNT(*) as count
FROM user_profiles

UNION ALL

SELECT 
    'employees' as table_name,
    COUNT(*) as count
FROM employees;

SELECT '✅ ГОТОВО! Обе таблицы доступны для чтения.' as final_status; 