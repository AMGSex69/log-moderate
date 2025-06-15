-- ПРОСТАЯ ПРОВЕРКА БЕЗ JOIN'ОВ

-- 1. Проверяем существует ли таблица districts
SELECT 'ПРОВЕРКА ТАБЛИЦЫ DISTRICTS:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'districts';

-- 2. Employees с district_id (без JOIN)
SELECT 'EMPLOYEES с district_id:' as info;
SELECT 
    id, 
    full_name, 
    district_id, 
    office_id
FROM employees 
WHERE district_id IS NOT NULL
ORDER BY district_id;

-- 3. User profiles с district_id (без JOIN)
SELECT 'USER_PROFILES с district_id:' as info;
SELECT 
    id, 
    full_name, 
    district_id, 
    office_id
FROM user_profiles 
WHERE district_id IS NOT NULL
ORDER BY district_id;

-- 4. Все сотрудники БЕЗ office_id
SELECT 'EMPLOYEES БЕЗ OFFICE_ID:' as info;
SELECT 
    id, 
    full_name, 
    district_id, 
    office_id
FROM employees 
WHERE office_id IS NULL
ORDER BY id;

-- 5. Проверяем что есть в offices
SELECT 'OFFICES:' as info;
SELECT id, name FROM offices ORDER BY id LIMIT 5;

-- 6. Общая статистика
SELECT 'СТАТИСТИКА:' as info;
SELECT 
    'employees' as table_name,
    COUNT(*) as total_records,
    COUNT(office_id) as with_office_id,
    COUNT(district_id) as with_district_id
FROM employees
UNION ALL
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as total_records,
    COUNT(office_id) as with_office_id,
    COUNT(district_id) as with_district_id
FROM user_profiles;

-- ПРОСТАЯ ПРОВЕРКА ДАННЫХ

-- 1. Все офисы
SELECT 'ВСЕ ОФИСЫ:' as info;
SELECT id, name FROM offices ORDER BY id;

-- 2. Ваши данные
SELECT 'ВАШИ ДАННЫЕ:' as info;
SELECT id, user_id, full_name, email, office_id
FROM user_profiles 
WHERE email = 'egordolgih@mail.ru';

-- 3. Найти офис "Тульская"
SELECT 'ОФИС ТУЛЬСКАЯ:' as info;
SELECT id, name FROM offices WHERE name LIKE '%Тульская%' OR name LIKE '%тульская%';

-- 4. Обновить office_id (выполните после того, как увидите ID офиса "Тульская")
-- Замените XX на правильный ID офиса "Тульская"
UPDATE user_profiles 
SET office_id = 2, -- ЗАМЕНИТЕ на правильный ID офиса "Тульская"
    updated_at = NOW()
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 5. Проверка результата
SELECT 'РЕЗУЛЬТАТ:' as info;
SELECT 
    up.id,
    up.user_id, 
    up.full_name,
    up.email,
    up.office_id,
    o.name as office_name
FROM user_profiles up
JOIN offices o ON up.office_id = o.id
WHERE up.email = 'egordolgih@mail.ru'; 