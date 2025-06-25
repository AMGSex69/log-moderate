-- ДИАГНОСТИКА: Проверяем данные в task_logs после миграции

-- 1. Проверяем общее количество записей
SELECT 'ОБЩИЕ ДАННЫЕ:' as info;
SELECT 
    (SELECT COUNT(*) FROM user_profiles) as user_profiles_count,
    (SELECT COUNT(*) FROM user_profiles WHERE employee_id IS NOT NULL) as profiles_with_employee_id,
    (SELECT COUNT(*) FROM task_logs) as task_logs_count,
    (SELECT COUNT(*) FROM task_types) as task_types_count;

-- 2. Проверяем связь task_logs с user_profiles
SELECT 'СВЯЗЬ task_logs с user_profiles:' as info;
SELECT 
    COUNT(*) as total_task_logs,
    COUNT(CASE WHEN up.id IS NOT NULL THEN 1 END) as linked_to_profiles,
    COUNT(CASE WHEN up.id IS NULL THEN 1 END) as orphaned_logs
FROM task_logs tl
LEFT JOIN user_profiles up ON up.employee_id = tl.employee_id;

-- 3. Показываем примеры данных task_logs
SELECT 'ПРИМЕРЫ task_logs:' as info;
SELECT 
    tl.id,
    tl.employee_id,
    tl.units_completed,
    tl.work_date,
    tt.name as task_name,
    up.full_name as employee_name
FROM task_logs tl
LEFT JOIN task_types tt ON tt.id = tl.task_type_id
LEFT JOIN user_profiles up ON up.employee_id = tl.employee_id
ORDER BY tl.created_at DESC
LIMIT 10;

-- 4. Проверяем employee_id в user_profiles
SELECT 'EMPLOYEE_ID в user_profiles:' as info;
SELECT 
    id,
    full_name,
    employee_id,
    office_id
FROM user_profiles 
WHERE employee_id IS NOT NULL
ORDER BY employee_id;

-- 5. Рассчитываем монеты для конкретного пользователя
SELECT 'РАСЧЕТ МОНЕТ для b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5:' as info;
SELECT 
    up.full_name,
    up.employee_id,
    COUNT(tl.id) as total_tasks,
    SUM(tl.units_completed) as total_units,
    SUM(tl.time_spent_minutes) as total_minutes,
    -- Примерный расчет монет (базовая награда 5 за единицу)
    SUM(tl.units_completed * 5) as estimated_coins
FROM user_profiles up
LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'
GROUP BY up.id, up.full_name, up.employee_id;

-- 6. Проверяем task_types
SELECT 'ТИПЫ ЗАДАЧ:' as info;
SELECT id, name FROM task_types ORDER BY id LIMIT 10; 