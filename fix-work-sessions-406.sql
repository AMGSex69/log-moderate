-- Исправление 406 ошибки для work_sessions

-- 1. Удаляем все существующие политики на work_sessions
DROP POLICY IF EXISTS "work_sessions_select_policy" ON work_sessions;
DROP POLICY IF EXISTS "work_sessions_insert_policy" ON work_sessions;
DROP POLICY IF EXISTS "work_sessions_update_policy" ON work_sessions;
DROP POLICY IF EXISTS "work_sessions_delete_policy" ON work_sessions;
DROP POLICY IF EXISTS "Users can view their own work sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can insert their own work sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can update their own work sessions" ON work_sessions;
DROP POLICY IF EXISTS "work_sessions_policy" ON work_sessions;

-- 2. Создаем единую разрешающую политику для всех операций
CREATE POLICY "work_sessions_full_access" ON work_sessions
FOR ALL 
TO authenticated
USING (
    employee_id IN (
        SELECT id FROM employees WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    employee_id IN (
        SELECT id FROM employees WHERE user_id = auth.uid()
    )
);

-- 3. Убедимся что RLS включена
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Проверяем результат
SELECT 'work_sessions policies after fix' as info;
SELECT 
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'work_sessions';

-- 5. Тестируем доступ для конкретного пользователя
-- Проверяем данные для employee_id = 260
SELECT 'test access for employee 260' as info;
SELECT COUNT(*) as sessions_count
FROM work_sessions 
WHERE employee_id = 260;

-- 6. Проверяем связь между auth.users и employees для employee_id 260
SELECT 'employee 260 user mapping' as info;
SELECT 
    e.id as employee_id,
    e.user_id,
    e.full_name,
    au.email
FROM employees e
LEFT JOIN auth.users au ON e.user_id = au.id
WHERE e.id = 260; 