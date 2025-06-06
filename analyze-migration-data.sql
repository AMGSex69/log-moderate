-- АНАЛИЗ ДАННЫХ ДЛЯ МИГРАЦИИ DISTRICTS -> OFFICES

-- 1. Смотрим что в старых districts
SELECT 'СТАРЫЕ DISTRICTS:' as info;
SELECT * FROM districts ORDER BY id;

-- 2. Сотрудники с district_id
SELECT 'EMPLOYEES с district_id:' as info;
SELECT 
    e.id, 
    e.full_name, 
    e.district_id, 
    d.name as district_name,
    e.office_id,
    o.name as office_name
FROM employees e
LEFT JOIN districts d ON d.id = e.district_id
LEFT JOIN offices o ON o.id = e.office_id
WHERE e.district_id IS NOT NULL
ORDER BY e.district_id;

-- 3. User profiles с district_id
SELECT 'USER_PROFILES с district_id:' as info;
SELECT 
    up.id, 
    up.full_name, 
    up.district_id, 
    d.name as district_name,
    up.office_id,
    o.name as office_name
FROM user_profiles up
LEFT JOIN districts d ON d.id = up.district_id
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.district_id IS NOT NULL
ORDER BY up.district_id;

-- 4. Проверяем соответствие имен districts и offices
SELECT 'СОПОСТАВЛЕНИЕ NAMES:' as info;
SELECT 
    'DISTRICTS:' as type,
    id,
    name 
FROM districts
UNION ALL
SELECT 
    'OFFICES:' as type,
    id,
    name 
FROM offices
ORDER BY type, name;

-- 5. Сотрудники БЕЗ office_id (нужно назначить)
SELECT 'EMPLOYEES БЕЗ OFFICE_ID:' as info;
SELECT 
    id, 
    full_name, 
    district_id, 
    office_id,
    CASE 
        WHEN district_id IS NOT NULL THEN 'Есть district_id'
        ELSE 'Нет ни district_id ни office_id'
    END as status
FROM employees 
WHERE office_id IS NULL
ORDER BY district_id NULLS LAST;

-- 6. User profiles БЕЗ office_id
SELECT 'USER_PROFILES БЕЗ OFFICE_ID:' as info;
SELECT 
    id, 
    full_name, 
    district_id, 
    office_id,
    CASE 
        WHEN district_id IS NOT NULL THEN 'Есть district_id'
        ELSE 'Нет ни district_id ни office_id'
    END as status
FROM user_profiles 
WHERE office_id IS NULL
ORDER BY district_id NULLS LAST; 