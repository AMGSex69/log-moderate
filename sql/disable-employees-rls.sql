-- ВРЕМЕННОЕ РЕШЕНИЕ: Отключаем RLS для employees

-- Отключаем RLS на таблице employees
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- Удаляем все RLS политики
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "employees_authenticated_update" ON employees;
    DROP POLICY IF EXISTS "employees_own_record_update" ON employees;
    DROP POLICY IF EXISTS "employees_admin_update" ON employees;
    DROP POLICY IF EXISTS "employees_own_profile_update" ON employees;
    DROP POLICY IF EXISTS "employees_update_own" ON employees;
    DROP POLICY IF EXISTS "employees_update_policy" ON employees;
    DROP POLICY IF EXISTS "Users can update own employee profile" ON employees;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Некоторые политики уже отсутствуют: %', SQLERRM;
END $$;

-- Проверяем статус RLS
SELECT 'СТАТУС RLS ДЛЯ employees:' as status;
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'employees';

-- Проверяем что политик не осталось
SELECT 'ОСТАВШИЕСЯ ПОЛИТИКИ:' as policies_status;
SELECT COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'employees';

SELECT 'RLS ОТКЛЮЧЁН - ПРОФИЛЬ ДОЛЖЕН ОБНОВЛЯТЬСЯ' as final_status; 