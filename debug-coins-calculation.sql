-- Диагностика проблемы с монетами и уровнями после миграции
-- Проверяем связи между user_profiles.employee_id и task_logs.employee_id

-- 1. Проверяем текущих пользователей и их employee_id
SELECT 
    'Current Users' as section,
    up.id as user_id,
    up.employee_id,
    up.full_name,
    up.surname,
    up.patronymic,
    up.office_id
FROM user_profiles up
ORDER BY up.employee_id;

-- 2. Проверяем записи в task_logs и их employee_id
SELECT 
    'Task Logs Summary' as section,
    tl.employee_id,
    COUNT(*) as total_records,
    SUM(tl.units_completed) as total_units,
    MIN(tl.work_date) as first_date,
    MAX(tl.work_date) as last_date
FROM task_logs tl
GROUP BY tl.employee_id
ORDER BY tl.employee_id;

-- 3. Проверяем соответствие между user_profiles и task_logs
SELECT 
    'User-TaskLog Mapping' as section,
    up.full_name,
    up.employee_id as profile_employee_id,
    COALESCE(tl_stats.total_records, 0) as task_records,
    COALESCE(tl_stats.total_units, 0) as total_units,
    COALESCE(tl_stats.estimated_coins, 0) as estimated_coins,
    CASE 
        WHEN tl_stats.total_records IS NULL THEN 'NO TASK LOGS'
        WHEN tl_stats.total_records > 0 THEN 'HAS TASK LOGS'
        ELSE 'UNKNOWN'
    END as status
FROM user_profiles up
LEFT JOIN (
    SELECT 
        tl.employee_id,
        COUNT(*) as total_records,
        SUM(tl.units_completed) as total_units,
        -- Примерный расчет монет (базовая ставка 5 за единицу)
        SUM(tl.units_completed * 5) as estimated_coins
    FROM task_logs tl
    GROUP BY tl.employee_id
) tl_stats ON up.employee_id = tl_stats.employee_id
ORDER BY up.employee_id;

-- 4. Детальная проверка для конкретного пользователя (employee_id = 3)
SELECT 
    'Detailed Check for Employee 3' as section,
    tl.id,
    tl.employee_id,
    tl.task_type_id,
    tt.name as task_name,
    tl.units_completed,
    tl.work_date,
    tl.time_spent_minutes,
    -- Расчет монет по реальным правилам
    CASE 
        WHEN tt.name = 'Актуализация ОСС' THEN tl.units_completed * 15
        WHEN tt.name = 'Обзвоны по рисовке' THEN tl.units_completed * 10
        WHEN tt.name = 'Отчеты физикам (+почта)' THEN tl.units_completed * 12
        WHEN tt.name = 'Протоколы ОСС' THEN tl.units_completed * 25
        WHEN tt.name = 'Внесение решений МЖИ (кол-во бланков)' THEN tl.units_completed * 5
        WHEN tt.name = 'Обходы' THEN tl.units_completed * 25
        ELSE tl.units_completed * 5
    END as calculated_coins
FROM task_logs tl
LEFT JOIN task_types tt ON tt.id = tl.task_type_id
WHERE tl.employee_id = 3
ORDER BY tl.work_date DESC, tl.id DESC;

-- 5. Проверяем, какие пользователи должны видеть монеты
SELECT 
    'Expected Coins by User' as section,
    up.full_name,
    up.employee_id,
    COALESCE(coins_calc.total_coins, 0) as expected_coins,
    COALESCE(coins_calc.total_tasks, 0) as total_tasks,
    COALESCE(coins_calc.total_units, 0) as total_units
FROM user_profiles up
LEFT JOIN (
    SELECT 
        tl.employee_id,
        COUNT(*) as total_tasks,
        SUM(tl.units_completed) as total_units,
        SUM(
            CASE 
                WHEN tt.name = 'Актуализация ОСС' THEN tl.units_completed * 15
                WHEN tt.name = 'Обзвоны по рисовке' THEN tl.units_completed * 10
                WHEN tt.name = 'Отчеты физикам (+почта)' THEN tl.units_completed * 12
                WHEN tt.name = 'Протоколы ОСС' THEN tl.units_completed * 25
                WHEN tt.name = 'Внесение решений МЖИ (кол-во бланков)' THEN tl.units_completed * 5
                WHEN tt.name = 'Обходы' THEN tl.units_completed * 25
                ELSE tl.units_completed * 5
            END
        ) as total_coins
    FROM task_logs tl
    LEFT JOIN task_types tt ON tt.id = tl.task_type_id
    GROUP BY tl.employee_id
) coins_calc ON up.employee_id = coins_calc.employee_id
WHERE up.employee_id IS NOT NULL
ORDER BY expected_coins DESC;

-- 6. Проверяем орфанные записи (если есть)
SELECT 
    'Orphaned Task Logs' as section,
    tl.employee_id,
    COUNT(*) as orphaned_records
FROM task_logs tl
LEFT JOIN user_profiles up ON up.employee_id = tl.employee_id
WHERE up.employee_id IS NULL
GROUP BY tl.employee_id
ORDER BY tl.employee_id; 