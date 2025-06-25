-- Исправляем функцию обновления прав сотрудников для работы с user_profiles
-- После миграции таблица employees была удалена, все данные в user_profiles

-- Удаляем старую функцию
DROP FUNCTION IF EXISTS update_employee_permissions_with_schedule(uuid, uuid, integer, text, integer, text);

-- Создаем новую функцию для работы с user_profiles
CREATE OR REPLACE FUNCTION update_employee_permissions_with_schedule(
    requesting_user_uuid uuid,
    target_user_uuid uuid,
    new_office_id integer DEFAULT NULL,
    new_admin_role text DEFAULT NULL,
    new_managed_office_id integer DEFAULT NULL,
    new_work_schedule text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    requesting_user_role text;
    requesting_user_office integer;
    target_user_data record;
    result json;
BEGIN
    -- Проверяем права запрашивающего пользователя
    SELECT admin_role, office_id 
    INTO requesting_user_role, requesting_user_office
    FROM user_profiles 
    WHERE id = requesting_user_uuid;
    
    IF requesting_user_role IS NULL THEN
        RAISE EXCEPTION 'Пользователь не найден или не имеет прав администратора';
    END IF;
    
    -- Проверяем, что запрашивающий пользователь имеет права
    IF requesting_user_role NOT IN ('office_admin', 'super_admin') THEN
        RAISE EXCEPTION 'Недостаточно прав для выполнения операции';
    END IF;
    
    -- Получаем данные целевого пользователя
    SELECT * INTO target_user_data
    FROM user_profiles 
    WHERE id = target_user_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Целевой пользователь не найден';
    END IF;
    
    -- Проверяем права на изменение офиса
    IF new_office_id IS NOT NULL THEN
        IF requesting_user_role = 'office_admin' AND 
           requesting_user_office != new_office_id AND 
           requesting_user_office != target_user_data.office_id THEN
            RAISE EXCEPTION 'Офис-админ может управлять только сотрудниками своего офиса';
        END IF;
    END IF;
    
    -- Обновляем данные пользователя
    UPDATE user_profiles 
    SET 
        office_id = COALESCE(new_office_id, office_id),
        admin_role = COALESCE(new_admin_role, admin_role),
        managed_office_id = COALESCE(new_managed_office_id, managed_office_id),
        work_schedule = COALESCE(new_work_schedule, work_schedule),
        work_hours = CASE 
            WHEN new_work_schedule IS NOT NULL THEN 
                CASE 
                    WHEN new_work_schedule = '2/2' THEN 12
                    ELSE 9
                END
            ELSE work_hours
        END,
        updated_at = NOW()
    WHERE id = target_user_uuid;
    
    -- Получаем обновленные данные
    SELECT row_to_json(up.*) INTO result
    FROM user_profiles up
    WHERE id = target_user_uuid;
    
    RETURN result;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION update_employee_permissions_with_schedule(uuid, uuid, integer, text, integer, text) TO authenticated;

-- Проверяем, что функция создана
SELECT 'Функция update_employee_permissions_with_schedule успешно обновлена для работы с user_profiles' as status; 