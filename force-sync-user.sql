-- ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ
-- Замените 'ваш_email@example.com' на свой реальный email

DO $$
DECLARE
    target_email TEXT := 'egordolgih@mail.ru'; -- ЗАМЕНИТЕ НА СВОЙ EMAIL
    user_uuid UUID;
    user_name TEXT;
    target_office_name TEXT := 'Тульская';
    target_office_id INTEGER;
    employee_exists BOOLEAN := FALSE;
BEGIN
    -- Находим пользователя по email (пробуем разные варианты связи)
    SELECT u.id, up.full_name
    INTO user_uuid, user_name
    FROM auth.users u
    LEFT JOIN user_profiles up ON u.id::text = up.id::text OR u.email = up.email
    WHERE u.email = target_email;
    
    IF user_uuid IS NULL THEN
        RAISE NOTICE 'Пользователь с email % не найден', target_email;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Найден пользователь: ID=%, NAME=%', user_uuid, user_name;
    
    -- Находим ID офиса "Тульская"
    SELECT id INTO target_office_id
    FROM offices
    WHERE name = target_office_name;
    
    IF target_office_id IS NULL THEN
        RAISE NOTICE 'Офис "%" не найден', target_office_name;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Офис "%" имеет ID=%', target_office_name, target_office_id;
    
    -- Обновляем user_profiles
    UPDATE user_profiles 
    SET office_name = target_office_name,
        updated_at = NOW()
    WHERE user_id = user_uuid;
    
    RAISE NOTICE 'Обновлен user_profiles для пользователя %', user_name;
    
    -- Проверяем, есть ли запись в employees
    SELECT EXISTS(
        SELECT 1 FROM employees 
        WHERE name = user_name
    ) INTO employee_exists;
    
    IF employee_exists THEN
        -- Обновляем существующую запись в employees
        UPDATE employees 
        SET office_id = target_office_id,
            updated_at = NOW()
        WHERE name = user_name;
        
        RAISE NOTICE 'Обновлена запись в employees для %', user_name;
    ELSE
        -- Создаем новую запись в employees
        INSERT INTO employees (name, office_id, created_at, updated_at)
        VALUES (user_name, target_office_id, NOW(), NOW());
        
        RAISE NOTICE 'Создана новая запись в employees для %', user_name;
    END IF;
    
    -- Проверяем результат
    RAISE NOTICE '=== РЕЗУЛЬТАТ СИНХРОНИЗАЦИИ ===';
    
    SELECT 
        up.full_name,
        up.office_name,
        e.office_id,
        o.name as office_from_employees
    FROM user_profiles up
    LEFT JOIN employees e ON up.full_name = e.name
    LEFT JOIN offices o ON e.office_id = o.id
    WHERE up.user_id = user_uuid;
    
END $$; 