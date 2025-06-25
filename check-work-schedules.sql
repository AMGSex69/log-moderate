-- Проверка текущего состояния рабочих графиков в системе
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- 1. Проверяем графики в таблице user_profiles
SELECT 
    'user_profiles' as table_name,
    work_schedule,
    work_hours,
    COUNT(*) as count
FROM user_profiles 
GROUP BY work_schedule, work_hours
ORDER BY count DESC;

-- 2. Проверяем графики в таблице employees
SELECT 
    'employees' as table_name,
    work_schedule,
    work_hours,
    COUNT(*) as count
FROM employees 
GROUP BY work_schedule, work_hours
ORDER BY count DESC;

-- 3. Проверяем конкретных пользователей с их графиками
SELECT 
    up.id,
    up.full_name,
    up.work_schedule as profile_schedule,
    up.work_hours as profile_hours,
    e.work_schedule as employee_schedule,
    e.work_hours as employee_hours,
    CASE 
        WHEN up.work_schedule != e.work_schedule OR up.work_hours != e.work_hours 
        THEN '❌ НЕСООТВЕТСТВИЕ' 
        ELSE '✅ СООТВЕТСТВУЕТ' 
    END as status
FROM user_profiles up
LEFT JOIN employees e ON e.user_id = up.id
ORDER BY up.full_name;

-- 4. Проверяем метаданные пользователей в auth.users
SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data->>'full_name' as meta_name,
    au.raw_user_meta_data->>'work_schedule' as meta_schedule,
    up.work_schedule as profile_schedule,
    e.work_schedule as employee_schedule
FROM auth.users au
LEFT JOIN user_profiles up ON up.id = au.id
LEFT JOIN employees e ON e.user_id = au.id
WHERE au.raw_user_meta_data IS NOT NULL
ORDER BY au.email;

-- 5. Статистика по всем возможным значениям графиков
WITH all_schedules AS (
    SELECT work_schedule FROM user_profiles WHERE work_schedule IS NOT NULL
    UNION ALL
    SELECT work_schedule FROM employees WHERE work_schedule IS NOT NULL
    UNION ALL
    SELECT au.raw_user_meta_data->>'work_schedule' as work_schedule 
    FROM auth.users au 
    WHERE au.raw_user_meta_data->>'work_schedule' IS NOT NULL
)
SELECT 
    work_schedule,
    COUNT(*) as total_occurrences
FROM all_schedules
GROUP BY work_schedule
ORDER BY total_occurrences DESC;

SELECT 'Проверка завершена! Изучите результаты выше.' as status; 