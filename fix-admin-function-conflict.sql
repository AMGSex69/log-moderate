-- Исправление конфликта функций админки
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- 1. Удаляем старую функцию
DROP FUNCTION IF EXISTS get_employees_for_admin(UUID);

-- 2. Удаляем старую функцию update_employee_permissions если она есть
DROP FUNCTION IF EXISTS update_employee_permissions(UUID, UUID, INTEGER, TEXT, INTEGER);

-- 3. Создаем новую функцию для получения сотрудников с графиками работы
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
            e.full_name,
            COALESCE(au.email, 'no-email@example.com') as email,
            e.position as employee_position,
            e.office_id,
            o.name as office_name,
            COALESCE(e.admin_role, 'user') as admin_role,
            e.managed_office_id,
            COALESCE(e.is_admin, false) as is_admin,
            COALESCE(e.is_online, false) as is_online,
            e.last_seen,
            e.created_at,
            COALESCE(e.work_schedule, '5/2') as work_schedule,
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
            e.full_name,
            COALESCE(au.email, 'no-email@example.com') as email,
            e.position as employee_position,
            e.office_id,
            o.name as office_name,
            COALESCE(e.admin_role, 'user') as admin_role,
            e.managed_office_id,
            COALESCE(e.is_admin, false) as is_admin,
            COALESCE(e.is_online, false) as is_online,
            e.last_seen,
            e.created_at,
            COALESCE(e.work_schedule, '5/2') as work_schedule,
            COALESCE(e.work_hours, 9) as work_hours
        FROM employees e
        LEFT JOIN auth.users au ON au.id = e.user_id
        LEFT JOIN offices o ON o.id = e.office_id
        WHERE e.office_id = access_check.managed_office_id
        ORDER BY e.full_name;
    END IF;
END;
$$;

-- 4. Создаем функцию для обновления сотрудника с графиком работы
CREATE OR REPLACE FUNCTION update_employee_permissions_with_schedule(
    requesting_user_uuid UUID,
    target_user_uuid UUID,
    new_office_id INTEGER DEFAULT NULL,
    new_admin_role TEXT DEFAULT NULL,
    new_managed_office_id INTEGER DEFAULT NULL,
    new_work_schedule TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    access_check RECORD;
    target_employee_id INTEGER;
    new_work_hours INTEGER;
BEGIN
    -- Проверяем права доступа запрашивающего пользователя
    SELECT * INTO access_check 
    FROM check_admin_access_unified(requesting_user_uuid) 
    LIMIT 1;
    
    IF NOT access_check.can_access THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions';
    END IF;
    
    -- Получаем ID сотрудника
    SELECT id INTO target_employee_id 
    FROM employees 
    WHERE user_id = target_user_uuid;
    
    IF target_employee_id IS NULL THEN
        RAISE EXCEPTION 'Employee not found';
    END IF;
    
    -- Проверяем права на изменение графика работы (только супер админ)
    IF new_work_schedule IS NOT NULL AND NOT access_check.is_super_admin THEN
        RAISE EXCEPTION 'Access denied: only super admin can change work schedule';
    END IF;
    
    -- Валидируем график работы
    IF new_work_schedule IS NOT NULL AND new_work_schedule NOT IN ('5/2', '2/2') THEN
        RAISE EXCEPTION 'Invalid work schedule: must be 5/2 or 2/2';
    END IF;
    
    -- Вычисляем рабочие часы на основе графика
    IF new_work_schedule IS NOT NULL THEN
        new_work_hours := CASE 
            WHEN new_work_schedule = '2/2' THEN 12
            WHEN new_work_schedule = '5/2' THEN 9
            ELSE 9
        END;
    END IF;
    
    -- Обновляем employees
    UPDATE employees 
    SET 
        office_id = COALESCE(new_office_id, office_id),
        admin_role = COALESCE(new_admin_role, admin_role),
        managed_office_id = CASE 
            WHEN new_admin_role = 'office_admin' THEN new_managed_office_id
            WHEN new_admin_role = 'user' THEN NULL
            ELSE managed_office_id
        END,
        is_admin = CASE 
            WHEN new_admin_role IN ('office_admin', 'super_admin') THEN true
            WHEN new_admin_role = 'user' THEN false
            ELSE is_admin
        END,
        work_schedule = COALESCE(new_work_schedule, work_schedule),
        work_hours = COALESCE(new_work_hours, work_hours),
        updated_at = NOW()
    WHERE id = target_employee_id;
    
    -- Обновляем user_profiles
    UPDATE user_profiles 
    SET 
        admin_role = COALESCE(new_admin_role, admin_role),
        managed_office_id = CASE 
            WHEN new_admin_role = 'office_admin' THEN new_managed_office_id
            WHEN new_admin_role = 'user' THEN NULL
            ELSE managed_office_id
        END,
        is_admin = CASE 
            WHEN new_admin_role IN ('office_admin', 'super_admin') THEN true
            WHEN new_admin_role = 'user' THEN false
            ELSE is_admin
        END,
        work_schedule = COALESCE(new_work_schedule, work_schedule),
        work_hours = COALESCE(new_work_hours, work_hours),
        updated_at = NOW()
    WHERE id = target_user_uuid;
    
    RETURN TRUE;
END;
$$;

-- 5. Предоставляем права на выполнение функций
GRANT EXECUTE ON FUNCTION get_employees_for_admin TO authenticated;
GRANT EXECUTE ON FUNCTION update_employee_permissions_with_schedule TO authenticated;

-- 6. Создаем функцию для получения информации о графике работы
CREATE OR REPLACE FUNCTION get_work_schedule_info(schedule_type TEXT)
RETURNS TABLE (
    schedule_name TEXT,
    daily_hours INTEGER,
    work_hours INTEGER,
    break_hours INTEGER,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN schedule_type = '5/2' THEN '5/2 (Пятидневка)'::TEXT
            WHEN schedule_type = '2/2' THEN '2/2 (Сменный)'::TEXT
            ELSE 'Неизвестный график'::TEXT
        END as schedule_name,
        CASE 
            WHEN schedule_type = '5/2' THEN 9
            WHEN schedule_type = '2/2' THEN 12
            ELSE 8
        END as daily_hours,
        CASE 
            WHEN schedule_type = '5/2' THEN 8
            WHEN schedule_type = '2/2' THEN 11
            ELSE 7
        END as work_hours,
        1 as break_hours,
        CASE 
            WHEN schedule_type = '5/2' THEN '8 часов работы + 1 час обед'::TEXT
            WHEN schedule_type = '2/2' THEN '11 часов работы + 1 час обед'::TEXT
            ELSE 'Стандартный график'::TEXT
        END as description;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_work_schedule_info TO authenticated;

SELECT 'Функции для управления графиками работы успешно созданы!' as status; 