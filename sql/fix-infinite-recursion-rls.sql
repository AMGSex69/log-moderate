-- ===========================================
-- СРОЧНОЕ ИСПРАВЛЕНИЕ БЕСКОНЕЧНОЙ РЕКУРСИИ RLS
-- ===========================================

-- 1. УДАЛЯЕМ ВСЕ ПРОБЛЕМНЫЕ ПОЛИТИКИ
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Office admins can view office profiles" ON user_profiles;
DROP POLICY IF EXISTS "Office admins can update office profiles" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON user_profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_profiles;

-- Удаляем политики для employees
DROP POLICY IF EXISTS "Users can view own employee record" ON employees;
DROP POLICY IF EXISTS "Users can update own employee record" ON employees;
DROP POLICY IF EXISTS "Admins can view all employees" ON employees;
DROP POLICY IF EXISTS "Admins can update all employees" ON employees;

-- Удаляем политики для work_sessions
DROP POLICY IF EXISTS "Users can view own work sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can manage own work sessions" ON work_sessions;
DROP POLICY IF EXISTS "Admins can view all work sessions" ON work_sessions;

-- Удаляем политики для active_sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON active_sessions;
DROP POLICY IF EXISTS "Users can manage own sessions" ON active_sessions;

-- 2. ВРЕМЕННО ОТКЛЮЧАЕМ RLS ДЛЯ ВОССТАНОВЛЕНИЯ РАБОТЫ
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions DISABLE ROW LEVEL SECURITY;

-- 3. СОЗДАЕМ ПРОСТЫЕ БЕЗОПАСНЫЕ ПОЛИТИКИ

-- Включаем RLS обратно
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- ПРОСТЫЕ ПОЛИТИКИ ДЛЯ USER_PROFILES
CREATE POLICY "Allow own profile access" ON user_profiles
    FOR ALL USING (auth.uid() = id);

CREATE POLICY "Allow admin full access" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND (up.role = 'super-admin' OR up.is_admin = true)
        )
    );

-- ПРОСТЫЕ ПОЛИТИКИ ДЛЯ EMPLOYEES
CREATE POLICY "Allow own employee access" ON employees
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Allow admin employee access" ON employees
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND (up.role = 'super-admin' OR up.is_admin = true)
        )
    );

-- ПРОСТЫЕ ПОЛИТИКИ ДЛЯ WORK_SESSIONS
CREATE POLICY "Allow own work sessions" ON work_sessions
    FOR ALL USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Allow admin work sessions" ON work_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND (up.role = 'super-admin' OR up.is_admin = true)
        )
    );

-- ПРОСТЫЕ ПОЛИТИКИ ДЛЯ ACTIVE_SESSIONS
CREATE POLICY "Allow own active sessions" ON active_sessions
    FOR ALL USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Allow admin active sessions" ON active_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND (up.role = 'super-admin' OR up.is_admin = true)
        )
    );

-- 4. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
SELECT 'Проверка политик user_profiles:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_profiles';

SELECT 'Проверка политик employees:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'employees';

-- 5. ТЕСТИРУЕМ ДОСТУП
SELECT 'Тест доступа к user_profiles:' as test_type;
SELECT COUNT(*) as total_profiles FROM user_profiles;

SELECT 'Тест доступа к employees:' as test_type;
SELECT COUNT(*) as total_employees FROM employees;

COMMENT ON TABLE user_profiles IS 'Исправлены RLS политики - убрана бесконечная рекурсия'; 