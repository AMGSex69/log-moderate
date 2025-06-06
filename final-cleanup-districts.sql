-- ===========================================
-- ФИНАЛЬНАЯ ОЧИСТКА ОТ DISTRICTS
-- ===========================================

-- БЕЗОПАСНАЯ ОЧИСТКА: все данные уже в offices!

SELECT 'НАЧИНАЕМ ФИНАЛЬНУЮ ОЧИСТКУ...' as status;

-- 1. Удаляем foreign key constraints на districts
SELECT 'Удаляем constraints...' as step;

-- Ищем все constraints на district_id
SELECT 
    'НАЙДЕННЫЕ CONSTRAINTS:' as info,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE kcu.column_name = 'district_id'
    AND tc.constraint_type = 'FOREIGN KEY';

-- Удаляем constraints (если найдены)
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN 
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE kcu.column_name = 'district_id'
            AND tc.constraint_type = 'FOREIGN KEY'
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
                      constraint_record.table_name, 
                      constraint_record.constraint_name);
        RAISE NOTICE 'Удален constraint % из таблицы %', 
                     constraint_record.constraint_name, 
                     constraint_record.table_name;
    END LOOP;
END $$;

-- 2. Удаляем колонки district_id
SELECT 'Удаляем колонки district_id...' as step;

ALTER TABLE employees DROP COLUMN IF EXISTS district_id;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS district_id;

-- 3. Удаляем таблицу districts и связанные
SELECT 'Удаляем старые таблицы...' as step;

DROP TABLE IF EXISTS districts CASCADE;
DROP TABLE IF EXISTS district_stats CASCADE;

-- 4. Удаляем старые функции districts (если есть)
SELECT 'Удаляем старые функции...' as step;

DROP FUNCTION IF EXISTS get_district_statistics CASCADE;
DROP FUNCTION IF EXISTS get_district_leaderboard CASCADE;
DROP FUNCTION IF EXISTS employee_district_stats CASCADE;

-- 5. Удаляем старые views
DROP VIEW IF EXISTS employee_district_stats CASCADE;
DROP VIEW IF EXISTS district_employee_stats CASCADE;

-- 6. Проверяем результат
SELECT 'РЕЗУЛЬТАТ ОЧИСТКИ:' as info;

-- Проверяем что колонки удалены
SELECT 
    'КОЛОНКИ ПОСЛЕ ОЧИСТКИ:' as check_type,
    table_name,
    column_name
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name IN ('employees', 'user_profiles')
    AND column_name LIKE '%district%';

-- Проверяем что таблицы удалены  
SELECT 
    'ТАБЛИЦЫ DISTRICTS:' as check_type,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public' 
    AND table_name LIKE '%district%';

-- Проверяем что функции удалены
SELECT 
    'ФУНКЦИИ DISTRICTS:' as check_type,
    routine_name
FROM information_schema.routines
WHERE routine_schema = 'public' 
    AND routine_name LIKE '%district%';

-- 7. Финальная проверка данных
SELECT 'ФИНАЛЬНАЯ ПРОВЕРКА ДАННЫХ:' as info;

SELECT 
    'employees' as table_name,
    COUNT(*) as total_records,
    COUNT(office_id) as with_office_id,
    CASE WHEN COUNT(office_id) = COUNT(*) THEN '✅ ВСЕ В ОФИСАХ' ELSE '❌ ПРОБЛЕМА' END as status
FROM employees
UNION ALL
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as total_records,
    COUNT(office_id) as with_office_id,
    CASE WHEN COUNT(office_id) = COUNT(*) THEN '✅ ВСЕ В ОФИСАХ' ELSE '❌ ПРОБЛЕМА' END as status
FROM user_profiles;

SELECT 'ОЧИСТКА ЗАВЕРШЕНА! 🎉' as final_status; 