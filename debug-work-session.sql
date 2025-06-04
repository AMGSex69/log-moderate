-- Диагностика проблем с рабочими сессиями

-- 1. Проверяем структуру и данные user_profiles
SELECT 'user_profiles table check' as check_type;
SELECT COUNT(*) as total_profiles FROM public.user_profiles;
SELECT id, full_name, work_schedule, work_hours, created_at 
FROM public.user_profiles 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Проверяем структуру и данные employees
SELECT 'employees table check' as check_type;
SELECT COUNT(*) as total_employees FROM public.employees;
SELECT id, user_id, full_name, position, work_schedule, work_hours, created_at 
FROM public.employees 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Проверяем users из auth.users
SELECT 'auth.users check' as check_type;
SELECT COUNT(*) as total_auth_users FROM auth.users;
SELECT id, email, created_at, last_sign_in_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Проверяем связи между таблицами
SELECT 'profile-auth linkage' as check_type;
SELECT 
    au.id as auth_user_id,
    au.email,
    up.id as profile_id,
    up.full_name as profile_name,
    e.id as employee_id,
    e.full_name as employee_name
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
LEFT JOIN public.employees e ON au.id = e.user_id
ORDER BY au.created_at DESC
LIMIT 10;

-- 5. Проверяем рабочие сессии
SELECT 'work_sessions check' as check_type;
SELECT COUNT(*) as total_sessions FROM public.work_sessions;
SELECT 
    ws.id,
    ws.employee_id,
    ws.date,
    ws.clock_in_time,
    ws.clock_out_time,
    e.full_name
FROM public.work_sessions ws
LEFT JOIN public.employees e ON ws.employee_id = e.id
ORDER BY ws.date DESC, ws.clock_in_time DESC
LIMIT 10;

-- 6. Проверяем RLS политики user_profiles
SELECT 'user_profiles RLS policies' as check_type;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'user_profiles';

-- 7. Проверяем текущего пользователя
SELECT 'current user check' as check_type;
SELECT auth.uid() as current_user_id;

-- 8. Тестируем доступ к собственному профилю
SELECT 'profile access test' as check_type;
SELECT * FROM public.user_profiles WHERE id = auth.uid();

-- 9. Проверяем employee для текущего пользователя
SELECT 'employee access test' as check_type;
SELECT * FROM public.employees WHERE user_id = auth.uid();

-- 10. Проверяем сессии для текущего пользователя
SELECT 'sessions access test' as check_type;
SELECT 
    ws.*,
    e.full_name
FROM public.work_sessions ws
JOIN public.employees e ON ws.employee_id = e.id
WHERE e.user_id = auth.uid()
ORDER BY ws.date DESC
LIMIT 5; 