-- ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ОФИСА ПОЛЬЗОВАТЕЛЯ
-- Обновляет офис пользователя в обеих таблицах: user_profiles и employees

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
    
    -- Обновляем в employees (может не существовать)
    UPDATE employees 
    SET 
        office_id = new_office_id,
        updated_at = NOW()
    WHERE user_id = user_uuid;
    
    -- Возвращаем успех
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- В случае ошибки возвращаем FALSE
        RAISE NOTICE 'Ошибка обновления офиса: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Предоставляем права на выполнение
GRANT EXECUTE ON FUNCTION update_user_office(UUID, INTEGER) TO authenticated;

-- Тест функции
DO $$
DECLARE
    test_user_id UUID;
    test_result BOOLEAN;
BEGIN
    -- Берем любого пользователя из auth.users
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Тестируем обновление офиса для пользователя: %', test_user_id;
        
        -- Тестируем с офисом "Рассвет" (ID = 1)
        SELECT update_user_office(test_user_id, 1) INTO test_result;
        
        IF test_result THEN
            RAISE NOTICE 'Успешно обновлен офис для пользователя';
        ELSE
            RAISE NOTICE 'Ошибка обновления офиса';
        END IF;
    ELSE
        RAISE NOTICE 'Нет пользователей для тестирования';
    END IF;
END $$; 