-- ===========================================
-- БЕЗОПАСНОЕ ИСПРАВЛЕНИЕ RLS БЕЗ РЕКУРСИИ
-- ===========================================

-- 1. ПОЛНОСТЬЮ УДАЛЯЕМ ВСЕ ПОЛИТИКИ
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Удаляем все политики для user_profiles
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON user_profiles';
    END LOOP;
    
    -- Удаляем все политики для employees
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'employees' LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON employees';
    END LOOP;
    
    -- Удаляем все политики для work_sessions
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'work_sessions' LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON work_sessions';
    END LOOP;
    
    -- Удаляем все политики для active_sessions
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'active_sessions' LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON active_sessions';
    END LOOP;
END $$;

-- 2. ВРЕМЕННО ОТКЛЮЧАЕМ RLS
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions DISABLE ROW LEVEL SECURITY;

-- 3. СОЗДАЕМ ФУНКЦИЮ ДЛЯ ПРОВЕРКИ АДМИНА (БЕЗ РЕКУРСИИ)
CREATE OR REPLACE FUNCTION is_admin_user(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin_result BOOLEAN := false;
BEGIN
    -- Проверяем напрямую в таблице без RLS
    SELECT COALESCE(is_admin, false) OR (role = 'super-admin')
    INTO is_admin_result
    FROM user_profiles 
    WHERE id = user_uuid;
    
    RETURN COALESCE(is_admin_result, false);
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$;

-- 4. ВКЛЮЧАЕМ RLS И СОЗДАЕМ ПРОСТЫЕ ПОЛИТИКИ

-- USER_PROFILES - только свой профиль
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile_access" ON user_profiles
    FOR ALL USING (auth.uid() = id);

-- EMPLOYEES - свои записи + админы через функцию
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_employee_access" ON employees
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "admin_employee_access" ON employees
    FOR ALL USING (is_admin_user(auth.uid()));

-- WORK_SESSIONS - свои сессии + админы
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_work_sessions" ON work_sessions
    FOR ALL USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "admin_work_sessions" ON work_sessions
    FOR ALL USING (is_admin_user(auth.uid()));

-- ACTIVE_SESSIONS - свои активные сессии + админы
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_active_sessions" ON active_sessions
    FOR ALL USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "admin_active_sessions" ON active_sessions
    FOR ALL USING (is_admin_user(auth.uid()));

-- 5. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
SELECT 'Все политики удалены и пересозданы безопасно' as status;

SELECT 'Политики user_profiles:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles';

SELECT 'Политики employees:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'employees';

-- 6. ТЕСТИРУЕМ
SELECT 'Тест функции is_admin_user:' as test_type;
SELECT is_admin_user('b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID) as is_admin_test;

SELECT 'Тест доступа к таблицам:' as test_type;
SELECT 
    (SELECT COUNT(*) FROM user_profiles) as profiles_count,
    (SELECT COUNT(*) FROM employees) as employees_count;

COMMENT ON FUNCTION is_admin_user(UUID) IS 'Безопасная функция проверки админа без рекурсии RLS'; 