-- Быстрая диагностика проблемы с монетами
-- Основные проверки для выявления причины 0 монет у всех пользователей

-- ПРОВЕРКА 1: Есть ли вообще данные в task_logs?
SELECT 
    'TASK_LOGS CHECK' as check_name,
    COUNT(*) as total_task_logs,
    COUNT(DISTINCT employee_id) as unique_employee_ids,
    SUM(units_completed) as total_units_completed
FROM task_logs;

-- ПРОВЕРКА 2: Есть ли совпадения employee_id между таблицами?
SELECT 
    'EMPLOYEE_ID MATCH CHECK' as check_name,
    COUNT(DISTINCT up.employee_id) as users_with_employee_id,
    COUNT(DISTINCT tl.employee_id) as task_logs_with_employee_id,
    COUNT(DISTINCT up.employee_id) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM task_logs tl2 
            WHERE tl2.employee_id = up.employee_id
        )
    ) as matching_employee_ids
FROM user_profiles up
FULL OUTER JOIN task_logs tl ON tl.employee_id = up.employee_id
WHERE up.employee_id IS NOT NULL OR tl.employee_id IS NOT NULL;

-- ПРОВЕРКА 3: Примеры employee_id из обеих таблиц
SELECT 'USER_PROFILES' as source, employee_id, full_name, id::text as additional_info
FROM user_profiles 
WHERE employee_id IS NOT NULL 
LIMIT 3

UNION ALL

SELECT 'TASK_LOGS' as source, employee_id, task_type_id::text, units_completed::text
FROM task_logs 
WHERE employee_id IS NOT NULL 
LIMIT 3;

-- ПРОВЕРКА 4: Проверяем структуру task_logs
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'task_logs' 
ORDER BY ordinal_position;

-- ПРОВЕРКА 5: Тестовый расчет для первого пользователя с данными
WITH first_user_with_tasks AS (
    SELECT up.id, up.full_name, up.employee_id
    FROM user_profiles up
    WHERE EXISTS (
        SELECT 1 FROM task_logs tl 
        WHERE tl.employee_id = up.employee_id
    )
    LIMIT 1
)
SELECT 
    'TEST CALCULATION' as check_name,
    fuwt.full_name,
    fuwt.employee_id,
    COUNT(tl.id) as task_count,
    SUM(tl.units_completed) as total_units,
    SUM(
        CASE 
            WHEN tt.name = 'Актуализация ОСС' THEN tl.units_completed * 15
            WHEN tt.name = 'Обзвоны по рисовке' THEN tl.units_completed * 10
            WHEN tt.name = 'Отчеты физикам (+почта)' THEN tl.units_completed * 12
            WHEN tt.name = 'Протоколы ОСС' THEN tl.units_completed * 25
            WHEN tt.name = 'Внесение решений МЖИ (кол-во бланков)' THEN tl.units_completed * 5
            WHEN tt.name = 'Обходы' THEN tl.units_completed * 25
            WHEN tt.name = 'Работа с нетиповыми обращениями' THEN tl.units_completed * 8
            WHEN tt.name = 'СТП отмена ОСС' THEN tl.units_completed * 12
            WHEN tt.name = 'СТП подселенцы' THEN tl.units_completed * 10
            ELSE tl.units_completed * 5
        END
    ) as calculated_coins
FROM first_user_with_tasks fuwt
LEFT JOIN task_logs tl ON tl.employee_id = fuwt.employee_id
LEFT JOIN task_types tt ON tt.id = tl.task_type_id
GROUP BY fuwt.full_name, fuwt.employee_id; 