-- Диагностика структуры таблиц
-- Проверяем структуру user_profiles
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Проверяем структуру employees  
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Проверяем существование данных в user_profiles
SELECT COUNT(*) as user_profiles_count FROM user_profiles;

-- Проверяем существование данных в employees
SELECT COUNT(*) as employees_count FROM employees;

-- Проверяем конкретного пользователя в user_profiles
SELECT * FROM user_profiles WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- Проверяем конкретного пользователя в employees  
SELECT * FROM employees WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- Проверяем RLS политики для user_profiles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'user_profiles';

-- Проверяем RLS политики для employees
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'employees'; 