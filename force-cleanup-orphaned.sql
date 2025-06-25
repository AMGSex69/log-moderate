-- ПРИНУДИТЕЛЬНАЯ ОЧИСТКА ВСЕХ ORPHANED ЗАПИСЕЙ
-- ВНИМАНИЕ: Этот скрипт удалит ВСЕ записи без соответствующих employees

BEGIN;

SELECT 'НАЧИНАЕМ ПРИНУДИТЕЛЬНУЮ ОЧИСТКУ...' as status;

-- Показываем что будем удалять
SELECT 'ORPHANED ЗАПИСИ ДЛЯ УДАЛЕНИЯ:' as info;

-- task_logs
SELECT 
    'TASK_LOGS' as table_name,
    tl.employee_id,
    COUNT(*) as records_to_delete
FROM task_logs tl
LEFT JOIN employees e ON e.id = tl.employee_id
WHERE e.id IS NULL
GROUP BY tl.employee_id
ORDER BY tl.employee_id;

-- work_sessions  
SELECT 
    'WORK_SESSIONS' as table_name,
    ws.employee_id,
    COUNT(*) as records_to_delete
FROM work_sessions ws
LEFT JOIN employees e ON e.id = ws.employee_id
WHERE e.id IS NULL
GROUP BY ws.employee_id
ORDER BY ws.employee_id;

-- active_sessions
SELECT 
    'ACTIVE_SESSIONS' as table_name,
    as_table.employee_id,
    COUNT(*) as records_to_delete
FROM active_sessions as_table
LEFT JOIN employees e ON e.id = as_table.employee_id
WHERE e.id IS NULL
GROUP BY as_table.employee_id
ORDER BY as_table.employee_id;

-- УДАЛЯЕМ ВСЕ ORPHANED ЗАПИСИ

-- 1. Удаляем из task_logs
DELETE FROM task_logs 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

SELECT 'УДАЛЕНЫ ORPHANED TASK_LOGS' as status;

-- 2. Удаляем из work_sessions
DELETE FROM work_sessions 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

SELECT 'УДАЛЕНЫ ORPHANED WORK_SESSIONS' as status;

-- 3. Удаляем из active_sessions
DELETE FROM active_sessions 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

SELECT 'УДАЛЕНЫ ORPHANED ACTIVE_SESSIONS' as status;

-- 4. Удаляем из break_logs (если существует)
DELETE FROM break_logs 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

SELECT 'УДАЛЕНЫ ORPHANED BREAK_LOGS' as status;

-- 5. Удаляем из employee_prizes (если существует)
DELETE FROM employee_prizes 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

SELECT 'УДАЛЕНЫ ORPHANED EMPLOYEE_PRIZES' as status;

-- Проверяем результат
SELECT 'ПРОВЕРКА ПОСЛЕ ОЧИСТКИ:' as info;

-- Проверяем что orphaned записей больше нет
SELECT 
    'TASK_LOGS' as table_name,
    COUNT(*) as remaining_orphaned
FROM task_logs tl
LEFT JOIN employees e ON e.id = tl.employee_id
WHERE e.id IS NULL

UNION ALL

SELECT 
    'WORK_SESSIONS' as table_name,
    COUNT(*) as remaining_orphaned
FROM work_sessions ws
LEFT JOIN employees e ON e.id = ws.employee_id
WHERE e.id IS NULL

UNION ALL

SELECT 
    'ACTIVE_SESSIONS' as table_name,
    COUNT(*) as remaining_orphaned
FROM active_sessions as_table
LEFT JOIN employees e ON e.id = as_table.employee_id
WHERE e.id IS NULL;

SELECT 'ОЧИСТКА ЗАВЕРШЕНА!' as status;

COMMIT; 