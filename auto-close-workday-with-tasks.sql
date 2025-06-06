-- ФИНАЛЬНОЕ автоматическое закрытие рабочих дней И активных задач
-- Этот скрипт должен запускаться автоматически в 00:00 каждый день
-- Закрывает все незакрытые рабочие сессии предыдущих дней
-- И автоматически деактивирует все активные задачи

-- 1. ЗАКРЫВАЕМ ВСЕ АКТИВНЫЕ ЗАДАЧИ ПРЕДЫДУЩИХ ДНЕЙ
-- Деактивируем активные сессии, которые были запущены не сегодня
UPDATE active_sessions 
SET 
    is_active = false,
    last_heartbeat = NOW()
WHERE 
    is_active = true 
    AND DATE(started_at) < CURRENT_DATE;

-- Показываем какие активные задачи были закрыты
SELECT 'Автоматически закрытые активные задачи:' as info;
SELECT 
    e.full_name,
    tt.name as task_name,
    DATE(acs.started_at) as task_date,
    acs.started_at::time as started_time,
    'Закрыто автоматически' as status
FROM active_sessions acs
JOIN employees e ON e.id = acs.employee_id
JOIN task_types tt ON tt.id = acs.task_type_id
WHERE 
    acs.is_active = false 
    AND DATE(acs.started_at) < CURRENT_DATE
    AND acs.last_heartbeat::date = CURRENT_DATE
ORDER BY acs.started_at DESC;

-- 2. ЗАКРЫВАЕМ ВСЕ НЕЗАКРЫТЫЕ РАБОЧИЕ СЕССИИ ПРЕДЫДУЩИХ ДНЕЙ
UPDATE work_sessions 
SET 
    clock_out_time = 
        CASE 
            -- Если человек пришел до 18:00, закрываем в 18:00
            WHEN clock_in_time::time <= '18:00:00'::time THEN 
                (date + INTERVAL '18 hours')::timestamp
            -- Если пришел после 18:00, закрываем через 8 часов после прихода
            ELSE clock_in_time + INTERVAL '8 hours'
        END,
    total_work_minutes = 
        CASE 
            WHEN clock_in_time IS NOT NULL THEN
                CASE 
                    -- Если пришел до 18:00, считаем время до 18:00
                    WHEN clock_in_time::time <= '18:00:00'::time THEN
                        EXTRACT(EPOCH FROM (
                            (date + INTERVAL '18 hours')::timestamp - clock_in_time
                        )) / 60
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

-- 3. ОБНОВЛЯЕМ СТАТУС ОНЛАЙН ДЛЯ ВСЕХ СОТРУДНИКОВ В НАЧАЛЕ НОВОГО ДНЯ
UPDATE employees 
SET 
    is_online = false,
    updated_at = NOW()
WHERE is_online = true;

-- 4. ОЧИЩАЕМ СТАРЫЕ АКТИВНЫЕ СЕССИИ (СТАРШЕ 7 ДНЕЙ)
DELETE FROM active_sessions 
WHERE started_at < CURRENT_DATE - INTERVAL '7 days';

-- 5. ПРОВЕРЯЕМ РЕЗУЛЬТАТ - РАБОЧИЕ ДНИ
SELECT 'Автоматически закрытые рабочие дни:' as info;
SELECT 
    e.full_name,
    ws.date,
    ws.clock_in_time::time as "Время прихода",
    ws.clock_out_time::time as "Время ухода", 
    ROUND(ws.total_work_minutes::numeric, 0) as "Минут работы",
    'Закрыто автоматически' as status
FROM work_sessions ws
JOIN employees e ON e.id = ws.employee_id
WHERE 
    ws.date < CURRENT_DATE 
    AND ws.clock_out_time IS NOT NULL
    AND ws.updated_at::date = CURRENT_DATE
ORDER BY ws.date DESC, e.full_name;

-- 6. ПОКАЗЫВАЕМ СТАТИСТИКУ НЕЗАКРЫТЫХ ДНЕЙ (ЕСЛИ ОСТАЛИСЬ)
SELECT 'Еще не закрытые рабочие дни (если есть):' as info;
SELECT 
    e.full_name,
    ws.date,
    ws.clock_in_time::time as "Время прихода",
    'Не закрыт' as status
FROM work_sessions ws
JOIN employees e ON e.id = ws.employee_id
WHERE 
    ws.date < CURRENT_DATE 
    AND ws.clock_in_time IS NOT NULL
    AND ws.clock_out_time IS NULL
ORDER BY ws.date DESC, e.full_name;

-- 7. ПОКАЗЫВАЕМ ОСТАВШИЕСЯ АКТИВНЫЕ ЗАДАЧИ (ТОЛЬКО СЕГОДНЯШНИЕ)
SELECT 'Активные задачи на сегодня:' as info;
SELECT 
    e.full_name,
    tt.name as task_name,
    acs.started_at::time as started_time,
    'Активна' as status
FROM active_sessions acs
JOIN employees e ON e.id = acs.employee_id
JOIN task_types tt ON tt.id = acs.task_type_id
WHERE 
    acs.is_active = true 
    AND DATE(acs.started_at) = CURRENT_DATE
ORDER BY acs.started_at DESC;

-- 8. ОБЩАЯ СТАТИСТИКА
SELECT 'Общая статистика очистки:' as info;
SELECT 
    'Закрыто рабочих дней' as metric,
    COUNT(*) as count
FROM work_sessions 
WHERE 
    date < CURRENT_DATE 
    AND clock_out_time IS NOT NULL
    AND updated_at::date = CURRENT_DATE
UNION ALL
SELECT 
    'Деактивировано задач' as metric,
    COUNT(*) as count
FROM active_sessions 
WHERE 
    is_active = false 
    AND DATE(started_at) < CURRENT_DATE
    AND last_heartbeat::date = CURRENT_DATE
UNION ALL
SELECT 
    'Активных задач на сегодня' as metric,
    COUNT(*) as count
FROM active_sessions 
WHERE 
    is_active = true 
    AND DATE(started_at) = CURRENT_DATE;

-- 9. СОЗДАЕМ ФУНКЦИЮ ДЛЯ АВТОМАТИЧЕСКОГО ЗАПУСКА (ОПЦИОНАЛЬНО)
CREATE OR REPLACE FUNCTION auto_close_workday_and_tasks()
RETURNS TEXT AS $$
DECLARE
    closed_workdays INTEGER := 0;
    closed_tasks INTEGER := 0;
    result_text TEXT;
BEGIN
    -- Закрываем активные задачи предыдущих дней
    UPDATE active_sessions 
    SET is_active = false, last_heartbeat = NOW()
    WHERE is_active = true AND DATE(started_at) < CURRENT_DATE;
    
    GET DIAGNOSTICS closed_tasks = ROW_COUNT;
    
    -- Закрываем рабочие дни
    UPDATE work_sessions 
    SET 
        clock_out_time = CASE 
            WHEN clock_in_time::time <= '18:00:00'::time THEN 
                (date + INTERVAL '18 hours')::timestamp
            ELSE clock_in_time + INTERVAL '8 hours'
        END,
        total_work_minutes = CASE 
            WHEN clock_in_time IS NOT NULL THEN
                CASE 
                    WHEN clock_in_time::time <= '18:00:00'::time THEN
                        EXTRACT(EPOCH FROM (
                            (date + INTERVAL '18 hours')::timestamp - clock_in_time
                        )) / 60
                    ELSE 480
                END
            ELSE 0
        END,
        updated_at = NOW()
    WHERE 
        date < CURRENT_DATE 
        AND clock_in_time IS NOT NULL 
        AND clock_out_time IS NULL;
        
    GET DIAGNOSTICS closed_workdays = ROW_COUNT;
    
    -- Сбрасываем статус онлайн
    UPDATE employees SET is_online = false, updated_at = NOW() WHERE is_online = true;
    
    -- Очищаем старые сессии
    DELETE FROM active_sessions WHERE started_at < CURRENT_DATE - INTERVAL '7 days';
    
    result_text := 'Автоматическое закрытие выполнено: ' || 
                   closed_workdays || ' рабочих дней, ' || 
                   closed_tasks || ' активных задач';
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql;

-- Показываем что функция создана
SELECT 'Функция auto_close_workday_and_tasks() создана для автоматического запуска' as info; 