-- ФУНКЦИЯ СИНХРОНИЗАЦИИ ДАННЫХ МЕЖДУ EMPLOYEES И USER_PROFILES
-- Синхронизирует данные из employees в user_profiles

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
    WHERE e.user_id = target_user_id
    AND e.is_active = true;
    
    IF employee_record IS NULL THEN
        RETURN 'Employee не найден для пользователя ' || target_user_id;
    END IF;
    
    -- Обновляем или создаем user_profiles
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
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        position = EXCLUDED.position,
        office_id = EXCLUDED.office_id,
        work_schedule = EXCLUDED.work_schedule,
        work_hours = EXCLUDED.work_hours,
        is_admin = EXCLUDED.is_admin,
        avatar_url = EXCLUDED.avatar_url,
        office_name = EXCLUDED.office_name,
        role = EXCLUDED.role,
        updated_at = NOW();
    
    result_text := 'Синхронизированы данные для ' || employee_record.full_name || ' в офис "' || employee_record.office_name || '"';
    
    RETURN result_text;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'Ошибка синхронизации: ' || SQLERRM;
END;
$$;

-- Функция для синхронизации всех пользователей
CREATE OR REPLACE FUNCTION sync_all_employees_to_userprofiles()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    sync_result TEXT;
    total_synced INTEGER := 0;
BEGIN
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM employees 
        WHERE user_id IS NOT NULL 
        AND is_active = true
    LOOP
        SELECT sync_employee_to_userprofile(user_record.user_id) INTO sync_result;
        total_synced := total_synced + 1;
        RAISE NOTICE '%', sync_result;
    END LOOP;
    
    RETURN 'Синхронизировано ' || total_synced || ' пользователей';
END;
$$;

-- Права доступа
GRANT EXECUTE ON FUNCTION sync_employee_to_userprofile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_all_employees_to_userprofiles() TO authenticated;

-- Автоматическая синхронизация при обновлении employee
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

-- Создаем триггер для автоматической синхронизации
DROP TRIGGER IF EXISTS trigger_auto_sync_employee ON employees;
CREATE TRIGGER trigger_auto_sync_employee
    AFTER INSERT OR UPDATE ON employees
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_sync_employee_trigger();

-- Тестируем функции
DO $$
DECLARE
    test_result TEXT;
BEGIN
    RAISE NOTICE 'Запускаем синхронизацию всех пользователей...';
    SELECT sync_all_employees_to_userprofiles() INTO test_result;
    RAISE NOTICE 'Результат: %', test_result;
END $$; 