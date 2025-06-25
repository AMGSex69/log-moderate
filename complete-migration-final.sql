-- ФИНАЛЬНОЕ ЗАВЕРШЕНИЕ МИГРАЦИИ К ЕДИНОЙ ТАБЛИЦЕ
-- Учитывает текущее состояние БД где user_profiles уже обновлена

-- ===========================================
-- ШАГ 1: ПРОВЕРКА ТЕКУЩЕГО СОСТОЯНИЯ
-- ===========================================

SELECT 'ТЕКУЩЕЕ СОСТОЯНИЕ БД:' as info;

-- Проверяем количество записей
SELECT 
    (SELECT COUNT(*) FROM user_profiles) as user_profiles_count,
    (SELECT COUNT(*) FROM user_profiles WHERE employee_id IS NOT NULL) as profiles_with_employee_id,
    (SELECT COUNT(*) FROM employees) as employees_count,
    (SELECT COUNT(*) FROM task_logs) as task_logs_count,
    (SELECT COUNT(*) FROM work_sessions) as work_sessions_count,
    (SELECT COUNT(*) FROM active_sessions) as active_sessions_count;

-- Проверяем, есть ли маппинг между старыми и новыми ID
SELECT 'МАППИНГ ПРОВЕРКА:' as info;
SELECT 
    COUNT(*) as employees_with_profiles
FROM employees e
JOIN user_profiles up ON e.user_id = up.id
WHERE up.employee_id IS NOT NULL;

-- ===========================================
-- ШАГ 2: СОЗДАНИЕ МАППИНГА employee_id
-- ===========================================

-- Создаем временную таблицу для маппинга (если не существует)
DROP TABLE IF EXISTS employee_id_mapping;
CREATE TEMP TABLE employee_id_mapping AS 
SELECT 
    e.id as old_employee_id, 
    up.employee_id as new_employee_id,
    e.user_id
FROM employees e
JOIN user_profiles up ON e.user_id = up.id
WHERE up.employee_id IS NOT NULL;

-- Проверяем маппинг
SELECT 'СОЗДАН МАППИНГ:' as info;
SELECT COUNT(*) as mapped_records FROM employee_id_mapping;

-- Показываем примеры маппинга
SELECT 'ПРИМЕРЫ МАППИНГА:' as info;
SELECT old_employee_id, new_employee_id, user_id FROM employee_id_mapping LIMIT 5;

-- ===========================================
-- ШАГ 3: ОБНОВЛЕНИЕ ВНЕШНИХ КЛЮЧЕЙ
-- ===========================================

BEGIN;

-- Обновляем task_logs
UPDATE task_logs 
SET employee_id = em.new_employee_id
FROM employee_id_mapping em
WHERE task_logs.employee_id = em.old_employee_id;

-- Проверяем результат
SELECT 'ОБНОВЛЕНО task_logs:' as info;
SELECT COUNT(*) as updated_records FROM task_logs tl
JOIN user_profiles up ON up.employee_id = tl.employee_id;

-- Обновляем work_sessions
UPDATE work_sessions 
SET employee_id = em.new_employee_id
FROM employee_id_mapping em
WHERE work_sessions.employee_id = em.old_employee_id;

-- Проверяем результат
SELECT 'ОБНОВЛЕНО work_sessions:' as info;
SELECT COUNT(*) as updated_records FROM work_sessions ws
JOIN user_profiles up ON up.employee_id = ws.employee_id;

-- Обновляем active_sessions
UPDATE active_sessions 
SET employee_id = em.new_employee_id
FROM employee_id_mapping em
WHERE active_sessions.employee_id = em.old_employee_id;

-- Проверяем результат
SELECT 'ОБНОВЛЕНО active_sessions:' as info;
SELECT COUNT(*) as updated_records FROM active_sessions as_table
JOIN user_profiles up ON up.employee_id = as_table.employee_id;

-- Обновляем break_logs
UPDATE break_logs 
SET employee_id = em.new_employee_id
FROM employee_id_mapping em
WHERE break_logs.employee_id = em.old_employee_id;

-- Обновляем employee_prizes
UPDATE employee_prizes 
SET employee_id = em.new_employee_id
FROM employee_id_mapping em
WHERE employee_prizes.employee_id = em.old_employee_id;

COMMIT;

-- ===========================================
-- ШАГ 4: ОБНОВЛЕНИЕ ОГРАНИЧЕНИЙ ВНЕШНИХ КЛЮЧЕЙ
-- ===========================================

BEGIN;

-- Удаляем старые ограничения
ALTER TABLE task_logs DROP CONSTRAINT IF EXISTS task_logs_employee_id_fkey;
ALTER TABLE work_sessions DROP CONSTRAINT IF EXISTS work_sessions_employee_id_fkey;
ALTER TABLE active_sessions DROP CONSTRAINT IF EXISTS active_sessions_employee_id_fkey;
ALTER TABLE break_logs DROP CONSTRAINT IF EXISTS break_logs_employee_id_fkey;
ALTER TABLE employee_prizes DROP CONSTRAINT IF EXISTS employee_prizes_employee_id_fkey;

-- Создаем новые ограничения, ссылающиеся на user_profiles.employee_id
ALTER TABLE task_logs 
ADD CONSTRAINT task_logs_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES user_profiles(employee_id) ON DELETE CASCADE;

ALTER TABLE work_sessions 
ADD CONSTRAINT work_sessions_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES user_profiles(employee_id) ON DELETE CASCADE;

ALTER TABLE active_sessions 
ADD CONSTRAINT active_sessions_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES user_profiles(employee_id) ON DELETE CASCADE;

ALTER TABLE break_logs 
ADD CONSTRAINT break_logs_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES user_profiles(employee_id) ON DELETE CASCADE;

ALTER TABLE employee_prizes 
ADD CONSTRAINT employee_prizes_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES user_profiles(employee_id) ON DELETE CASCADE;

COMMIT;

-- ===========================================
-- ШАГ 5: СОЗДАНИЕ/ОБНОВЛЕНИЕ ФУНКЦИЙ
-- ===========================================

-- Функция для получения employee_id по user_id
CREATE OR REPLACE FUNCTION get_employee_id_by_user_id(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT employee_id FROM user_profiles WHERE id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для получения user_id по employee_id
CREATE OR REPLACE FUNCTION get_user_id_by_employee_id(emp_id INTEGER)
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT id FROM user_profiles WHERE employee_id = emp_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Обновляем функцию get_or_create_employee_id
CREATE OR REPLACE FUNCTION get_or_create_employee_id(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    employee_id INTEGER;
    user_name TEXT;
    user_email TEXT;
    default_office_id INTEGER;
BEGIN
    -- Ищем существующий employee_id в user_profiles
    SELECT up.employee_id INTO employee_id 
    FROM user_profiles up
    WHERE up.id = user_uuid;
    
    -- Если найден, возвращаем его
    IF employee_id IS NOT NULL THEN
        RETURN employee_id;
    END IF;
    
    -- Получаем данные пользователя из auth.users
    SELECT au.email, COALESCE(au.raw_user_meta_data->>'full_name', au.email) 
    INTO user_email, user_name
    FROM auth.users au 
    WHERE au.id = user_uuid;
    
    IF user_email IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Получаем ID офиса "Рассвет" как дефолтный
    SELECT id INTO default_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;
    IF default_office_id IS NULL THEN
        default_office_id := 1;
    END IF;
    
    -- Создаем/обновляем профиль пользователя
    INSERT INTO user_profiles (
        id, full_name, position, is_admin, office_id,
        work_schedule, work_hours, email, is_active,
        created_at, updated_at
    ) VALUES (
        user_uuid, user_name, 'Сотрудник', false, default_office_id,
        '5/2', 9, user_email, true,
        NOW(), NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(user_profiles.full_name, EXCLUDED.full_name),
        office_id = COALESCE(user_profiles.office_id, EXCLUDED.office_id),
        updated_at = NOW()
    RETURNING employee_id INTO employee_id;
    
    RETURN employee_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Ошибка создания employee_id: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- ===========================================
-- ШАГ 6: ОБНОВЛЕНИЕ RLS ПОЛИТИК
-- ===========================================

-- Обновляем RLS политики для task_logs
DROP POLICY IF EXISTS "task_logs_policy" ON task_logs;
DROP POLICY IF EXISTS "Users can manage own task logs" ON task_logs;
DROP POLICY IF EXISTS "task_logs_unified_policy" ON task_logs;

CREATE POLICY "task_logs_unified_policy" ON task_logs FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.employee_id = task_logs.employee_id 
        AND up.id = auth.uid()
    )
);

-- Обновляем RLS политики для work_sessions
DROP POLICY IF EXISTS "work_sessions_policy" ON work_sessions;
DROP POLICY IF EXISTS "Users can manage own work sessions" ON work_sessions;
DROP POLICY IF EXISTS "work_sessions_unified_policy" ON work_sessions;

CREATE POLICY "work_sessions_unified_policy" ON work_sessions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.employee_id = work_sessions.employee_id 
        AND up.id = auth.uid()
    )
);

-- Обновляем RLS политики для active_sessions
DROP POLICY IF EXISTS "active_sessions_policy" ON active_sessions;
DROP POLICY IF EXISTS "Users can manage own active sessions" ON active_sessions;
DROP POLICY IF EXISTS "active_sessions_unified_policy" ON active_sessions;

CREATE POLICY "active_sessions_unified_policy" ON active_sessions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.employee_id = active_sessions.employee_id 
        AND up.id = auth.uid()
    )
);

-- ===========================================
-- ШАГ 7: УДАЛЕНИЕ СТАРЫХ ФУНКЦИЙ
-- ===========================================

-- Удаляем функции синхронизации (больше не нужны)
DROP FUNCTION IF EXISTS sync_employee_to_userprofile(UUID);
DROP FUNCTION IF EXISTS sync_all_employees_to_userprofiles();
DROP FUNCTION IF EXISTS auto_sync_employee_trigger();

-- Удаляем триггеры синхронизации
DROP TRIGGER IF EXISTS auto_sync_employee_trigger ON employees;

-- ===========================================
-- ШАГ 8: ФИНАЛЬНАЯ ПРОВЕРКА
-- ===========================================

SELECT 'РЕЗУЛЬТАТЫ МИГРАЦИИ:' as info;

-- Проверяем количество записей после миграции
SELECT 
    (SELECT COUNT(*) FROM user_profiles) as user_profiles_count,
    (SELECT COUNT(*) FROM user_profiles WHERE employee_id IS NOT NULL) as profiles_with_employee_id,
    (SELECT COUNT(*) FROM task_logs) as task_logs_count,
    (SELECT COUNT(*) FROM work_sessions) as work_sessions_count,
    (SELECT COUNT(*) FROM active_sessions) as active_sessions_count;

-- Проверяем целостность данных
SELECT 'ПРОВЕРКА ЦЕЛОСТНОСТИ:' as info;

-- Проверяем task_logs
SELECT 
    COUNT(*) as total_task_logs,
    COUNT(CASE WHEN up.employee_id IS NOT NULL THEN 1 END) as valid_task_logs,
    COUNT(CASE WHEN up.employee_id IS NULL THEN 1 END) as orphaned_task_logs
FROM task_logs tl
LEFT JOIN user_profiles up ON up.employee_id = tl.employee_id;

-- Проверяем work_sessions
SELECT 
    COUNT(*) as total_work_sessions,
    COUNT(CASE WHEN up.employee_id IS NOT NULL THEN 1 END) as valid_work_sessions,
    COUNT(CASE WHEN up.employee_id IS NULL THEN 1 END) as orphaned_work_sessions
FROM work_sessions ws
LEFT JOIN user_profiles up ON up.employee_id = ws.employee_id;

-- Проверяем active_sessions
SELECT 
    COUNT(*) as total_active_sessions,
    COUNT(CASE WHEN up.employee_id IS NOT NULL THEN 1 END) as valid_active_sessions,
    COUNT(CASE WHEN up.employee_id IS NULL THEN 1 END) as orphaned_active_sessions
FROM active_sessions as_table
LEFT JOIN user_profiles up ON up.employee_id = as_table.employee_id;

-- Проверяем структуру объединенной таблицы
SELECT 'СТРУКТУРА user_profiles:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

-- ===========================================
-- ШАГ 9: ГОТОВНОСТЬ К УДАЛЕНИЮ employees
-- ===========================================

SELECT 'ГОТОВНОСТЬ К УДАЛЕНИЮ ТАБЛИЦЫ employees:' as info;

-- Проверяем, что все данные перенесены
SELECT 
    'Все внешние ключи обновлены и ссылаются на user_profiles.employee_id' as status
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'employees'
    AND tc.table_name != 'employees'
);

-- ВНИМАНИЕ: После проверки всех результатов можно безопасно удалить таблицу employees
-- Раскомментируйте следующую строку ТОЛЬКО если все проверки прошли успешно:
-- DROP TABLE employees CASCADE;

SELECT 'МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!' as status;
SELECT 'Проверьте все результаты выше перед удалением таблицы employees' as warning; 