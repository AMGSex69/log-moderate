-- Проверка реального состояния синхронизации
-- Показываем всех пользователей и их монеты

-- 1. ВСЕ пользователи с их монетами и уровнями
SELECT 
    up.id,
    up.full_name,
    up.employee_id,
    up.coins,
    up.level,
    up.experience,
    o.name as office_name,
    up.updated_at
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.employee_id IS NOT NULL
ORDER BY up.coins DESC;

-- 2. Статистика по синхронизации
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN coins > 0 THEN 1 END) as users_with_coins,
    COUNT(CASE WHEN coins = 0 THEN 1 END) as users_with_zero_coins,
    SUM(coins) as total_coins,
    AVG(coins) as avg_coins,
    MAX(coins) as max_coins,
    MIN(coins) as min_coins
FROM user_profiles 
WHERE employee_id IS NOT NULL;

-- 3. Пользователи без монет (возможно, проблема с employee_id)
SELECT 
    up.full_name,
    up.employee_id,
    up.coins,
    COUNT(tl.id) as task_logs_count,
    SUM(tl.units_completed) as total_units
FROM user_profiles up
LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
WHERE up.employee_id IS NOT NULL
AND up.coins = 0
GROUP BY up.id, up.full_name, up.employee_id, up.coins
ORDER BY task_logs_count DESC;

-- 4. Проверяем конкретных пользователей
SELECT 
    'Ксения Червякова' as check_user,
    up.full_name,
    up.employee_id,
    up.coins,
    up.level,
    COUNT(tl.id) as task_count
FROM user_profiles up
LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
WHERE up.full_name ILIKE '%червяков%'
GROUP BY up.id, up.full_name, up.employee_id, up.coins, up.level

UNION ALL

SELECT 
    'Долгих Егор' as check_user,
    up.full_name,
    up.employee_id,
    up.coins,
    up.level,
    COUNT(tl.id) as task_count
FROM user_profiles up
LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
WHERE up.full_name ILIKE '%долгих%'
GROUP BY up.id, up.full_name, up.employee_id, up.coins, up.level;

-- 5. Проверяем есть ли пользователи с task_logs но без монет
SELECT 
    up.full_name,
    up.employee_id,
    up.coins,
    COUNT(tl.id) as has_tasks,
    SUM(tl.units_completed) as total_units,
    'Должен иметь монеты, но их нет' as issue
FROM user_profiles up
JOIN task_logs tl ON tl.employee_id = up.employee_id
WHERE up.coins = 0
GROUP BY up.id, up.full_name, up.employee_id, up.coins
HAVING COUNT(tl.id) > 0; 