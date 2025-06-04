-- Упрощенное исправление проблем с доступом к базе данных
-- Выполните этот скрипт в SQL Editor вашего Supabase проекта

-- 1. Исправляем политики для work_sessions (основная проблема)
DROP POLICY IF EXISTS "Users can view all work sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can manage their own work sessions" ON work_sessions;

CREATE POLICY "Allow all operations on work_sessions for authenticated users" ON work_sessions
    FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- 2. Исправляем политики для active_sessions
DROP POLICY IF EXISTS "Users can view all active sessions" ON active_sessions;
DROP POLICY IF EXISTS "Users can manage their own active sessions" ON active_sessions;

CREATE POLICY "Allow all operations on active_sessions for authenticated users" ON active_sessions
    FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- 3. Исправляем политики для task_types
DROP POLICY IF EXISTS "Anyone can view task types" ON task_types;
CREATE POLICY "Allow all operations on task_types for authenticated users" ON task_types
    FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- 4. Исправляем политики для employees
DROP POLICY IF EXISTS "Users can view all employees" ON employees;
DROP POLICY IF EXISTS "Users can update their own employee record" ON employees;
DROP POLICY IF EXISTS "Users can insert their own employee record" ON employees;

CREATE POLICY "Allow all operations on employees for authenticated users" ON employees
    FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- 5. Исправляем политики для task_logs
DROP POLICY IF EXISTS "Users can view all task logs" ON task_logs;
DROP POLICY IF EXISTS "Users can insert their own task logs" ON task_logs;
DROP POLICY IF EXISTS "Users can update their own task logs" ON task_logs;

CREATE POLICY "Allow all operations on task_logs for authenticated users" ON task_logs
    FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- 6. Исправляем политики для break_logs
DROP POLICY IF EXISTS "Users can view all break logs" ON break_logs;
DROP POLICY IF EXISTS "Users can manage their own break logs" ON break_logs;

CREATE POLICY "Allow all operations on break_logs for authenticated users" ON break_logs
    FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- 7. Исправляем политики для employee_prizes  
DROP POLICY IF EXISTS "Users can view all prizes" ON employee_prizes;
DROP POLICY IF EXISTS "Users can manage their own prizes" ON employee_prizes;

CREATE POLICY "Allow all operations on employee_prizes for authenticated users" ON employee_prizes
    FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- Готово! Обновите страницу приложения (F5) и проверьте результат. 