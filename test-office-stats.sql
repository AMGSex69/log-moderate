-- ТЕСТ СТАТИСТИКИ ОФИСОВ

-- 1. Проверяем что у нас есть в таблице offices
SELECT 'ОФИСЫ:' as info;
SELECT id, name FROM offices ORDER BY id;

-- 2. Проверяем user_profiles с офисами
SELECT 'ПОЛЬЗОВАТЕЛИ В ОФИСАХ:' as info;
SELECT 
    up.id,
    up.full_name,
    up.office_id,
    o.name as office_name
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
ORDER BY up.full_name;

-- 3. Проверяем employees с офисами
SELECT 'СОТРУДНИКИ В ОФИСАХ:' as info;
SELECT 
    e.id,
    e.full_name,
    e.office_id,
    o.name as office_name,
    e.user_id
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
ORDER BY e.full_name;

-- 4. Проверяем work_sessions
SELECT 'РАБОЧИЕ СЕССИИ СЕГОДНЯ:' as info;
SELECT 
    ws.id,
    ws.employee_id,
    e.full_name,
    ws.clock_in_time,
    ws.clock_out_time,
    ws.total_work_minutes
FROM work_sessions ws
JOIN employees e ON e.id = ws.employee_id
WHERE ws.date = CURRENT_DATE
ORDER BY e.full_name;

-- 5. СОЗДАЕМ ПРОСТУЮ ФУНКЦИЮ БЕЗ СЛОЖНОЙ ЛОГИКИ
CREATE OR REPLACE FUNCTION get_office_statistics_simple(requesting_user_uuid UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_office_id INTEGER;
    result JSON;
BEGIN
    -- Получаем офис пользователя из user_profiles
    SELECT office_id INTO user_office_id
    FROM user_profiles
    WHERE id = requesting_user_uuid;
    
    -- Если не найден в user_profiles, смотрим в employees
    IF user_office_id IS NULL THEN
        SELECT office_id INTO user_office_id
        FROM employees
        WHERE user_id = requesting_user_uuid;
    END IF;
    
    -- Если все еще NULL, используем офис "Рассвет"
    IF user_office_id IS NULL THEN
        SELECT id INTO user_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;
    END IF;
    
    -- Формируем результат
    SELECT json_build_object(
        'office_id', user_office_id,
        'office_name', COALESCE(o.name, 'Неизвестный офис'),
        'total_employees', COALESCE(emp_count.total, 0),
        'working_employees', COALESCE(working_count.working, 0),
        'total_hours_today', COALESCE(ROUND(work_stats.total_hours, 1), 0),
        'avg_hours_today', COALESCE(ROUND(work_stats.avg_hours, 1), 0)
    ) INTO result
    FROM offices o
    LEFT JOIN (
        SELECT office_id, COUNT(*) as total
        FROM employees
        WHERE office_id = user_office_id
        GROUP BY office_id
    ) emp_count ON emp_count.office_id = o.id
    LEFT JOIN (
        SELECT e.office_id, COUNT(*) as working
        FROM employees e
        JOIN work_sessions ws ON ws.employee_id = e.id
        WHERE e.office_id = user_office_id
        AND ws.date = CURRENT_DATE
        AND ws.clock_in_time IS NOT NULL
        AND ws.clock_out_time IS NULL
        GROUP BY e.office_id
    ) working_count ON working_count.office_id = o.id
    LEFT JOIN (
        SELECT e.office_id, 
               SUM(ws.total_work_minutes) / 60.0 as total_hours,
               CASE 
                   WHEN COUNT(CASE WHEN ws.total_work_minutes > 0 THEN 1 END) > 0 
                   THEN AVG(CASE WHEN ws.total_work_minutes > 0 THEN ws.total_work_minutes END) / 60.0
                   ELSE 0 
               END as avg_hours
        FROM employees e
        LEFT JOIN work_sessions ws ON ws.employee_id = e.id AND ws.date = CURRENT_DATE
        WHERE e.office_id = user_office_id
        GROUP BY e.office_id
    ) work_stats ON work_stats.office_id = o.id
    WHERE o.id = user_office_id;
    
    RETURN result;
END;
$$;

-- 6. ТЕСТИРУЕМ ПРОСТУЮ ФУНКЦИЮ
SELECT 'ТЕСТ ПРОСТОЙ ФУНКЦИИ:' as info;

-- Берем первого пользователя для теста
DO $$
DECLARE
    test_user_id UUID;
    test_result JSON;
BEGIN
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        SELECT get_office_statistics_simple(test_user_id) INTO test_result;
        RAISE NOTICE 'Результат для пользователя %: %', test_user_id, test_result;
    ELSE
        RAISE NOTICE 'Нет пользователей для тестирования';
    END IF;
END $$; 