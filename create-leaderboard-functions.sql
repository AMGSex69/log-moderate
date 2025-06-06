-- СОЗДАНИЕ ФУНКЦИЙ ДЛЯ ЛИДЕРБОРДА И СТАТИСТИКИ ОФИСА

-- 1. ФУНКЦИЯ ДЛЯ ЛИДЕРБОРДА ОФИСА С ТЕКУЩИМ ПОЛЬЗОВАТЕЛЕМ
CREATE OR REPLACE FUNCTION get_leaderboard_with_current_user(current_user_id UUID)
RETURNS TABLE (
    name TEXT,
    score NUMERIC,
    rank INTEGER,
    is_current_user BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH user_office AS (
        -- Находим офис текущего пользователя
        SELECT COALESCE(e.office_id, up.office_id, 1) as office_id
        FROM auth.users u
        LEFT JOIN employees e ON e.user_id = u.id
        LEFT JOIN user_profiles up ON up.id = u.id
        WHERE u.id = current_user_id
        LIMIT 1
    ),
    office_stats AS (
        -- Статистика по офису за последние 30 дней
        SELECT 
            COALESCE(e.user_id, tl.employee_id::text::uuid) as user_id,
            COALESCE(e.full_name, up.full_name, 'Сотрудник') as full_name,
            SUM(tl.time_spent_minutes::numeric / 60.0) as total_hours
        FROM task_logs tl
        LEFT JOIN employees e ON e.id = tl.employee_id
        LEFT JOIN user_profiles up ON up.id = COALESCE(e.user_id, tl.employee_id::text::uuid)
        WHERE 
            tl.work_date >= CURRENT_DATE - INTERVAL '30 days'
            AND COALESCE(e.office_id, up.office_id, 1) = (SELECT office_id FROM user_office)
        GROUP BY 
            COALESCE(e.user_id, tl.employee_id::text::uuid),
            COALESCE(e.full_name, up.full_name, 'Сотрудник')
        HAVING SUM(tl.time_spent_minutes) > 0
    ),
    ranked_stats AS (
        SELECT 
            os.full_name,
            os.total_hours,
            os.user_id,
            ROW_NUMBER() OVER (ORDER BY os.total_hours DESC) as position
        FROM office_stats os
    )
    SELECT 
        rs.full_name::TEXT as name,
        rs.total_hours as score,
        rs.position::INTEGER as rank,
        (rs.user_id = current_user_id) as is_current_user
    FROM ranked_stats rs
    ORDER BY rs.position
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ФУНКЦИЯ ДЛЯ СТАТИСТИКИ ОФИСА
CREATE OR REPLACE FUNCTION get_office_statistics(requesting_user_uuid UUID)
RETURNS TABLE (
    office_name TEXT,
    total_employees INTEGER,
    working_employees INTEGER,
    total_hours_today NUMERIC,
    avg_hours_today NUMERIC
) AS $$
DECLARE
    user_office_id INTEGER;
    office_name_result TEXT;
BEGIN
    -- Находим офис пользователя
    SELECT COALESCE(e.office_id, up.office_id, 1), COALESCE(o.name, 'Рассвет')
    INTO user_office_id, office_name_result
    FROM auth.users u
    LEFT JOIN employees e ON e.user_id = u.id
    LEFT JOIN user_profiles up ON up.id = u.id
    LEFT JOIN offices o ON o.id = COALESCE(e.office_id, up.office_id, 1)
    WHERE u.id = requesting_user_uuid
    LIMIT 1;

    -- Если офис не найден, используем значения по умолчанию
    IF user_office_id IS NULL THEN
        user_office_id := 1;
        office_name_result := 'Рассвет';
    END IF;

    RETURN QUERY
    WITH office_employees AS (
        -- Все сотрудники офиса
        SELECT DISTINCT COALESCE(e.user_id, tl.employee_id::text::uuid) as user_id
        FROM employees e
        FULL OUTER JOIN task_logs tl ON tl.employee_id = e.id
        LEFT JOIN user_profiles up ON up.id = COALESCE(e.user_id, tl.employee_id::text::uuid)
        WHERE COALESCE(e.office_id, up.office_id, 1) = user_office_id
          AND COALESCE(e.user_id, tl.employee_id::text::uuid) IS NOT NULL
    ),
    today_work AS (
        -- Работа сегодня
        SELECT 
            COALESCE(e.user_id, tl.employee_id::text::uuid) as user_id,
            SUM(tl.time_spent_minutes::numeric / 60.0) as hours_today
        FROM task_logs tl
        LEFT JOIN employees e ON e.id = tl.employee_id
        LEFT JOIN user_profiles up ON up.id = COALESCE(e.user_id, tl.employee_id::text::uuid)
        WHERE 
            tl.work_date = CURRENT_DATE
            AND COALESCE(e.office_id, up.office_id, 1) = user_office_id
        GROUP BY COALESCE(e.user_id, tl.employee_id::text::uuid)
        HAVING SUM(tl.time_spent_minutes) > 0
    )
    SELECT 
        office_name_result::TEXT as office_name,
        (SELECT COUNT(*)::INTEGER FROM office_employees) as total_employees,
        (SELECT COUNT(*)::INTEGER FROM today_work WHERE hours_today > 0) as working_employees,
        COALESCE((SELECT SUM(hours_today) FROM today_work), 0)::NUMERIC as total_hours_today,
        CASE 
            WHEN (SELECT COUNT(*) FROM today_work WHERE hours_today > 0) > 0 
            THEN COALESCE((SELECT AVG(hours_today) FROM today_work WHERE hours_today > 0), 0)::NUMERIC
            ELSE 0::NUMERIC
        END as avg_hours_today;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ДАЕМ ПРАВА НА ВЫПОЛНЕНИЕ ФУНКЦИЙ
GRANT EXECUTE ON FUNCTION get_leaderboard_with_current_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_office_statistics(UUID) TO authenticated;

-- 4. ПРОВЕРЯЕМ ФУНКЦИИ
SELECT 'Функции для лидерборда и статистики офиса созданы успешно!' as status; 