-- ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ ORPHANED ЗАПИСЕЙ
-- Удаляем все записи, которые ссылаются на несуществующие employee_id

-- Показать проблему
SELECT 'НАЙДЕНЫ ORPHANED ЗАПИСИ В TASK_LOGS:' as status;
SELECT 
    tl.employee_id,
    COUNT(*) as orphaned_count,
    'НЕТ В EMPLOYEES' as problem
FROM task_logs tl
LEFT JOIN employees e ON e.id = tl.employee_id
WHERE e.id IS NULL
GROUP BY tl.employee_id
ORDER BY tl.employee_id;

-- Показать проблему в work_sessions
SELECT 'НАЙДЕНЫ ORPHANED ЗАПИСИ В WORK_SESSIONS:' as status;
SELECT 
    ws.employee_id,
    COUNT(*) as orphaned_count,
    'НЕТ В EMPLOYEES' as problem
FROM work_sessions ws
LEFT JOIN employees e ON e.id = ws.employee_id
WHERE e.id IS NULL
GROUP BY ws.employee_id
ORDER BY ws.employee_id;

-- Показать проблему в active_sessions
SELECT 'НАЙДЕНЫ ORPHANED ЗАПИСИ В ACTIVE_SESSIONS:' as status;
SELECT 
    acs.employee_id,
    COUNT(*) as orphaned_count,
    'НЕТ В EMPLOYEES' as problem
FROM active_sessions acs
LEFT JOIN employees e ON e.id = acs.employee_id
WHERE e.id IS NULL
GROUP BY acs.employee_id
ORDER BY acs.employee_id;

-- УДАЛЯЕМ ВСЕ ORPHANED ЗАПИСИ
BEGIN;

-- 1. Удаляем orphaned записи из task_logs
DELETE FROM task_logs 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

-- 2. Удаляем orphaned записи из work_sessions
DELETE FROM work_sessions 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

-- 3. Удаляем orphaned записи из active_sessions
DELETE FROM active_sessions 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

-- 4. Удаляем orphaned записи из break_logs (если есть)
DELETE FROM break_logs 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

-- 5. Удаляем orphaned записи из employee_prizes (если есть)
DELETE FROM employee_prizes 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

COMMIT;

-- Проверяем результат
SELECT 'РЕЗУЛЬТАТ ОЧИСТКИ:' as status;
SELECT 
    'TASK_LOGS' as table_name,
    COUNT(*) as remaining_records
FROM task_logs
UNION ALL
SELECT 
    'WORK_SESSIONS',
    COUNT(*)
FROM work_sessions
UNION ALL
SELECT 
    'ACTIVE_SESSIONS',
    COUNT(*)
FROM active_sessions
UNION ALL
SELECT 
    'EMPLOYEES',
    COUNT(*)
FROM employees;

SELECT 'ОЧИСТКА ЗАВЕРШЕНА! Теперь можно выполнять миграцию.' as final_status; 