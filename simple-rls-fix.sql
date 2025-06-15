-- ПРОСТОЕ ИСПРАВЛЕНИЕ RLS ДЛЯ EMPLOYEES
-- Выполните в Supabase SQL Editor

-- 1. Удаляем все существующие политики
DROP POLICY IF EXISTS "Users can read own employee data" ON employees;
DROP POLICY IF EXISTS "Users can update own employee data" ON employees;
DROP POLICY IF EXISTS "Admins can read all employee data" ON employees;
DROP POLICY IF EXISTS "Admins can update all employee data" ON employees;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON employees;
DROP POLICY IF EXISTS "Users can view all employees" ON employees;
DROP POLICY IF EXISTS "Users can update their own employee record" ON employees;
DROP POLICY IF EXISTS "Users can insert their own employee record" ON employees;

-- 2. Создаем простую политику для всех операций
CREATE POLICY "employees_all_operations" ON employees
    FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- 3. Включаем RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 4. Тестируем доступ
SELECT 
    'ТЕСТ ДОСТУПА К EMPLOYEES:' as info,
    id,
    full_name,
    user_id,
    office_id
FROM employees 
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID;

-- 5. Проверяем все записи employees (для админа)
SELECT 
    'ВСЕ EMPLOYEES:' as info,
    COUNT(*) as total_employees
FROM employees; 