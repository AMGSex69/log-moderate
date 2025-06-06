-- Исправление проблем с таймерами и синхронизацией времени

-- 1. Обновляем триггер для work_sessions для корректной работы с временными зонами
CREATE OR REPLACE FUNCTION update_work_session_end_time()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем end_time только если установлено clock_out_time
    IF NEW.clock_out_time IS NOT NULL AND OLD.clock_out_time IS NULL THEN
        NEW.end_time = NEW.clock_out_time;
    END IF;
    
    -- Обновляем updated_at каждый раз
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Пересоздаем триггер если существует
DROP TRIGGER IF EXISTS work_session_end_time_trigger ON work_sessions;
CREATE TRIGGER work_session_end_time_trigger
    BEFORE UPDATE ON work_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_work_session_end_time();

-- 2. Очищаем "зависшие" активные сессии старше 2 часов
UPDATE active_sessions 
SET is_active = false 
WHERE is_active = true 
AND last_heartbeat < NOW() - INTERVAL '2 hours';

-- 3. Удаляем полностью устаревшие активные сессии (старше 24 часов)
DELETE FROM active_sessions 
WHERE last_heartbeat < NOW() - INTERVAL '24 hours';

-- 4. Добавляем индексы для улучшения производительности запросов по времени
CREATE INDEX IF NOT EXISTS idx_active_sessions_heartbeat 
ON active_sessions(last_heartbeat) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_work_sessions_date_employee 
ON work_sessions(date, employee_id);

CREATE INDEX IF NOT EXISTS idx_task_logs_work_date 
ON task_logs(work_date, employee_id);

-- 5. Функция для очистки старых данных (можно вызывать периодически)
CREATE OR REPLACE FUNCTION cleanup_old_timer_data()
RETURNS TEXT AS $$
DECLARE
    deleted_sessions INTEGER;
    updated_sessions INTEGER;
BEGIN
    -- Деактивируем старые активные сессии
    UPDATE active_sessions 
    SET is_active = false 
    WHERE is_active = true 
    AND last_heartbeat < NOW() - INTERVAL '2 hours';
    
    GET DIAGNOSTICS updated_sessions = ROW_COUNT;
    
    -- Удаляем очень старые сессии
    DELETE FROM active_sessions 
    WHERE last_heartbeat < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_sessions = ROW_COUNT;
    
    RETURN format('Деактивировано сессий: %s, Удалено сессий: %s', 
                  updated_sessions, deleted_sessions);
END;
$$ LANGUAGE plpgsql;

-- 6. Функция для валидации временных данных
CREATE OR REPLACE FUNCTION validate_time_consistency()
RETURNS TABLE(
    issue_type TEXT,
    table_name TEXT,
    record_id INTEGER,
    issue_description TEXT
) AS $$
BEGIN
    -- Проверяем work_sessions с некорректным временем
    RETURN QUERY
    SELECT 
        'invalid_work_time'::TEXT,
        'work_sessions'::TEXT,
        id::INTEGER,
        'clock_out_time раньше clock_in_time'::TEXT
    FROM work_sessions 
    WHERE clock_in_time IS NOT NULL 
    AND clock_out_time IS NOT NULL 
    AND clock_out_time < clock_in_time;
    
    -- Проверяем активные сессии с устаревшим heartbeat
    RETURN QUERY
    SELECT 
        'stale_active_session'::TEXT,
        'active_sessions'::TEXT,
        id::INTEGER,
        format('Heartbeat устарел на %s', 
               extract(epoch from (NOW() - last_heartbeat)) / 3600)::TEXT
    FROM active_sessions 
    WHERE is_active = true 
    AND last_heartbeat < NOW() - INTERVAL '1 hour';
    
    -- Проверяем задачи с нулевым временем
    RETURN QUERY
    SELECT 
        'zero_time_task'::TEXT,
        'task_logs'::TEXT,
        id::INTEGER,
        'Задача с нулевым временем выполнения'::TEXT
    FROM task_logs 
    WHERE time_spent_minutes = 0;
    
END;
$$ LANGUAGE plpgsql;

-- 7. Обновляем настройки часового пояса для сессии (если нужно)
-- По умолчанию PostgreSQL использует UTC, что правильно для веб-приложений
SELECT current_setting('timezone') as current_timezone;

-- 8. Создаем представление для удобного просмотра активных сессий с таймингом
CREATE OR REPLACE VIEW active_sessions_with_timing AS
SELECT 
    s.id,
    s.employee_id,
    e.full_name,
    s.task_type_id,
    tt.name as task_name,
    s.started_at,
    s.last_heartbeat,
    extract(epoch from (NOW() - s.started_at)) / 60 as elapsed_minutes,
    extract(epoch from (NOW() - s.last_heartbeat)) / 60 as minutes_since_heartbeat,
    s.is_active
FROM active_sessions s
JOIN employees e ON s.employee_id = e.id
JOIN task_types tt ON s.task_type_id = tt.id
WHERE s.is_active = true
ORDER BY s.started_at;

-- 9. Создаем представление для ежедневной статистики работы
CREATE OR REPLACE VIEW daily_work_stats AS
SELECT 
    ws.employee_id,
    e.full_name,
    ws.date,
    ws.clock_in_time,
    ws.clock_out_time,
    ws.total_work_minutes,
    CASE 
        WHEN ws.clock_in_time IS NOT NULL AND ws.clock_out_time IS NULL 
        THEN extract(epoch from (NOW() - ws.clock_in_time)) / 60
        ELSE ws.total_work_minutes
    END as current_work_minutes,
    ws.total_task_minutes,
    ws.total_idle_minutes,
    (ws.total_task_minutes::float / NULLIF(ws.total_work_minutes, 0) * 100) as productivity_percentage
FROM work_sessions ws
JOIN employees e ON ws.employee_id = e.id
WHERE ws.date = CURRENT_DATE
ORDER BY ws.clock_in_time DESC;

-- 10. Информация о выполненных исправлениях
SELECT 
    'Исправления таймеров применены успешно!' as status,
    NOW() as applied_at,
    (SELECT COUNT(*) FROM active_sessions WHERE is_active = true) as active_sessions_count,
    (SELECT COUNT(*) FROM work_sessions WHERE date = CURRENT_DATE) as todays_work_sessions;

-- Запускаем очистку старых данных
SELECT cleanup_old_timer_data() as cleanup_result;

-- Показываем текущие проблемы (если есть)
SELECT * FROM validate_time_consistency(); 