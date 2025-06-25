-- Полная синхронизация игровых статистик в user_profiles
-- Обновляем coins, experience, level на основе фактических данных из task_logs
-- Включает проверку всех пользователей и их статистик

BEGIN;

-- Сначала проверим текущее состояние
SELECT 
    'BEFORE SYNC' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN coins > 0 THEN 1 END) as users_with_coins,
    COUNT(CASE WHEN level > 1 THEN 1 END) as users_with_levels,
    SUM(COALESCE(coins, 0)) as total_coins,
    AVG(COALESCE(level, 1)) as avg_level
FROM user_profiles 
WHERE employee_id IS NOT NULL;

-- Обновляем игровые статистики для ВСЕХ пользователей
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
    LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
    LEFT JOIN task_types tt ON tt.id = tl.task_type_id
    WHERE up.employee_id IS NOT NULL
    GROUP BY up.employee_id
) calculated_stats
WHERE user_profiles.employee_id = calculated_stats.employee_id
AND user_profiles.employee_id IS NOT NULL;

-- Устанавливаем 0 монет для пользователей без employee_id
UPDATE user_profiles 
SET 
    coins = 0,
    experience = 0,
    level = 1,
    updated_at = NOW()
WHERE employee_id IS NULL;

-- Проверяем результат ПОСЛЕ синхронизации
SELECT 
    'AFTER SYNC' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN coins > 0 THEN 1 END) as users_with_coins,
    COUNT(CASE WHEN level > 1 THEN 1 END) as users_with_levels,
    SUM(COALESCE(coins, 0)) as total_coins,
    AVG(COALESCE(level, 1)) as avg_level
FROM user_profiles 
WHERE employee_id IS NOT NULL;

-- Детальная информация по пользователям
SELECT 
    up.id,
    up.full_name,
    up.employee_id,
    up.coins,
    up.experience,
    up.level,
    up.office_id,
    o.name as office_name,
    COUNT(tl.id) as total_tasks,
    SUM(tl.units_completed) as total_units
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
WHERE up.employee_id IS NOT NULL
GROUP BY up.id, up.full_name, up.employee_id, up.coins, up.experience, up.level, up.office_id, o.name
ORDER BY up.coins DESC;

COMMIT;

-- Итоговая статистика
SELECT 
    COUNT(*) as total_users_synced,
    SUM(COALESCE(coins, 0)) as total_coins_distributed,
    AVG(COALESCE(level, 1)) as avg_level,
    MAX(coins) as max_coins,
    MIN(coins) as min_coins,
    'Полная синхронизация игровых статистик завершена' as message
FROM user_profiles; 