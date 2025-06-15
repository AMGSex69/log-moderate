-- Проверяем текущий офис пользователя во всех таблицах
SELECT 'ДАННЫЕ ИЗ EMPLOYEES (АДМИНКА):' as source;
SELECT 
    e.id as employee_id,
    e.user_id,
    e.full_name,
    e.office_id,
    o.name as office_name,
    e.is_active
FROM employees e
LEFT JOIN offices o ON e.office_id = o.id
WHERE e.user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

SELECT 'ДАННЫЕ ИЗ USER_PROFILES:' as source;
SELECT 
    up.id,
    up.full_name,
    up.office_id,
    up.office_name
FROM user_profiles up
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

SELECT 'ВСЕ ОФИСЫ:' as source;
SELECT id, name FROM offices ORDER BY id;

SELECT 'ПРОВЕРКА ОФИСА 18 (ПЛАНЕТА):' as source;
SELECT * FROM offices WHERE id = 18;

SELECT 'ПРОВЕРКА ОФИСА 17 (ВИТЯЗЬ):' as source;
SELECT * FROM offices WHERE id = 17; 