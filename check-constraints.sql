-- ===========================================
-- ПРОВЕРКА ОГРАНИЧЕНИЙ В ТАБЛИЦАХ
-- ===========================================

-- 1. Проверяем ограничения в таблице user_profiles
SELECT 'ОГРАНИЧЕНИЯ user_profiles:' as info;
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.user_profiles'::regclass;

-- 2. Проверяем ограничения в таблице employees  
SELECT 'ОГРАНИЧЕНИЯ employees:' as info;
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.employees'::regclass;

-- 3. Проверяем индексы в user_profiles
SELECT 'ИНДЕКСЫ user_profiles:' as info;
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'user_profiles' AND schemaname = 'public';

-- 4. Проверяем индексы в employees
SELECT 'ИНДЕКСЫ employees:' as info;
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'employees' AND schemaname = 'public';

-- 5. Проверяем структуру таблиц
SELECT 'СТРУКТУРА user_profiles:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
ORDER BY ordinal_position;

SELECT 'СТРУКТУРА employees:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'employees'
ORDER BY ordinal_position; 