-- ПРОВЕРКА ORPHANED ЗАПИСЕЙ
-- Проверяем все таблицы на наличие orphaned записей

SELECT '=== ПРОВЕРКА ORPHANED ЗАПИСЕЙ ===' as title;

-- 1. Проверяем task_logs
SELECT 'ORPHANED TASK_LOGS' as section;
SELECT 
    tl.employee_id,
    COUNT(*) as count,
    'НЕТ В EMPLOYEES' as problem
FROM task_logs tl
LEFT JOIN employees e ON e.id = tl.employee_id
WHERE e.id IS NULL
GROUP BY tl.employee_id
ORDER BY tl.employee_id;

-- 2. Проверяем work_sessions
SELECT 'ORPHANED WORK_SESSIONS' as section;
SELECT 
    ws.employee_id,
    COUNT(*) as count,
    'НЕТ В EMPLOYEES' as problem
FROM work_sessions ws
LEFT JOIN employees e ON e.id = ws.employee_id
WHERE e.id IS NULL
GROUP BY ws.employee_id
ORDER BY ws.employee_id;

-- 3. Проверяем active_sessions
SELECT 'ORPHANED ACTIVE_SESSIONS' as section;
SELECT 
    as_table.employee_id,
    COUNT(*) as count,
    'НЕТ В EMPLOYEES' as problem
FROM active_sessions as_table
LEFT JOIN employees e ON e.id = as_table.employee_id
WHERE e.id IS NULL
GROUP BY as_table.employee_id
ORDER BY as_table.employee_id;

-- 4. Проверяем break_logs (если существует)
SELECT 'ORPHANED BREAK_LOGS' as section;
SELECT 
    bl.employee_id,
    COUNT(*) as count,
    'НЕТ В EMPLOYEES' as problem
FROM break_logs bl
LEFT JOIN employees e ON e.id = bl.employee_id
WHERE e.id IS NULL
GROUP BY bl.employee_id
ORDER BY bl.employee_id;

-- 5. Проверяем employee_prizes (если существует)
SELECT 'ORPHANED EMPLOYEE_PRIZES' as section;
SELECT 
    ep.employee_id,
    COUNT(*) as count,
    'НЕТ В EMPLOYEES' as problem
FROM employee_prizes ep
LEFT JOIN employees e ON e.id = ep.employee_id
WHERE e.id IS NULL
GROUP BY ep.employee_id
ORDER BY ep.employee_id;

-- 6. Общая статистика
SELECT 'ОБЩАЯ СТАТИСТИКА' as section;
SELECT 
    'EMPLOYEES' as table_name,
    COUNT(*) as total_records
FROM employees

UNION ALL

SELECT 
    'TASK_LOGS' as table_name,
    COUNT(*) as total_records
FROM task_logs

UNION ALL

SELECT 
    'WORK_SESSIONS' as table_name,
    COUNT(*) as total_records
FROM work_sessions

UNION ALL

SELECT 
    'ACTIVE_SESSIONS' as table_name,
    COUNT(*) as total_records
 