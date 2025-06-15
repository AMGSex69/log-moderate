-- ===========================================
-- УНИФИКАЦИЯ СИСТЕМЫ АДМИНСКИХ ПРАВ
-- ===========================================

-- 1. Синхронизируем is_admin с admin_role для всех пользователей
UPDATE user_profiles 
SET is_admin = CASE 
    WHEN admin_role IN ('office_admin', 'super_admin') THEN true
    ELSE false
END;

UPDATE employees 
SET is_admin = CASE 
    WHEN admin_role IN ('office_admin', 'super_admin') THEN true
    ELSE false
END;

-- 2. Обновляем пользователей со старой системой (role = 'admin')
-- Переводим их в новую систему admin_role
UPDATE user_profiles 
SET admin_role = 'super_admin', is_admin = true
WHERE role = 'admin' AND admin_role = 'user';

UPDATE employees 
SET admin_role = 'super_admin', is_admin = true
WHERE user_id IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
) AND admin_role = 'user';

-- 3. Создаем триггер для автоматической синхронизации is_admin
CREATE OR REPLACE FUNCTION sync_is_admin_field()
RETURNS TRIGGER AS $$
BEGIN
    -- Автоматически устанавливаем is_admin на основе admin_role
    NEW.is_admin = CASE 
        WHEN NEW.admin_role IN ('office_admin', 'super_admin') THEN true
        ELSE false
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггеры для user_profiles
DROP TRIGGER IF EXISTS trigger_sync_is_admin_user_profiles ON user_profiles;
CREATE TRIGGER trigger_sync_is_admin_user_profiles
    BEFORE INSERT OR UPDATE OF admin_role ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_is_admin_field();

-- Создаем триггеры для employees
DROP TRIGGER IF EXISTS trigger_sync_is_admin_employees ON employees;
CREATE TRIGGER trigger_sync_is_admin_employees
    BEFORE INSERT OR UPDATE OF admin_role ON employees
    FOR EACH ROW
    EXECUTE FUNCTION sync_is_admin_field();

-- 4. Обновляем функцию проверки прав - используем только admin_role
CREATE OR REPLACE FUNCTION check_admin_access_unified(
    requesting_user_uuid UUID,
    target_office_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    can_access BOOLEAN,
    admin_role TEXT,
    managed_office_id INTEGER,
    is_super_admin BOOLEAN,
    is_office_admin BOOLEAN,
    is_admin BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_admin_role TEXT;
    user_managed_office INTEGER;
    user_is_admin BOOLEAN;
BEGIN
    -- Получаем роль пользователя
    SELECT up.admin_role, up.managed_office_id, up.is_admin
    INTO user_admin_role, user_managed_office, user_is_admin
    FROM user_profiles up
    WHERE up.id = requesting_user_uuid;
    
    -- Если пользователь не найден
    IF user_admin_role IS NULL THEN
        RETURN QUERY SELECT false, 'user'::TEXT, NULL::INTEGER, false, false, false;
        RETURN;
    END IF;
    
    -- Супер-админ имеет доступ ко всему
    IF user_admin_role = 'super_admin' THEN
        RETURN QUERY SELECT true, user_admin_role, user_managed_office, true, false, user_is_admin;
        RETURN;
    END IF;
    
    -- Офис-админ имеет доступ только к своему офису
    IF user_admin_role = 'office_admin' THEN
        IF target_office_id IS NULL OR target_office_id = user_managed_office THEN
            RETURN QUERY SELECT true, user_admin_role, user_managed_office, false, true, user_is_admin;
        ELSE
            RETURN QUERY SELECT false, user_admin_role, user_managed_office, false, true, user_is_admin;
        END IF;
        RETURN;
    END IF;
    
    -- Проверяем старую систему (is_admin = true, но admin_role = 'user')
    -- Такие пользователи становятся супер-админами
    IF user_is_admin = true AND user_admin_role = 'user' THEN
        -- Обновляем их роль
        UPDATE user_profiles SET admin_role = 'super_admin' WHERE id = requesting_user_uuid;
        UPDATE employees SET admin_role = 'super_admin' WHERE user_id = requesting_user_uuid;
        
        RETURN QUERY SELECT true, 'super_admin'::TEXT, user_managed_office, true, false, true;
        RETURN;
    END IF;
    
    -- Обычный пользователь не имеет админ доступа
    RETURN QUERY SELECT false, user_admin_role, user_managed_office, false, false, user_is_admin;
END;
$$;

-- 5. Создаем view для удобного получения информации о правах
CREATE OR REPLACE VIEW admin_users_view AS
SELECT 
    up.id,
    up.full_name,
    au.email,
    up.admin_role,
    up.is_admin,
    up.managed_office_id,
    o.name as managed_office_name,
    up.office_id,
    current_office.name as current_office_name,
    CASE 
        WHEN up.admin_role = 'super_admin' THEN 'Супер-администратор'
        WHEN up.admin_role = 'office_admin' THEN 'Администратор офиса'
        WHEN up.is_admin = true THEN 'Администратор (старая система)'
        ELSE 'Сотрудник'
    END as role_description
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
LEFT JOIN offices o ON o.id = up.managed_office_id
LEFT JOIN offices current_office ON current_office.id = up.office_id
WHERE up.admin_role != 'user' OR up.is_admin = true
ORDER BY 
    CASE up.admin_role 
        WHEN 'super_admin' THEN 1
        WHEN 'office_admin' THEN 2
        ELSE 3
    END,
    up.full_name;

-- 6. Проверяем результат миграции
SELECT 'Результат унификации системы админских прав:' as status;

SELECT 
    admin_role,
    is_admin,
    COUNT(*) as count
FROM user_profiles 
GROUP BY admin_role, is_admin
ORDER BY admin_role, is_admin;

-- 7. Показываем всех админов
SELECT * FROM admin_users_view;

COMMENT ON FUNCTION sync_is_admin_field() IS 'Автоматически синхронизирует поле is_admin с admin_role';
COMMENT ON FUNCTION check_admin_access_unified(UUID, INTEGER) IS 'Унифицированная проверка прав доступа с поддержкой старой системы';
COMMENT ON VIEW admin_users_view IS 'Удобный просмотр всех пользователей с админскими правами'; 