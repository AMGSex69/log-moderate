-- Исправление проблемы "Employee not found" (исправленная версия)
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- 1. Проверяем текущее состояние данных
SELECT 'Диагностика проблемы Employee not found:' as info;

-- Проверяем сотрудников с пустыми или некорректными user_id
SELECT 
    id,
    user_id,
    full_name,
    CASE 
        WHEN user_id IS NULL THEN '❌ NULL user_id'
        WHEN LENGTH(user_id::text) < 30 THEN '❌ Некорректный user_id'
        ELSE '✅ Корректный user_id'
    END as user_id_status
FROM employees 
WHERE user_id IS NULL OR LENGTH(user_id::text) < 30
ORDER BY id;

-- 2. Исправляем функцию update_employee_permissions_with_schedule
DROP FUNCTION IF EXISTS update_employee_permissions_with_schedule(UUID, UUID, INTEGER, TEXT, INTEGER, TEXT);

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
    
    RAISE NOTICE 'Обновление завершено успешно';
    RETURN TRUE;
END;
$$;

-- 3. Предоставляем права на выполнение функции
GRANT EXECUTE ON FUNCTION update_employee_permissions_with_schedule TO authenticated;

-- 4. Проверяем корректность данных после исправления
SELECT 'Проверка корректности данных:' as info;

SELECT 
    COUNT(*) as total_employees,
    COUNT(CASE WHEN user_id IS NOT NULL AND LENGTH(user_id::text) >= 30 THEN 1 END) as valid_user_ids,
    COUNT(CASE WHEN user_id IS NULL OR LENGTH(user_id::text) < 30 THEN 1 END) as invalid_user_ids
FROM employees;

-- 5. Показываем первых 5 сотрудников для проверки
SELECT 
    id,
    LEFT(user_id::text, 8) || '...' as user_id_preview,
    full_name,
    office_id,
    admin_role,
    work_schedule,
    work_hours
FROM employees 
WHERE user_id IS NOT NULL
ORDER BY id
LIMIT 5;

-- 6. Проверяем связь между auth.users и employees
SELECT 'Проверка связи auth.users <-> employees:' as info;

SELECT 
    'В auth.users но не в employees' as status,
    COUNT(*) as count
FROM auth.users au
LEFT JOIN employees e ON e.user_id = au.id
WHERE e.id IS NULL;

SELECT 
    'В employees но не в auth.users' as status,
    COUNT(*) as count
FROM employees e
LEFT JOIN auth.users au ON au.id = e.user_id
WHERE au.id IS NULL;

SELECT 'Исправление Employee not found завершено!' as status; 