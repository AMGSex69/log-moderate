-- Проверяем структуру таблиц профилей и RLS политики

-- 1. Структура user_profiles
SELECT 'СТРУКТУРА user_profiles:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Проверяем есть ли office_name в user_profiles
SELECT 'ПРОВЕРКА office_name в user_profiles:' as check_info;
SELECT CASE 
    WHEN COUNT(*) > 0 THEN 'КОЛОНКА office_name СУЩЕСТВУЕТ'
    ELSE 'КОЛОНКА office_name НЕ СУЩЕСТВУЕТ'
END as result
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name = 'office_name'
AND table_schema = 'public';

-- 3. Проверяем RLS политики для employees
SELECT 'RLS ПОЛИТИКИ employees:' as rls_info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'employees';

-- 4. Проверяем связь между user_id и office в employees
SELECT 'СВЯЗЬ user_id с office в employees:' as office_check;
SELECT 
    e.id,
    e.user_id,
    e.office_id,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON e.office_id = o.id
WHERE e.user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'; 