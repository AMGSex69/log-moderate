-- Проверка RLS политик для work_sessions и диагностика 406 ошибок

-- 1. Проверяем все RLS политики на work_sessions
SELECT 'work_sessions RLS policies' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'work_sessions';

-- 2. Проверяем, включена ли RLS на таблице
SELECT 'RLS status on work_sessions' as info;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    forcerowsecurity as force_rls
FROM pg_tables 
WHERE tablename = 'work_sessions';

-- 3. Проверяем данные для конкретного пользователя (employee_id = 260)
SELECT 'work_sessions data for employee 260' as info;
SELECT 
    id,
    employee_id,
    date,
    clock_in_time,
    clock_out_time,
    created_at
FROM work_sessions 
WHERE employee_id = 260
ORDER BY date DESC
LIMIT 5;

-- 4. Проверяем связь с employees таблицей
SELECT 'employee 260 details' as info;
SELECT 
    e.id as employee_id,
    e.user_id,
    e.full_name,
    e.email,
    au.id as auth_user_id,
    au.email as auth_email
FROM employees e
LEFT JOIN auth.users au ON e.user_id = au.id
WHERE e.id = 260;

-- 5. Проверяем текущую сессию auth.uid()
SELECT 'current auth context' as info;
SELECT 
    auth.uid() as current_user_id,
    auth.email() as current_email,
    current_user as db_user;

-- 6. Тестируем доступ с подстановкой правильного пользователя
-- (это покажет, работает ли политика в принципе)
SET LOCAL row_security = off;
SELECT 'work_sessions without RLS' as info;
SELECT 
    id,
    employee_id,
    date,
    clock_in_time,
    clock_out_time
FROM work_sessions 
WHERE employee_id = 260 AND date = '2025-06-05'
LIMIT 1;
SET LOCAL row_security = on;

-- 7. Проверим политики более детально
SELECT 'detailed RLS policy analysis' as info;
SELECT 
    policyname,
    permissive,
    cmd,
    qual as policy_condition
FROM pg_policies 
WHERE tablename = 'work_sessions'
ORDER BY policyname; 