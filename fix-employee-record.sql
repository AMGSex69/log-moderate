-- Скрипт для создания записи сотрудника для существующего пользователя
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем существующих пользователей без записей в employees
SELECT 
    au.id as user_id,
    au.email,
    au.raw_user_meta_data->>'full_name' as full_name,
    e.id as employee_id
FROM auth.users au
LEFT JOIN employees e ON e.user_id = au.id
WHERE e.id IS NULL;

-- 2. Создаем записи сотрудников для всех пользователей без записей
INSERT INTO employees (user_id, full_name, position)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'Сотрудник') as full_name,
    'Сотрудник' as position
FROM auth.users au
LEFT JOIN employees e ON e.user_id = au.id
WHERE e.id IS NULL;

-- 3. Проверяем результат
SELECT 
    au.id as user_id,
    au.email,
    e.id as employee_id,
    e.full_name,
    e.position
FROM auth.users au
JOIN employees e ON e.user_id = au.id; 