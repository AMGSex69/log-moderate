-- Проверка расчета монет - выявляем ошибки в формуле

-- 1. Топ пользователей по монетам (возможно, есть ошибки)
SELECT 
    up.full_name,
    up.employee_id,
    up.coins,
    up.level,
    o.name as office_name
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.coins > 0
ORDER BY up.coins DESC
LIMIT 10;

-- 2. Детальный расчет для пользователя с максимальными монетами
WITH max_coins_user AS (
    SELECT employee_id, coins
    FROM user_profiles 
    WHERE coins = (SELECT MAX(coins) FROM user_profiles)
    LIMIT 1
)
SELECT 
    tt.name as task_type,
    COUNT(tl.id) as task_count,
    SUM(tl.units_completed) as total_units,
    CASE 
        WHEN tt.name = 'Актуализация ОСС' THEN 15
        WHEN tt.name = 'Обзвоны по рисовке' THEN 10
        WHEN tt.name = 'Отчеты физикам (+почта)' THEN 12
        WHEN tt.name = 'Протоколы ОСС' THEN 25
        WHEN tt.name = 'Внесение решений МЖИ (кол-во бланков)' THEN 5
        WHEN tt.name = 'Обходы' THEN 25
        WHEN tt.name = 'Работа с нетиповыми обращениями' THEN 8
        WHEN tt.name = 'СТП отмена ОСС' THEN 12
        WHEN tt.name = 'СТП подселенцы' THEN 10
        ELSE 5
    END as coins_per_unit,
    SUM(tl.units_completed) * CASE 
        WHEN tt.name = 'Актуализация ОСС' THEN 15
        WHEN tt.name = 'Обзвоны по рисовке' THEN 10
        WHEN tt.name = 'Отчеты физикам (+почта)' THEN 12
        WHEN tt.name = 'Протоколы ОСС' THEN 25
        WHEN tt.name = 'Внесение решений МЖИ (кол-во бланков)' THEN 5
        WHEN tt.name = 'Обходы' THEN 25
        WHEN tt.name = 'Работа с нетиповыми обращениями' THEN 8
        WHEN tt.name = 'СТП отмена ОСС' THEN 12
        WHEN tt.name = 'СТП подселенцы' THEN 10
        ELSE 5
    END as calculated_coins
FROM max_coins_user mcu
JOIN task_logs tl ON tl.employee_id = mcu.employee_id
JOIN task_types tt ON tt.id = tl.task_type_id
GROUP BY tt.name
ORDER BY calculated_coins DESC;

-- 3. Проверяем максимальные значения units_completed
SELECT 
    tt.name as task_type,
    MAX(tl.units_completed) as max_units,
    AVG(tl.units_completed) as avg_units,
    COUNT(tl.id) as total_records
FROM task_logs tl
JOIN task_types tt ON tt.id = tl.task_type_id
GROUP BY tt.name
ORDER BY max_units DESC;

-- 4. Проверяем записи с аномально большими units_completed
SELECT 
    up.full_name,
    tt.name as task_type,
    tl.units_completed,
    tl.created_at,
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
    END as coins_for_task
FROM task_logs tl
JOIN task_types tt ON tt.id = tl.task_type_id
JOIN user_profiles up ON up.employee_id = tl.employee_id
WHERE tl.units_completed > 1000  -- Ищем аномально большие значения
ORDER BY tl.units_completed DESC
LIMIT 20;

-- 5. Статистика по разумным значениям (предполагаем, что больше 10000 монет - ошибка)
SELECT 
    'REASONABLE COINS' as category,
    COUNT(*) as user_count,
    AVG(coins) as avg_coins,
    MAX(coins) as max_coins
FROM user_profiles 
WHERE coins BETWEEN 1 AND 10000
UNION ALL
SELECT 
    'EXCESSIVE COINS' as category,
    COUNT(*) as user_count,
    AVG(coins) as avg_coins,
    MAX(coins) as max_coins
FROM user_profiles 
WHERE coins > 10000; 