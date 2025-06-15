-- ===========================================
-- ИСПРАВЛЕНИЕ ЛИДЕРБОРДА И ПРОФИЛЕЙ
-- ===========================================

-- 1. ПРОВЕРЯЕМ ТЕКУЩИЕ ДАННЫЕ
SELECT 'Проверка данных пользователей:' as info;
SELECT 
    up.id,
    up.full_name,
    up.avatar_url,
    up.role,
    up.is_admin,
    e.id as employee_id,
    e.full_name as employee_name
FROM user_profiles up
LEFT JOIN employees e ON e.user_id = up.id
ORDER BY up.full_name;

-- 2. ПРОВЕРЯЕМ ФУНКЦИЮ ЛИДЕРБОРДА
SELECT 'Тест функции get_leaderboard_stats:' as test_type;
SELECT 
    employee_id,
    user_id,
    full_name,
    employee_position,
    office_name,
    total_tasks,
    completed_tasks,
    total_points,
    avatar_url
FROM get_leaderboard_stats()
LIMIT 10;

-- 3. ИСПРАВЛЯЕМ ФИО (если нужно)
-- Проверяем, есть ли проблемы с порядком имени/фамилии
SELECT 'Проверка ФИО:' as info;
SELECT 
    id,
    full_name,
    CASE 
        WHEN full_name LIKE '% %' THEN 
            split_part(full_name, ' ', 2) || ' ' || split_part(full_name, ' ', 1)
        ELSE full_name 
    END as corrected_name
FROM user_profiles
WHERE full_name IS NOT NULL;

-- 4. ВОССТАНАВЛИВАЕМ АВАТАРКИ ДЛЯ КОНКРЕТНОГО ПОЛЬЗОВАТЕЛЯ
-- Проверяем аватарку для пользователя b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5
SELECT 'Проверка аватарки пользователя:' as info;
SELECT 
    id,
    full_name,
    avatar_url,
    CASE 
        WHEN avatar_url IS NULL OR avatar_url = '' THEN 'Аватарка отсутствует'
        ELSE 'Аватарка есть'
    END as avatar_status
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 5. СОЗДАЕМ УЛУЧШЕННУЮ ФУНКЦИЮ ЛИДЕРБОРДА
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
        -- Используем task_logs для статистики
        RETURN QUERY
        SELECT 
            COALESCE(e.id, 0) as employee_id,
            up.id as user_id,
            COALESCE(up.full_name, 'Неизвестный пользователь')::TEXT as full_name,
            COALESCE(up."position", 'Сотрудник')::TEXT as employee_position,
            COALESCE(o.name, 'Рассвет')::TEXT as office_name,
            COALESCE(stats.total_tasks, 0)::INTEGER as total_tasks,
            COALESCE(stats.completed_tasks, 0)::INTEGER as completed_tasks,
            COALESCE(
                CASE 
                    WHEN stats.total_tasks > 0 
                    THEN ROUND((stats.completed_tasks::NUMERIC / stats.total_tasks::NUMERIC) * 100, 1)
                    ELSE 0 
                END, 
                0
            ) as completion_rate,
            COALESCE(stats.total_units, 0)::INTEGER as total_points,
            COALESCE(up.avatar_url, '')::TEXT as avatar_url
        FROM user_profiles up
        LEFT JOIN employees e ON e.user_id = up.id
        LEFT JOIN offices o ON o.id = COALESCE(up.office_id, e.office_id, 1)
        LEFT JOIN (
            -- Статистика из task_logs
            SELECT 
                tl.employee_id,
                COUNT(*)::INTEGER as total_tasks,
                COUNT(CASE WHEN tl.is_active = false THEN 1 END)::INTEGER as completed_tasks,
                SUM(COALESCE(tl.units_completed, 0))::INTEGER as total_units,
                SUM(COALESCE(tl.time_spent_minutes, 0))::INTEGER as total_minutes
            FROM task_logs tl
            GROUP BY tl.employee_id
        ) stats ON stats.employee_id = e.id
        WHERE up.id IS NOT NULL
        ORDER BY 
            COALESCE(stats.total_units, 0) DESC,
            COALESCE(stats.completed_tasks, 0) DESC,
            up.full_name;
    ELSE
        -- Базовая информация без статистики
        RETURN QUERY
        SELECT 
            COALESCE(e.id, 0) as employee_id,
            up.id as user_id,
            COALESCE(up.full_name, 'Неизвестный пользователь')::TEXT as full_name,
            COALESCE(up."position", 'Сотрудник')::TEXT as employee_position,
            COALESCE(o.name, 'Рассвет')::TEXT as office_name,
            0 as total_tasks,
            0 as completed_tasks,
            0::NUMERIC as completion_rate,
            0 as total_points,
            COALESCE(up.avatar_url, '')::TEXT as avatar_url
        FROM user_profiles up
        LEFT JOIN employees e ON e.user_id = up.id
        LEFT JOIN offices o ON o.id = COALESCE(up.office_id, e.office_id, 1)
        WHERE up.id IS NOT NULL
        ORDER BY up.full_name;
    END IF;
END;
$$;

-- 6. ТЕСТИРУЕМ ИСПРАВЛЕННУЮ ФУНКЦИЮ
SELECT 'Тест исправленной функции лидерборда:' as test_type;
SELECT 
    employee_id,
    user_id,
    full_name,
    employee_position,
    office_name,
    total_tasks,
    completed_tasks,
    total_points,
    CASE 
        WHEN avatar_url = '' THEN 'Нет аватарки'
        ELSE 'Есть аватарка'
    END as avatar_status
FROM get_leaderboard_stats()
ORDER BY total_points DESC
LIMIT 10;

-- 7. ПРОВЕРЯЕМ RLS ПОЛИТИКИ ДЛЯ ЛИДЕРБОРДА
SELECT 'Проверка доступа к функции лидерборда:' as info;
SELECT COUNT(*) as leaderboard_records FROM get_leaderboard_stats();

COMMENT ON FUNCTION get_leaderboard_stats() IS 'Исправленная функция лидерборда с улучшенной обработкой данных'; 