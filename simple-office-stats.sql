-- ПРОСТАЯ ФУНКЦИЯ СТАТИСТИКИ ОФИСА
-- Заменяет сложную функцию на простую и надежную

CREATE OR REPLACE FUNCTION get_office_statistics(requesting_user_uuid UUID)
RETURNS TABLE (
    office_id INTEGER,
    office_name TEXT,
    total_employees BIGINT,
    working_employees BIGINT,
    total_hours_today NUMERIC,
    avg_hours_today NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_office_id INTEGER := 1; -- По умолчанию офис "Рассвет"
    user_role TEXT := 'user';
BEGIN
    -- Получаем офис пользователя (сначала из user_profiles, потом из employees)
    SELECT COALESCE(up.office_id, 1), COALESCE(up.role, 'user')
    INTO user_office_id, user_role
    FROM user_profiles up
    WHERE up.id = requesting_user_uuid;
    
    -- Если не найден в user_profiles, ищем в employees
    IF user_office_id = 1 THEN
        SELECT COALESCE(e.office_id, 1) INTO user_office_id
        FROM employees e
        WHERE e.user_id = requesting_user_uuid;
    END IF;
    
    -- Возвращаем простую статистику
    RETURN QUERY
    SELECT 
        user_office_id::INTEGER as office_id,
        COALESCE(o.name, 'Рассвет')::TEXT as office_name,
        COALESCE(employees_count.total, 0)::BIGINT as total_employees,
        COALESCE(working_count.working, 0)::BIGINT as working_employees,
        COALESCE(work_stats.total_hours, 0)::NUMERIC as total_hours_today,
        COALESCE(work_stats.avg_hours, 0)::NUMERIC as avg_hours_today
    FROM offices o
    LEFT JOIN (
        -- Считаем всех сотрудников в офисе
        SELECT COUNT(*) as total
        FROM employees
        WHERE office_id = user_office_id
    ) employees_count ON true
    LEFT JOIN (
        -- Считаем работающих сейчас
        SELECT COUNT(*) as working
        FROM employees e
        INNER JOIN work_sessions ws ON ws.employee_id = e.id
        WHERE e.office_id = user_office_id
        AND ws.date = CURRENT_DATE
        AND ws.clock_in_time IS NOT NULL
        AND ws.clock_out_time IS NULL
    ) working_count ON true
    LEFT JOIN (
        -- Считаем общие часы и среднее
        SELECT 
            COALESCE(SUM(ws.total_work_minutes) / 60.0, 0) as total_hours,
            CASE 
                WHEN COUNT(CASE WHEN ws.total_work_minutes > 0 THEN 1 END) > 0 
                THEN AVG(CASE WHEN ws.total_work_minutes > 0 THEN ws.total_work_minutes END) / 60.0
                ELSE 0 
            END as avg_hours
        FROM employees e
        LEFT JOIN work_sessions ws ON ws.employee_id = e.id AND ws.date = CURRENT_DATE
        WHERE e.office_id = user_office_id
    ) work_stats ON true
    WHERE o.id = user_office_id;
END;
$$;

-- ТЕСТ ФУНКЦИИ
SELECT 'ТЕСТ ПРОСТОЙ ФУНКЦИИ:' as info;
SELECT * FROM get_office_statistics('00000000-0000-0000-0000-000000000000'::UUID);

-- Если есть реальные пользователи, тестируем с ними
DO $$
DECLARE
    test_user_id UUID;
    test_result RECORD;
BEGIN
    -- Берем любого пользователя из auth.users
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Тестируем для пользователя: %', test_user_id;
        
        FOR test_result IN 
            SELECT * FROM get_office_statistics(test_user_id)
        LOOP
            RAISE NOTICE 'Результат: office_id=%, office_name=%, total_employees=%, working_employees=%, total_hours=%, avg_hours=%', 
                test_result.office_id, 
                test_result.office_name, 
                test_result.total_employees, 
                test_result.working_employees, 
                test_result.total_hours_today, 
                test_result.avg_hours_today;
        END LOOP;
    ELSE
        RAISE NOTICE 'Нет пользователей для тестирования';
    END IF;
END $$; 