-- ПРОВЕРКА ДАННЫХ ВО ВСЕХ ТАБЛИЦАХ

-- 1. Данные в employees (админка)
SELECT 'ДАННЫЕ В employees (АДМИНКА):' as info;
SELECT id, user_id, full_name, office_id, position, is_active
FROM employees 
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 2. Данные в user_profiles (профиль)
SELECT 'ДАННЫЕ В user_profiles (ПРОФИЛЬ):' as info;
SELECT id, full_name, office_id, office_name, position
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 3. Офисы и их ID
SELECT 'ВСЕ ОФИСЫ:' as info;
SELECT id, name FROM offices ORDER BY id;

-- 4. Какой офис соответствует office_id из employees
SELECT 'ОФИС ИЗ employees:' as info;
SELECT e.office_id, o.name as office_name, e.full_name
FROM employees e
JOIN offices o ON e.office_id = o.id
WHERE e.user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 5. Какой офис соответствует office_id из user_profiles
SELECT 'ОФИС ИЗ user_profiles:' as info;
SELECT up.office_id, o.name as office_name, up.full_name
FROM user_profiles up
LEFT JOIN offices o ON up.office_id = o.id
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'; 