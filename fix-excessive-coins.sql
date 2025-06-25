-- Исправление аномально больших значений монет
-- Устанавливаем разумные лимиты и пересчитываем

BEGIN;

-- 1. Показываем текущее состояние
SELECT 
    'BEFORE FIX' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN coins > 10000 THEN 1 END) as users_with_excessive_coins,
    MAX(coins) as max_coins,
    AVG(coins) as avg_coins
FROM user_profiles;

-- 2. Находим и исправляем аномальные записи в task_logs
-- Предполагаем, что units_completed > 1000 за одну задачу - это ошибка
UPDATE task_logs 
SET units_completed = CASE 
    WHEN units_completed > 1000 THEN LEAST(units_completed / 100, 100)  -- Делим на 100 или ограничиваем до 100
    ELSE units_completed 
END
WHERE units_completed > 1000;

-- 3. Пересчитываем монеты с исправленными данными
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
) calculated_stats
WHERE user_profiles.employee_id = calculated_stats.employee_id
AND user_profiles.employee_id IS NOT NULL;

-- 4. Дополнительно ограничиваем максимальные монеты (на случай если все еще есть аномалии)
UPDATE user_profiles 
SET 
    coins = LEAST(coins, 10000),  -- Максимум 10000 монет
    level = CASE 
        WHEN LEAST(coins, 10000) >= 2300 THEN 10
        WHEN LEAST(coins, 10000) >= 1850 THEN 9
        WHEN LEAST(coins, 10000) >= 1450 THEN 8
        WHEN LEAST(coins, 10000) >= 1100 THEN 7
        WHEN LEAST(coins, 10000) >= 800 THEN 6
        WHEN LEAST(coins, 10000) >= 550 THEN 5
        WHEN LEAST(coins, 10000) >= 350 THEN 4
        WHEN LEAST(coins, 10000) >= 200 THEN 3
        WHEN LEAST(coins, 10000) >= 100 THEN 2
        WHEN LEAST(coins, 10000) >= 50 THEN 1
        ELSE 1
    END
WHERE coins > 10000;

-- 5. Показываем результат
SELECT 
    'AFTER FIX' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN coins > 10000 THEN 1 END) as users_with_excessive_coins,
    MAX(coins) as max_coins,
    AVG(coins) as avg_coins,
    COUNT(CASE WHEN coins > 0 THEN 1 END) as users_with_coins
FROM user_profiles;

-- 6. Топ пользователей после исправления
SELECT 
    up.full_name,
    up.coins,
    up.level,
    o.name as office_name
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.coins > 0
ORDER BY up.coins DESC
LIMIT 10;

COMMIT;

SELECT 'Исправление аномальных значений монет завершено' as message; 