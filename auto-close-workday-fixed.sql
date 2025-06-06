-- Исправленное автоматическое закрытие рабочих дней
-- Закрывает все незакрытые рабочие сессии предыдущих дней

-- 1. Закрываем все незакрытые рабочие сессии предыдущих дней
UPDATE work_sessions 
SET 
    clock_out_time = 
        CASE 
            -- Если человек пришел до 18:00, закрываем в 18:00
            WHEN clock_in_time <= '18:00:00'::time THEN '18:00:00'::time
            -- Если пришел после 18:00, закрываем через 8 часов после прихода
            ELSE (clock_in_time::interval + INTERVAL '8 hours')::time
        END,
    total_work_minutes = 
        CASE 
            WHEN clock_in_time IS NOT NULL THEN
                CASE 
                    -- Если пришел до 18:00, считаем время до 18:00
                    WHEN clock_in_time <= '18:00:00'::time THEN
                        EXTRACT(EPOCH FROM ('18:00:00'::time - clock_in_time)) / 60
                    -- Если пришел после 18:00, даем 8 часов
                    ELSE 480
                END
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
    ws.total_work_minutes,
    'Закрыто автоматически' as status
FROM work_sessions ws
JOIN employees e ON e.id = ws.employee_id
WHERE 
    ws.date < CURRENT_DATE 
    AND ws.clock_out_time IS NOT NULL
    AND ws.updated_at::date = CURRENT_DATE
ORDER BY ws.date DESC, e.full_name;

-- 4. Показываем статистику незакрытых дней (если остались)
SELECT 'Еще не закрытые рабочие дни (если есть):' as info;
SELECT 
    e.full_name,
    ws.date,
    ws.clock_in_time,
    'Не закрыт' as status
FROM work_sessions ws
JOIN employees e ON e.id = ws.employee_id
WHERE 
    ws.date < CURRENT_DATE 
    AND ws.clock_in_time IS NOT NULL
    AND ws.clock_out_time IS NULL
ORDER BY ws.date DESC, e.full_name; 