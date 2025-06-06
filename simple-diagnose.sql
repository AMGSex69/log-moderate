-- ===========================================
-- УПРОЩЕННАЯ ДИАГНОСТИКА
-- ===========================================

-- 1. БАЗОВЫЕ СЧЕТЧИКИ
SELECT 'БАЗОВЫЕ СЧЕТЧИКИ:' as info;

SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users;
SELECT 'user_profiles' as table_name, COUNT(*) as count FROM public.user_profiles;
SELECT 'employees' as table_name, COUNT(*) as count FROM public.employees;
SELECT 'districts' as table_name, COUNT(*) as count FROM public.districts;

-- 2. ПРОВЕРИМ ДОСТУП К auth.users
SELECT 'ПЕРВЫЕ 3 ПОЛЬЗОВАТЕЛЯ:' as info;
SELECT 
    id::text as user_id,
    email,
    created_at::date as registered
FROM auth.users 
ORDER BY created_at 
LIMIT 3;

-- 3. ПРОВЕРИМ user_profiles
SELECT 'ПЕРВЫЕ 3 ПРОФИЛЯ:' as info;
SELECT 
    id::text as user_id,
    full_name,
    district_id
FROM public.user_profiles 
ORDER BY created_at 
LIMIT 3;

-- 4. ПРОВЕРИМ employees
SELECT 'ПЕРВЫЕ 3 СОТРУДНИКА:' as info;
SELECT 
    id,
    user_id::text,
    full_name,
    district_id
FROM public.employees 
ORDER BY created_at 
LIMIT 3;

-- 5. ПРОСТАЯ ПРОВЕРКА ПРОПУСКОВ
SELECT 'ПОЛЬЗОВАТЕЛИ БЕЗ user_profiles:' as info;
SELECT COUNT(*) as count
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
WHERE up.id IS NULL;

SELECT 'ПОЛЬЗОВАТЕЛИ БЕЗ employees:' as info;
SELECT COUNT(*) as count
FROM auth.users au
LEFT JOIN public.employees e ON e.user_id = au.id
WHERE e.id IS NULL;

SELECT 'УПРОЩЕННАЯ ДИАГНОСТИКА ЗАВЕРШЕНА' as status; 