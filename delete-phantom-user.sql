-- УДАЛЕНИЕ ЛИШНЕГО ПОЛЬЗОВАТЕЛЯ nikita.timofcev.2022@mail.ru
-- ⚠️ ВНИМАНИЕ: Выполняйте ТОЛЬКО после проверки find-phantom-user.sql
-- ⚠️ Этот скрипт необратимо удалит данные!

-- 1. СНАЧАЛА ПРОВЕРЯЕМ ЧТО МЫ УДАЛЯЕМ
SELECT 'ПРОВЕРКА ПЕРЕД УДАЛЕНИЕМ:' as step_1;

SELECT 
    'EMPLOYEES' as table_name,
    e.id,
    e.full_name,
    e.email,
    e.is_active,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON e.office_id = o.id
WHERE 
    e.full_name ILIKE '%nikita%' 
    OR e.email ILIKE '%nikita%' 
    OR e.email ILIKE '%timofcev%'
    OR e.email = 'nikita.timofcev.2022@mail.ru';

-- 2. ПРОВЕРЯЕМ СВЯЗАННЫЕ TASK_LOGS
SELECT 'СВЯЗАННЫЕ TASK_LOGS:' as step_2;

SELECT 
    COUNT(*) as task_logs_count
FROM task_logs tl
JOIN employees e ON tl.employee_id = e.id
WHERE 
    e.full_name ILIKE '%nikita%' 
    OR e.email ILIKE '%nikita%' 
    OR e.email ILIKE '%timofcev%'
    OR e.email = 'nikita.timofcev.2022@mail.ru';

-- 3. ЕСЛИ ВСЕ ВЕРНО, РАСКОММЕНТИРУЙТЕ БЛОК НИЖЕ ДЛЯ УДАЛЕНИЯ:

/*
-- ВНИМАНИЕ! Раскомментируйте только если уверены!

-- 3.1. Удаляем связанные task_logs
DELETE FROM task_logs 
WHERE employee_id IN (
    SELECT id FROM employees 
    WHERE 
        full_name ILIKE '%nikita%' 
        OR email ILIKE '%nikita%' 
        OR email ILIKE '%timofcev%'
        OR email = 'nikita.timofcev.2022@mail.ru'
);

-- 3.2. Удаляем из employees
DELETE FROM employees 
WHERE 
    full_name ILIKE '%nikita%' 
    OR email ILIKE '%nikita%' 
    OR email ILIKE '%timofcev%'
    OR email = 'nikita.timofcev.2022@mail.ru';

-- 3.3. Удаляем из user_profiles (если есть)
DELETE FROM user_profiles 
WHERE 
    full_name ILIKE '%nikita%' 
    OR full_name ILIKE '%timofcev%';

-- 3.4. Проверяем результат
SELECT 'ПРОВЕРКА ПОСЛЕ УДАЛЕНИЯ:' as result;

SELECT 
    COUNT(*) as remaining_employees
FROM employees 
WHERE 
    full_name ILIKE '%nikita%' 
    OR email ILIKE '%nikita%' 
    OR email ILIKE '%timofcev%'
    OR email = 'nikita.timofcev.2022@mail.ru';

SELECT 'ГОТОВО! Пользователь удален.' as final_status;
*/

-- АЛЬТЕРНАТИВНЫЙ БЕЗОПАСНЫЙ СПОСОБ - ДЕАКТИВАЦИЯ:
SELECT 'АЛЬТЕРНАТИВА - ДЕАКТИВАЦИЯ:' as alternative;

-- Раскомментируйте для деактивации вместо удаления:
/*
UPDATE employees 
SET 
    is_active = false,
    email = email || '_DELETED',
    full_name = full_name || ' (УДАЛЕН)'
WHERE 
    full_name ILIKE '%nikita%' 
    OR email ILIKE '%nikita%' 
    OR email ILIKE '%timofcev%'
    OR email = 'nikita.timofcev.2022@mail.ru';
*/

SELECT 'Выберите один из способов выше и раскомментируйте нужный блок.' as instruction; 