-- ===========================================
-- ПРОВЕРКА И ОЧИСТКА БАЗЫ ДАННЫХ
-- ===========================================

-- 1. ПРОВЕРЯЕМ ТЕКУЩУЮ СТРУКТУРУ
SELECT 'ТЕКУЩИЕ ТАБЛИЦЫ:' as info;
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

SELECT 'ТЕКУЩИЕ ФУНКЦИИ:' as info;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;

-- 2. ПРОВЕРЯЕМ СТАТИСТИКУ ОФИСОВ
SELECT 'ОФИСЫ:' as info;
SELECT * FROM public.offices ORDER BY name;

SELECT 'ПОЛЬЗОВАТЕЛИ ПО ОФИСАМ:' as info;
SELECT 
    o.name as office_name,
    COUNT(up.id) as user_profiles_count,
    COUNT(e.id) as employees_count
FROM offices o
LEFT JOIN user_profiles up ON up.office_id = o.id
LEFT JOIN employees e ON e.office_id = o.id
GROUP BY o.id, o.name
ORDER BY o.name;

-- 3. ПРОВЕРЯЕМ РАБОТУ ФУНКЦИИ get_office_statistics
SELECT 'ТЕСТ ФУНКЦИИ get_office_statistics:' as info;

-- Берем любого пользователя для теста
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Тестируем функцию для пользователя: %', test_user_id;
        PERFORM * FROM get_office_statistics(test_user_id);
    ELSE
        RAISE NOTICE 'Нет пользователей для тестирования';
    END IF;
END $$;

-- 4. УДАЛЯЕМ НЕНУЖНЫЕ ТАБЛИЦЫ И ФУНКЦИИ

-- Удаляем старые таблицы округов если есть
DROP TABLE IF EXISTS public.districts CASCADE;
DROP TABLE IF EXISTS public.district_stats CASCADE;

-- Удаляем дублирующие функции
DROP FUNCTION IF EXISTS get_district_statistics CASCADE;
DROP FUNCTION IF EXISTS get_district_leaderboard CASCADE;
DROP FUNCTION IF EXISTS employee_district_stats CASCADE;

-- Удаляем старые представления
DROP VIEW IF EXISTS employee_district_stats CASCADE;
DROP VIEW IF EXISTS district_employee_stats CASCADE;

-- 5. СОЗДАЕМ ПРАВИЛЬНУЮ ФУНКЦИЮ get_office_statistics
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
    user_office_id INTEGER;
    user_role TEXT;
BEGIN
    -- Получаем офис и роль пользователя
    SELECT 
        COALESCE(up.office_id, 1), -- По умолчанию офис "Рассвет"
        COALESCE(up.role, 'user')
    INTO user_office_id, user_role
    FROM user_profiles up
    WHERE up.id = requesting_user_uuid;

    -- Если офис не найден, используем офис "Рассвет"
    IF user_office_id IS NULL THEN
        SELECT id INTO user_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;
    END IF;

    -- Возвращаем статистику офиса
    RETURN QUERY
    SELECT 
        o.id::INTEGER as office_id,
        o.name::TEXT as office_name,
        COALESCE(COUNT(DISTINCT e.id), 0)::BIGINT as total_employees,
        COALESCE(COUNT(DISTINCT CASE 
            WHEN ws.clock_in_time IS NOT NULL AND ws.clock_out_time IS NULL 
            THEN e.id 
        END), 0)::BIGINT as working_employees,
        COALESCE(SUM(ws.total_work_minutes), 0)::NUMERIC / 60.0 as total_hours_today,
        COALESCE(
            CASE 
                WHEN COUNT(DISTINCT CASE WHEN ws.total_work_minutes > 0 THEN e.id END) > 0 
                THEN AVG(ws.total_work_minutes) 
                ELSE 0 
            END, 0
        )::NUMERIC / 60.0 as avg_hours_today
    FROM offices o
    LEFT JOIN employees e ON e.office_id = o.id
    LEFT JOIN work_sessions ws ON ws.employee_id = e.id AND ws.date = CURRENT_DATE
    WHERE o.id = user_office_id
    GROUP BY o.id, o.name;
END;
$$;

-- 6. ОБНОВЛЯЕМ ФУНКЦИЮ ЛИДЕРБОРДА
CREATE OR REPLACE FUNCTION get_leaderboard_with_current_user(current_user_uuid UUID)
RETURNS TABLE (
    name TEXT,
    score TEXT,
    rank INTEGER,
    is_current_user BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_office_id INTEGER;
    user_role TEXT;
BEGIN
    -- Получаем офис и роль текущего пользователя
    SELECT 
        COALESCE(up.office_id, 1), -- По умолчанию офис "Рассвет"
        COALESCE(up.role, 'user')
    INTO user_office_id, user_role
    FROM user_profiles up
    WHERE up.id = current_user_uuid;

    -- Возвращаем лидерборд в зависимости от роли
    RETURN QUERY
    SELECT 
        e.full_name::TEXT as name,
        COALESCE(ROUND(SUM(ws.total_work_minutes) / 60.0, 1)::TEXT || ' ч', '0 ч')::TEXT as score,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ws.total_work_minutes), 0) DESC)::INTEGER as rank,
        (e.user_id = current_user_uuid)::BOOLEAN as is_current_user
    FROM employees e
    LEFT JOIN work_sessions ws ON ws.employee_id = e.id 
        AND ws.date >= CURRENT_DATE - INTERVAL '7 days' -- Статистика за неделю
    WHERE 
        CASE 
            WHEN user_role = 'super_admin' THEN true  -- Супер-админы видят всех
            WHEN user_role = 'office_admin' THEN e.office_id = user_office_id  -- Админы офиса видят свой офис
            ELSE e.office_id = user_office_id  -- Обычные пользователи видят свой офис
        END
    GROUP BY e.id, e.full_name, e.user_id
    HAVING SUM(ws.total_work_minutes) > 0 -- Показываем только тех, кто работал
    ORDER BY COALESCE(SUM(ws.total_work_minutes), 0) DESC
    LIMIT 10;
END;
$$;

-- 7. ПРОСТАЯ ФУНКЦИЯ get_or_create_employee_id
CREATE OR REPLACE FUNCTION get_or_create_employee_id(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    employee_id INTEGER;
    user_name TEXT;
    default_office_id INTEGER;
BEGIN
    -- Сначала пробуем найти существующего сотрудника
    SELECT id INTO employee_id
    FROM employees
    WHERE user_id = user_uuid;

    -- Если нашли, возвращаем
    IF employee_id IS NOT NULL THEN
        RETURN employee_id;
    END IF;

    -- Если не нашли, создаем нового
    -- Получаем имя пользователя
    SELECT COALESCE(up.full_name, au.email, 'Пользователь') INTO user_name
    FROM auth.users au
    LEFT JOIN user_profiles up ON up.id = au.id
    WHERE au.id = user_uuid;

    -- Получаем ID офиса "Рассвет" как офис по умолчанию
    SELECT id INTO default_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;

    -- Создаем нового сотрудника
    INSERT INTO employees (
        user_id,
        full_name,
        position,
        work_schedule,
        work_hours,
        is_admin,
        is_online,
        office_id,
        created_at,
        updated_at
    ) VALUES (
        user_uuid,
        user_name,
        'Сотрудник',
        '5/2',
        9,
        false,
        false,
        default_office_id,
        NOW(),
        NOW()
    )
    RETURNING id INTO employee_id;

    RETURN employee_id;
END;
$$;

-- 8. ПРОВЕРЯЕМ РЕЗУЛЬТАТ ОЧИСТКИ
SELECT 'РЕЗУЛЬТАТ ОЧИСТКИ:' as info;

SELECT 'Оставшиеся таблицы:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;

SELECT 'Функции для офисов:' as info;
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND (routine_name LIKE '%office%' OR routine_name LIKE '%employee%' OR routine_name LIKE '%leaderboard%')
ORDER BY routine_name;

-- Тестируем функцию статистики
SELECT 'ТЕСТ ОБНОВЛЕННОЙ ФУНКЦИИ:' as info;
SELECT * FROM get_office_statistics(
    (SELECT id FROM auth.users LIMIT 1)
);

SELECT 'ОЧИСТКА ЗАВЕРШЕНА ✅' as status; 