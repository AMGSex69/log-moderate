-- Тест 1: Проверяем auth.users
SELECT COUNT(*) as auth_users_count FROM auth.users;

-- Тест 2: Проверяем user_profiles  
SELECT COUNT(*) as user_profiles_count FROM public.user_profiles;

-- Тест 3: Проверяем employees
SELECT COUNT(*) as employees_count FROM public.employees; 