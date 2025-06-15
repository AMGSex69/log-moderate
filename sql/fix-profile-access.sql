-- ===========================================
-- ИСПРАВЛЕНИЕ ДОСТУПА К ПРОФИЛЮ ПОЛЬЗОВАТЕЛЯ
-- ===========================================

-- 1. Проверяем текущие RLS политики
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'employees')
ORDER BY tablename, policyname;

-- 2. Создаем уникальное ограничение для user_id в employees (если не существует)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'employees_user_id_unique'
    ) THEN
        ALTER TABLE employees ADD CONSTRAINT employees_user_id_unique UNIQUE (user_id);
        RAISE NOTICE 'Создано уникальное ограничение employees_user_id_unique';
    ELSE
        RAISE NOTICE 'Уникальное ограничение employees_user_id_unique уже существует';
    END IF;
END $$;

-- 3. Временно отключаем RLS для диагностики
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- 4. Проверяем, что пользователь существует в базе
SELECT 'Проверка пользователя в auth.users:' as check_type;
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users 
WHERE email = 'egordolgih@mail.ru';

-- 5. Проверяем профиль в user_profiles
SELECT 'Проверка профиля в user_profiles:' as check_type;
SELECT 
    up.*,
    o.name as office_name
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.id IN (
    SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru'
);

-- 6. Проверяем запись в employees
SELECT 'Проверка записи в employees:' as check_type;
SELECT 
    e.*,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE e.user_id IN (
    SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru'
);

-- 7. Создаем/обновляем профиль если его нет
DO $$
DECLARE
    user_uuid UUID;
    user_email TEXT := 'egordolgih@mail.ru';
    default_office_id INTEGER;
BEGIN
    -- Получаем UUID пользователя
    SELECT id INTO user_uuid FROM auth.users WHERE email = user_email;
    
    IF user_uuid IS NULL THEN
        RAISE NOTICE 'Пользователь % не найден в auth.users', user_email;
        RETURN;
    END IF;
    
    -- Получаем ID офиса "Рассвет"
    SELECT id INTO default_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;
    IF default_office_id IS NULL THEN
        default_office_id := 1;
    END IF;
    
    -- Создаем/обновляем профиль в user_profiles
    INSERT INTO user_profiles (
        id,
        full_name,
        position,
        work_schedule,
        work_hours,
        is_admin,
        admin_role,
        office_id,
        created_at,
        updated_at
    ) VALUES (
        user_uuid,
        'Долгих',
        'Супер-администратор',
        '5/2',
        9,
        true,
        'super_admin',
        default_office_id,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(user_profiles.full_name, EXCLUDED.full_name),
        admin_role = 'super_admin',
        is_admin = true,
        office_id = COALESCE(user_profiles.office_id, EXCLUDED.office_id),
        updated_at = NOW();
    
    -- Создаем/обновляем запись в employees (теперь с уникальным ограничением)
    INSERT INTO employees (
        user_id,
        full_name,
        position,
        work_schedule,
        work_hours,
        is_admin,
        admin_role,
        office_id,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        user_uuid,
        'Долгих',
        'Супер-администратор',
        '5/2',
        9,
        true,
        'super_admin',
        default_office_id,
        true,
        NOW(),
        NOW()
    ) ON CONFLICT (user_id) DO UPDATE SET
        full_name = COALESCE(employees.full_name, EXCLUDED.full_name),
        admin_role = 'super_admin',
        is_admin = true,
        office_id = COALESCE(employees.office_id, EXCLUDED.office_id),
        is_active = true,
        updated_at = NOW();
    
    RAISE NOTICE 'Профиль пользователя % создан/обновлен', user_email;
END $$;

-- 8. Создаем упрощенные RLS политики
-- Политика для user_profiles - пользователи могут видеть свой профиль + админы видят всех
DROP POLICY IF EXISTS "Users can view basic profile info" ON user_profiles;
DROP POLICY IF EXISTS "Admin access to user profiles" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;

CREATE POLICY "user_profiles_access_policy" ON user_profiles
FOR ALL USING (
    -- Пользователь видит свой профиль
    auth.uid() = id 
    OR
    -- Супер-админы видят всех
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.admin_role = 'super_admin'
    )
    OR
    -- Офис-админы видят сотрудников своего офиса
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.admin_role = 'office_admin' 
        AND up.managed_office_id = user_profiles.office_id
    )
);

-- Политика для employees - аналогично
DROP POLICY IF EXISTS "Users can view employees from same office" ON employees;
DROP POLICY IF EXISTS "employees_select_policy" ON employees;

CREATE POLICY "employees_access_policy" ON employees
FOR ALL USING (
    -- Пользователь видит свою запись
    auth.uid() = user_id 
    OR
    -- Супер-админы видят всех
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.admin_role = 'super_admin'
    )
    OR
    -- Офис-админы видят сотрудников своего офиса
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.admin_role = 'office_admin' 
        AND up.managed_office_id = employees.office_id
    )
);

-- 9. Включаем RLS обратно
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 10. Финальная проверка
SELECT 'Финальная проверка профиля:' as check_type;
SELECT 
    up.id,
    up.full_name,
    up.admin_role,
    up.is_admin,
    up.office_id,
    o.name as office_name
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.id IN (
    SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru'
);

-- 11. Проверяем работу унифицированной функции
SELECT 'Проверка функции check_admin_access_unified:' as check_type;
SELECT * FROM check_admin_access_unified(
    (SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru')
);

COMMENT ON POLICY "user_profiles_access_policy" ON user_profiles IS 'Упрощенная политика доступа к профилям с поддержкой ролей';
COMMENT ON POLICY "employees_access_policy" ON employees IS 'Упрощенная политика доступа к сотрудникам с поддержкой ролей'; 