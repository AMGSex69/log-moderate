-- ФУНКЦИЯ ДЛЯ ОБЕСПЕЧЕНИЯ НАЛИЧИЯ EMPLOYEE В ОФИСЕ
-- Создает или обновляет employee запись в указанном офисе

CREATE OR REPLACE FUNCTION ensure_employee_in_office(
    user_uuid UUID,
    target_office_id INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_employee_id INTEGER;
    user_name TEXT;
    user_position TEXT;
    result_employee_id INTEGER;
BEGIN
    -- Проверяем существует ли employee для этого пользователя
    SELECT id INTO existing_employee_id
    FROM employees
    WHERE user_id = user_uuid;
    
    -- Получаем данные пользователя для создания employee
    SELECT 
        COALESCE(up.full_name, au.raw_user_meta_data->>'full_name', 'Пользователь'),
        COALESCE(up.position, 'Сотрудник')
    INTO user_name, user_position
    FROM auth.users au
    LEFT JOIN user_profiles up ON up.id = au.id
    WHERE au.id = user_uuid;
    
    IF existing_employee_id IS NOT NULL THEN
        -- Обновляем существующую запись
        UPDATE employees 
        SET 
            office_id = target_office_id,
            full_name = user_name,
            position = user_position,
            is_active = true,
            updated_at = NOW()
        WHERE id = existing_employee_id
        RETURNING id INTO result_employee_id;
        
        RAISE NOTICE 'Обновлен employee ID % для офиса %', result_employee_id, target_office_id;
    ELSE
        -- Создаем новую запись
        INSERT INTO employees (
            user_id,
            full_name,
            position,
            office_id,
            work_schedule,
            work_hours,
            is_admin,
            is_online,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            user_uuid,
            user_name,
            user_position,
            target_office_id,
            '5/2',
            9,
            false,
            false,
            true,
            NOW(),
            NOW()
        )
        RETURNING id INTO result_employee_id;
        
        RAISE NOTICE 'Создан новый employee ID % для офиса %', result_employee_id, target_office_id;
    END IF;
    
    RETURN result_employee_id;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Ошибка создания/обновления employee: %', SQLERRM;
        RETURN NULL;
END;
$$;

-- Предоставляем права на выполнение
GRANT EXECUTE ON FUNCTION ensure_employee_in_office(UUID, INTEGER) TO authenticated;

-- Обновляем функцию update_user_office чтобы она использовала ensure_employee_in_office
CREATE OR REPLACE FUNCTION update_user_office(
    user_uuid UUID,
    new_office_id INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    office_exists BOOLEAN := FALSE;
    employee_id INTEGER;
BEGIN
    -- Проверяем что офис существует
    SELECT EXISTS(SELECT 1 FROM offices WHERE id = new_office_id) INTO office_exists;
    
    IF NOT office_exists THEN
        RAISE EXCEPTION 'Офис с ID % не существует', new_office_id;
    END IF;
    
    -- Обновляем в user_profiles (может не существовать)
    UPDATE user_profiles 
    SET 
        office_id = new_office_id,
        updated_at = NOW()
    WHERE id = user_uuid;
    
    -- Создаем или обновляем employee в новом офисе
    SELECT ensure_employee_in_office(user_uuid, new_office_id) INTO employee_id;
    
    IF employee_id IS NULL THEN
        RAISE EXCEPTION 'Не удалось создать или обновить employee в офисе %', new_office_id;
    END IF;
    
    RAISE NOTICE 'Пользователь % успешно перемещен в офис % (employee_id: %)', user_uuid, new_office_id, employee_id;
    
    -- Возвращаем успех
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- В случае ошибки возвращаем FALSE
        RAISE NOTICE 'Ошибка обновления офиса: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Тест функции
DO $$
DECLARE
    test_user_id UUID;
    test_result BOOLEAN;
    test_employee_id INTEGER;
BEGIN
    -- Берем любого пользователя из auth.users
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Тестируем ensure_employee_in_office для пользователя: %', test_user_id;
        
        -- Тестируем создание employee в офисе "Тульская" (предполагаем ID = 2)
        SELECT ensure_employee_in_office(test_user_id, 2) INTO test_employee_id;
        
        IF test_employee_id IS NOT NULL THEN
            RAISE NOTICE 'Успешно создан/обновлен employee ID: %', test_employee_id;
            
            -- Тестируем полную функцию update_user_office
            SELECT update_user_office(test_user_id, 2) INTO test_result;
            
            IF test_result THEN
                RAISE NOTICE 'Успешно обновлен офис пользователя';
            ELSE
                RAISE NOTICE 'Ошибка обновления офиса';
            END IF;
        ELSE
            RAISE NOTICE 'Ошибка создания employee';
        END IF;
    ELSE
        RAISE NOTICE 'Нет пользователей для тестирования';
    END IF;
END $$; 