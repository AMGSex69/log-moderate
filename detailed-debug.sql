-- ДЕТАЛЬНАЯ ДИАГНОСТИКА ПРОБЛЕМЫ СИНХРОНИЗАЦИИ
-- Выполните каждый блок запросов по отдельности

-- 1. ПРОВЕРКА СТРУКТУРЫ ТАБЛИЦ
SELECT 'СТРУКТУРА user_profiles:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

SELECT 'СТРУКТУРА employees:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'employees' 
ORDER BY ordinal_position;

-- 2. ПРОВЕРКА ДАННЫХ В ТАБЛИЦАХ
SELECT 'ДАННЫЕ В user_profiles:' as info;
SELECT user_id, full_name, office_name, created_at 
FROM user_profiles 
ORDER BY created_at DESC;

SELECT 'ДАННЫЕ В employees:' as info;
SELECT id, name, office_id, created_at 
FROM employees 
ORDER BY created_at DESC;

-- 3. ПРОВЕРКА СВЯЗИ МЕЖДУ ТАБЛИЦАМИ
SELECT 'СВЯЗЬ user_profiles -> employees:' as info;
SELECT 
    up.user_id,
    up.full_name,
    up.office_name,
    e.id as employee_id,
    e.name as employee_name,
    e.office_id,
    o.name as office_name_from_employees
FROM user_profiles up
LEFT JOIN employees e ON up.full_name = e.name
LEFT JOIN offices o ON e.office_id = o.id
ORDER BY up.created_at DESC;

-- 4. ПРОВЕРКА ОФИСОВ
SELECT 'ОФИСЫ:' as info;
SELECT id, name FROM offices ORDER BY name;

-- 5. ПОИСК ПОЛЬЗОВАТЕЛЯ ПО EMAIL (замените на свой email)
SELECT 'ПОИСК ПОЛЬЗОВАТЕЛЯ:' as info;
SELECT 
    up.user_id,
    up.full_name,
    up.office_name,
    u.email,
    e.id as employee_id,
    e.office_id,
    o.name as office_name_from_employees
FROM user_profiles up
LEFT JOIN auth.users u ON up.user_id = u.id
LEFT JOIN employees e ON up.full_name = e.name
LEFT JOIN offices o ON e.office_id = o.id
WHERE u.email LIKE '%@%'  -- замените на свой email
ORDER BY up.created_at DESC;

-- 6. ПРОВЕРКА ФУНКЦИЙ (если они существуют)
SELECT 'ФУНКЦИИ В БД:' as info;
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('update_user_office', 'sync_employee_to_userprofile', 'ensure_employee_in_office'); 