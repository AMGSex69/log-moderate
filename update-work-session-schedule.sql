-- Обновление времени окончания в активных рабочих сессиях при изменении графика работы
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- Функция для пересчета времени окончания рабочей сессии
CREATE OR REPLACE FUNCTION recalculate_work_session_end_time(
    target_user_uuid UUID,
    new_work_hours INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_employee_id INTEGER;
    active_session RECORD;
    new_expected_end_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Получаем employee_id
    SELECT id INTO target_employee_id 
    FROM employees 
    WHERE user_id = target_user_uuid;
    
    IF target_employee_id IS NULL THEN
        RAISE NOTICE 'Employee not found for user_id: %', target_user_uuid;
        RETURN FALSE;
    END IF;
    
    -- Ищем активную рабочую сессию (начата, но не завершена)
    SELECT * INTO active_session
    FROM work_sessions 
    WHERE employee_id = target_employee_id 
    AND date = CURRENT_DATE 
    AND clock_in_time IS NOT NULL 
    AND clock_out_time IS NULL;
    
    IF active_session.id IS NULL THEN
        RAISE NOTICE 'No active work session found for employee_id: %', target_employee_id;
        RETURN FALSE;
    END IF;
    
    -- Вычисляем новое время окончания
    new_expected_end_time := active_session.clock_in_time + (new_work_hours || ' hours')::INTERVAL;
    
    RAISE NOTICE 'Recalculating work session end time: old=%, new=%', 
        active_session.expected_end_time, new_expected_end_time;
    
    -- Обновляем время окончания
    UPDATE work_sessions 
    SET 
        expected_end_time = new_expected_end_time,
        updated_at = NOW()
    WHERE id = active_session.id;
    
    RAISE NOTICE 'Work session end time updated successfully';
    RETURN TRUE;
END;
$$;

-- Предоставляем права на выполнение функции
GRANT EXECUTE ON FUNCTION recalculate_work_session_end_time TO authenticated;

-- Обновляем функцию update_employee_permissions_with_schedule для автоматического пересчета
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
    target_employee_record RECORD;
    new_work_hours INTEGER;
BEGIN
    -- Отладочная информация
    RAISE NOTICE 'Запрос на обновление сотрудника: target_user_uuid=%, new_office_id=%, new_admin_role=%, new_work_schedule=%', 
        target_user_uuid, new_office_id, new_admin_role, new_work_schedule;

    -- Проверяем права доступа запрашивающего пользователя
    SELECT * INTO access_check 
    FROM check_admin_access_unified(requesting_user_uuid) 
    LIMIT 1;
    
    IF NOT access_check.can_access THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions';
    END IF;
    
    -- Ищем сотрудника по user_id с дополнительной информацией
    SELECT 
        e.id,
        e.user_id,
        e.full_name,
        e.office_id,
        e.admin_role,
        e.work_schedule,
        e.work_hours
    INTO target_employee_record 
    FROM employees e
    WHERE e.user_id = target_user_uuid;
    
    IF target_employee_record.id IS NULL THEN
        -- Пытаемся найти по другим критериям для отладки
        RAISE NOTICE 'Сотрудник не найден по user_id: %', target_user_uuid;
        
        -- Показываем всех сотрудников для отладки
        RAISE NOTICE 'Доступные сотрудники:';
        FOR target_employee_record IN 
            SELECT id, user_id, full_name FROM employees ORDER BY id LIMIT 5
        LOOP
            RAISE NOTICE 'ID: %, User_ID: %, Name: %', 
                target_employee_record.id, 
                target_employee_record.user_id, 
                target_employee_record.full_name;
        END LOOP;
        
        -- Проверяем, есть ли вообще такой user_id в базе auth.users
        PERFORM 1 FROM auth.users WHERE id = target_user_uuid;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'User not found in auth.users: %', target_user_uuid;
        END IF;
        
        RAISE EXCEPTION 'Employee record not found for user_id: %. Employee may not be properly registered.', target_user_uuid;
    END IF;
    
    target_employee_id := target_employee_record.id;
    
    RAISE NOTICE 'Найден сотрудник: id=%, name=%, current_office=%, current_role=%', 
        target_employee_id, target_employee_record.full_name, target_employee_record.office_id, target_employee_record.admin_role;
    
    -- Проверяем права на изменение графика работы (только супер админ)
    IF new_work_schedule IS NOT NULL AND NOT access_check.is_super_admin THEN
        RAISE EXCEPTION 'Access denied: only super admin can change work schedule';
    END IF;
    
    -- Валидируем график работы
    IF new_work_schedule IS NOT NULL AND new_work_schedule NOT IN ('5/2', '2/2') THEN
        RAISE EXCEPTION 'Invalid work schedule: must be 5/2 or 2/2, got: %', new_work_schedule;
    END IF;
    
    -- Вычисляем рабочие часы на основе графика
    IF new_work_schedule IS NOT NULL THEN
        new_work_hours := CASE 
            WHEN new_work_schedule = '2/2' THEN 12
            WHEN new_work_schedule = '5/2' THEN 9
            ELSE 9
        END;
        RAISE NOTICE 'Новый график работы: % (% часов)', new_work_schedule, new_work_hours;
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
    
    -- Проверяем, что обновление прошло успешно
    GET DIAGNOSTICS target_employee_id = ROW_COUNT;
    IF target_employee_id = 0 THEN
        RAISE EXCEPTION 'Failed to update employee record';
    END IF;
    
    -- Обновляем user_profiles если запись существует
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
    
    -- НОВОЕ: Пересчитываем время окончания активной рабочей сессии при изменении графика
    IF new_work_schedule IS NOT NULL AND new_work_hours IS NOT NULL THEN
        PERFORM recalculate_work_session_end_time(target_user_uuid, new_work_hours);
    END IF;
    
    RAISE NOTICE 'Обновление завершено успешно';
    RETURN TRUE;
END;
$$;

-- Предоставляем права на выполнение обновленной функции
GRANT EXECUTE ON FUNCTION update_employee_permissions_with_schedule TO authenticated;

SELECT 'Функции для пересчета времени работы созданы!' as status; 