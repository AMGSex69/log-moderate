-- Исправленный скрипт предоставления админских прав пользователю flack_nion@mail.ru
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

-- 2. Проверяем существование пользователя
SELECT 'Поиск пользователя flack_nion@mail.ru...' as status;

DO $$
DECLARE
    user_exists boolean;
    user_uuid uuid;
    profile_exists boolean;
    employee_exists boolean;
BEGIN
    -- Проверяем существование пользователя в auth.users
    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE email = 'flack_nion@mail.ru'
    ) INTO user_exists;
    
    IF user_exists THEN
        -- Получаем UUID пользователя
        SELECT id FROM auth.users WHERE email = 'flack_nion@mail.ru' INTO user_uuid;
        RAISE NOTICE 'Пользователь найден: %', user_uuid;
        
        -- 2. Обновляем метаданные в auth.users
        UPDATE auth.users 
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
        WHERE email = 'flack_nion@mail.ru';
        
        RAISE NOTICE 'Метаданные auth.users обновлены';
        
        -- 3. Проверяем существование записи в user_profiles
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
            RAISE NOTICE 'Запись user_profiles обновлена';
        ELSE
            -- Создаем новую запись в user_profiles (только с существующими колонками)
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
                    'flack_nion'
                ),
                'admin',
                '5/2',
                9,
                'Администратор',
                true,
                NOW(),
                NOW()
            );
            RAISE NOTICE 'Запись user_profiles создана';
        END IF;
        
        -- 4. Проверяем существование записи в employees
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
            RAISE NOTICE 'Запись employees обновлена';
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
                    'flack_nion'
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
            RAISE NOTICE 'Запись employees создана';
        END IF;
        
    ELSE
        RAISE NOTICE 'ОШИБКА: Пользователь flack_nion@mail.ru не найден в системе!';
        RAISE NOTICE 'Пользователь должен сначала зарегистрироваться в системе.';
    END IF;
END
$$;

-- 5. Проверяем результат
SELECT '=== РЕЗУЛЬТАТЫ ПРЕДОСТАВЛЕНИЯ АДМИНСКИХ ПРАВ ===' as info;

SELECT 'Проверка auth.users:' as check_type;
SELECT 
    email, 
    raw_app_meta_data->>'role' as role_in_metadata,
    created_at
FROM auth.users 
WHERE email = 'flack_nion@mail.ru';

SELECT 'Проверка user_profiles:' as check_type;
SELECT 
    up.*
FROM user_profiles up
WHERE up.id = (SELECT id FROM auth.users WHERE email = 'flack_nion@mail.ru');

SELECT 'Проверка employees:' as check_type;
SELECT 
    e.*
FROM employees e
WHERE e.user_id = (SELECT id FROM auth.users WHERE email = 'flack_nion@mail.ru');

SELECT 'Все администраторы в системе:' as check_type;
SELECT DISTINCT
    u.email,
    COALESCE(up.role, 'user') as role,
    COALESCE(e.is_admin, false) as is_admin_employee,
    COALESCE(up.is_admin, false) as is_admin_profile
FROM auth.users u
LEFT JOIN user_profiles up ON up.id = u.id
LEFT JOIN employees e ON e.user_id = u.id
WHERE up.role = 'admin' OR e.is_admin = true OR up.is_admin = true
ORDER BY u.email; 