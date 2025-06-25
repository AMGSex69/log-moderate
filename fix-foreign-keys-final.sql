-- Исправляем внешние ключи после миграции с employees на user_profiles

-- 1. Проверяем текущие внешние ключи
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND (ccu.table_name = 'employees' OR tc.table_name = 'employees')
ORDER BY tc.table_name;

-- 2. Удаляем старые внешние ключи, ссылающиеся на employees (если они еще есть)
DO $$ 
DECLARE
    constraint_record RECORD;
BEGIN
    -- Получаем все внешние ключи, ссылающиеся на employees
    FOR constraint_record IN 
        SELECT 
            tc.table_name, 
            tc.constraint_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND ccu.table_name = 'employees'
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
                      constraint_record.table_name, 
                      constraint_record.constraint_name);
        RAISE NOTICE 'Удален внешний ключ: %.%', 
                     constraint_record.table_name, 
                     constraint_record.constraint_name;
    END LOOP;
END $$;

-- 3. Создаем правильные внешние ключи для user_profiles
-- task_logs.employee_id -> user_profiles.employee_id
ALTER TABLE task_logs 
DROP CONSTRAINT IF EXISTS task_logs_employee_id_fkey;

ALTER TABLE task_logs 
ADD CONSTRAINT task_logs_employee_id_fkey 
FOREIGN KEY (employee_id) 
REFERENCES user_profiles(employee_id) 
ON DELETE CASCADE;

-- work_sessions.employee_id -> user_profiles.employee_id  
ALTER TABLE work_sessions 
DROP CONSTRAINT IF EXISTS work_sessions_employee_id_fkey;

ALTER TABLE work_sessions 
ADD CONSTRAINT work_sessions_employee_id_fkey 
FOREIGN KEY (employee_id) 
REFERENCES user_profiles(employee_id) 
ON DELETE CASCADE;

-- 4. Проверяем новые внешние ключи
SELECT 
    'Новые внешние ключи:' as status,
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'user_profiles'
    AND kcu.column_name = 'employee_id'
ORDER BY tc.table_name;

SELECT 'Внешние ключи успешно обновлены для работы с user_profiles!' as final_status; 