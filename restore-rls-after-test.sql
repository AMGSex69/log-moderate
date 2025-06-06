-- ВОССТАНОВЛЕНИЕ RLS ПОЛИТИК ПОСЛЕ ТЕСТИРОВАНИЯ
-- Выполните этот скрипт ТОЛЬКО после успешного тестирования регистрации

-- 1. Включаем обратно Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 2. Создаем безопасные RLS политики для user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- Политики для user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles 
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles 
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles 
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Создаем безопасные RLS политики для employees
DROP POLICY IF EXISTS "Users can view all employees" ON public.employees;
DROP POLICY IF EXISTS "Users can update own employee record" ON public.employees;
DROP POLICY IF EXISTS "Users can insert own employee record" ON public.employees;

-- Политики для employees
CREATE POLICY "Users can view all employees" ON public.employees 
    FOR SELECT USING (true);

CREATE POLICY "Users can update own employee record" ON public.employees 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own employee record" ON public.employees 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Убираем тестовую функцию
DROP FUNCTION IF EXISTS test_user_creation();

-- 5. Проверяем что RLS включен
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    CASE WHEN rowsecurity THEN '✅ RLS ENABLED' ELSE '❌ RLS DISABLED' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'employees')
ORDER BY tablename;

SELECT 'RLS policies restored! System is secure again.' as status; 