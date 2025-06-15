-- Debug the exact frontend query

-- 1. Test the basic employees query
SELECT 
    'Basic employees query' as test,
    COUNT(*) as count
FROM employees;

-- 2. Test employees with office join
SELECT 
    'Employees with office join' as test,
    e.id,
    e.full_name,
    e.office_id,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
LIMIT 5;

-- 3. Test the exact frontend query step by step
-- Step 1: All employees
SELECT 
    'All employees' as test,
    COUNT(*) as count
FROM employees;

-- Step 2: Active employees
SELECT 
    'Active employees' as test,
    COUNT(*) as count
FROM employees
WHERE is_active = true;

-- Step 3: Employees with office "Рассвет"
SELECT 
    'Employees in Рассвет office' as test,
    COUNT(*) as count
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет';

-- Step 4: Active employees in "Рассвет" office
SELECT 
    'Active employees in Рассвет office' as test,
    COUNT(*) as count
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет' AND e.is_active = true;

-- 5. Test the exact frontend SELECT with all columns
SELECT 
    'Frontend exact query' as test,
    e.id,
    e.full_name,
    e.user_id,
    e.is_online,
    e.position,
    e.is_active,
    e.work_hours,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет' AND e.is_active = true;

-- 6. Check if there's an RLS policy blocking the query
-- Test as if we're the authenticated user
SET LOCAL "request.jwt.claims" = '{"sub": "b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5"}';

SELECT 
    'Query with user context' as test,
    e.id,
    e.full_name,
    e.user_id,
    e.is_online,
    e.position,
    e.is_active,
    e.work_hours,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет' AND e.is_active = true;

-- 7. Check RLS policies on employees table
SELECT 
    'RLS policies on employees' as test,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'employees';

-- 8. Check if RLS is enabled on employees
SELECT 
    'RLS status on employees' as test,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'employees'; 