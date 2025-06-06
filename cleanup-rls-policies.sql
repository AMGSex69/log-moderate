-- ОЧИСТКА ДУБЛИРУЮЩИХСЯ RLS ПОЛИТИК
-- Выполните этот скрипт для устранения конфликтов

-- 1. ПОЛНАЯ ОЧИСТКА ВСЕХ ПОЛИТИК ДЛЯ USER_PROFILES
DROP POLICY IF EXISTS "allow_all_for_authenticated" ON public.user_profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "view_own_profile" ON public.user_profiles;

-- Создаем ТОЛЬКО одну простую политику для user_profiles
CREATE POLICY "user_profiles_all_access" ON public.user_profiles
    FOR ALL USING (true) WITH CHECK (true);

-- 2. ПОЛНАЯ ОЧИСТКА ВСЕХ ПОЛИТИК ДЛЯ EMPLOYEES  
DROP POLICY IF EXISTS "Allow all operations on employees for authenticated users" ON public.employees;
DROP POLICY IF EXISTS "Users can update own profile" ON public.employees;
DROP POLICY IF EXISTS "employees_delete_policy" ON public.employees;
DROP POLICY IF EXISTS "employees_insert_policy" ON public.employees;
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;
DROP POLICY IF EXISTS "employees_update_policy" ON public.employees;

-- Создаем ТОЛЬКО одну простую политику для employees
CREATE POLICY "employees_all_access" ON public.employees
    FOR ALL USING (true) WITH CHECK (true);

-- 3. ПОЛНАЯ ОЧИСТКА ВСЕХ ПОЛИТИК ДЛЯ WORK_SESSIONS
DROP POLICY IF EXISTS "Enable delete access for users" ON public.work_sessions;
DROP POLICY IF EXISTS "Enable insert access for users" ON public.work_sessions;
DROP POLICY IF EXISTS "Enable read access for users" ON public.work_sessions;
DROP POLICY IF EXISTS "Enable update access for users" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_delete_policy" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_insert_policy" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_select_policy" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_update_policy" ON public.work_sessions;

-- Создаем ТОЛЬКО одну простую политику для work_sessions
CREATE POLICY "work_sessions_all_access" ON public.work_sessions
    FOR ALL USING (true) WITH CHECK (true);

-- 4. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
SELECT 'Итоговые RLS политики:' as result;
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('user_profiles', 'employees', 'work_sessions')
ORDER BY tablename;

-- 5. СОЗДАЕМ НЕДОСТАЮЩИЙ USER_PROFILE
INSERT INTO public.user_profiles (
    id, full_name, position, is_admin, work_schedule, work_hours, role
) VALUES (
    'd096d488-f045-4d15-a0ab-3c31a3323faf',
    COALESCE(
        (SELECT email FROM auth.users WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'),
        'Тестовый пользователь'
    ),
    'Сотрудник',
    false,
    '5/2',
    9,
    'user'
) ON CONFLICT (id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- 6. ИТОГОВАЯ ПРОВЕРКА
SELECT 'Проверка пользователя:' as check_type;
SELECT 
    up.id,
    up.full_name as profile_name,
    e.id as employee_id,
    e.full_name as employee_name,
    e.email
FROM public.user_profiles up
FULL OUTER JOIN public.employees e ON e.user_id = up.id
WHERE up.id = 'd096d488-f045-4d15-a0ab-3c31a3323faf' 
   OR e.user_id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'; 