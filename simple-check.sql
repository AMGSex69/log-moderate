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