-- НЕМЕДЛЕННОЕ ИСПРАВЛЕНИЕ СИНХРОНИЗАЦИИ
-- Применить в Supabase Dashboard -> SQL Editor

-- 1. Создаем функцию синхронизации (упрощенная версия)
CREATE OR REPLACE FUNCTION sync_employee_to_userprofile(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    employee_record RECORD;
    result_text TEXT;
BEGIN
    -- Получаем данные employee
    SELECT 
        e.full_name,
        e.position,
        e.office_id,
        e.work_schedule,
        e.work_hours,
        e.is_admin,
        e.avatar_url,
        o.name as office_name
    INTO employee_record
    FROM employees e
    LEFT JOIN offices o ON o.id = e.office_id
    WHERE e.user_id = target_user_id;
    
    IF employee_record IS NULL THEN
        RETURN 'Employee не найден для пользователя ' || target_user_id;
    END IF;
    
    -- Обновляем user_profiles
    UPDATE user_profiles SET
        full_name = employee_record.full_name,
        position = employee_record.position,
        office_id = employee_record.office_id,
        work_schedule = employee_record.work_schedule,
        work_hours = employee_record.work_hours,
        is_admin = employee_record.is_admin,
        avatar_url = employee_record.avatar_url,
        office_name = employee_record.office_name,
        role = CASE WHEN employee_record.is_admin THEN 'admin' ELSE 'user' END,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- Если записи не было, создаем новую
    IF NOT FOUND THEN
        INSERT INTO user_profiles (
            id,
            full_name,
            position,
            office_id,
            work_schedule,
            work_hours,
            is_admin,
            avatar_url,
            office_name,
            role,
            is_online,
            created_at,
            updated_at
        ) VALUES (
            target_user_id,
            employee_record.full_name,
            employee_record.position,
            employee_record.office_id,
            employee_record.work_schedule,
            employee_record.work_hours,
            employee_record.is_admin,
            employee_record.avatar_url,
            employee_record.office_name,
            CASE WHEN employee_record.is_admin THEN 'admin' ELSE 'user' END,
            false,
            NOW(),
            NOW()
        );
    END IF;
    
    result_text := 'Синхронизированы данные для ' || employee_record.full_name || ' в офис "' || employee_record.office_name || '"';
    
    RETURN result_text;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'Ошибка синхронизации: ' || SQLERRM;
END;
$$;

-- 2. Даем права на выполнение
GRANT EXECUTE ON FUNCTION sync_employee_to_userprofile(UUID) TO authenticated;

-- 3. НЕМЕДЛЕННО синхронизируем конкретного пользователя (ваш ID)
DO $$
DECLARE
    sync_result TEXT;
    target_user_id UUID := 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'; -- Ваш ID
    rec RECORD;
BEGIN
    -- Показываем данные ДО синхронизации
    RAISE NOTICE 'ДАННЫЕ ДО СИНХРОНИЗАЦИИ:';
    
    -- Employee данные
    FOR rec IN 
        SELECT e.full_name, e.position, o.name as office_name
        FROM employees e
        LEFT JOIN offices o ON e.office_id = o.id
        WHERE e.user_id = target_user_id
    LOOP
        RAISE NOTICE 'Employee: % - % - офис: %', rec.full_name, rec.position, rec.office_name;
    END LOOP;
    
    -- User_profiles данные
    FOR rec IN 
        SELECT full_name, position, office_name
        FROM user_profiles
        WHERE id = target_user_id
    LOOP
        RAISE NOTICE 'Profile: % - % - офис: %', rec.full_name, rec.position, rec.office_name;
    END LOOP;
    
    -- Выполняем синхронизацию
    RAISE NOTICE 'ВЫПОЛНЯЕМ СИНХРОНИЗАЦИЮ...';
    SELECT sync_employee_to_userprofile(target_user_id) INTO sync_result;
    RAISE NOTICE 'Результат: %', sync_result;
    
    -- Показываем данные ПОСЛЕ синхронизации
    RAISE NOTICE 'ДАННЫЕ ПОСЛЕ СИНХРОНИЗАЦИИ:';
    FOR rec IN 
        SELECT full_name, position, office_name
        FROM user_profiles
        WHERE id = target_user_id
    LOOP
        RAISE NOTICE 'Profile: % - % - офис: %', rec.full_name, rec.position, rec.office_name;
    END LOOP;
END $$;

-- 4. Создаем триггер для автоматической синхронизации
CREATE OR REPLACE FUNCTION auto_sync_employee_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    sync_result TEXT;
BEGIN
    -- Синхронизируем при INSERT или UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT sync_employee_to_userprofile(NEW.user_id) INTO sync_result;
        RAISE NOTICE 'Автосинхронизация: %', sync_result;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Создаем триггер
DROP TRIGGER IF EXISTS trigger_auto_sync_employee ON employees;
CREATE TRIGGER trigger_auto_sync_employee
    AFTER INSERT OR UPDATE ON employees
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_sync_employee_trigger();

-- 5. Синхронизируем ВСЕХ пользователей
DO $$
DECLARE
    user_record RECORD;
    sync_result TEXT;
    total_synced INTEGER := 0;
BEGIN
    RAISE NOTICE 'СИНХРОНИЗИРУЕМ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ...';
    
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM employees 
        WHERE user_id IS NOT NULL
    LOOP
        SELECT sync_employee_to_userprofile(user_record.user_id) INTO sync_result;
        total_synced := total_synced + 1;
        RAISE NOTICE '%', sync_result;
    END LOOP;
    
    RAISE NOTICE 'СИНХРОНИЗИРОВАНО % ПОЛЬЗОВАТЕЛЕЙ', total_synced;
END $$; 