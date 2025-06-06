-- Автоматическое закрытие рабочих дней
-- Закрывает все незакрытые рабочие сессии предыдущих дней

-- 1. Закрываем все незакрытые рабочие сессии предыдущих дней
UPDATE work_sessions 
SET 
    clock_out_time = 
        CASE 
            -- Если рабочий день был в пятницу, закрываем в 18:00
            WHEN EXTRACT(DOW FROM date) = 5 THEN (date + INTERVAL '18 hours')::time
            -- Для обычных дней тоже 18:00
            ELSE (date + INTERVAL '18 hours')::time
        END,
    total_work_minutes = 
        CASE 
            WHEN clock_in_time IS NOT NULL THEN
                EXTRACT(EPOCH FROM (
                    CASE 
                        WHEN EXTRACT(DOW FROM date) = 5 THEN (date + INTERVAL '18 hours')::time
                        ELSE (date + INTERVAL '18 hours')::time
                    END - clock_in_time
                )) / 60
            ELSE 0
        END,
    updated_at = NOW()
WHERE 
    date < CURRENT_DATE  -- Только предыдущие дни
    AND clock_in_time IS NOT NULL  -- Только те, кто отметился на работу
    AND clock_out_time IS NULL;  -- Но не закрыл рабочий день

-- 2. Обновляем статус онлайн для всех сотрудников в начале нового дня
UPDATE employees 
SET 
    is_online = false,
    updated_at = NOW()
WHERE is_online = true;

-- 3. Проверяем результат
SELECT 'Автоматически закрытые рабочие дни:' as info;
SELECT 
    e.full_name,
    ws.date,
    ws.clock_in_time,
    ws.clock_out_time,
    ws.total_work_minutes
FROM work_sessions ws
JOIN employees e ON e.id = ws.employee_id
WHERE 
    ws.date < CURRENT_DATE 
    AND ws.clock_out_time IS NOT NULL
    AND ws.updated_at::date = CURRENT_DATE
ORDER BY ws.date DESC, e.full_name; 