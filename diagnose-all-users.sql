-- ===========================================
-- ДИАГНОСТИКА ВСЕХ ПОЛЬЗОВАТЕЛЕЙ В СИСТЕМЕ
-- ===========================================

-- 1. ОБЩАЯ СТАТИСТИКА ПОЛЬЗОВАТЕЛЕЙ
SELECT 'ОБЩАЯ СТАТИСТИКА:' as info;

SELECT 'Всего пользователей в auth.users:' as info, COUNT(*) as count FROM auth.users;
SELECT 'Всего профилей в user_profiles:' as info, COUNT(*) as count FROM public.user_profiles;
SELECT 'Всего записей в employees:' as info, COUNT(*) as count FROM public.employees;
SELECT 'Всего округов:' as info, COUNT(*) as count FROM public.districts;

-- 2. ПРОВЕРЯЕМ ПОЛЬЗОВАТЕЛЕЙ БЕЗ ПРОФИЛЕЙ
SELECT 'ПОЛЬЗОВАТЕЛИ БЕЗ user_profiles:' as info;
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.raw_user_meta_data->>'full_name' as meta_name
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
WHERE up.id IS NULL
ORDER BY au.created_at;

-- 3. ПРОВЕРЯЕМ ПОЛЬЗОВАТЕЛЕЙ БЕЗ EMPLOYEES
SELECT 'ПОЛЬЗОВАТЕЛИ БЕЗ employees:' as info;
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.raw_user_meta_data->>'full_name' as meta_name
FROM auth.users au
LEFT JOIN public.employees e ON e.user_id = au.id
WHERE e.id IS NULL
ORDER BY au.created_at;

-- 4. ПРОВЕРЯЕМ ПОЛЬЗОВАТЕЛЕЙ БЕЗ ОКРУГОВ
SELECT 'ПОЛЬЗОВАТЕЛИ БЕЗ ОКРУГОВ (user_profiles):' as info;
SELECT 
    up.id,
    up.full_name,
    up.district_id,
    au.email,
    au.created_at
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE up.district_id IS NULL
ORDER BY au.created_at;

SELECT 'ПОЛЬЗОВАТЕЛИ БЕЗ ОКРУГОВ (employees):' as info;
SELECT 
    e.id,
    e.full_name,
    e.district_id,
    au.email,
    au.created_at
FROM public.employees e
JOIN auth.users au ON au.id = e.user_id
WHERE e.district_id IS NULL
ORDER BY au.created_at;

-- 5. ПРОВЕРЯЕМ НЕСООТВЕТСТВИЯ МЕЖДУ user_profiles И employees
SELECT 'НЕСООТВЕТСТВИЯ МЕЖДУ ТАБЛИЦАМИ:' as info;
SELECT 
    'В user_profiles, но НЕТ в employees' as issue,
    up.id::text,
    up.full_name,
    au.email
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id
LEFT JOIN public.employees e ON e.user_id = up.id
WHERE e.id IS NULL

UNION ALL

SELECT 
    'В employees, но НЕТ в user_profiles' as issue,
    e.user_id::text,
    e.full_name,
    au.email
FROM public.employees e
JOIN auth.users au ON au.id = e.user_id
LEFT JOIN public.user_profiles up ON up.id = e.user_id
WHERE up.id IS NULL;

-- 6. ПРОВЕРЯЕМ РАЗНЫЕ ЗНАЧЕНИЯ district_id
SELECT 'РАЗНЫЕ ОКРУГА В user_profiles И employees:' as info;
SELECT 
    up.id,
    up.full_name,
    up.district_id as profile_district,
    e.district_id as employee_district,
    au.email
FROM public.user_profiles up
JOIN public.employees e ON e.user_id = up.id
JOIN auth.users au ON au.id = up.id
WHERE up.district_id != e.district_id OR 
      (up.district_id IS NULL AND e.district_id IS NOT NULL) OR
      (up.district_id IS NOT NULL AND e.district_id IS NULL);

-- 7. ПОКАЗЫВАЕМ ПОЛНУЮ КАРТИНУ ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ
SELECT 'ПОЛНАЯ КАРТИНА ВСЕХ ПОЛЬЗОВАТЕЛЕЙ:' as info;
SELECT 
    au.email,
    au.id::text as user_id,
    au.created_at::date as registered,
    up.full_name as profile_name,
    up.district_id as profile_district,
    e.id as employee_id,
    e.full_name as employee_name,
    e.district_id as employee_district,
    d.name as district_name,
    CASE 
        WHEN up.id IS NULL THEN '❌ НЕТ ПРОФИЛЯ'
        WHEN e.id IS NULL THEN '❌ НЕТ EMPLOYEE'
        WHEN up.district_id IS NULL AND e.district_id IS NULL THEN '⚠️ НЕТ ОКРУГА'
        WHEN up.district_id != e.district_id THEN '⚠️ РАЗНЫЕ ОКРУГА'
        ELSE '✅ ВСЁ ОК'
    END as status
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
LEFT JOIN public.employees e ON e.user_id = au.id
LEFT JOIN public.districts d ON d.id = COALESCE(up.district_id, e.district_id)
ORDER BY au.created_at DESC;

-- 8. СТАТИСТИКА ПО ОКРУГАМ
SELECT 'СТАТИСТИКА ПО ОКРУГАМ:' as info;
SELECT 
    d.name as district_name,
    COUNT(DISTINCT up.id) as users_in_profiles,
    COUNT(DISTINCT e.id) as users_in_employees,
    COUNT(DISTINCT CASE WHEN up.id IS NOT NULL AND e.id IS NOT NULL THEN up.id END) as complete_users
FROM public.districts d
LEFT JOIN public.user_profiles up ON up.district_id = d.id
LEFT JOIN public.employees e ON e.district_id = d.id
GROUP BY d.id, d.name
ORDER BY d.name;

SELECT '=== ДИАГНОСТИКА ЗАВЕРШЕНА ===' as status; 