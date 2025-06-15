-- ===========================================
-- ПРОВЕРКА УСПЕШНОГО ПРИМЕНЕНИЯ СКРИПТА
-- ===========================================

-- 1. Проверяем новые колонки в user_profiles
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('admin_role', 'managed_office_id')
ORDER BY column_name;

-- 2. Проверяем новые колонки в employees
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND column_name IN ('admin_role', 'managed_office_id')
ORDER BY column_name;

-- 3. Проверяем супер-админа
SELECT 
    up.full_name,
    au.email,
    up.admin_role,
    up.is_admin,
    up.managed_office_id,
    o.name as office_name
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
LEFT JOIN offices o ON o.id = up.office_id
WHERE au.email = 'egordolgih@mail.ru';

-- 4. Проверяем созданные функции
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_name IN (
    'check_admin_access',
    'get_employees_for_admin', 
    'update_employee_permissions'
)
ORDER BY routine_name;

-- 5. Проверяем созданные индексы
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE indexname LIKE 'idx_%admin%' 
   OR indexname LIKE 'idx_%office%'
ORDER BY indexname;

-- 6. Проверяем RLS политики
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'user_profiles'
AND policyname LIKE '%Admin%'
ORDER BY policyname;

-- 7. Тестируем функцию проверки прав (замените UUID на реальный)
-- SELECT * FROM check_admin_access('your-user-uuid-here');

-- 8. Проверяем все роли пользователей
SELECT 
    up.full_name,
    au.email,
    up.admin_role,
    up.is_admin,
    up.managed_office_id,
    o.name as managed_office_name
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
LEFT JOIN offices o ON o.id = up.managed_office_id
WHERE up.admin_role != 'user' OR up.is_admin = true
ORDER BY up.admin_role DESC, up.full_name; 