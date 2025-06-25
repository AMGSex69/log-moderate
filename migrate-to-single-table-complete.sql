-- ПОЛНАЯ МИГРАЦИЯ К ЕДИНОЙ ТАБЛИЦЕ user_profiles
-- Объединяем user_profiles и employees в одну таблицу
-- ВНИМАНИЕ: Выполняйте по частям и проверяйте каждый шаг!

-- ===========================================
-- ШАГ 1: АНАЛИЗ И ПОДГОТОВКА
-- ===========================================

-- Проверим текущую структуру таблиц
SELECT 'АНАЛИЗ user_profiles:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

SELECT 'АНАЛИЗ employees:' as info;  
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'employees' 
ORDER BY ordinal_position;

-- Проверим количество записей
SELECT 'КОЛИЧЕСТВО ЗАПИСЕЙ:' as info;
SELECT 
    (SELECT COUNT(*) FROM user_profiles) as user_profiles_count,
    (SELECT COUNT(*) FROM employees) as employees_count,
    (SELECT COUNT(*) FROM task_logs) as task_logs_count,
    (SELECT COUNT(*) FROM work_sessions) as work_sessions_count,
    (SELECT COUNT(*) FROM active_sessions) as active_sessions_count;

-- Найдем пользователей без связанных employee записей
SELECT 'ПОЛЬЗОВАТЕЛИ БЕЗ EMPLOYEES:' as info;
SELECT up.id, up.full_name, up.position
FROM user_profiles up
LEFT JOIN employees e ON e.user_id = up.id
WHERE e.id IS NULL;

-- Найдем employees без user_profiles
SELECT 'EMPLOYEES БЕЗ USER_PROFILES:' as info;
SELECT e.id, e.user_id, e.full_name, e.position
FROM employees e
LEFT JOIN user_profiles up ON up.id = e.user_id
WHERE up.id IS NULL;

-- ===========================================
-- ШАГ 2: СОЗДАНИЕ РЕЗЕРВНЫХ КОПИЙ
-- ===========================================

-- Создаем резервные копии таблиц
CREATE TABLE IF NOT EXISTS user_profiles_backup AS SELECT * FROM user_profiles;
CREATE TABLE IF NOT EXISTS employees_backup AS SELECT * FROM employees;
CREATE TABLE IF NOT EXISTS task_logs_backup AS SELECT * FROM task_logs;
CREATE TABLE IF NOT EXISTS work_sessions_backup AS SELECT * FROM work_sessions;
CREATE TABLE IF NOT EXISTS active_sessions_backup AS SELECT * FROM active_sessions;

SELECT 'РЕЗЕРВНЫЕ КОПИИ СОЗДАНЫ' as status;

-- ===========================================
-- ШАГ 3: ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ ПОЛЕЙ В user_profiles
-- ===========================================

BEGIN;

-- Добавляем employee_id как SERIAL (автоинкремент)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS employee_id SERIAL UNIQUE;

-- Добавляем недостающие поля из employees
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS employee_number TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;

-- Убеждаемся, что все нужные поля есть
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS work_schedule TEXT DEFAULT '5/2';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS work_hours INTEGER DEFAULT 9;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS office_id INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMIT;

-- ===========================================
-- ШАГ 4: СИНХРОНИЗАЦИЯ ДАННЫХ
-- ===========================================

BEGIN;

-- Обновляем user_profiles данными из employees
UPDATE user_profiles 
SET 
    full_name = COALESCE(e.full_name, user_profiles.full_name),
    position = COALESCE(e.position, user_profiles.position),
    work_schedule = COALESCE(e.work_schedule, user_profiles.work_schedule),
    work_hours = COALESCE(e.work_hours, user_profiles.work_hours),
    office_id = COALESCE(e.office_id, user_profiles.office_id),
    is_admin = COALESCE(e.is_admin, user_profiles.is_admin),
    avatar_url = COALESCE(e.avatar_url, user_profiles.avatar_url),
    employee_number = COALESCE(e.employee_number, user_profiles.employee_number),
    email = COALESCE(e.email, user_profiles.email),
    is_active = COALESCE(e.is_active, user_profiles.is_active),
    last_seen = COALESCE(e.last_seen, user_profiles.last_seen),
    updated_at = NOW()
FROM employees e 
WHERE e.user_id = user_profiles.id;

-- Создаем записи user_profiles для employees без профиля
INSERT INTO user_profiles (
    id, full_name, position, work_schedule, work_hours, 
    office_id, is_admin, avatar_url, employee_number, 
    email, is_active, last_seen, created_at, updated_at
)
SELECT 
    e.user_id,
    e.full_name,
    COALESCE(e.position, 'Сотрудник'),
    COALESCE(e.work_schedule, '5/2'),
    COALESCE(e.work_hours, 9),
    e.office_id,
    COALESCE(e.is_admin, false),
    e.avatar_url,
    e.employee_number,
    e.email,
    COALESCE(e.is_active, true),
    e.last_seen,
    COALESCE(e.created_at, NOW()),
    COALESCE(e.updated_at, NOW())
FROM employees e
LEFT JOIN user_profiles up ON up.id = e.user_id
WHERE up.id IS NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ===========================================
-- ШАГ 5: СОЗДАНИЕ МАППИНГА employee_id
-- ===========================================

-- Создаем временную таблицу для маппинга старых и новых ID
CREATE TEMP TABLE employee_id_mapping AS 
SELECT 
    e.id as old_employee_id, 
    up.employee_id as new_employee_id,
    e.user_id
FROM employees e
JOIN user_profiles up ON e.user_id = up.id
WHERE up.employee_id IS NOT NULL;

-- Проверяем маппинг
SELECT 'МАППИНГ employee_id:' as info;
SELECT COUNT(*) as mapped_records FROM employee_id_mapping;

-- ===========================================
-- ШАГ 6: ОБНОВЛЕНИЕ ВНЕШНИХ КЛЮЧЕЙ
-- ===========================================

BEGIN;

-- Обновляем task_logs
UPDATE task_logs 
SET employee_id = em.new_employee_id
FROM employee_id_mapping em
WHERE task_logs.employee_id = em.old_employee_id;

-- Обновляем work_sessions
UPDATE work_sessions 
SET employee_id = em.new_employee_id
FROM employee_id_mapping em
WHERE work_sessions.employee_id = em.old_employee_id;

-- Обновляем active_sessions
UPDATE active_sessions 
SET employee_id = em.new_employee_id
FROM employee_id_mapping em
WHERE active_sessions.employee_id = em.old_employee_id;

-- Обновляем break_logs (если есть)
UPDATE break_logs 
SET employee_id = em.new_employee_id
FROM employee_id_mapping em
WHERE break_logs.employee_id = em.old_employee_id;

-- Обновляем employee_prizes (если есть)
UPDATE employee_prizes 
SET employee_id = em.new_employee_id
FROM employee_id_mapping em
WHERE employee_prizes.employee_id = em.old_employee_id;

-- Обновляем favorite_tasks (если есть)
UPDATE favorite_tasks 
SET user_id = em.user_id
FROM employee_id_mapping em
WHERE favorite_tasks.user_id = em.user_id;

COMMIT;

-- ===========================================
-- ШАГ 7: ОБНОВЛЕНИЕ ОГРАНИЧЕНИЙ ВНЕШНИХ КЛЮЧЕЙ
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

-- Для break_logs и employee_prizes (если таблицы существуют)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'break_logs') THEN
        ALTER TABLE break_logs 
        ADD CONSTRAINT break_logs_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES user_profiles(employee_id) ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_prizes') THEN
        ALTER TABLE employee_prizes 
        ADD CONSTRAINT employee_prizes_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES user_profiles(employee_id) ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;

-- ===========================================
-- ШАГ 8: СОЗДАНИЕ НОВЫХ ФУНКЦИЙ
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
-- ШАГ 9: ОБНОВЛЕНИЕ RLS ПОЛИТИК
-- ===========================================

-- Обновляем RLS политики для task_logs
DROP POLICY IF EXISTS "task_logs_policy" ON task_logs;
CREATE POLICY "task_logs_policy" ON task_logs FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.employee_id = task_logs.employee_id 
        AND up.id = auth.uid()
    )
);

-- Обновляем RLS политики для work_sessions
DROP POLICY IF EXISTS "work_sessions_policy" ON work_sessions;
CREATE POLICY "work_sessions_policy" ON work_sessions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.employee_id = work_sessions.employee_id 
        AND up.id = auth.uid()
    )
);

-- Обновляем RLS политики для active_sessions
DROP POLICY IF EXISTS "active_sessions_policy" ON active_sessions;
CREATE POLICY "active_sessions_policy" ON active_sessions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.employee_id = active_sessions.employee_id 
        AND up.id = auth.uid()
    )
);

-- ===========================================
-- ШАГ 10: УДАЛЕНИЕ СТАРЫХ ФУНКЦИЙ И ТАБЛИЦ
-- ===========================================

-- Удаляем функции синхронизации (больше не нужны)
DROP FUNCTION IF EXISTS sync_employee_to_userprofile(UUID);
DROP FUNCTION IF EXISTS sync_all_employees_to_userprofiles();
DROP FUNCTION IF EXISTS auto_sync_employee_trigger();

-- Удаляем триггеры синхронизации
DROP TRIGGER IF EXISTS auto_sync_employee_trigger ON employees;

-- ВНИМАНИЕ: Удаление таблицы employees - необратимая операция!
-- Убедитесь, что все данные перенесены корректно
-- DROP TABLE employees;

-- ===========================================
-- ШАГ 11: ПРОВЕРКА РЕЗУЛЬТАТОВ
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
SELECT 
    COUNT(*) as orphaned_task_logs
FROM task_logs tl
LEFT JOIN user_profiles up ON up.employee_id = tl.employee_id
WHERE up.employee_id IS NULL;

-- Проверяем структуру объединенной таблицы
SELECT 'СТРУКТУРА user_profiles:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

SELECT 'МИГРАЦИЯ ЗАВЕРШЕНА!' as status; 