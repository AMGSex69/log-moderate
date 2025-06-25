-- Простая проверка связи между user_profiles и task_logs

-- 1. Пользователи с employee_id
SELECT 
    up.full_name,
    up.employee_id,
    up.office_id
FROM user_profiles up
WHERE up.employee_id IS NOT NULL
ORDER BY up.employee_id;

-- 2. Сводка по task_logs
SELECT 
    tl.employee_id,
    COUNT(*) as records_count,
    SUM(tl.units_completed) as total_units
FROM task_logs tl
GROUP BY tl.employee_id
ORDER BY tl.employee_id;

-- 3. Соответствие между пользователями и их задачами
SELECT 
    up.full_name,
    up.employee_id as profile_emp_id,
    COALESCE(tl_stats.records_count, 0) as task_records,
    COALESCE(tl_stats.total_units, 0) as total_units
FROM user_profiles up
LEFT JOIN (
    SELECT 
        employee_id,
        COUNT(*) as records_count,
        SUM(units_completed) as total_units
    FROM task_logs
    GROUP BY employee_id
) tl_stats ON up.employee_id = tl_stats.employee_id
WHERE up.employee_id IS NOT NULL
ORDER BY up.employee_id; 