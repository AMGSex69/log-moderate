-- Исправление типов данных в функции админки
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- 1. Удаляем проблемную функцию
DROP FUNCTION IF EXISTS get_employees_for_admin(UUID);

-- 2. Создаем функцию с правильными типами данных
CREATE OR REPLACE FUNCTION get_employees_for_admin(requesting_user_uuid UUID)
RETURNS TABLE (
    employee_id INTEGER,
    user_id UUID,
    full_name TEXT,
    email TEXT,
    employee_position TEXT,
    office_id INTEGER,
    office_name TEXT,
    admin_role TEXT,
    managed_office_id INTEGER,
    is_admin BOOLEAN,
    is_online BOOLEAN,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    work_schedule TEXT,
    work_hours INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    access_check RECORD;
BEGIN
    -- Проверяем права доступа
    SELECT * INTO access_check 
    FROM check_admin_access_unified(requesting_user_uuid) 
    LIMIT 1;
    
    IF NOT access_check.can_access THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions';
    END IF;
    
    -- Возвращаем сотрудников в зависимости от уровня доступа
    IF access_check.is_super_admin THEN
        -- Супер-админ видит всех сотрудников
        RETURN QUERY
        SELECT 
            e.id as employee_id,
            e.user_id,
            COALESCE(e.full_name, '')::TEXT as full_name,
            COALESCE(au.email, 'no-email@example.com')::TEXT as email,
            COALESCE(e.position, '')::TEXT as employee_position,
            e.office_id,
            COALESCE(o.name, '')::TEXT as office_name,
            COALESCE(e.admin_role, 'user')::TEXT as admin_role,
            e.managed_office_id,
            COALESCE(e.is_admin, false) as is_admin,
            COALESCE(e.is_online, false) as is_online,
            e.last_seen,
            e.created_at,
            COALESCE(e.work_schedule, '5/2')::TEXT as work_schedule,
            COALESCE(e.work_hours, 9) as work_hours
        FROM employees e
        LEFT JOIN auth.users au ON au.id = e.user_id
        LEFT JOIN offices o ON o.id = e.office_id
        ORDER BY e.full_name;
        
    ELSIF access_check.is_office_admin THEN
        -- Офис-админ видит только сотрудников своего офиса
        RETURN QUERY
        SELECT 
            e.id as employee_id,
            e.user_id,
            COALESCE(e.full_name, '')::TEXT as full_name,
            COALESCE(au.email, 'no-email@example.com')::TEXT as email,
            COALESCE(e.position, '')::TEXT as employee_position,
            e.office_id,
            COALESCE(o.name, '')::TEXT as office_name,
            COALESCE(e.admin_role, 'user')::TEXT as admin_role,
            e.managed_office_id,
            COALESCE(e.is_admin, false) as is_admin,
            COALESCE(e.is_online, false) as is_online,
            e.last_seen,
            e.created_at,
            COALESCE(e.work_schedule, '5/2')::TEXT as work_schedule,
            COALESCE(e.work_hours, 9) as work_hours
        FROM employees e
        LEFT JOIN auth.users au ON au.id = e.user_id
        LEFT JOIN offices o ON o.id = e.office_id
        WHERE e.office_id = access_check.managed_office_id
        ORDER BY e.full_name;
    END IF;
END;
$$;

-- 3. Предоставляем права на выполнение функции
GRANT EXECUTE ON FUNCTION get_employees_for_admin TO authenticated;

-- 4. Тестируем структуру возвращаемых данных
SELECT 'Проверка структуры функции:' as info;

-- 5. Проверяем типы столбцов в таблице employees
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND column_name IN ('full_name', 'position', 'admin_role', 'work_schedule')
ORDER BY column_name;

SELECT 'Функция get_employees_for_admin исправлена!' as status; 