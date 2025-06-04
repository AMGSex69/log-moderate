-- Исправление проблемы с рабочими сессиями
-- Проблема: clock_out_time меньше clock_in_time, что приводит к неправильному определению статуса работы

-- 1. Найдем проблемные сессии
SELECT 
    id,
    employee_id,
    date,
    clock_in_time,
    clock_out_time,
    CASE 
        WHEN clock_out_time < clock_in_time THEN 'ПРОБЛЕМА: clock_out < clock_in'
        WHEN clock_in_time IS NOT NULL AND clock_out_time IS NULL THEN 'В работе'
        WHEN clock_in_time IS NULL AND clock_out_time IS NOT NULL THEN 'ПРОБЛЕМА: есть выход без входа'
        ELSE 'ОК'
    END as status
FROM work_sessions 
WHERE date = CURRENT_DATE
ORDER BY employee_id;

-- 2. Исправляем проблемные сессии
-- Если clock_out_time раньше clock_in_time, то это значит что пользователь начал новый день
-- но время окончания от предыдущего дня не было сброшено
UPDATE work_sessions 
SET 
    clock_out_time = NULL,
    updated_at = NOW()
WHERE 
    date = CURRENT_DATE 
    AND clock_in_time IS NOT NULL 
    AND clock_out_time IS NOT NULL 
    AND clock_out_time < clock_in_time;

-- 3. Проверяем результат
SELECT 
    'После исправления:' as info,
    id,
    employee_id,
    date,
    clock_in_time,
    clock_out_time,
    CASE 
        WHEN clock_in_time IS NOT NULL AND clock_out_time IS NULL THEN 'В работе ✅'
        WHEN clock_in_time IS NULL AND clock_out_time IS NULL THEN 'Не работает'
        WHEN clock_in_time IS NOT NULL AND clock_out_time IS NOT NULL AND clock_out_time > clock_in_time THEN 'День завершен ✅'
        ELSE 'ПРОБЛЕМА'
    END as status
FROM work_sessions 
WHERE date = CURRENT_DATE
ORDER BY employee_id;

-- 4. Дополнительная проверка: убираем дублирующие активные сессии на один день
-- (на случай если было создано несколько сессий на один день)
WITH ranked_sessions AS (
    SELECT 
        id,
        employee_id,
        date,
        ROW_NUMBER() OVER (PARTITION BY employee_id, date ORDER BY created_at DESC) as rn
    FROM work_sessions 
    WHERE date = CURRENT_DATE
)
DELETE FROM work_sessions 
WHERE id IN (
    SELECT id FROM ranked_sessions WHERE rn > 1
);

-- 5. Финальная проверка
SELECT 
    'Финальная проверка:' as info,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN clock_in_time IS NOT NULL AND clock_out_time IS NULL THEN 1 END) as working_now,
    COUNT(CASE WHEN clock_in_time IS NOT NULL AND clock_out_time IS NOT NULL THEN 1 END) as finished_today,
    COUNT(CASE WHEN clock_in_time IS NULL AND clock_out_time IS NULL THEN 1 END) as not_started
FROM work_sessions 
WHERE date = CURRENT_DATE; 