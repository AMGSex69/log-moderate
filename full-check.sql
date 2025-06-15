-- ПОЛНАЯ ПРОВЕРКА ВСЕХ ДАННЫХ

-- 1. Данные в user_profiles
SELECT 'user_profiles:' as table_name, id::text as user_id, full_name, office_id, office_name
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 2. Все офисы
SELECT 'offices:' as info, id, name FROM offices ORDER BY id;

-- 3. Офис из user_profiles
SELECT 'Офис из user_profiles:' as info;
SELECT up.office_id, COALESCE(o.name, 'НЕ НАЙДЕН') as office_name
FROM user_profiles up
LEFT JOIN offices o ON up.office_id = o.id
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 4. Принудительно синхронизируем user_profiles с employees
UPDATE user_profiles 
SET 
    office_id = 18,
    office_name = 'Планета',
    updated_at = NOW()
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 5. Проверка после синхронизации
SELECT 'ПОСЛЕ СИНХРОНИЗАЦИИ:' as info;
SELECT up.office_id, up.office_name, o.name as office_from_table
FROM user_profiles up
LEFT JOIN offices o ON up.office_id = o.id
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'; 