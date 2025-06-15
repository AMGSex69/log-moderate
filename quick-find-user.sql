-- БЫСТРЫЙ ПОИСК ЛИШНЕГО ПОЛЬЗОВАТЕЛЯ
-- Упрощенная версия без сложных JOIN

-- 1. ИЩЕМ В EMPLOYEES
SELECT 'В таблице EMPLOYEES:' as step_1;

SELECT 
    id,
    full_name,
    email,
    is_active,
    office_id
FROM employees 
WHERE 
    full_name ILIKE '%nikita%' 
    OR email ILIKE '%nikita%' 
    OR email ILIKE '%timofcev%'
    OR email = 'nikita.timofcev.2022@mail.ru';

-- 2. ПРОВЕРЯЕМ ВЕСЬ ОФИС РАССВЕТ
SELECT 'ВСЕ СОТРУДНИКИ РАССВЕТА:' as step_2;

SELECT 
    id,
    full_name, 
    email,
    is_active,
    position
FROM employees 
WHERE office_id = (SELECT id FROM offices WHERE name = 'Рассвет')
ORDER BY full_name;

-- 3. ИЩЕМ КОНКРЕТНОГО ПОЛЬЗОВАТЕЛЯ
SELECT 'ДЕТАЛИ NIKITA:' as step_3;

SELECT 
    id as employee_id,
    full_name,
    email,
    user_id,
    is_active,
    position,
    office_id,
    created_at
FROM employees 
WHERE 
    email = 'nikita.timofcev.2022@mail.ru'
    OR full_name ILIKE '%nikita%timofcev%'
    OR full_name ILIKE '%timofcev%';

-- 4. ПРОВЕРЯЕМ ОФИС ЭТОГО ПОЛЬЗОВАТЕЛЯ
SELECT 'ОФИС NIKITA:' as step_4;

SELECT 
    e.full_name,
    e.email,
    e.is_active,
    o.name as office_name
FROM employees e
JOIN offices o ON e.office_id = o.id
WHERE 
    e.email = 'nikita.timofcev.2022@mail.ru'
    OR e.full_name ILIKE '%nikita%timofcev%'
    OR e.full_name ILIKE '%timofcev%';

-- 5. ПРОСТАЯ ПРОВЕРКА - КТО В ПОЗИЦИИ #7 В ЛИДЕРБОРДЕ
SELECT 'РАНЖИРОВАНИЕ РАССВЕТА:' as step_5;

SELECT 
    ROW_NUMBER() OVER (ORDER BY id) as position,
    id,
    full_name,
    email,
    is_active
FROM employees 
WHERE office_id = (SELECT id FROM offices WHERE name = 'Рассвет')
ORDER BY id; 