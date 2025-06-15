-- ПРОДВИНУТАЯ ДИАГНОСТИКА И ИСПРАВЛЕНИЕ ТРИГГЕРА
-- Выполните в Supabase SQL Editor по частям

-- 1. СОЗДАЕМ ЛОГИ ДЛЯ ОТСЛЕЖИВАНИЯ ТРИГГЕРА
CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    operation TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. ПОЛНОСТЬЮ ПЕРЕСОЗДАЕМ ФУНКЦИЮ С ДЕТАЛЬНЫМ ЛОГИРОВАНИЕМ
CREATE OR REPLACE FUNCTION auto_sync_employee_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    office_name_val TEXT;
    rows_updated INTEGER;
BEGIN
    -- Логируем каждое срабатывание
    INSERT INTO sync_logs (user_id, operation, message)
    VALUES (NEW.user_id, TG_OP, 'Триггер сработал для пользователя: ' || NEW.user_id::TEXT);
    
    -- Получаем название офиса
    SELECT name INTO office_name_val FROM offices WHERE id = NEW.office_id;
    
    -- Логируем найденный офис
    INSERT INTO sync_logs (user_id, operation, message)
    VALUES (NEW.user_id, 'OFFICE_LOOKUP', 'Найден офис: ' || COALESCE(office_name_val, 'NULL'));
    
    -- Обновляем user_profiles
    UPDATE user_profiles SET
        full_name = COALESCE(NEW.full_name, user_profiles.full_name),
        position = COALESCE(NEW.position, user_profiles.position),
        office_id = NEW.office_id,
        office_name = office_name_val,
        work_schedule = COALESCE(NEW.work_schedule, user_profiles.work_schedule, '5/2'),
        work_hours = COALESCE(NEW.work_hours, user_profiles.work_hours, 9),
        is_admin = COALESCE(NEW.is_admin, user_profiles.is_admin, false),
        role = CASE WHEN COALESCE(NEW.is_admin, false) THEN 'admin' ELSE 'user' END,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    
    -- Логируем результат обновления
    INSERT INTO sync_logs (user_id, operation, message)
    VALUES (NEW.user_id, 'UPDATE_RESULT', 'Обновлено строк: ' || rows_updated::TEXT);
    
    RETURN NEW;
END;
$$;

-- 3. УДАЛЯЕМ И ПЕРЕСОЗДАЕМ ТРИГГЕР
DROP TRIGGER IF EXISTS trigger_auto_sync_employee ON employees;
CREATE TRIGGER trigger_auto_sync_employee
    AFTER INSERT OR UPDATE ON employees
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_sync_employee_trigger();

-- 4. ОЧИЩАЕМ СТАРЫЕ ЛОГИ И ТЕСТИРУЕМ
DELETE FROM sync_logs;

-- 5. ТЕСТОВОЕ ОБНОВЛЕНИЕ ВАШЕГО ПРОФИЛЯ
UPDATE employees 
SET office_id = office_id, -- Фиктивное обновление для срабатывания триггера
    updated_at = NOW()
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID;

-- 6. ПРОВЕРЯЕМ ЛОГИ ТРИГГЕРА
SELECT 
    'ЛОГИ ТРИГГЕРА:' as info,
    user_id,
    operation,
    message,
    created_at
FROM sync_logs 
ORDER BY created_at DESC;

-- 7. ПРОВЕРЯЕМ ТЕКУЩЕЕ СОСТОЯНИЕ ДАННЫХ
SELECT 
    'СОСТОЯНИЕ ПОСЛЕ ТЕСТА:' as info,
    up.full_name,
    up.office_name as profile_office,
    up.office_id as profile_office_id,
    e.office_id as employee_office_id,
    up.updated_at as profile_updated_at,
    e.updated_at as employee_updated_at
FROM user_profiles up
LEFT JOIN employees e ON e.user_id = up.id
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'::UUID;

-- 8. ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ПРАВ НА ТАБЛИЦЫ
SELECT 
    'ПРАВА НА ТАБЛИЦЫ:' as info,
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename IN ('employees', 'user_profiles', 'offices')
ORDER BY tablename; 