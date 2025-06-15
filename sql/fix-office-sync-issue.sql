-- ===========================================
-- ИСПРАВЛЕНИЕ СИНХРОНИЗАЦИИ ОФИСА
-- ===========================================
-- Когда в админке меняют офис, он должен синхронизироваться с профилем и главной страницей

-- 1. ИСПРАВЛЯЕМ ФУНКЦИЮ update_employee_permissions
-- Добавляем синхронизацию office_name и обновление всех связанных данных
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
    new_office_name TEXT;
    update_count INTEGER;
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
    
    -- Получаем название нового офиса если меняется office_id
    IF new_office_id IS NOT NULL THEN
        SELECT name INTO new_office_name 
        FROM offices 
        WHERE id = new_office_id;
        
        IF new_office_name IS NULL THEN
            RAISE EXCEPTION 'Office with ID % not found', new_office_id;
        END IF;
    END IF;
    
    -- Обновляем user_profiles (основная таблица) с синхронизацией office_name
    UPDATE user_profiles 
    SET 
        office_id = COALESCE(new_office_id, office_id),
        office_name = COALESCE(new_office_name, office_name),
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
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    
    -- Проверяем, что обновление прошло успешно
    IF update_count = 0 THEN
        RAISE EXCEPTION 'User not found or update failed';
    END IF;
    
    -- Обновляем employees для совместимости (если запись существует)
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
    
    -- Обновляем лидерборд если меняется офис
    IF new_office_id IS NOT NULL THEN
        -- Удаляем старую запись из лидерборда
        DELETE FROM employees_leaderboard 
        WHERE user_id = target_user_uuid;
        
        -- Добавляем в лидерборд нового офиса если таблица существует
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees_leaderboard') THEN
            INSERT INTO employees_leaderboard (
                employee_id,
                user_id,
                full_name,
                employee_position,
                total_points,
                completed_tasks,
                avatar_url,
                is_online,
                last_seen,
                office_id
            )
            SELECT 
                e.id as employee_id,
                e.user_id,
                COALESCE(e.full_name, up.full_name, 'Unknown Employee') as full_name,
                COALESCE(e.position, up.position, 'Employee') as employee_position,
                0 as total_points, -- Начальные очки
                0 as completed_tasks, -- Начальные задачи
                COALESCE(up.avatar_url, e.avatar_url) as avatar_url,
                COALESCE(e.is_online, false) as is_online,
                COALESCE(e.last_seen, NOW()) as last_seen,
                new_office_id as office_id
            FROM employees e
            LEFT JOIN user_profiles up ON e.user_id = up.id
            WHERE e.user_id = target_user_uuid;
        END IF;
    END IF;
    
    -- Логируем успешное обновление
    RAISE NOTICE 'Employee permissions updated successfully for user %, new office: %', 
                 target_user_uuid, 
                 COALESCE(new_office_name, 'не изменён');
    
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Логируем ошибку и пробрасываем её дальше
        RAISE NOTICE 'Error in update_employee_permissions: %', SQLERRM;
        RAISE;
END;
$$;

-- 2. СОЗДАЕМ ФУНКЦИЮ ДЛЯ ПРИНУДИТЕЛЬНОЙ СИНХРОНИЗАЦИИ
-- Эта функция синхронизирует office_name из таблицы offices для всех пользователей
CREATE OR REPLACE FUNCTION sync_office_names()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sync_count INTEGER := 0;
BEGIN
    -- Обновляем office_name в user_profiles на основе office_id
    UPDATE user_profiles 
    SET office_name = o.name,
        updated_at = NOW()
    FROM offices o
    WHERE user_profiles.office_id = o.id
    AND (user_profiles.office_name IS NULL 
         OR user_profiles.office_name != o.name);
    
    GET DIAGNOSTICS sync_count = ROW_COUNT;
    
    RAISE NOTICE 'Синхронизировано % записей office_name', sync_count;
    
    RETURN sync_count;
END;
$$;

-- 3. ВЫПОЛНЯЕМ СИНХРОНИЗАЦИЮ office_name для существующих пользователей
SELECT sync_office_names();

-- 4. СОЗДАЕМ ТРИГГЕР ДЛЯ АВТОМАТИЧЕСКОЙ СИНХРОНИЗАЦИИ office_name
-- Этот триггер будет автоматически обновлять office_name при изменении office_id
CREATE OR REPLACE FUNCTION sync_office_name_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Если изменился office_id, обновляем office_name
    IF TG_OP = 'UPDATE' AND OLD.office_id IS DISTINCT FROM NEW.office_id THEN
        SELECT name INTO NEW.office_name 
        FROM offices 
        WHERE id = NEW.office_id;
    END IF;
    
    -- Если это INSERT и office_name не задан, получаем его из offices
    IF TG_OP = 'INSERT' AND NEW.office_name IS NULL AND NEW.office_id IS NOT NULL THEN
        SELECT name INTO NEW.office_name 
        FROM offices 
        WHERE id = NEW.office_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Создаем триггер для user_profiles
DROP TRIGGER IF EXISTS user_profiles_sync_office_name ON user_profiles;
CREATE TRIGGER user_profiles_sync_office_name
    BEFORE INSERT OR UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_office_name_trigger();

-- 5. ПРОВЕРЯЕМ РЕЗУЛЬТАТЫ
SELECT 
    'Проверка синхронизации офисов:' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN office_name IS NOT NULL THEN 1 END) as users_with_office_name,
    COUNT(CASE WHEN office_id IS NOT NULL THEN 1 END) as users_with_office_id
FROM user_profiles;

-- Показываем несинхронизированные записи если они есть
SELECT 
    'Несинхронизированные записи:' as info,
    up.id,
    up.full_name,
    up.office_id,
    up.office_name,
    o.name as actual_office_name
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.office_id IS NOT NULL 
AND (up.office_name IS NULL OR up.office_name != o.name);

-- 6. ПРЕДОСТАВЛЯЕМ ПРАВА НА ВЫПОЛНЕНИЕ ФУНКЦИЙ
GRANT EXECUTE ON FUNCTION update_employee_permissions(UUID, UUID, INTEGER, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_office_names() TO authenticated;

-- 7. ФИНАЛЬНЫЕ СООБЩЕНИЯ
DO $$
BEGIN
    RAISE NOTICE '✅ Исправление синхронизации офиса завершено!';
    RAISE NOTICE 'Теперь при изменении офиса в админке он будет автоматически синхронизироваться с профилем';
END $$; 