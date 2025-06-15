-- ===========================================
-- СИСТЕМА РОЛЕЙ АДМИНИСТРАТОРОВ
-- ===========================================

-- 1. Добавляем новые колонки в user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS admin_role TEXT DEFAULT 'user' CHECK (admin_role IN ('user', 'office_admin', 'super_admin')),
ADD COLUMN IF NOT EXISTS managed_office_id INTEGER REFERENCES offices(id);

-- 2. Добавляем новые колонки в employees (для совместимости)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS admin_role TEXT DEFAULT 'user' CHECK (admin_role IN ('user', 'office_admin', 'super_admin')),
ADD COLUMN IF NOT EXISTS managed_office_id INTEGER REFERENCES offices(id);

-- 3. Обновляем существующих админов
-- Устанавливаем супер-админа для egordolgih@mail.ru
UPDATE user_profiles 
SET admin_role = 'super_admin', is_admin = true 
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru'
);

UPDATE employees 
SET admin_role = 'super_admin', is_admin = true 
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru'
);

-- 4. Создаем функцию для проверки прав доступа
CREATE OR REPLACE FUNCTION check_admin_access(
    requesting_user_uuid UUID,
    target_office_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    can_access BOOLEAN,
    admin_role TEXT,
    managed_office_id INTEGER,
    is_super_admin BOOLEAN,
    is_office_admin BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_admin_role TEXT;
    user_managed_office INTEGER;
BEGIN
    -- Получаем роль пользователя
    SELECT up.admin_role, up.managed_office_id
    INTO user_admin_role, user_managed_office
    FROM user_profiles up
    WHERE up.id = requesting_user_uuid;
    
    -- Если пользователь не найден
    IF user_admin_role IS NULL THEN
        RETURN QUERY SELECT false, 'user'::TEXT, NULL::INTEGER, false, false;
        RETURN;
    END IF;
    
    -- Супер-админ имеет доступ ко всему
    IF user_admin_role = 'super_admin' THEN
        RETURN QUERY SELECT true, user_admin_role, user_managed_office, true, false;
        RETURN;
    END IF;
    
    -- Офис-админ имеет доступ только к своему офису
    IF user_admin_role = 'office_admin' THEN
        IF target_office_id IS NULL OR target_office_id = user_managed_office THEN
            RETURN QUERY SELECT true, user_admin_role, user_managed_office, false, true;
        ELSE
            RETURN QUERY SELECT false, user_admin_role, user_managed_office, false, true;
        END IF;
        RETURN;
    END IF;
    
    -- Обычный пользователь не имеет админ доступа
    RETURN QUERY SELECT false, user_admin_role, user_managed_office, false, false;
END;
$$;

-- 5. Создаем функцию для получения списка сотрудников (с учетом прав)
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
    SELECT * INTO access_check FROM check_admin_access(requesting_user_uuid);
    
    IF NOT access_check.can_access THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions';
    END IF;
    
    -- Супер-админ видит всех
    IF access_check.is_super_admin THEN
        RETURN QUERY
        SELECT 
            up.id::INTEGER as employee_id,
            up.id as user_id,
            up.full_name,
            au.email,
            up."position" as employee_position,
            up.office_id,
            o.name as office_name,
            up.admin_role,
            up.managed_office_id,
            up.is_admin,
            up.is_online,
            up.last_seen,
            up.created_at
        FROM user_profiles up
        JOIN auth.users au ON au.id = up.id
        LEFT JOIN offices o ON o.id = up.office_id
        ORDER BY up.full_name;
    
    -- Офис-админ видит только своих сотрудников
    ELSIF access_check.is_office_admin THEN
        RETURN QUERY
        SELECT 
            up.id::INTEGER as employee_id,
            up.id as user_id,
            up.full_name,
            au.email,
            up."position" as employee_position,
            up.office_id,
            o.name as office_name,
            up.admin_role,
            up.managed_office_id,
            up.is_admin,
            up.is_online,
            up.last_seen,
            up.created_at
        FROM user_profiles up
        JOIN auth.users au ON au.id = up.id
        LEFT JOIN offices o ON o.id = up.office_id
        WHERE up.office_id = access_check.managed_office_id
        ORDER BY up.full_name;
    END IF;
END;
$$;

-- 6. Создаем функцию для обновления прав сотрудника
CREATE OR REPLACE FUNCTION update_employee_permissions(
    requesting_user_uuid UUID,
    target_user_uuid UUID,
    new_office_id INTEGER DEFAULT NULL,
    new_admin_role TEXT DEFAULT NULL,
    new_managed_office_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    access_check RECORD;
    target_current_office INTEGER;
BEGIN
    -- Проверяем права доступа
    SELECT * INTO access_check FROM check_admin_access(requesting_user_uuid);
    
    IF NOT access_check.can_access THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions';
    END IF;
    
    -- Получаем текущий офис целевого пользователя
    SELECT office_id INTO target_current_office 
    FROM user_profiles WHERE id = target_user_uuid;
    
    -- Офис-админ может управлять только сотрудниками своего офиса
    IF access_check.is_office_admin THEN
        IF target_current_office != access_check.managed_office_id THEN
            RAISE EXCEPTION 'Access denied: can only manage employees from your office';
        END IF;
        
        -- Офис-админ не может назначать супер-админов
        IF new_admin_role = 'super_admin' THEN
            RAISE EXCEPTION 'Access denied: cannot assign super admin role';
        END IF;
    END IF;
    
    -- Обновляем user_profiles
    UPDATE user_profiles 
    SET 
        office_id = COALESCE(new_office_id, office_id),
        admin_role = COALESCE(new_admin_role, admin_role),
        managed_office_id = CASE 
            WHEN new_admin_role = 'office_admin' THEN COALESCE(new_managed_office_id, new_office_id, office_id)
            WHEN new_admin_role = 'user' THEN NULL
            ELSE managed_office_id
        END,
        is_admin = CASE 
            WHEN new_admin_role IN ('office_admin', 'super_admin') THEN true
            WHEN new_admin_role = 'user' THEN false
            ELSE is_admin
        END,
        updated_at = NOW()
    WHERE id = target_user_uuid;
    
    -- Обновляем employees для совместимости
    UPDATE employees 
    SET 
        office_id = COALESCE(new_office_id, office_id),
        admin_role = COALESCE(new_admin_role, admin_role),
        managed_office_id = CASE 
            WHEN new_admin_role = 'office_admin' THEN COALESCE(new_managed_office_id, new_office_id, office_id)
            WHEN new_admin_role = 'user' THEN NULL
            ELSE managed_office_id
        END,
        is_admin = CASE 
            WHEN new_admin_role IN ('office_admin', 'super_admin') THEN true
            WHEN new_admin_role = 'user' THEN false
            ELSE is_admin
        END,
        updated_at = NOW()
    WHERE user_id = target_user_uuid;
    
    RETURN true;
END;
$$;

-- 7. Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_user_profiles_admin_role ON user_profiles(admin_role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_managed_office ON user_profiles(managed_office_id);
CREATE INDEX IF NOT EXISTS idx_employees_admin_role ON employees(admin_role);
CREATE INDEX IF NOT EXISTS idx_employees_managed_office ON employees(managed_office_id);

-- 8. Обновляем RLS политики
-- Политика для user_profiles (админы могут видеть сотрудников согласно своим правам)
DROP POLICY IF EXISTS "Admin access to user profiles" ON user_profiles;
CREATE POLICY "Admin access to user profiles" ON user_profiles
FOR ALL USING (
    -- Супер-админ видит всех
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.id = auth.uid() AND up.admin_role = 'super_admin'
    )
    OR
    -- Офис-админ видит сотрудников своего офиса
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.admin_role = 'office_admin' 
        AND up.managed_office_id = user_profiles.office_id
    )
    OR
    -- Пользователь видит только себя
    id = auth.uid()
);

COMMENT ON TABLE user_profiles IS 'Профили пользователей с системой ролей администраторов';
COMMENT ON COLUMN user_profiles.admin_role IS 'Роль администратора: user, office_admin, super_admin';
COMMENT ON COLUMN user_profiles.managed_office_id IS 'ID офиса, которым управляет офис-админ'; 