-- ===========================================
-- ИСПРАВЛЕНИЕ ОШИБКИ 400 В update_employee_permissions
-- ===========================================
-- Функция возвращает ошибку 400 при вызове из админки

-- 1. ПРОВЕРЯЕМ ТЕКУЩЕЕ СОСТОЯНИЕ ФУНКЦИИ
SELECT 'Проверяем функцию update_employee_permissions:' as step_1;

SELECT 
    proname as function_name,
    pronargs as num_args,
    proargnames as arg_names,
    proargtypes::regtype[] as arg_types
FROM pg_proc 
WHERE proname = 'update_employee_permissions';

-- 2. УДАЛЯЕМ СТАРУЮ ФУНКЦИЮ И СОЗДАЕМ НОВУЮ УПРОЩЕННУЮ ВЕРСИЮ
DROP FUNCTION IF EXISTS update_employee_permissions(UUID, UUID, INTEGER, TEXT, INTEGER);

-- 3. СОЗДАЕМ УПРОЩЕННУЮ ФУНКЦИЮ БЕЗ СЛОЖНОЙ ЛОГИКИ
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
    requesting_user_record RECORD;
    target_user_record RECORD;
    old_office_id INTEGER;
    new_office_name TEXT;
BEGIN
    -- Логируем входные параметры для отладки
    RAISE NOTICE 'update_employee_permissions called with: requesting_user=%, target_user=%, office_id=%, admin_role=%, managed_office_id=%', 
        requesting_user_uuid, target_user_uuid, new_office_id, new_admin_role, new_managed_office_id;

    -- Проверяем что запрашивающий пользователь существует
    SELECT * INTO requesting_user_record 
    FROM user_profiles 
    WHERE id = requesting_user_uuid;
    
    IF requesting_user_record IS NULL THEN
        RAISE EXCEPTION 'Requesting user not found: %', requesting_user_uuid;
    END IF;

    -- Проверяем что целевой пользователь существует
    SELECT * INTO target_user_record 
    FROM user_profiles 
    WHERE id = target_user_uuid;
    
    IF target_user_record IS NULL THEN
        RAISE EXCEPTION 'Target user not found: %', target_user_uuid;
    END IF;

    -- Сохраняем старый офис для логирования
    old_office_id := target_user_record.office_id;

    -- Получаем название нового офиса если офис меняется
    IF new_office_id IS NOT NULL AND new_office_id != old_office_id THEN
        SELECT name INTO new_office_name 
        FROM offices 
        WHERE id = new_office_id;
        
        IF new_office_name IS NULL THEN
            RAISE EXCEPTION 'Office not found: %', new_office_id;
        END IF;
    END IF;

    -- Обновляем user_profiles (основная таблица)
    UPDATE user_profiles 
    SET 
        office_id = COALESCE(new_office_id, office_id),
        office_name = CASE 
            WHEN new_office_id IS NOT NULL THEN new_office_name
            ELSE office_name
        END,
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
    RAISE NOTICE 'Employee permissions updated successfully: user=%, old_office=%, new_office=%, admin_role=%', 
        target_user_uuid, old_office_id, new_office_id, new_admin_role;

    RETURN true;

EXCEPTION
    WHEN OTHERS THEN
        -- Логируем ошибку
        RAISE NOTICE 'Error in update_employee_permissions: %', SQLERRM;
        RAISE;
END;
$$;

-- 4. ПРЕДОСТАВЛЯЕМ ПРАВА НА ВЫПОЛНЕНИЕ
GRANT EXECUTE ON FUNCTION update_employee_permissions(UUID, UUID, INTEGER, TEXT, INTEGER) TO authenticated;

-- 5. ТЕСТИРУЕМ ФУНКЦИЮ
SELECT 'Тестируем функцию:' as step_5;

-- Проверяем что функция создана
SELECT 
    proname as function_name,
    pronargs as num_args,
    proargnames as arg_names
FROM pg_proc 
WHERE proname = 'update_employee_permissions';

-- 6. СОЗДАЕМ ТАКЖЕ ФУНКЦИЮ check_admin_access ЕСЛИ ЕЕ НЕТ
CREATE OR REPLACE FUNCTION check_admin_access(user_uuid UUID)
RETURNS TABLE (
    can_access BOOLEAN,
    is_super_admin BOOLEAN,
    is_office_admin BOOLEAN,
    managed_office_id INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Получаем данные пользователя
    SELECT 
        admin_role,
        managed_office_id as office_id,
        is_admin
    INTO user_record
    FROM user_profiles 
    WHERE id = user_uuid;
    
    -- Если пользователь не найден
    IF user_record IS NULL THEN
        RETURN QUERY SELECT false, false, false, NULL::INTEGER;
        RETURN;
    END IF;
    
    -- Возвращаем права доступа
    RETURN QUERY SELECT 
        user_record.is_admin as can_access,
        (user_record.admin_role = 'super_admin') as is_super_admin,
        (user_record.admin_role = 'office_admin') as is_office_admin,
        user_record.office_id as managed_office_id;
END;
$$;

GRANT EXECUTE ON FUNCTION check_admin_access(UUID) TO authenticated;

-- 7. ФИНАЛЬНОЕ СООБЩЕНИЕ
DO $$
BEGIN
    RAISE NOTICE '✅ Функция update_employee_permissions исправлена!';
    RAISE NOTICE 'Теперь она должна работать без ошибки 400';
END $$; 