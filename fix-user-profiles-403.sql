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

-- 5. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
SELECT 'Политики обновлены. Проверяем:' as status;

SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'employees')
ORDER BY tablename, policyname;

-- 6. ТЕСТИРУЕМ ДОСТУП (замените UUID на реальный)
-- SELECT id, full_name, position, office_id FROM user_profiles LIMIT 3; 