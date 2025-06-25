-- ДИАГНОСТИКА И ИСПРАВЛЕНИЕ ПРОБЛЕМЫ МИГРАЦИИ
-- Проверяем несоответствия в данных

-- ===========================================
-- ШАГ 1: ДИАГНОСТИКА ПРОБЛЕМЫ
-- ===========================================

SELECT 'ДИАГНОСТИКА ПРОБЛЕМЫ:' as info;

-- Проверяем количество записей в таблицах
SELECT 
    'ОБЩАЯ СТАТИСТИКА:' as section,
    (SELECT COUNT(*) FROM user_profiles) as user_profiles_count,
    (SELECT COUNT(*) FROM employees) as employees_count,
    (SELECT COUNT(*) FROM task_logs) as task_logs_count,
    (SELECT COUNT(*) FROM work_sessions) as work_sessions_count,
    (SELECT COUNT(*) FROM active_sessions) as active_sessions_count;

-- Проверяем orphaned записи в task_logs
SELECT 'ORPHANED TASK_LOGS:' as section;
SELECT 
    tl.employee_id,
    COUNT(*) as orphaned_records
FROM task_logs tl
LEFT JOIN employees e ON e.id = tl.employee_id
WHERE e.id IS NULL
GROUP BY tl.employee_id
ORDER BY tl.employee_id;

-- Проверяем orphaned записи в work_sessions
SELECT 'ORPHANED WORK_SESSIONS:' as section;
SELECT 
    ws.employee_id,
    COUNT(*) as orphaned_records
FROM work_sessions ws
LEFT JOIN employees e ON e.id = ws.employee_id
WHERE e.id IS NULL
GROUP BY ws.employee_id
ORDER BY ws.employee_id;

-- Проверяем orphaned записи в active_sessions
SELECT 'ORPHANED ACTIVE_SESSIONS:' as section;
SELECT 
    as_table.employee_id,
    COUNT(*) as orphaned_records
FROM active_sessions as_table
LEFT JOIN employees e ON e.id = as_table.employee_id
WHERE e.id IS NULL
GROUP BY as_table.employee_id
ORDER BY as_table.employee_id;

-- Проверяем, есть ли пользователи без employee_id в user_profiles
SELECT 'USER_PROFILES БЕЗ EMPLOYEE_ID:' as section;
SELECT 
    COUNT(*) as profiles_without_employee_id
FROM user_profiles 
WHERE employee_id IS NULL;

-- Показываем примеры таких профилей
SELECT 'ПРИМЕРЫ ПРОФИЛЕЙ БЕЗ EMPLOYEE_ID:' as section;
SELECT id, full_name, email, created_at
FROM user_profiles 
WHERE employee_id IS NULL
LIMIT 5;

-- ===========================================
-- ШАГ 2: ИСПРАВЛЕНИЕ ORPHANED ЗАПИСЕЙ
-- ===========================================

-- Создаем временную таблицу для хранения orphaned employee_id
DROP TABLE IF EXISTS temp_orphaned_employees;
CREATE TEMP TABLE temp_orphaned_employees AS
SELECT DISTINCT employee_id
FROM (
    SELECT employee_id FROM task_logs
    UNION
    SELECT employee_id FROM work_sessions  
    UNION
    SELECT employee_id FROM active_sessions
    UNION
    SELECT employee_id FROM break_logs
    UNION 
    SELECT employee_id FROM employee_prizes
) all_employee_ids
WHERE employee_id NOT IN (SELECT id FROM employees WHERE id IS NOT NULL);

SELECT 'НАЙДЕНО ORPHANED EMPLOYEE_IDS:' as info;
SELECT * FROM temp_orphaned_employees ORDER BY employee_id;

-- ===========================================
-- ШАГ 3: ВАРИАНТЫ РЕШЕНИЯ
-- ===========================================

SELECT 'ВАРИАНТЫ РЕШЕНИЯ:' as info;

-- Вариант 1: Удалить orphaned записи
SELECT 'ВАРИАНТ 1 - УДАЛЕНИЕ ORPHANED ЗАПИСЕЙ:' as option;
SELECT 
    (SELECT COUNT(*) FROM task_logs WHERE employee_id IN (SELECT employee_id FROM temp_orphaned_employees)) as task_logs_to_delete,
    (SELECT COUNT(*) FROM work_sessions WHERE employee_id IN (SELECT employee_id FROM temp_orphaned_employees)) as work_sessions_to_delete,
    (SELECT COUNT(*) FROM active_sessions WHERE employee_id IN (SELECT employee_id FROM temp_orphaned_employees)) as active_sessions_to_delete;

-- Вариант 2: Создать недостающие записи в employees (если возможно найти user_id)
SELECT 'ВАРИАНТ 2 - СОЗДАНИЕ НЕДОСТАЮЩИХ EMPLOYEES:' as option;

-- Пытаемся найти соответствие через user_profiles
SELECT 
    toe.employee_id as missing_employee_id,
    up.id as user_id,
    up.full_name,
    up.email
FROM temp_orphaned_employees toe
LEFT JOIN user_profiles up ON up.employee_id = toe.employee_id
ORDER BY toe.employee_id;

-- ===========================================
-- ШАГ 4: БЕЗОПАСНОЕ ИСПРАВЛЕНИЕ
-- ===========================================

BEGIN;

-- Сначала попробуем создать недостающие записи employees из user_profiles
INSERT INTO employees (
    id, user_id, full_name, email, position, is_admin, 
    work_schedule, work_hours, office_id, is_active, created_at, updated_at
)
SELECT 
    up.employee_id,
    up.id,
    up.full_name,
    COALESCE(up.email, 'unknown@example.com'),
    up.position,
    up.is_admin,
    up.work_schedule,
    up.work_hours,
    up.office_id,
    COALESCE(up.is_active, true),
    COALESCE(up.created_at, NOW()),
    COALESCE(up.updated_at, NOW())
FROM user_profiles up
JOIN temp_orphaned_employees toe ON toe.employee_id = up.employee_id
WHERE up.employee_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Проверяем, сколько записей создали
SELECT 'СОЗДАНО EMPLOYEES ЗАПИСЕЙ:' as info;
SELECT COUNT(*) as created_records
FROM employees e
JOIN temp_orphaned_employees toe ON toe.employee_id = e.id;

-- Проверяем, остались ли orphaned записи
DROP TABLE IF EXISTS temp_still_orphaned;
CREATE TEMP TABLE temp_still_orphaned AS
SELECT employee_id
FROM temp_orphaned_employees
WHERE employee_id NOT IN (SELECT id FROM employees WHERE id IS NOT NULL);

SELECT 'ОСТАЛИСЬ ORPHANED:' as info;
SELECT COUNT(*) as still_orphaned FROM temp_still_orphaned;

-- Если остались orphaned записи, удаляем их
DELETE FROM task_logs WHERE employee_id IN (SELECT employee_id FROM temp_still_orphaned);
DELETE FROM work_sessions WHERE employee_id IN (SELECT employee_id FROM temp_still_orphaned);
DELETE FROM active_sessions WHERE employee_id IN (SELECT employee_id FROM temp_still_orphaned);
DELETE FROM break_logs WHERE employee_id IN (SELECT employee_id FROM temp_still_orphaned);
DELETE FROM employee_prizes WHERE employee_id IN (SELECT employee_id FROM temp_still_orphaned);

-- Показываем количество удаленных записей
SELECT 'УДАЛЕНО ORPHANED ЗАПИСЕЙ:' as info;
SELECT ROW_COUNT() as deleted_records;

COMMIT;

-- ===========================================
-- ШАГ 5: ФИНАЛЬНАЯ ПРОВЕРКА
-- ===========================================

SELECT 'ФИНАЛЬНАЯ ПРОВЕРКА:' as info;

-- Проверяем, что больше нет orphaned записей
SELECT 
    'ПРОВЕРКА ЦЕЛОСТНОСТИ:' as section,
    (SELECT COUNT(*) FROM task_logs tl LEFT JOIN employees e ON e.id = tl.employee_id WHERE e.id IS NULL) as orphaned_task_logs,
    (SELECT COUNT(*) FROM work_sessions ws LEFT JOIN employees e ON e.id = ws.employee_id WHERE e.id IS NULL) as orphaned_work_sessions,
    (SELECT COUNT(*) FROM active_sessions as_table LEFT JOIN employees e ON e.id = as_table.employee_id WHERE e.id IS NULL) as orphaned_active_sessions;

SELECT 'ГОТОВНОСТЬ К ПРОДОЛЖЕНИЮ МИГРАЦИИ:' as status;
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM task_logs tl LEFT JOIN employees e ON e.id = tl.employee_id WHERE e.id IS NULL) = 0
        AND (SELECT COUNT(*) FROM work_sessions ws LEFT JOIN employees e ON e.id = ws.employee_id WHERE e.id IS NULL) = 0
        AND (SELECT COUNT(*) FROM active_sessions as_table LEFT JOIN employees e ON e.id = as_table.employee_id WHERE e.id IS NULL) = 0
        THEN 'ГОТОВО - можно продолжать миграцию'
        ELSE 'НЕ ГОТОВО - есть проблемы с данными'
    END as migration_readiness;