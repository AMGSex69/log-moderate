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

-- ===========================================
-- ИСПРАВЛЕНИЕ RLS ПОЛИТИК ДЛЯ USER_PROFILES
-- ===========================================
-- Позволяет аутентифицированным пользователям видеть профили других пользователей

-- 1. Проверяем текущие политики
SELECT 
    'Текущие RLS политики для user_profiles:' as info,
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 2. Удаляем старые ограничительные политики
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON user_profiles;

-- 3. Создаем новую политику для просмотра профилей
-- Позволяет всем аутентифицированным пользователям видеть основные данные профилей
CREATE POLICY "Allow authenticated users to view profiles" ON user_profiles
    FOR SELECT 
    USING (auth.role() = 'authenticated');

-- 4. Политика для обновления - только свой профиль
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE 
    USING (auth.uid() = id);

-- 5. Политика для вставки - только свой профиль
CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- 6. Проверяем новые политики
SELECT 
    'Новые RLS политики для user_profiles:' as info,
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 7. Проверяем, что RLS включен
SELECT 
    'RLS статус для user_profiles:' as info,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'user_profiles' AND schemaname = 'public';

-- 8. Если RLS отключен, включаем его
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 9. Тестовый запрос для проверки доступа
SELECT 
    'Тест доступа к user_profiles:' as info,
    COUNT(*) as accessible_profiles
FROM user_profiles;

-- 10. Проверяем конкретного пользователя
SELECT 
    'Профиль пользователя 6121f80a-d739-4634-b077-aebc0a3b36d1:' as info,
    id,
    full_name,
    avatar_url,
    CASE 
        WHEN avatar_url IS NULL OR avatar_url = '' THEN 'Аватарка отсутствует'
        ELSE 'Аватарка есть: ' || LEFT(avatar_url, 50) || '...'
    END as avatar_status
FROM user_profiles 
WHERE id = '6121f80a-d739-4634-b077-aebc0a3b36d1'; 