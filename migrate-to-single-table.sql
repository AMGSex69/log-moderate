-- Миграция к единой таблице user_profiles
-- Убираем дублирование между user_profiles и employees

BEGIN;

-- 1. Добавляем недостающие поля в user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS employee_id SERIAL UNIQUE;

-- 2. Синхронизируем данные из employees в user_profiles
UPDATE user_profiles 
SET 
    full_name = COALESCE(e.full_name, user_profiles.full_name),
    position = COALESCE(e.position, user_profiles.position),
    work_schedule = COALESCE(e.work_schedule, user_profiles.work_schedule),
    work_hours = COALESCE(e.work_hours, user_profiles.work_hours),
    office_id = COALESCE(e.office_id, user_profiles.office_id),
    is_admin = COALESCE(e.is_admin, user_profiles.is_admin),
    avatar_url = COALESCE(e.avatar_url, user_profiles.avatar_url),
    updated_at = NOW()
FROM employees e 
WHERE e.user_id = user_profiles.id;

-- 3. Создаем временную таблицу для маппинга employee_id
CREATE TEMP TABLE employee_mapping AS 
SELECT e.id as old_employee_id, up.employee_id as new_employee_id
FROM employees e
JOIN user_profiles up ON e.user_id = up.id;

-- 4. Обновляем все внешние ключи
UPDATE task_logs 
SET employee_id = em.new_employee_id
FROM employee_mapping em
WHERE task_logs.employee_id = em.old_employee_id;

UPDATE work_sessions 
SET employee_id = em.new_employee_id
FROM employee_mapping em
WHERE work_sessions.employee_id = em.old_employee_id;

UPDATE active_sessions 
SET employee_id = em.new_employee_id
FROM employee_mapping em
WHERE active_sessions.employee_id = em.old_employee_id;

-- 5. Обновляем внешние ключи для ссылки на user_profiles.employee_id
ALTER TABLE task_logs 
DROP CONSTRAINT IF EXISTS task_logs_employee_id_fkey;

ALTER TABLE task_logs 
ADD CONSTRAINT task_logs_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES user_profiles(employee_id);

ALTER TABLE work_sessions 
DROP CONSTRAINT IF EXISTS work_sessions_employee_id_fkey;

ALTER TABLE work_sessions 
ADD CONSTRAINT work_sessions_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES user_profiles(employee_id);

ALTER TABLE active_sessions 
DROP CONSTRAINT IF EXISTS active_sessions_employee_id_fkey;

ALTER TABLE active_sessions 
ADD CONSTRAINT active_sessions_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES user_profiles(employee_id);

-- 6. Удаляем функцию синхронизации (больше не нужна)
DROP FUNCTION IF EXISTS sync_employee_to_userprofile(UUID);

-- 7. Удаляем таблицу employees
DROP TABLE employees;

-- 8. Создаем функцию для получения employee_id по user_id
CREATE OR REPLACE FUNCTION get_employee_id_by_user_id(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT employee_id FROM user_profiles WHERE id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- Проверка результата
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as records_count,
    COUNT(DISTINCT employee_id) as unique_employee_ids
FROM user_profiles
WHERE employee_id IS NOT NULL; 