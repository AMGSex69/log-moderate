-- Синхронизация игровых статистик в user_profiles с реальными данными из task_logs
-- Обновляем coins, experience, level на основе фактических данных

BEGIN;

-- Обновляем игровые статистики для каждого пользователя
UPDATE user_profiles 
SET 
    coins = COALESCE(calculated_stats.total_coins, 0),
    experience = COALESCE(calculated_stats.total_coins, 0), -- Опыт = монеты
    level = CASE 
        WHEN COALESCE(calculated_stats.total_coins, 0) >= 2300 THEN 10
        WHEN COALESCE(calculated_stats.total_coins, 0) >= 1850 THEN 9
        WHEN COALESCE(calculated_stats.total_coins, 0) >= 1450 THEN 8
        WHEN COALESCE(calculated_stats.total_coins, 0) >= 1100 THEN 7
        WHEN COALESCE(calculated_stats.total_coins, 0) >= 800 THEN 6
        WHEN COALESCE(calculated_stats.total_coins, 0) >= 550 THEN 5
        WHEN COALESCE(calculated_stats.total_coins, 0) >= 350 THEN 4
        WHEN COALESCE(calculated_stats.total_coins, 0) >= 200 THEN 3
        WHEN COALESCE(calculated_stats.total_coins, 0) >= 100 THEN 2
        WHEN COALESCE(calculated_stats.total_coins, 0) >= 50 THEN 1
        ELSE 1
    END,
    updated_at = NOW()
FROM (
    SELECT 
        up.employee_id,
        COALESCE(SUM(
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
                ELSE tl.units_completed * 5 -- базовая награда
            END
        ), 0) as total_coins
    FROM user_profiles up
    LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
    LEFT JOIN task_types tt ON tt.id = tl.task_type_id
    WHERE up.employee_id IS NOT NULL
    GROUP BY up.employee_id
) calculated_stats
WHERE user_profiles.employee_id = calculated_stats.employee_id
AND user_profiles.employee_id IS NOT NULL;

-- Проверяем результат
SELECT 
    up.id,
    up.full_name,
    up.employee_id,
    up.coins,
    up.experience,
    up.level,
    up.office_id,
    COUNT(tl.id) as task_count
FROM user_profiles up
LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
WHERE up.employee_id IS NOT NULL
GROUP BY up.id, up.full_name, up.employee_id, up.coins, up.experience, up.level, up.office_id
ORDER BY up.coins DESC;

COMMIT;

-- Информация о выполненной операции
SELECT 
    COUNT(*) as total_users_synced,
    SUM(coins) as total_coins_distributed,
    AVG(level) as avg_level,
    'Игровые статистики синхронизированы с реальными данными' as message
FROM user_profiles 
WHERE employee_id IS NOT NULL; 