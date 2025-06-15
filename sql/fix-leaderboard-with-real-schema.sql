-- ===========================================
-- ИСПРАВЛЕНИЕ ЛИДЕРБОРДА ПОД РЕАЛЬНУЮ СХЕМУ БД
-- ===========================================

-- Исправляем функцию get_leaderboard_stats() для работы с реальной схемой
CREATE OR REPLACE FUNCTION get_leaderboard_stats()
RETURNS TABLE (
    employee_id INTEGER,
    user_id UUID,
    full_name TEXT,
    employee_position TEXT,
    office_name TEXT,
    total_tasks INTEGER,
    completed_tasks INTEGER,
    completion_rate NUMERIC,
    total_points INTEGER,
    avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    task_logs_exists BOOLEAN;
    work_sessions_exists BOOLEAN;
BEGIN
    -- Проверяем существование таблиц
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'task_logs' 
        AND table_schema = 'public'
    ) INTO task_logs_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'work_sessions' 
        AND table_schema = 'public'
    ) INTO work_sessions_exists;
    
    IF task_logs_exists THEN
        -- Используем реальную схему с task_logs
        RETURN QUERY
        SELECT 
            COALESCE(e.id, 0) as employee_id,
            up.id as user_id,
            up.full_name::TEXT,
            COALESCE(up."position", 'Сотрудник')::TEXT as employee_position,
            COALESCE(o.name, 'Рассвет')::TEXT as office_name,
            COALESCE(stats.total_tasks, 0) as total_tasks,
            COALESCE(stats.completed_tasks, 0) as completed_tasks,
            COALESCE(
                CASE 
                    WHEN stats.total_tasks > 0 
                    THEN ROUND((stats.completed_tasks::NUMERIC / stats.total_tasks::NUMERIC) * 100, 1)
                    ELSE 0 
                END, 
                0
            ) as completion_rate,
            COALESCE(stats.total_units, 0) as total_points,
            COALESCE(up.avatar_url, '')::TEXT
        FROM user_profiles up
        LEFT JOIN employees e ON e.user_id = up.id
        LEFT JOIN offices o ON o.id = up.office_id
        LEFT JOIN (
            -- Статистика из task_logs
            SELECT 
                tl.employee_id,
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN tl.is_active = false THEN 1 END) as completed_tasks,
                SUM(COALESCE(tl.units_completed, 0)) as total_units,
                SUM(COALESCE(tl.time_spent_minutes, 0)) as total_minutes
            FROM task_logs tl
            GROUP BY tl.employee_id
        ) stats ON stats.employee_id = e.id
        WHERE up.id IS NOT NULL
        ORDER BY 
            COALESCE(stats.total_units, 0) DESC,
            COALESCE(stats.completed_tasks, 0) DESC,
            up.full_name;
            
    ELSIF work_sessions_exists THEN
        -- Используем work_sessions если task_logs нет
        RETURN QUERY
        SELECT 
            COALESCE(e.id, 0) as employee_id,
            up.id as user_id,
            up.full_name::TEXT,
            COALESCE(up."position", 'Сотрудник')::TEXT as employee_position,
            COALESCE(o.name, 'Рассвет')::TEXT as office_name,
            COALESCE(stats.total_sessions, 0) as total_tasks,
            COALESCE(stats.completed_sessions, 0) as completed_tasks,
            COALESCE(
                CASE 
                    WHEN stats.total_sessions > 0 
                    THEN ROUND((stats.completed_sessions::NUMERIC / stats.total_sessions::NUMERIC) * 100, 1)
                    ELSE 0 
                END, 
                0
            ) as completion_rate,
            COALESCE(stats.total_work_minutes, 0) as total_points,
            COALESCE(up.avatar_url, '')::TEXT
        FROM user_profiles up
        LEFT JOIN employees e ON e.user_id = up.id
        LEFT JOIN offices o ON o.id = up.office_id
        LEFT JOIN (
            -- Статистика из work_sessions
            SELECT 
                ws.employee_id,
                COUNT(*) as total_sessions,
                COUNT(CASE WHEN ws.end_time IS NOT NULL THEN 1 END) as completed_sessions,
                SUM(COALESCE(ws.total_work_minutes, 
                    CASE 
                        WHEN ws.end_time IS NOT NULL AND ws.start_time IS NOT NULL 
                        THEN EXTRACT(EPOCH FROM (ws.end_time - ws.start_time))/60
                        ELSE 0 
                    END, 0)) as total_work_minutes
            FROM work_sessions ws
            WHERE ws.is_active = true
            GROUP BY ws.employee_id
        ) stats ON stats.employee_id = e.id
        WHERE up.id IS NOT NULL
        ORDER BY 
            COALESCE(stats.total_work_minutes, 0) DESC,
            COALESCE(stats.completed_sessions, 0) DESC,
            up.full_name;
    ELSE
        -- Базовая информация без статистики
        RETURN QUERY
        SELECT 
            COALESCE(e.id, 0) as employee_id,
            up.id as user_id,
            up.full_name::TEXT,
            COALESCE(up."position", 'Сотрудник')::TEXT as employee_position,
            COALESCE(o.name, 'Рассвет')::TEXT as office_name,
            0 as total_tasks,
            0 as completed_tasks,
            0::NUMERIC as completion_rate,
            0 as total_points,
            COALESCE(up.avatar_url, '')::TEXT
        FROM user_profiles up
        LEFT JOIN employees e ON e.user_id = up.id
        LEFT JOIN offices o ON o.id = up.office_id
        WHERE up.id IS NOT NULL
        ORDER BY up.full_name;
    END IF;
END;
$$;

-- Тестируем функцию
SELECT 'Тест функции get_leaderboard_stats с реальной схемой:' as test_type;
SELECT 
    employee_id,
    full_name,
    employee_position,
    office_name,
    total_tasks,
    completed_tasks,
    completion_rate,
    total_points
FROM get_leaderboard_stats()
LIMIT 10;

-- Проверяем какие таблицы у нас есть
SELECT 'Доступные таблицы для статистики:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('task_logs', 'work_sessions', 'tasks', 'task_types')
ORDER BY table_name;

COMMENT ON FUNCTION get_leaderboard_stats() IS 'Функция лидерборда, адаптированная под реальную схему БД с task_logs и work_sessions'; 