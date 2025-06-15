-- ДИАГНОСТИКА И ИСПРАВЛЕНИЕ 403 ОШИБКИ
-- Выполните этот скрипт целиком в Supabase SQL Editor

-- 1. ПРОВЕРЯЕМ КАКИЕ ТАБЛИЦЫ СУЩЕСТВУЮТ
SELECT 'Проверяем существующие таблицы:' as step_1;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'user_profiles', 'employees', 'profiles')
ORDER BY table_name;

-- 2. ПРОВЕРЯЕМ ТЕКУЩИЕ RLS ПОЛИТИКИ
SELECT 'Текущие RLS политики:' as step_2;

SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'user_profiles', 'employees', 'profiles')
ORDER BY tablename, policyname;

-- 3. ПРОВЕРЯЕМ RLS СТАТУС ТАБЛИЦ
SELECT 'RLS статус таблиц:' as step_3;

SELECT 
    t.tablename,
    t.rowsecurity as rls_enabled
FROM pg_tables t
WHERE t.schemaname = 'public'
AND t.tablename IN ('users', 'user_profiles', 'employees', 'profiles');

-- 4. ИСПРАВЛЯЕМ ПРОБЛЕМЫ С ДОСТУПОМ
SELECT 'Исправляем доступ к таблицам:' as step_4;

-- Удаляем все старые политики для всех возможных таблиц
DROP POLICY IF EXISTS "Users can view profiles from same office" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view basic profile info" ON public.user_profiles;
DROP POLICY IF EXISTS "authenticated_users_can_view_profiles" ON public.user_profiles;

DROP POLICY IF EXISTS "Users can view profiles from same office" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "Users can view basic profile info" ON public.users;
DROP POLICY IF EXISTS "authenticated_users_can_view_users" ON public.users;

DROP POLICY IF EXISTS "Users can view profiles from same office" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can view basic profile info" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_users_can_view_profiles" ON public.profiles;

DROP POLICY IF EXISTS "Users can view employees from same office" ON public.employees;
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;
DROP POLICY IF EXISTS "Users can view employee info" ON public.employees;
DROP POLICY IF EXISTS "authenticated_users_can_view_employees" ON public.employees;

-- 5. СОЗДАЕМ ОТКРЫТЫЕ ПОЛИТИКИ ДЛЯ ВСЕХ ТАБЛИЦ

-- Для user_profiles (если существует)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
        EXECUTE 'ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "open_access_user_profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true)';
        RAISE NOTICE 'Политика для user_profiles создана';
    END IF;
END $$;

-- Для users (если существует)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "open_access_users" ON public.users FOR SELECT TO authenticated USING (true)';
        RAISE NOTICE 'Политика для users создана';
    END IF;
END $$;

-- Для profiles (если существует)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "open_access_profiles" ON public.profiles FOR SELECT TO authenticated USING (true)';
        RAISE NOTICE 'Политика для profiles создана';
    END IF;
END $$;

-- Для employees
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
        EXECUTE 'ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "open_access_employees" ON public.employees FOR SELECT TO authenticated USING (true)';
        RAISE NOTICE 'Политика для employees создана';
    END IF;
END $$;

-- 6. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
SELECT 'Результат после исправлений:' as step_6;

SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'user_profiles', 'employees', 'profiles')
ORDER BY tablename, policyname;

-- 7. ТЕСТИРУЕМ ДОСТУП
SELECT 'Тестируем доступ (замените UUID на реальный):' as step_7;

-- Раскомментируйте и протестируйте нужные запросы:
-- SELECT COUNT(*) as user_profiles_count FROM user_profiles;
-- SELECT COUNT(*) as users_count FROM users;
-- SELECT COUNT(*) as profiles_count FROM profiles;
-- SELECT COUNT(*) as employees_count FROM employees;

SELECT 'ДИАГНОСТИКА ЗАВЕРШЕНА. Проверьте результаты выше.' as final_message; 