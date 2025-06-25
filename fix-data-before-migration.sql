-- ИСПРАВЛЕНИЕ ДАННЫХ ПЕРЕД МИГРАЦИЕЙ
-- Простое решение проблемы с orphaned записями

-- Шаг 1: Найти все orphaned employee_id
SELECT 'Поиск orphaned записей...' as status;

-- Показать проблемные записи
SELECT 
    'ПРОБЛЕМНЫЕ EMPLOYEE_ID:' as info,
    tl.employee_id,
    COUNT(*) as task_logs_count
FROM task_logs tl
LEFT JOIN employees e ON e.id = tl.employee_id
WHERE e.id IS NULL
GROUP BY tl.employee_id
ORDER BY tl.employee_id;

-- Шаг 2: Удалить orphaned записи (самое простое решение)
BEGIN;

-- Удаляем task_logs без соответствующих employees
DELETE FROM task_logs 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

-- Удаляем work_sessions без соответствующих employees  
DELETE FROM work_sessions 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

-- Удаляем active_sessions без соответствующих employees
DELETE FROM active_sessions 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

-- Удаляем break_logs без соответствующих employees
DELETE FROM break_logs 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

-- Удаляем employee_prizes без соответствующих employees
DELETE FROM employee_prizes 
WHERE employee_id NOT IN (
    SELECT id FROM employees WHERE id IS NOT NULL
);

COMMIT;

-- Шаг 3: Проверка результата
SELECT 'ПРОВЕРКА ПОСЛЕ ОЧИСТКИ:' as status;

SELECT 
    (SELECT COUNT(*) FROM task_logs tl LEFT JOIN employees e ON e.id = tl.employee_id WHERE e.id IS NULL) as orphaned_task_logs,
    (SELECT COUNT(*) FROM work_sessions ws LEFT JOIN employees e ON e.id = ws.employee_id WHERE e.id IS NULL) as orphaned_work_sessions,
    (SELECT COUNT(*) FROM active_sessions as_table LEFT JOIN employees e ON e.id = as_table.employee_id WHERE e.id IS NULL) as orphaned_active_sessions;

SELECT 'ДАННЫЕ ИСПРАВЛЕНЫ - МОЖНО ПРОДОЛЖАТЬ МИГРАЦИЮ' as result; 