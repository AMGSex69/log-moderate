-- ПОИСК ЛИШНЕГО ПОЛЬЗОВАТЕЛЯ nikita.timofcev.2022@mail.ru
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. ИЩЕМ В ТАБЛИЦЕ EMPLOYEES
SELECT 'EMPLOYEES:' as table_name;

SELECT 
    employees.id,
    employees.user_id,
    employees.full_name,
    employees.email,
    employees.position,
    employees.is_active,
    employees.office_id,
    employees.created_at,
    offices.name as office_name
FROM employees 
LEFT JOIN offices ON employees.office_id = offices.id
WHERE 
    full_name ILIKE '%nikita%' 
    OR email ILIKE '%nikita%' 
    OR email ILIKE '%timofcev%'
    OR email = 'nikita.timofcev.2022@mail.ru';

-- 2. ИЩЕМ В ТАБЛИЦЕ USER_PROFILES
SELECT 'USER_PROFILES:' as table_name;

SELECT 
    user_profiles.id,
    user_profiles.full_name,
    user_profiles.position,
    user_profiles.office_id,
    user_profiles.created_at,
    offices.name as office_name
FROM user_profiles 
LEFT JOIN offices ON user_profiles.office_id = offices.id
WHERE 
    full_name ILIKE '%nikita%' 
    OR full_name ILIKE '%timofcev%';

-- 3. ИЩЕМ В AUTH.USERS
SELECT 'AUTH.USERS:' as table_name;

SELECT 
    auth.users.id,
    auth.users.email,
    auth.users.created_at,
    auth.users.last_sign_in_at,
    auth.users.deleted_at
FROM auth.users
WHERE 
    email ILIKE '%nikita%' 
    OR email ILIKE '%timofcev%'
    OR email = 'nikita.timofcev.2022@mail.ru';

-- 4. ИЩЕМ СВЯЗАННЫЕ TASK_LOGS
SELECT 'TASK_LOGS COUNT:' as table_name;

SELECT 
    e.full_name,
    e.email,
    COUNT(tl.id) as task_count,
    MIN(tl.work_date) as first_task,
    MAX(tl.work_date) as last_task
FROM employees e
LEFT JOIN task_logs tl ON e.id = tl.employee_id
WHERE 
    e.full_name ILIKE '%nikita%' 
    OR e.email ILIKE '%nikita%' 
    OR e.email ILIKE '%timofcev%'
    OR e.email = 'nikita.timofcev.2022@mail.ru'
GROUP BY e.id, e.full_name, e.email;

-- 5. ПРОВЕРЯЕМ ВСЕ ЗАПИСИ ОФИСА РАССВЕТ
SELECT 'ВСЕ СОТРУДНИКИ РАССВЕТА:' as table_name;

SELECT 
    e.id,
    e.user_id,
    e.full_name,
    e.email,
    e.is_active,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON e.office_id = o.id
WHERE o.name = 'Рассвет'
ORDER BY e.full_name;

-- 6. ДЕТАЛЬНАЯ ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ #7
SELECT 'ДЕТАЛИ ПОЛЬЗОВАТЕЛЯ #7:' as info;

-- Эмулируем наш запрос из лидерборда для этого пользователя
WITH user_stats AS (
    SELECT 
        e.id,
        e.full_name,
        e.user_id,
        e.position,
        e.is_active,
        e.is_online,
        o.name as office_name,
        COUNT(tl.id) as task_count,
        COALESCE(SUM(tl.time_spent_minutes), 0) as total_time,
        COALESCE(SUM(tl.units_completed), 0) as total_units
    FROM employees e
    LEFT JOIN offices o ON e.office_id = o.id
    LEFT JOIN task_logs tl ON e.id = tl.employee_id 
        AND tl.work_date >= CURRENT_DATE - INTERVAL '30 days'
    WHERE o.name = 'Рассвет'
        AND (e.full_name ILIKE '%nikita%' OR e.email ILIKE '%nikita%' OR e.email ILIKE '%timofcev%')
    GROUP BY e.id, e.full_name, e.user_id, e.position, e.is_active, e.is_online, o.name
)
SELECT 
    id,
    full_name,
    user_id,
    position,
    is_active,
    is_online,
    office_name,
    task_count,
    total_time,
    total_units
FROM user_stats;

SELECT 'ГОТОВО! Проверьте результаты выше.' as final_message; 