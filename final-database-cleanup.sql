-- =============================================
-- ФИНАЛЬНАЯ ОЧИСТКА БАЗЫ ДАННЫХ
-- Удаление старых таблиц и бэкапов после миграции
-- =============================================

-- 1. Удаляем старую таблицу employees (теперь все данные в user_profiles)
DROP TABLE IF EXISTS employees CASCADE;

-- 2. Удаляем все backup таблицы
DROP TABLE IF EXISTS employees_backup CASCADE;
DROP TABLE IF EXISTS task_logs_backup CASCADE;
DROP TABLE IF EXISTS user_profiles_backup CASCADE;
DROP TABLE IF EXISTS work_sessions_backup CASCADE;

-- 3. Удаляем старые функции если есть
DROP FUNCTION IF EXISTS sync_employee_with_user_profile() CASCADE;
DROP FUNCTION IF EXISTS update_employee_from_user_profile() CASCADE;

-- 4. Проверяем целостность данных
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN employee_id IS NOT NULL THEN 1 END) as with_employee_id
FROM user_profiles

UNION ALL

SELECT 
    'task_logs' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT employee_id) as unique_employees
FROM task_logs

UNION ALL

SELECT 
    'work_sessions' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT employee_id) as unique_employees
FROM work_sessions;

-- 5. Проверяем foreign keys
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table
FROM pg_constraint 
WHERE contype = 'f' 
AND (conrelid::regclass::text LIKE '%task_logs%' 
     OR conrelid::regclass::text LIKE '%work_sessions%'
     OR conrelid::regclass::text LIKE '%user_profiles%')
ORDER BY table_name;

SELECT '✅ База данных очищена от старых таблиц!' as status; 