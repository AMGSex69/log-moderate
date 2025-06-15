-- ===========================================
-- ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ ФУНКЦИИ СОТРУДНИКОВ (ИСПРАВЛЕННЫЕ ТИПЫ ДАННЫХ)
-- ===========================================

-- 1. Проверяем структуру таблицы user_profiles
SELECT 'Структура таблицы user_profiles:' as info;
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Проверяем структуру таблицы employees
SELECT 'Структура таблицы employees:' as info;
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Исправляем функцию get_employees_for_admin с правильными типами данных
CREATE OR REPLACE FUNCTION get_employees_for_admin(requesting_user_uuid UUID)
RETURNS TABLE (
    employee_id INTEGER,
    user_id UUID,
    full_name TEXT,
    email TEXT,
    employee_position TEXT,
    office_id INTEGER,
    office_name TEXT,
    admin_role TEXT,
    managed_office_id INTEGER,
    is_admin BOOLEAN,
    is_online BOOLEAN,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    access_check RECORD;
    has_is_online_in_profiles BOOLEAN;
    has_last_seen_in_profiles BOOLEAN;
BEGIN
    -- Проверяем права доступа
    SELECT * INTO access_check FROM check_admin_access_unified(requesting_user_uuid);
    
    IF NOT access_check.can_access THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions';
    END IF;
    
    -- Проверяем наличие колонок is_online и last_seen в user_profiles
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'is_online' 
        AND table_schema = 'public'
    ) INTO has_is_online_in_profiles;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'last_seen' 
        AND table_schema = 'public'
    ) INTO has_last_seen_in_profiles;
    
    -- Супер-админ видит всех
    IF access_check.is_super_admin THEN
        IF has_is_online_in_profiles AND has_last_seen_in_profiles THEN
            -- Полная версия с is_online и last_seen из user_profiles
            RETURN QUERY
            SELECT 
                COALESCE(e.id, 0) as employee_id,
                up.id as user_id,
                up.full_name::TEXT,
                au.email::TEXT,
                COALESCE(up."position", 'Сотрудник')::TEXT as employee_position,
                COALESCE(up.office_id, 1) as office_id,
                COALESCE(o.name, 'Рассвет')::TEXT as office_name,
                COALESCE(up.admin_role, 'user')::TEXT as admin_role,
                up.managed_office_id,
                COALESCE(up.is_admin, false) as is_admin,
                COALESCE(up.is_online, false) as is_online,
                up.last_seen,
                up.created_at
            FROM user_profiles up
            JOIN auth.users au ON au.id = up.id
            LEFT JOIN employees e ON e.user_id = up.id
            LEFT JOIN offices o ON o.id = up.office_id
            ORDER BY up.full_name;
        ELSE
            -- Упрощенная версия без is_online и last_seen из user_profiles
            RETURN QUERY
            SELECT 
                COALESCE(e.id, 0) as employee_id,
                up.id as user_id,
                up.full_name::TEXT,
                au.email::TEXT,
                COALESCE(up."position", 'Сотрудник')::TEXT as employee_position,
                COALESCE(up.office_id, 1) as office_id,
                COALESCE(o.name, 'Рассвет')::TEXT as office_name,
                COALESCE(up.admin_role, 'user')::TEXT as admin_role,
                up.managed_office_id,
                COALESCE(up.is_admin, false) as is_admin,
                COALESCE(e.is_online, false) as is_online,
                e.last_seen,
                up.created_at
            FROM user_profiles up
            JOIN auth.users au ON au.id = up.id
            LEFT JOIN employees e ON e.user_id = up.id
            LEFT JOIN offices o ON o.id = up.office_id
            ORDER BY up.full_name;
        END IF;
    
    -- Офис-админ видит только своих сотрудников
    ELSIF access_check.is_office_admin THEN
        IF has_is_online_in_profiles AND has_last_seen_in_profiles THEN
            -- Полная версия с is_online и last_seen из user_profiles
            RETURN QUERY
            SELECT 
                COALESCE(e.id, 0) as employee_id,
                up.id as user_id,
                up.full_name::TEXT,
                au.email::TEXT,
                COALESCE(up."position", 'Сотрудник')::TEXT as employee_position,
                COALESCE(up.office_id, 1) as office_id,
                COALESCE(o.name, 'Рассвет')::TEXT as office_name,
                COALESCE(up.admin_role, 'user')::TEXT as admin_role,
                up.managed_office_id,
                COALESCE(up.is_admin, false) as is_admin,
                COALESCE(up.is_online, false) as is_online,
                up.last_seen,
                up.created_at
            FROM user_profiles up
            JOIN auth.users au ON au.id = up.id
            LEFT JOIN employees e ON e.user_id = up.id
            LEFT JOIN offices o ON o.id = up.office_id
            WHERE up.office_id = access_check.managed_office_id
            ORDER BY up.full_name;
        ELSE
            -- Упрощенная версия без is_online и last_seen из user_profiles
            RETURN QUERY
            SELECT 
                COALESCE(e.id, 0) as employee_id,
                up.id as user_id,
                up.full_name::TEXT,
                au.email::TEXT,
                COALESCE(up."position", 'Сотрудник')::TEXT as employee_position,
                COALESCE(up.office_id, 1) as office_id,
                COALESCE(o.name, 'Рассвет')::TEXT as office_name,
                COALESCE(up.admin_role, 'user')::TEXT as admin_role,
                up.managed_office_id,
                COALESCE(up.is_admin, false) as is_admin,
                COALESCE(e.is_online, false) as is_online,
                e.last_seen,
                up.created_at
            FROM user_profiles up
            JOIN auth.users au ON au.id = up.id
            LEFT JOIN employees e ON e.user_id = up.id
            LEFT JOIN offices o ON o.id = up.office_id
            WHERE up.office_id = access_check.managed_office_id
            ORDER BY up.full_name;
        END IF;
    END IF;
END;
$$;

-- 4. Восстанавливаем ваш полный профиль
DO $$
DECLARE
    user_uuid UUID;
    user_email TEXT := 'egordolgih@mail.ru';
    default_office_id INTEGER;
    has_avatar_url BOOLEAN;
BEGIN
    -- Получаем UUID пользователя
    SELECT id INTO user_uuid FROM auth.users WHERE email = user_email;
    
    IF user_uuid IS NULL THEN
        RAISE NOTICE 'Пользователь % не найден', user_email;
        RETURN;
    END IF;
    
    -- Получаем ID офиса "Рассвет"
    SELECT id INTO default_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;
    IF default_office_id IS NULL THEN
        default_office_id := 1;
    END IF;
    
    -- Проверяем наличие колонки avatar_url
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'avatar_url' 
        AND table_schema = 'public'
    ) INTO has_avatar_url;
    
    -- Восстанавливаем профиль с учетом структуры таблицы
    IF has_avatar_url THEN
        UPDATE user_profiles SET
            full_name = 'Егор Александрович Долгих',
            position = 'Супер-администратор системы',
            admin_role = 'super_admin',
            is_admin = true,
            office_id = default_office_id,
            work_schedule = '5/2',
            work_hours = 9,
            avatar_url = 'https://avatars.githubusercontent.com/u/yourusername',
            updated_at = NOW()
        WHERE id = user_uuid;
    ELSE
        UPDATE user_profiles SET
            full_name = 'Егор Александрович Долгих',
            position = 'Супер-администратор системы',
            admin_role = 'super_admin',
            is_admin = true,
            office_id = default_office_id,
            work_schedule = '5/2',
            work_hours = 9,
            updated_at = NOW()
        WHERE id = user_uuid;
    END IF;
    
    -- Обновляем запись в employees
    UPDATE employees SET
        full_name = 'Егор Александрович Долгих',
        position = 'Супер-администратор системы',
        admin_role = 'super_admin',
        is_admin = true,
        office_id = default_office_id,
        work_schedule = '5/2',
        work_hours = 9,
        is_active = true,
        updated_at = NOW()
    WHERE user_id = user_uuid;
    
    RAISE NOTICE 'Полный профиль пользователя % восстановлен', user_email;
END $$;

-- 5. Тестируем исправленную функцию
SELECT 'Тест исправленной функции get_employees_for_admin:' as test_type;
SELECT 
    employee_id,
    full_name,
    email,
    employee_position,
    office_name,
    admin_role,
    is_admin
FROM get_employees_for_admin(
    (SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru')
) 
LIMIT 10;

-- 6. Проверяем восстановленный профиль
SELECT 'Восстановленный профиль:' as check_type;
SELECT 
    up.id,
    up.full_name,
    up.position,
    up.admin_role,
    up.is_admin,
    up.office_id,
    o.name as office_name,
    up.work_schedule,
    up.work_hours
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.id IN (
    SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru'
);

-- 7. Проверяем общее количество пользователей
SELECT 'Общее количество пользователей:' as count_type;
SELECT COUNT(*) as total_users FROM user_profiles;

-- 8. Проверяем соответствие между auth.users и user_profiles
SELECT 'Проверка соответствия пользователей:' as check_type;
SELECT 
    COUNT(au.id) as auth_users_count,
    COUNT(up.id) as user_profiles_count,
    COUNT(au.id) - COUNT(up.id) as missing_profiles
FROM auth.users au
LEFT JOIN user_profiles up ON up.id = au.id;

COMMENT ON FUNCTION get_employees_for_admin(UUID) IS 'Адаптивная функция получения сотрудников для админа с правильными типами данных'; 