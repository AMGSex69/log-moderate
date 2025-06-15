-- Cleanup Employee Data Issues
-- This script addresses duplicate entries and email inconsistencies

BEGIN;

-- 1. First, let's examine the current state
SELECT 'Current duplicate nikita entries:' as info;
SELECT id, full_name, email, position, is_active 
FROM employees 
WHERE full_name LIKE '%nikita%' OR full_name LIKE '%timofeev%'
ORDER BY id;

-- 2. Fix the nikita entries - move email from full_name to email field
-- Keep the lower ID (301) and fix its data
UPDATE employees 
SET 
    full_name = 'Никита Тимофеев',
    email = 'nikita.timofeev.2022@mail.ru'
WHERE id = 301;

-- 3. Delete the duplicate entry (302)
DELETE FROM employees WHERE id = 302;

-- 4. Verify the cleanup
SELECT 'After cleanup - nikita entries:' as info;
SELECT id, full_name, email, position, is_active 
FROM employees 
WHERE full_name LIKE '%Никита%' OR email LIKE '%nikita%'
ORDER BY id;

-- 5. Show all employees after cleanup
SELECT 'All employees after cleanup:' as info;
SELECT id, full_name, email, position, is_active, office_name
FROM employees
WHERE is_active = true
ORDER BY position DESC, full_name;

-- 6. Check for any other potential issues
SELECT 'Potential issues check:' as info;
SELECT 
    'Employees with email-like names' as issue_type,
    COUNT(*) as count
FROM employees 
WHERE full_name LIKE '%@%' AND is_active = true

UNION ALL

SELECT 
    'Employees with null emails' as issue_type,
    COUNT(*) as count
FROM employees 
WHERE email IS NULL AND is_active = true

UNION ALL

SELECT 
    'Total active employees' as issue_type,
    COUNT(*) as count
FROM employees 
WHERE is_active = true;

COMMIT; 