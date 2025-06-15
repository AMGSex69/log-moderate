-- ДИАГНОСТИКА И ИСПРАВЛЕНИЕ ТРИГГЕРА
-- Выполните в Supabase SQL Editor

-- 1. Проверяем текущее состояние вашего профиля
SELECT 
    'ТЕКУЩЕЕ СОСТОЯНИЕ ПРОФИЛЯ:' as info,
    up.full_name,
    up.office_name as profile_office,
    up.office_id as profile_office_id,
    e.office_id as employee_office_id,
    o1.name as profile_office_from_table,
    o2.name as employee_office_from_table
FROM user_profiles up
LEFT JOIN employees e ON e.user_id = up.id
LEFT JOIN offices o1 ON o1.id = up.office_id
LEFT JOIN offices o2 ON o2.id = e.office_id
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID;

-- 2. Проверяем существование триггера
SELECT 
    'ПРОВЕРКА ТРИГГЕРА:' as info,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    t.tgenabled as enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'trigger_auto_sync_employee';

-- 3. ИСПРАВЛЯЕМ ТРИГГЕР (улучшенная версия)
CREATE OR REPLACE FUNCTION auto_sync_employee_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Логируем срабатывание триггера
    RAISE NOTICE 'ТРИГГЕР СРАБОТАЛ: % для пользователя %', TG_OP, NEW.user_id;
    
    -- Синхронизируем при INSERT или UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Сразу обновляем user_profiles
        UPDATE user_profiles SET
            full_name = COALESCE(NEW.full_name, user_profiles.full_name),
            position = COALESCE(NEW.position, user_profiles.position),
            office_id = NEW.office_id,
            office_name = (SELECT name FROM offices WHERE id = NEW.office_id),
            work_schedule = COALESCE(NEW.work_schedule, user_profiles.work_schedule, '5/2'),
            work_hours = COALESCE(NEW.work_hours, user_profiles.work_hours, 9),
            is_admin = COALESCE(NEW.is_admin, user_profiles.is_admin, false),
            role = CASE WHEN COALESCE(NEW.is_admin, false) THEN 'admin' ELSE 'user' END,
            updated_at = NOW()
        WHERE id = NEW.user_id;
        
        RAISE NOTICE 'СИНХРОНИЗАЦИЯ ВЫПОЛНЕНА для пользователя %', NEW.user_id;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;

-- 4. Пересоздаем триггер
DROP TRIGGER IF EXISTS trigger_auto_sync_employee ON employees;
CREATE TRIGGER trigger_auto_sync_employee
    AFTER INSERT OR UPDATE ON employees
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_sync_employee_trigger();

-- 5. Тестируем триггер - делаем фиктивное обновление
UPDATE employees 
SET updated_at = NOW() 
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID;

-- 6. Принудительно синхронизируем СЕЙЧАС
SELECT sync_employee_to_userprofile('b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID) as forced_sync_result;

-- 7. Проверяем результат после исправления
SELECT 
    'РЕЗУЛЬТАТ ПОСЛЕ ИСПРАВЛЕНИЯ:' as info,
    up.full_name,
    up.office_name as profile_office,
    up.office_id as profile_office_id,
    e.office_id as employee_office_id,
    o1.name as profile_office_from_table,
    o2.name as employee_office_from_table
FROM user_profiles up
LEFT JOIN employees e ON e.user_id = up.id
LEFT JOIN offices o1 ON o1.id = up.office_id
LEFT JOIN offices o2 ON o2.id = e.office_id
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID; 