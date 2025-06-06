-- ПРОСТАЯ ДИАГНОСТИКА СОСТОЯНИЯ БД
-- Выполните каждую секцию отдельно

-- 1. Проверяем существование пользователя в разных таблицах
SELECT 'Проверка auth.users' as check_type;
SELECT id, email, created_at 
FROM auth.users 
WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf';

-- 2. Проверяем user_profiles
SELECT 'Проверка user_profiles' as check_type;
SELECT * 
FROM public.user_profiles 
WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf';

-- 3. Проверяем employees
SELECT 'Проверка employees' as check_type;
SELECT * 
FROM public.employees 
WHERE user_id = 'd096d488-f045-4d15-a0ab-3c31a3323faf';

-- 4. Общее количество записей
SELECT 'Общие счетчики' as check_type;
SELECT 
    (SELECT COUNT(*) FROM public.user_profiles) as user_profiles_count,
    (SELECT COUNT(*) FROM public.employees) as employees_count,
    (SELECT COUNT(*) FROM public.work_sessions) as work_sessions_count;

-- 5. Активные RLS политики
SELECT 'RLS политики' as check_type;
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('user_profiles', 'employees', 'work_sessions')
ORDER BY tablename; 