-- ТЕСТИРОВАНИЕ ФУНКЦИЙ СИНХРОНИЗАЦИИ
-- Выполните этот скрипт ПОСЛЕ применения sync-employee-userprofile.sql

-- 1. Проверяем существование функций
SELECT 
    p.proname as function_name,
    p.prosrc as function_source
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' 
AND p.proname LIKE '%sync%';

-- 2. Проверяем существование триггера
SELECT 
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'trigger_auto_sync_employee';

-- 3. Тестируем синхронизацию конкретного пользователя
-- ЗАМЕНИТЕ 'ваш-user-id' на реальный ID пользователя
DO $$
DECLARE
    test_user_id UUID := 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'; -- Замените на ваш ID
    sync_result TEXT;
BEGIN
    -- Проверяем данные до синхронизации
    RAISE NOTICE 'ДАННЫЕ ДО СИНХРОНИЗАЦИИ:';
    
    RAISE NOTICE 'Employee данные:';
    FOR rec IN 
        SELECT e.full_name, e.position, o.name as office_name
        FROM employees e
        LEFT JOIN offices o ON e.office_id = o.id
        WHERE e.user_id = test_user_id
    LOOP
        RAISE NOTICE 'Employee: % - % - офис: %', rec.full_name, rec.position, rec.office_name;
    END LOOP;
    
    RAISE NOTICE 'User_profiles данные:';
    FOR rec IN 
        SELECT full_name, position, office_name
        FROM user_profiles
        WHERE id = test_user_id
    LOOP
        RAISE NOTICE 'Profile: % - % - офис: %', rec.full_name, rec.position, rec.office_name;
    END LOOP;
    
    -- Выполняем синхронизацию
    RAISE NOTICE 'ВЫПОЛНЯЕМ СИНХРОНИЗАЦИЮ...';
    SELECT sync_employee_to_userprofile(test_user_id) INTO sync_result;
    RAISE NOTICE 'Результат синхронизации: %', sync_result;
    
    -- Проверяем данные после синхронизации
    RAISE NOTICE 'ДАННЫЕ ПОСЛЕ СИНХРОНИЗАЦИИ:';
    
    RAISE NOTICE 'User_profiles данные (обновленные):';
    FOR rec IN 
        SELECT full_name, position, office_name
        FROM user_profiles
        WHERE id = test_user_id
    LOOP
        RAISE NOTICE 'Profile: % - % - офис: %', rec.full_name, rec.position, rec.office_name;
    END LOOP;
END $$;

-- 4. Тестируем массовую синхронизацию
DO $$
DECLARE
    mass_sync_result TEXT;
BEGIN
    RAISE NOTICE 'ВЫПОЛНЯЕМ МАССОВУЮ СИНХРОНИЗАЦИЮ...';
    SELECT sync_all_employees_to_userprofiles() INTO mass_sync_result;
    RAISE NOTICE 'Результат массовой синхронизации: %', mass_sync_result;
END $$;

-- 5. Проверяем общую статистику синхронизации
SELECT 
    'Статистика синхронизации' as info,
    (SELECT COUNT(*) FROM employees WHERE user_id IS NOT NULL) as employees_with_users,
    (SELECT COUNT(*) FROM user_profiles) as total_profiles,
    (SELECT COUNT(*) 
     FROM employees e 
     INNER JOIN user_profiles up ON e.user_id = up.id 
     WHERE e.office_id = up.office_id) as synced_offices; 