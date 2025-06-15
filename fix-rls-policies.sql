-- Проверка и исправление RLS политик
-- Выполните этот скрипт если продолжают быть проблемы с доступом

-- 1. Проверяем текущие политики
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public';

-- 2. Удаляем и пересоздаем политики для employees (если нужно)
DROP POLICY IF EXISTS "Users can view all employees" ON employees;
DROP POLICY IF EXISTS "Users can update their own employee record" ON employees;
DROP POLICY IF EXISTS "Users can insert their own employee record" ON employees;

-- 3. Создаем более простые политики
CREATE POLICY "Allow all operations for authenticated users" ON employees
    FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- 4. Проверяем настройки RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'task_logs', 'work_sessions', 'employee_prizes', 'task_types');

-- 5. Временно отключаем RLS для employees (для отладки)
-- Раскомментируйте если нужно:
-- ALTER TABLE employees DISABLE ROW LEVEL SECURITY; 

-- ИСПРАВЛЕНИЕ RLS ПОЛИТИК ДЛЯ ТАБЛИЦЫ EMPLOYEES
-- Выполните в Supabase SQL Editor

-- 1. Проверяем текущие RLS политики
SELECT 
    'ТЕКУЩИЕ RLS ПОЛИТИКИ:' as info,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'employees'
ORDER BY policyname;

-- 2. Проверяем, включен ли RLS для employees
SELECT 
    'RLS СТАТУС:' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables t
WHERE tablename = 'employees';

-- 3. Создаем или обновляем политику для чтения employees
-- Разрешаем пользователям читать свои собственные записи
DROP POLICY IF EXISTS "Users can read own employee data" ON employees;
CREATE POLICY "Users can read own employee data" ON employees
    FOR SELECT 
    USING (auth.uid() = user_id);

-- 4. Создаем политику для обновления своих данных
DROP POLICY IF EXISTS "Users can update own employee data" ON employees;
CREATE POLICY "Users can update own employee data" ON employees
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Создаем политику для админов (чтение всех записей)
DROP POLICY IF EXISTS "Admins can read all employee data" ON employees;
CREATE POLICY "Admins can read all employee data" ON employees
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

-- 6. Создаем политику для админов (обновление всех записей)
DROP POLICY IF EXISTS "Admins can update all employee data" ON employees;
CREATE POLICY "Admins can update all employee data" ON employees
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

-- 7. Убеждаемся, что RLS включен
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 8. Проверяем результат - политики после изменений
SELECT 
    'ОБНОВЛЕННЫЕ RLS ПОЛИТИКИ:' as info,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'employees'
ORDER BY policyname;

-- 9. Тестируем доступ к данным (должно вернуть вашу запись)
SELECT 
    'ТЕСТ ДОСТУПА:' as info,
    id,
    full_name,
    user_id,
    office_id
FROM employees 
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID; 