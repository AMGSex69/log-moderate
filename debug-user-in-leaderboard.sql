-- ОТЛАДКА ПРОБЛЕМЫ С ЛИДЕРБОРДОМ
-- Проверяем состояние пользователя в базе данных

-- 1. Проверяем user_profiles
SELECT 'USER_PROFILES:' as table_name;
SELECT 
    id,
    full_name,
    office_id,
    (SELECT name FROM offices WHERE id = user_profiles.office_id) as office_name
FROM user_profiles 
WHERE id = 'YOUR_USER_ID_HERE'::UUID;

-- 2. Проверяем employees
SELECT 'EMPLOYEES:' as table_name;
SELECT 
    id,
    user_id,
    full_name,
    office_id,
    is_active,
    (SELECT name FROM offices WHERE id = employees.office_id) as office_name
FROM employees 
WHERE user_id = 'YOUR_USER_ID_HERE'::UUID;

-- 3. Проверяем все офисы
SELECT 'OFFICES:' as table_name;
SELECT id, name FROM offices ORDER BY id;

-- 4. Проверяем всех employees в офисе "Тульская" (предполагаем ID = 2)
SELECT 'EMPLOYEES_IN_TULSKAYA:' as table_name;
SELECT 
    e.id,
    e.user_id,
    e.full_name,
    e.office_id,
    e.is_active,
    o.name as office_name
FROM employees e
JOIN offices o ON o.id = e.office_id
WHERE e.office_id = (SELECT id FROM offices WHERE name = 'Тульская' LIMIT 1)
AND e.is_active = true;

-- 5. Функция для быстрого создания employee в офисе "Тульская"
CREATE OR REPLACE FUNCTION quick_fix_user_in_tulskaya(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tulskaya_office_id INTEGER;
    user_name TEXT;
    result_text TEXT;
BEGIN
    -- Получаем ID офиса "Тульская"
    SELECT id INTO tulskaya_office_id FROM offices WHERE name = 'Тульская' LIMIT 1;
    
    IF tulskaya_office_id IS NULL THEN
        RETURN 'Офис "Тульская" не найден';
    END IF;
    
    -- Получаем имя пользователя
    SELECT COALESCE(up.full_name, 'Пользователь') INTO user_name
    FROM user_profiles up
    WHERE up.id = target_user_id;
    
    -- Удаляем существующего employee (если есть)
    DELETE FROM employees WHERE user_id = target_user_id;
    
    -- Создаем нового employee в офисе "Тульская"
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
        target_user_id,
        user_name,
        'Сотрудник',
        tulskaya_office_id,
        '5/2',
        9,
        false,
        false,
        true,
        NOW(),
        NOW()
    );
    
    -- Обновляем user_profiles
    UPDATE user_profiles 
    SET 
        office_id = tulskaya_office_id,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    result_text := 'Пользователь ' || user_name || ' успешно добавлен в офис "Тульская" (ID: ' || tulskaya_office_id || ')';
    
    RETURN result_text;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'Ошибка: ' || SQLERRM;
END;
$$;

-- Права доступа
GRANT EXECUTE ON FUNCTION quick_fix_user_in_tulskaya(UUID) TO authenticated;

-- Инструкция по использованию:
/*
1. Замените 'YOUR_USER_ID_HERE' на ваш реальный UUID пользователя
2. Выполните SELECT запросы для диагностики
3. Если нужно, используйте функцию quick_fix_user_in_tulskaya:
   SELECT quick_fix_user_in_tulskaya('ваш_uuid_здесь'::UUID);
*/ 