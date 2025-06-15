-- Проверяем актуальные данные пользователя после обновления

-- 1. Проверяем данные в employees
SELECT 'АКТУАЛЬНЫЕ ДАННЫЕ В employees:' as status;
SELECT 
    id,
    user_id,
    full_name,
    email,
    position,
    avatar_url,
    phone,
    bio,
    website,
    office_id,
    is_active,
    updated_at,
    created_at
FROM employees 
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 2. Проверяем связь с офисом
SELECT 'СВЯЗЬ С ОФИСОМ:' as office_status;
SELECT 
    e.id,
    e.full_name,
    e.office_id,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON e.office_id = o.id
WHERE e.user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 3. Проверяем есть ли данные в user_profiles
SELECT 'ДАННЫЕ В user_profiles:' as profile_status;
SELECT *
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 4. Проверяем последнее время обновления
SELECT 'ВРЕМЯ ПОСЛЕДНЕГО ОБНОВЛЕНИЯ:' as time_check;
SELECT 
    full_name,
    updated_at,
    CASE 
        WHEN updated_at > NOW() - INTERVAL '5 minutes' 
        THEN 'ОБНОВЛЕНО НЕДАВНО'
        ELSE 'СТАРЫЕ ДАННЫЕ'
    END as freshness
FROM employees 
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'; 