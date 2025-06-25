-- Исправление пропущенных пользователей в синхронизации монет
-- Обновляем пользователей, которые имеют задачи, но 0 монет

BEGIN;

-- Сначала проверим, кого мы будем обновлять
SELECT 
    'USERS TO UPDATE' as status,
    up.full_name,
    up.employee_id,
    up.coins as current_coins,
    COUNT(tl.id) as task_count,
    SUM(tl.units_completed) as total_units
FROM user_profiles up
JOIN task_logs tl ON tl.employee_id = up.employee_id
WHERE up.coins = 0
AND up.employee_id IS NOT NULL
GROUP BY up.id, up.full_name, up.employee_id, up.coins
ORDER BY total_units DESC;

-- Обновляем пользователей с 0 монет, но с задачами
UPDATE user_profiles 
SET 
    coins = COALESCE(calculated_stats.total_coins, 0),
    experience = COALESCE(calculated_stats.total_coins, 0),
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
                -- Основные типы задач
                WHEN tt.name = 'Актуализация ОСС' THEN tl.units_completed * 15
                WHEN tt.name = 'Обзвоны по рисовке' THEN tl.units_completed * 10
                WHEN tt.name = 'Отчеты физикам (+почта)' THEN tl.units_completed * 12
                WHEN tt.name = 'Протоколы ОСС' THEN tl.units_completed * 25
                WHEN tt.name = 'Внесение решений МЖИ (кол-во бланков)' THEN tl.units_completed * 5
                WHEN tt.name = 'Обходы' THEN tl.units_completed * 25
                WHEN tt.name = 'Работа с нетиповыми обращениями' THEN tl.units_completed * 8
                WHEN tt.name = 'СТП отмена ОСС' THEN tl.units_completed * 12
                WHEN tt.name = 'СТП подселенцы' THEN tl.units_completed * 10
                
                -- Задачи для офиса "Экран"
                WHEN tt.name = 'Обработка видеоматериалов' THEN tl.units_completed * 20
                WHEN tt.name = 'Монтаж роликов' THEN tl.units_completed * 25
                WHEN tt.name = 'Создание графики' THEN tl.units_completed * 18
                WHEN tt.name = 'Работа с звуком' THEN tl.units_completed * 15
                WHEN tt.name = 'Цветокоррекция' THEN tl.units_completed * 22
                WHEN tt.name = 'Анимация' THEN tl.units_completed * 30
                WHEN tt.name = 'Рендеринг' THEN tl.units_completed * 12
                WHEN tt.name = 'Архивирование' THEN tl.units_completed * 8
                WHEN tt.name = 'Техническая поддержка' THEN tl.units_completed * 10
                WHEN tt.name = 'Контроль качества' THEN tl.units_completed * 16
                
                -- Для всех остальных задач
                ELSE tl.units_completed * 5
            END
        ), 0) as total_coins
    FROM user_profiles up
    JOIN task_logs tl ON CAST(tl.employee_id AS TEXT) = CAST(up.employee_id AS TEXT)
    LEFT JOIN task_types tt ON tt.id = tl.task_type_id
    WHERE up.employee_id IS NOT NULL
    AND up.coins = 0  -- Только пользователи с 0 монет
    GROUP BY up.employee_id
) calculated_stats
WHERE CAST(user_profiles.employee_id AS TEXT) = CAST(calculated_stats.employee_id AS TEXT)
AND user_profiles.coins = 0
AND user_profiles.employee_id IS NOT NULL;

-- Проверяем результат
SELECT 
    'AFTER FIX' as status,
    up.full_name,
    up.employee_id,
    up.coins,
    up.level,
    COUNT(tl.id) as task_count
FROM user_profiles up
LEFT JOIN task_logs tl ON CAST(tl.employee_id AS TEXT) = CAST(up.employee_id AS TEXT)
WHERE up.employee_id IS NOT NULL
GROUP BY up.id, up.full_name, up.employee_id, up.coins, up.level
ORDER BY up.coins DESC;

COMMIT;

-- Финальная статистика
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN coins > 0 THEN 1 END) as users_with_coins,
    COUNT(CASE WHEN coins = 0 THEN 1 END) as users_with_zero_coins,
    SUM(coins) as total_coins,
    'Исправление синхронизации завершено' as message
FROM user_profiles 
WHERE employee_id IS NOT NULL; 