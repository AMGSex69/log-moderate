-- Простая проверка данных для выявления проблемы с монетами

-- 1. Сколько записей в каждой таблице?
SELECT 'user_profiles' as table_name, COUNT(*) as count FROM user_profiles
UNION ALL
SELECT 'task_logs' as table_name, COUNT(*) as count FROM task_logs
UNION ALL
SELECT 'task_types' as table_name, COUNT(*) as count FROM task_types;

-- 2. Есть ли данные в task_logs?
SELECT 
    COUNT(*) as total_task_logs,
    COUNT(DISTINCT employee_id) as unique_employee_ids,
    SUM(units_completed) as total_units
FROM task_logs;

-- 3. Есть ли пользователи с employee_id?
SELECT 
    COUNT(*) as total_users,
    COUNT(employee_id) as users_with_employee_id
FROM user_profiles;

-- 4. Совпадают ли employee_id?
SELECT 
    COUNT(DISTINCT up.employee_id) as users_employee_ids,
    COUNT(DISTINCT tl.employee_id) as task_logs_employee_ids
FROM user_profiles up, task_logs tl
WHERE up.employee_id IS NOT NULL AND tl.employee_id IS NOT NULL;

-- 5. Первые 3 записи из каждой таблицы
SELECT 'USER_PROFILES' as source, employee_id, full_name FROM user_profiles WHERE employee_id IS NOT NULL LIMIT 3;
SELECT 'TASK_LOGS' as source, employee_id, task_type_id::text as info FROM task_logs WHERE employee_id IS NOT NULL LIMIT 3; 