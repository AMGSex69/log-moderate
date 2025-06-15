-- Исправляем функцию update_employee_permissions
-- Выполнить в Supabase Dashboard -> SQL Editor

-- 1. Пересоздаем функцию без проблемных операций
CREATE OR REPLACE FUNCTION update_employee_permissions(
    requesting_user_uuid UUID,
    target_user_uuid UUID,
    new_office_id INTEGER DEFAULT NULL,
    new_admin_role TEXT DEFAULT NULL,
    new_managed_office_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    access_check RECORD;
    target_current_office INTEGER;
    update_count INTEGER;
BEGIN
    -- Проверяем права доступа
    SELECT * INTO access_check FROM check_admin_access(requesting_user_uuid);
    
    IF NOT access_check.can_access THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions';
    END IF;
    
    -- Получаем текущий офис целевого пользователя
    SELECT office_id INTO target_current_office 
    FROM user_profiles WHERE id = target_user_uuid;
    
    -- Офис-админ может управлять только сотрудниками своего офиса
    IF access_check.is_office_admin THEN
        IF target_current_office != access_check.managed_office_id THEN
            RAISE EXCEPTION 'Access denied: can only manage employees from your office';
        END IF;
        
        -- Офис-админ не может назначать супер-админов
        IF new_admin_role = 'super_admin' THEN
            RAISE EXCEPTION 'Access denied: cannot assign super admin role';
        END IF;
    END IF;
    
    -- Обновляем user_profiles (основная таблица)
    UPDATE user_profiles 
    SET 
        office_id = COALESCE(new_office_id, office_id),
        admin_role = COALESCE(new_admin_role, admin_role),
        managed_office_id = CASE 
            WHEN new_admin_role = 'office_admin' THEN COALESCE(new_managed_office_id, new_office_id, office_id)
            WHEN new_admin_role = 'user' THEN NULL
            ELSE managed_office_id
        END,
        is_admin = CASE 
            WHEN new_admin_role IN ('office_admin', 'super_admin') THEN true
            WHEN new_admin_role = 'user' THEN false
            ELSE is_admin
        END,
        updated_at = NOW()
    WHERE id = target_user_uuid;
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    
    -- Проверяем, что обновление прошло успешно
    IF update_count = 0 THEN
        RAISE EXCEPTION 'User not found or update failed';
    END IF;
    
    -- Обновляем employees для совместимости (если запись существует)
    UPDATE employees 
    SET 
        office_id = COALESCE(new_office_id, office_id),
        admin_role = COALESCE(new_admin_role, admin_role),
        managed_office_id = CASE 
            WHEN new_admin_role = 'office_admin' THEN COALESCE(new_managed_office_id, new_office_id, office_id)
            WHEN new_admin_role = 'user' THEN NULL
            ELSE managed_office_id
        END,
        is_admin = CASE 
            WHEN new_admin_role IN ('office_admin', 'super_admin') THEN true
            WHEN new_admin_role = 'user' THEN false
            ELSE is_admin
        END,
        updated_at = NOW()
    WHERE user_id = target_user_uuid;
    
    -- Логируем успешное обновление
    RAISE NOTICE 'Employee permissions updated successfully for user %', target_user_uuid;
    
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Логируем ошибку и пробрасываем её дальше
        RAISE NOTICE 'Error in update_employee_permissions: %', SQLERRM;
        RAISE;
END;
$$;

-- 2. Проверяем, что функция создана
SELECT 
    'Function check' as info,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'update_employee_permissions';

-- 3. Тестируем функцию (замените UUID на реальные)
-- SELECT update_employee_permissions(
--     'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID,  -- requesting user
--     'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID,  -- target user  
--     1,  -- office_id
--     'user',  -- admin_role
--     NULL  -- managed_office_id
-- ); 