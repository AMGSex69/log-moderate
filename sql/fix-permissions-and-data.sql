-- ===========================================
-- ИСПРАВЛЕНИЕ ПРАВ ДОСТУПА И ПРОБЛЕМ С ДАННЫМИ
-- ===========================================

-- 1. Проверяем текущие RLS политики для user_profiles
SELECT 'Текущие RLS политики для user_profiles:' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 2. Проверяем текущие RLS политики для employees
SELECT 'Текущие RLS политики для employees:' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'employees';

-- 3. Исправляем RLS политики для user_profiles
-- Удаляем старые политики
DROP POLICY IF EXISTS "user_profiles_access_policy" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admin access to user profiles" ON user_profiles;

-- Создаем новые упрощенные политики
CREATE POLICY "user_profiles_select_policy" ON user_profiles
    FOR SELECT USING (
        -- Пользователь может видеть свой профиль
        auth.uid() = id
        OR
        -- Супер-админ может видеть всех
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.admin_role = 'super_admin'
        )
        OR
        -- Офис-админ может видеть сотрудников своего офиса
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.admin_role = 'office_admin' 
            AND up.managed_office_id = user_profiles.office_id
        )
    );

CREATE POLICY "user_profiles_update_policy" ON user_profiles
    FOR UPDATE USING (
        -- Пользователь может обновлять свой профиль
        auth.uid() = id
        OR
        -- Супер-админ может обновлять всех
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.admin_role = 'super_admin'
        )
        OR
        -- Офис-админ может обновлять сотрудников своего офиса
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.admin_role = 'office_admin' 
            AND up.managed_office_id = user_profiles.office_id
        )
    );

CREATE POLICY "user_profiles_insert_policy" ON user_profiles
    FOR INSERT WITH CHECK (
        -- Пользователь может создавать свой профиль
        auth.uid() = id
        OR
        -- Супер-админ может создавать профили
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.admin_role = 'super_admin'
        )
    );

-- 4. Исправляем RLS политики для employees
-- Удаляем старые политики
DROP POLICY IF EXISTS "Users can view their own employee record" ON employees;
DROP POLICY IF EXISTS "Users can update their own employee record" ON employees;
DROP POLICY IF EXISTS "Admins can manage all employees" ON employees;
DROP POLICY IF EXISTS "Users can view employee info" ON employees;

-- Создаем новые политики для employees
CREATE POLICY "employees_select_policy" ON employees
    FOR SELECT USING (
        -- Пользователь может видеть свою запись
        auth.uid() = user_id
        OR
        -- Супер-админ может видеть всех
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.admin_role = 'super_admin'
        )
        OR
        -- Офис-админ может видеть сотрудников своего офиса
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.admin_role = 'office_admin' 
            AND up.managed_office_id = employees.office_id
        )
        OR
        -- Все аутентифицированные пользователи могут видеть базовую информацию о сотрудниках
        auth.role() = 'authenticated'
    );

CREATE POLICY "employees_update_policy" ON employees
    FOR UPDATE USING (
        -- Пользователь может обновлять свою запись
        auth.uid() = user_id
        OR
        -- Супер-админ может обновлять всех
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.admin_role = 'super_admin'
        )
        OR
        -- Офис-админ может обновлять сотрудников своего офиса
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.admin_role = 'office_admin' 
            AND up.managed_office_id = employees.office_id
        )
    );

CREATE POLICY "employees_insert_policy" ON employees
    FOR INSERT WITH CHECK (
        -- Пользователь может создавать свою запись
        auth.uid() = user_id
        OR
        -- Супер-админ может создавать записи
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.admin_role = 'super_admin'
        )
    );

-- 5. Создаем функцию для безопасного получения статистики лидерборда
CREATE OR REPLACE FUNCTION get_leaderboard_stats()
RETURNS TABLE (
    employee_id INTEGER,
    user_id UUID,
    full_name TEXT,
    employee_position TEXT,
    office_name TEXT,
    total_tasks INTEGER,
    completed_tasks INTEGER,
    completion_rate NUMERIC,
    total_points INTEGER,
    avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tasks_table_exists BOOLEAN;
BEGIN
    -- Проверяем существование таблицы tasks
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'tasks' 
        AND table_schema = 'public'
    ) INTO tasks_table_exists;
    
    IF tasks_table_exists THEN
        -- Если таблица tasks существует, используем статистику из неё
        RETURN QUERY
        SELECT 
            COALESCE(e.id, 0) as employee_id,
            up.id as user_id,
            up.full_name::TEXT,
            COALESCE(up."position", 'Сотрудник')::TEXT as employee_position,
            COALESCE(o.name, 'Рассвет')::TEXT as office_name,
            COALESCE(stats.total_tasks, 0) as total_tasks,
            COALESCE(stats.completed_tasks, 0) as completed_tasks,
            COALESCE(
                CASE 
                    WHEN stats.total_tasks > 0 
                    THEN ROUND((stats.completed_tasks::NUMERIC / stats.total_tasks::NUMERIC) * 100, 1)
                    ELSE 0 
                END, 
                0
            ) as completion_rate,
            COALESCE(stats.total_points, 0) as total_points,
            COALESCE(up.avatar_url, '')::TEXT
        FROM user_profiles up
        LEFT JOIN employees e ON e.user_id = up.id
        LEFT JOIN offices o ON o.id = up.office_id
        LEFT JOIN (
            -- Подзапрос для получения статистики задач
            SELECT 
                t.employee_id,
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
                SUM(COALESCE(t.points, 0)) as total_points
            FROM tasks t
            GROUP BY t.employee_id
        ) stats ON stats.employee_id = e.id
        WHERE up.id IS NOT NULL
        ORDER BY 
            COALESCE(stats.total_points, 0) DESC,
            COALESCE(stats.completed_tasks, 0) DESC,
            up.full_name;
    ELSE
        -- Если таблица tasks не существует, возвращаем базовую информацию о сотрудниках
        RETURN QUERY
        SELECT 
            COALESCE(e.id, 0) as employee_id,
            up.id as user_id,
            up.full_name::TEXT,
            COALESCE(up."position", 'Сотрудник')::TEXT as employee_position,
            COALESCE(o.name, 'Рассвет')::TEXT as office_name,
            0 as total_tasks,
            0 as completed_tasks,
            0::NUMERIC as completion_rate,
            0 as total_points,
            COALESCE(up.avatar_url, '')::TEXT
        FROM user_profiles up
        LEFT JOIN employees e ON e.user_id = up.id
        LEFT JOIN offices o ON o.id = up.office_id
        WHERE up.id IS NOT NULL
        ORDER BY up.full_name;
    END IF;
END;
$$;

-- 6. Создаем функцию для безопасного обновления профиля
CREATE OR REPLACE FUNCTION update_user_profile_safe(
    target_user_id UUID,
    new_full_name TEXT DEFAULT NULL,
    new_position TEXT DEFAULT NULL,
    new_work_schedule TEXT DEFAULT NULL,
    new_work_hours INTEGER DEFAULT NULL,
    new_office_name TEXT DEFAULT NULL,
    new_avatar_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_office_id INTEGER;
    current_user_id UUID;
    is_authorized BOOLEAN := false;
BEGIN
    -- Получаем ID текущего пользователя
    current_user_id := auth.uid();
    
    -- Проверяем права доступа
    IF current_user_id = target_user_id THEN
        -- Пользователь обновляет свой профиль
        is_authorized := true;
    ELSIF EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = current_user_id AND admin_role = 'super_admin'
    ) THEN
        -- Супер-админ может обновлять любые профили
        is_authorized := true;
    ELSIF EXISTS (
        SELECT 1 FROM user_profiles up1
        JOIN user_profiles up2 ON up2.office_id = up1.managed_office_id
        WHERE up1.id = current_user_id 
        AND up1.admin_role = 'office_admin'
        AND up2.id = target_user_id
    ) THEN
        -- Офис-админ может обновлять профили в своем офисе
        is_authorized := true;
    END IF;
    
    IF NOT is_authorized THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions to update this profile';
    END IF;
    
    -- Получаем ID офиса если указано название
    IF new_office_name IS NOT NULL THEN
        SELECT id INTO target_office_id 
        FROM offices 
        WHERE name = new_office_name 
        LIMIT 1;
        
        IF target_office_id IS NULL THEN
            target_office_id := 1; -- Дефолтный офис
        END IF;
    END IF;
    
    -- Обновляем user_profiles
    UPDATE user_profiles SET
        full_name = COALESCE(new_full_name, full_name),
        position = COALESCE(new_position, position),
        work_schedule = COALESCE(new_work_schedule, work_schedule),
        work_hours = COALESCE(new_work_hours, work_hours),
        office_id = COALESCE(target_office_id, office_id),
        avatar_url = COALESCE(new_avatar_url, avatar_url),
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- Обновляем employees для синхронизации
    UPDATE employees SET
        full_name = COALESCE(new_full_name, full_name),
        position = COALESCE(new_position, position),
        work_schedule = COALESCE(new_work_schedule, work_schedule),
        work_hours = COALESCE(new_work_hours, work_hours),
        office_id = COALESCE(target_office_id, office_id),
        updated_at = NOW()
    WHERE user_id = target_user_id;
    
    RETURN true;
END;
$$;

-- 7. Проверяем и исправляем данные для проблемного пользователя
DO $$
DECLARE
    problem_user_id UUID := 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';
    user_email TEXT;
    default_office_id INTEGER;
BEGIN
    -- Получаем email пользователя
    SELECT email INTO user_email 
    FROM auth.users 
    WHERE id = problem_user_id;
    
    IF user_email IS NULL THEN
        RAISE NOTICE 'Пользователь % не найден в auth.users', problem_user_id;
        RETURN;
    END IF;
    
    -- Получаем ID офиса "Рассвет"
    SELECT id INTO default_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;
    IF default_office_id IS NULL THEN
        default_office_id := 1;
    END IF;
    
    -- Создаем/обновляем профиль
    INSERT INTO user_profiles (
        id, full_name, position, office_id, work_schedule, work_hours,
        is_admin, admin_role, created_at, updated_at
    ) VALUES (
        problem_user_id,
        COALESCE(user_email, 'Пользователь'),
        'Сотрудник',
        default_office_id,
        '5/2',
        9,
        false,
        'user',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        office_id = COALESCE(user_profiles.office_id, EXCLUDED.office_id),
        work_schedule = COALESCE(user_profiles.work_schedule, EXCLUDED.work_schedule),
        work_hours = COALESCE(user_profiles.work_hours, EXCLUDED.work_hours),
        updated_at = NOW();
    
    -- Создаем/обновляем employee
    INSERT INTO employees (
        user_id, full_name, position, office_id, work_schedule, work_hours,
        is_admin, admin_role, is_active, created_at, updated_at
    ) VALUES (
        problem_user_id,
        COALESCE(user_email, 'Пользователь'),
        'Сотрудник',
        default_office_id,
        '5/2',
        9,
        false,
        'user',
        true,
        NOW(),
        NOW()
    ) ON CONFLICT (user_id) DO UPDATE SET
        office_id = COALESCE(employees.office_id, EXCLUDED.office_id),
        work_schedule = COALESCE(employees.work_schedule, EXCLUDED.work_schedule),
        work_hours = COALESCE(employees.work_hours, EXCLUDED.work_hours),
        is_active = true,
        updated_at = NOW();
    
    RAISE NOTICE 'Данные для пользователя % исправлены', user_email;
END $$;

-- 8. Тестируем новые функции
SELECT 'Тест функции get_leaderboard_stats:' as test_type;
SELECT 
    employee_id,
    full_name,
    employee_position,
    office_name,
    total_tasks,
    completed_tasks,
    completion_rate,
    total_points
FROM get_leaderboard_stats()
LIMIT 5;

-- 9. Проверяем финальное состояние
SELECT 'Финальная проверка пользователей:' as check_type;
SELECT 
    COUNT(au.id) as total_auth_users,
    COUNT(up.id) as total_profiles,
    COUNT(e.id) as total_employees,
    COUNT(CASE WHEN up.admin_role = 'super_admin' THEN 1 END) as super_admins,
    COUNT(CASE WHEN up.admin_role = 'office_admin' THEN 1 END) as office_admins
FROM auth.users au
LEFT JOIN user_profiles up ON up.id = au.id
LEFT JOIN employees e ON e.user_id = au.id;

COMMENT ON FUNCTION get_leaderboard_stats() IS 'Безопасная функция получения статистики лидерборда';
COMMENT ON FUNCTION update_user_profile_safe(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) IS 'Безопасная функция обновления профиля пользователя'; 