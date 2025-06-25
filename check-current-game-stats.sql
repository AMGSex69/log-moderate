-- Проверка текущего состояния игровых статистик
-- Показывает расхождения между сохраненными и рассчитанными значениями

-- 1. Общая статистика по user_profiles
SELECT 
    'CURRENT STATE' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN coins > 0 THEN 1 END) as users_with_coins,
    COUNT(CASE WHEN level > 1 THEN 1 END) as users_with_levels,
    SUM(COALESCE(coins, 0)) as total_coins,
    AVG(COALESCE(level, 1)) as avg_level,
    MAX(coins) as max_coins,
    MIN(coins) as min_coins
FROM user_profiles 
WHERE employee_id IS NOT NULL;

-- 2. Пользователи с их текущими и рассчитанными статистиками
SELECT 
    up.id,
    up.full_name,
    up.employee_id,
    up.coins as current_coins,
    up.level as current_level,
    COALESCE(calculated_stats.total_coins, 0) as calculated_coins,
    CASE 
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
    END as calculated_level,
    (COALESCE(calculated_stats.total_coins, 0) - COALESCE(up.coins, 0)) as coins_diff,
    o.name as office_name,
    calculated_stats.task_count
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
LEFT JOIN (
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
        ), 0) as total_coins,
        COUNT(tl.id) as task_count
    FROM user_profiles up
    LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
    LEFT JOIN task_types tt ON tt.id = tl.task_type_id
    WHERE up.employee_id IS NOT NULL
    GROUP BY up.employee_id
) calculated_stats ON calculated_stats.employee_id = up.employee_id
WHERE up.employee_id IS NOT NULL
ORDER BY calculated_stats.total_coins DESC;

-- 3. Пользователи с расхождениями (где current_coins != calculated_coins)
SELECT 
    'USERS WITH DISCREPANCIES' as status,
    COUNT(*) as count_users_with_diff
FROM (
    SELECT 
        up.id,
        up.coins as current_coins,
        COALESCE(calculated_stats.total_coins, 0) as calculated_coins
    FROM user_profiles up
    LEFT JOIN (
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
                    ELSE tl.units_completed * 5
                END
            ), 0) as total_coins
        FROM user_profiles up
        LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
        LEFT JOIN task_types tt ON tt.id = tl.task_type_id
        WHERE up.employee_id IS NOT NULL
        GROUP BY up.employee_id
    ) calculated_stats ON calculated_stats.employee_id = up.employee_id
    WHERE up.employee_id IS NOT NULL
    AND COALESCE(up.coins, 0) != COALESCE(calculated_stats.total_coins, 0)
) discrepancies;

-- 4. Статистика по офисам
SELECT 
    o.name as office_name,
    COUNT(up.id) as users_count,
    SUM(COALESCE(up.coins, 0)) as total_office_coins,
    AVG(COALESCE(up.coins, 0)) as avg_coins_per_user,
    AVG(COALESCE(up.level, 1)) as avg_level
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.employee_id IS NOT NULL
GROUP BY o.id, o.name
ORDER BY total_office_coins DESC; 