-- ===========================================
-- ИСПРАВЛЕНИЕ БЕСКОНЕЧНОЙ РЕКУРСИИ В RLS
-- ===========================================

-- Проблема: RLS политика ссылается на саму таблицу user_profiles,
-- что создает бесконечную рекурсию при проверке прав доступа

-- 1. Временно отключаем RLS
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- 2. Удаляем проблемные политики
DROP POLICY IF EXISTS "user_profiles_access_policy" ON user_profiles;
DROP POLICY IF EXISTS "employees_access_policy" ON employees;

-- 3. Создаем простые политики БЕЗ рекурсии
-- Для user_profiles - разрешаем всем аутентифицированным пользователям читать
CREATE POLICY "user_profiles_simple_read" ON user_profiles
FOR SELECT USING (auth.role() = 'authenticated');

-- Для user_profiles - разрешаем пользователям обновлять только свой профиль
CREATE POLICY "user_profiles_simple_update" ON user_profiles
FOR UPDATE USING (auth.uid() = id);

-- Для user_profiles - разрешаем пользователям вставлять только свой профиль
CREATE POLICY "user_profiles_simple_insert" ON user_profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Для employees - разрешаем всем аутентифицированным пользователям читать
CREATE POLICY "employees_simple_read" ON employees
FOR SELECT USING (auth.role() = 'authenticated');

-- Для employees - разрешаем пользователям обновлять только свою запись
CREATE POLICY "employees_simple_update" ON employees
FOR UPDATE USING (auth.uid() = user_id);

-- Для employees - разрешаем пользователям вставлять только свою запись
CREATE POLICY "employees_simple_insert" ON employees
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Включаем RLS обратно
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 5. Проверяем что политики созданы
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'employees')
ORDER BY tablename, policyname;

-- 6. Тестируем доступ к профилю
SELECT 'Тест доступа к профилю:' as test_type;
SELECT 
    up.id,
    up.full_name,
    up.admin_role,
    up.is_admin
FROM user_profiles up
WHERE up.id IN (
    SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru'
)
LIMIT 1;

COMMENT ON POLICY "user_profiles_simple_read" ON user_profiles IS 'Простая политика чтения без рекурсии';
COMMENT ON POLICY "employees_simple_read" ON employees IS 'Простая политика чтения без рекурсии'; 