-- Финальный скрипт для создания записей сотрудников для существующих пользователей
-- Выполните этот скрипт в Supabase SQL Editor после создания базы данных

-- 1. Проверяем существующих пользователей без записей в employees
SELECT 
    'Проверка пользователей без записей сотрудников:' as info;

SELECT 
    au.id as user_id,
    au.email,
    au.raw_user_meta_data->>'full_name' as full_name_from_meta,
    e.id as employee_id,
    CASE 
        WHEN e.id IS NULL THEN 'ОТСУТСТВУЕТ'
        ELSE 'ЕСТЬ'
    END as employee_status
FROM auth.users au
LEFT JOIN employees e ON e.user_id = au.id
ORDER BY au.created_at;

-- 2. Показываем пользователей, для которых нужно создать записи
SELECT 
    'Пользователи для создания записей:' as info;

SELECT 
    au.id as user_id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'Сотрудник') as suggested_name
FROM auth.users au
LEFT JOIN employees e ON e.user_id = au.id
WHERE e.id IS NULL;

-- 3. Создаем записи сотрудников для всех пользователей без записей
INSERT INTO employees (user_id, full_name, email, position, is_active)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'Сотрудник') as full_name,
    au.email,
    'Сотрудник' as position,
    true as is_active
FROM auth.users au
LEFT JOIN employees e ON e.user_id = au.id
WHERE e.id IS NULL;

-- 4. Проверяем результат создания
SELECT 
    'Результат создания записей:' as info;

SELECT 
    au.id as user_id,
    au.email,
    e.id as employee_id,
    e.full_name,
    e.position,
    e.is_active,
    e.created_at as employee_created_at
FROM auth.users au
JOIN employees e ON e.user_id = au.id
ORDER BY e.created_at DESC;

-- 5. Дополнительные проверки безопасности

-- Проверяем дублирующиеся записи сотрудников
SELECT 
    'Проверка дублирующихся записей:' as info;

SELECT 
    user_id, 
    COUNT(*) as count,
    STRING_AGG(id::text, ', ') as employee_ids
FROM employees 
GROUP BY user_id 
HAVING COUNT(*) > 1;

-- Проверяем пользователей без email
SELECT 
    'Пользователи без email:' as info;

SELECT 
    e.id as employee_id,
    e.user_id,
    e.full_name,
    e.email
FROM employees e
WHERE e.email IS NULL OR e.email = '';

-- 6. Исправляем записи без email (если есть)
UPDATE employees 
SET email = au.email
FROM auth.users au
WHERE employees.user_id = au.id 
AND (employees.email IS NULL OR employees.email = '');

-- 7. Финальная проверка целостности
SELECT 
    'Финальная проверка целостности:' as info;

-- Количество пользователей vs сотрудников
SELECT 
    (SELECT COUNT(*) FROM auth.users) as total_users,
    (SELECT COUNT(*) FROM employees) as total_employees,
    (SELECT COUNT(*) FROM employees WHERE is_active = true) as active_employees;

-- Пользователи без сотрудников (должно быть 0)
SELECT 
    COUNT(*) as users_without_employees
FROM auth.users au
LEFT JOIN employees e ON e.user_id = au.id
WHERE e.id IS NULL;

-- 8. Проверяем RLS политики (опционально)
SELECT 
    'Проверка RLS политик:' as info;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'task_logs', 'work_sessions')
ORDER BY tablename, policyname;

-- 9. Проверяем индексы
SELECT 
    'Проверка индексов:' as info;

SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
AND tablename IN ('employees', 'task_logs', 'work_sessions', 'active_sessions')
ORDER BY tablename, indexname;

-- 10. Успешное завершение
SELECT 
    '✅ Записи сотрудников успешно созданы и проверены!' as success_message,
    NOW() as completed_at;

-- Дополнительно: показываем, как теперь работает аутентификация
SELECT 
    'Пример проверки аутентификации:' as info;

-- Имитируем проверку пользователя (замените на реальный UUID)
DO $$
DECLARE
    test_user_id UUID;
    test_employee RECORD;
BEGIN
    -- Берем первого пользователя для теста
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Проверяем, что для него есть запись сотрудника
        SELECT * INTO test_employee FROM employees WHERE user_id = test_user_id;
        
        IF test_employee IS NOT NULL THEN
            RAISE NOTICE 'Тест пройден: для пользователя % найден сотрудник % (ID: %)', 
                test_user_id, test_employee.full_name, test_employee.id;
        ELSE
            RAISE NOTICE 'Ошибка: для пользователя % не найден сотрудник', test_user_id;
        END IF;
    ELSE
        RAISE NOTICE 'Нет пользователей для тестирования';
    END IF;
END $$; 