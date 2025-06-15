-- СИНХРОНИЗАЦИЯ С УЧЕТОМ РЕАЛЬНОЙ СТРУКТУРЫ БД
-- Скопируйте и выполните в Supabase SQL Editor

-- 1. Сначала проверим структуру таблиц
SELECT 'user_profiles columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

SELECT 'employees columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employees' 
ORDER BY ordinal_position;

-- 2. Добавляем недостающие колонки в user_profiles (если их нет)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS office_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS work_schedule TEXT DEFAULT '5/2';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS work_hours INTEGER DEFAULT 9;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. Создаем функцию синхронизации (только существующие колонки)
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
        COALESCE(e.work_schedule, '5/2') as work_schedule,
        COALESCE(e.work_hours, 9) as work_hours,
        COALESCE(e.is_admin, false) as is_admin,
        e.avatar_url,
        o.name as office_name
    INTO employee_record
    FROM employees e
    LEFT JOIN offices o ON o.id = e.office_id
    WHERE e.user_id = target_user_id;
    
    IF employee_record IS NULL THEN
        RETURN 'Employee не найден для пользователя ' || target_user_id;
    END IF;
    
    -- Обновляем user_profiles (только существующие колонки)
    UPDATE user_profiles SET
        full_name = COALESCE(employee_record.full_name, full_name),
        position = COALESCE(employee_record.position, position),
        office_id = employee_record.office_id,
        work_schedule = employee_record.work_schedule,
        work_hours = employee_record.work_hours,
        is_admin = employee_record.is_admin,
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
            office_name,
            role,
            is_online,
            created_at,
            updated_at
        ) VALUES (
            target_user_id,
            employee_record.full_name,
            COALESCE(employee_record.position, 'Сотрудник'),
            employee_record.office_id,
            employee_record.work_schedule,
            employee_record.work_hours,
            employee_record.is_admin,
            employee_record.office_name,
            CASE WHEN employee_record.is_admin THEN 'admin' ELSE 'user' END,
            false,
            NOW(),
            NOW()
        );
    END IF;
    
    result_text := 'Синхронизированы данные для ' || COALESCE(employee_record.full_name, 'пользователя') || ' в офис "' || COALESCE(employee_record.office_name, 'Не указан') || '"';
    
    RETURN result_text;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'Ошибка синхронизации: ' || SQLERRM;
END;
$$;

-- 4. Даем права на выполнение
GRANT EXECUTE ON FUNCTION sync_employee_to_userprofile(UUID) TO authenticated;

-- 5. Синхронизируем ВАШЕГО пользователя
SELECT sync_employee_to_userprofile('b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID) as sync_result;

-- 6. Синхронизируем ВСЕХ пользователей (безопасно)
UPDATE user_profiles SET
    office_id = e.office_id,
    office_name = o.name,
    full_name = COALESCE(e.full_name, user_profiles.full_name),
    position = COALESCE(e.position, user_profiles.position),
    work_schedule = COALESCE(e.work_schedule, user_profiles.work_schedule, '5/2'),
    work_hours = COALESCE(e.work_hours, user_profiles.work_hours, 9),
    is_admin = COALESCE(e.is_admin, user_profiles.is_admin, false),
    role = CASE WHEN COALESCE(e.is_admin, false) THEN 'admin' ELSE 'user' END,
    updated_at = NOW()
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE user_profiles.id = e.user_id;

-- 7. Создаем триггер для автоматической синхронизации
CREATE OR REPLACE FUNCTION auto_sync_employee_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Синхронизируем при INSERT или UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM sync_employee_to_userprofile(NEW.user_id);
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

-- 8. Проверяем результат для вашего пользователя
SELECT 
    'РЕЗУЛЬТАТ СИНХРОНИЗАЦИИ:' as status,
    up.full_name,
    up.position,
    up.office_name,
    up.office_id,
    o.name as office_from_offices_table
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID;

-- 9. Показываем все синхронизированные профили
SELECT 
    'ВСЕ СИНХРОНИЗИРОВАННЫЕ ПРОФИЛИ:' as info,
    up.full_name,
    up.office_name,
    up.office_id
FROM user_profiles up
WHERE up.office_id IS NOT NULL
ORDER BY up.full_name; 