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