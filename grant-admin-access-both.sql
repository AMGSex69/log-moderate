-- Предоставление админских прав двум пользователям
-- flack_nion@mail.ru и egordolgih@mail.ru
-- Выполните этот скрипт в SQL Editor вашего Supabase проекта

-- 1. Сначала проверим структуру таблиц
SELECT 'Проверка структуры таблицы user_profiles...' as status;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

SELECT 'Проверка структуры таблицы employees...' as status;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'employees' 
ORDER BY ordinal_position;

-- 2. Функция для назначения админских прав
CREATE OR REPLACE FUNCTION grant_admin_rights(user_email TEXT, user_display_name TEXT)
RETURNS TEXT AS $$
DECLARE
    user_exists boolean;
    user_uuid uuid;
    profile_exists boolean;
    employee_exists boolean;
    result_msg TEXT;
BEGIN
    -- Проверяем существование пользователя в auth.users
    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE email = user_email
    ) INTO user_exists;
    
    IF user_exists THEN
        -- Получаем UUID пользователя
        SELECT id FROM auth.users WHERE email = user_email INTO user_uuid;
        result_msg := format('✅ Пользователь %s найден: %s', user_email, user_uuid);
        RAISE NOTICE '%', result_msg;
        
        -- Обновляем метаданные в auth.users
        UPDATE auth.users 
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
        WHERE email = user_email;
        
        RAISE NOTICE '✅ Метаданные auth.users обновлены для %', user_email;
        
        -- Проверяем существование записи в user_profiles
        SELECT EXISTS (
            SELECT 1 FROM user_profiles WHERE id = user_uuid
        ) INTO profile_exists;
        
        IF profile_exists THEN
            -- Обновляем существующую запись в user_profiles
            UPDATE user_profiles SET
                role = 'admin',
                is_admin = true,
                position = 'Администратор',
                updated_at = NOW()
            WHERE id = user_uuid;
            RAISE NOTICE '✅ Запись user_profiles обновлена для %', user_email;
        ELSE
            -- Создаем новую запись в user_profiles
            INSERT INTO user_profiles (
                id, 
                full_name, 
                role,
                work_schedule, 
                work_hours,
                position,
                is_admin,
                created_at,
                updated_at
            ) VALUES (
                user_uuid,
                COALESCE(
                    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = user_uuid),
                    user_display_name
                ),
                'admin',
                '5/2',
                9,
                'Администратор',
                true,
                NOW(),
                NOW()
            );
            RAISE NOTICE '✅ Запись user_profiles создана для %', user_email;
        END IF;
        
        -- Проверяем существование записи в employees
        SELECT EXISTS (
            SELECT 1 FROM employees WHERE user_id = user_uuid
        ) INTO employee_exists;
        
        IF employee_exists THEN
            -- Обновляем существующую запись в employees
            UPDATE employees SET
                is_admin = true,
                position = 'Администратор',
                is_active = true,
                updated_at = NOW()
            WHERE user_id = user_uuid;
            RAISE NOTICE '✅ Запись employees обновлена для %', user_email;
        ELSE
            -- Создаем новую запись в employees
            INSERT INTO employees (
                user_id,
                full_name,
                position,
                is_admin,
                is_active,
                work_schedule,
                work_hours,
                is_online,
                created_at,
                updated_at
            ) VALUES (
                user_uuid,
                COALESCE(
                    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = user_uuid),
                    user_display_name
                ),
                'Администратор',
                true,
                true,
                '5/2',
                9,
                false,
                NOW(),
                NOW()
            );
            RAISE NOTICE '✅ Запись employees создана для %', user_email;
        END IF;
        
        RETURN format('SUCCESS: Админские права предоставлены пользователю %s', user_email);
        
    ELSE
        result_msg := format('❌ ОШИБКА: Пользователь %s не найден в системе!', user_email);
        RAISE NOTICE '%', result_msg;
        RAISE NOTICE 'Пользователь должен сначала зарегистрироваться в системе.';
        RETURN result_msg;
    END IF;
END
$$ LANGUAGE plpgsql;

-- 3. Назначаем права обоим администраторам
SELECT '=== НАЗНАЧЕНИЕ АДМИНСКИХ ПРАВ ===' as info;

SELECT grant_admin_rights('egordolgih@mail.ru', 'Егор Долгих') as result_egor;
SELECT grant_admin_rights('flack_nion@mail.ru', 'flack_nion') as result_flack;

-- 4. Проверяем результаты для обоих пользователей
SELECT '=== РЕЗУЛЬТАТЫ НАЗНАЧЕНИЯ АДМИНСКИХ ПРАВ ===' as info;

SELECT 'Проверка auth.users (оба админа):' as check_type;
SELECT 
    email, 
    raw_app_meta_data->>'role' as role_in_metadata,
    created_at
FROM auth.users 
WHERE email IN ('egordolgih@mail.ru', 'flack_nion@mail.ru')
ORDER BY email;

SELECT 'Проверка user_profiles (оба админа):' as check_type;
SELECT 
    up.id,
    u.email,
    up.full_name,
    up.role,
    up.is_admin,
    up.position
FROM user_profiles up
JOIN auth.users u ON u.id = up.id
WHERE u.email IN ('egordolgih@mail.ru', 'flack_nion@mail.ru')
ORDER BY u.email;

SELECT 'Проверка employees (оба админа):' as check_type;
SELECT 
    e.id,
    u.email,
    e.full_name,
    e.position,
    e.is_admin,
    e.is_active
FROM employees e
JOIN auth.users u ON u.id = e.user_id
WHERE u.email IN ('egordolgih@mail.ru', 'flack_nion@mail.ru')
ORDER BY u.email;

SELECT 'ВСЕ администраторы в системе:' as check_type;
SELECT DISTINCT
    u.email,
    COALESCE(up.role, 'user') as role,
    COALESCE(e.is_admin, false) as is_admin_employee,
    COALESCE(up.is_admin, false) as is_admin_profile,
    up.position as profile_position,
    e.position as employee_position
FROM auth.users u
LEFT JOIN user_profiles up ON up.id = u.id
LEFT JOIN employees e ON e.user_id = u.id
WHERE up.role = 'admin' OR e.is_admin = true OR up.is_admin = true
ORDER BY u.email;

-- 5. Удаляем временную функцию
DROP FUNCTION grant_admin_rights(TEXT, TEXT); 