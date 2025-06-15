-- ===========================================
-- ИСПРАВЛЕНИЕ ФУНКЦИИ СОТРУДНИКОВ И ВОССТАНОВЛЕНИЕ ПРОФИЛЯ
-- ===========================================

-- 1. Проверяем текущую функцию get_employees_for_admin
SELECT 'Проверка существующей функции:' as check_type;
SELECT 
    proname,
    pg_get_function_result(oid) as return_type,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'get_employees_for_admin';

-- 2. Исправляем функцию get_employees_for_admin
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
BEGIN
    -- Проверяем права доступа
    SELECT * INTO access_check FROM check_admin_access_unified(requesting_user_uuid);
    
    IF NOT access_check.can_access THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions';
    END IF;
    
    -- Супер-админ видит всех
    IF access_check.is_super_admin THEN
        RETURN QUERY
        SELECT 
            COALESCE(e.id, 0) as employee_id,
            up.id as user_id,
            up.full_name,
            au.email,
            COALESCE(up."position", 'Сотрудник') as employee_position,
            COALESCE(up.office_id, 1) as office_id,
            COALESCE(o.name, 'Рассвет') as office_name,
            COALESCE(up.admin_role, 'user') as admin_role,
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
    
    -- Офис-админ видит только своих сотрудников
    ELSIF access_check.is_office_admin THEN
        RETURN QUERY
        SELECT 
            COALESCE(e.id, 0) as employee_id,
            up.id as user_id,
            up.full_name,
            au.email,
            COALESCE(up."position", 'Сотрудник') as employee_position,
            COALESCE(up.office_id, 1) as office_id,
            COALESCE(o.name, 'Рассвет') as office_name,
            COALESCE(up.admin_role, 'user') as admin_role,
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
    END IF;
END;
$$;

-- 3. Восстанавливаем ваш полный профиль с правильными данными
DO $$
DECLARE
    user_uuid UUID;
    user_email TEXT := 'egordolgih@mail.ru';
    default_office_id INTEGER;
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
    
    -- Восстанавливаем полный профиль с вашими данными
    UPDATE user_profiles SET
        full_name = 'Егор Александрович Долгих',
        position = 'Супер-администратор системы',
        admin_role = 'super_admin',
        is_admin = true,
        office_id = default_office_id,
        work_schedule = '5/2',
        work_hours = 9,
        avatar_url = 'https://avatars.githubusercontent.com/u/yourusername', -- Замените на вашу аватарку
        updated_at = NOW()
    WHERE id = user_uuid;
    
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

-- 4. Создаем дополнительных сотрудников для тестирования
DO $$
DECLARE
    default_office_id INTEGER;
    test_user_id UUID;
BEGIN
    -- Получаем ID офиса "Рассвет"
    SELECT id INTO default_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;
    
    -- Создаем тестовых пользователей в user_profiles
    INSERT INTO user_profiles (
        id, full_name, position, office_id, work_schedule, work_hours,
        is_admin, admin_role, created_at, updated_at
    ) VALUES 
    (gen_random_uuid(), 'Анна Петровна Иванова', 'Менеджер по продажам', default_office_id, '5/2', 8, false, 'user', NOW(), NOW()),
    (gen_random_uuid(), 'Дмитрий Сергеевич Козлов', 'Ведущий специалист', default_office_id, '5/2', 8, false, 'user', NOW(), NOW()),
    (gen_random_uuid(), 'Елена Владимировна Смирнова', 'Аналитик данных', default_office_id, '5/2', 8, false, 'user', NOW(), NOW())
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Дополнительные тестовые пользователи созданы';
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
    up.avatar_url,
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

COMMENT ON FUNCTION get_employees_for_admin(UUID) IS 'Исправленная функция получения сотрудников для админа без ошибок типов'; 