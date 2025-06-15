-- Check offices and employee relationships (simplified)

-- 1. Check all offices
SELECT 
    'All offices' as info,
    id,
    name
FROM offices
ORDER BY id;

-- 2. Check current user's office relationship
SELECT 
    'Current user office info' as info,
    e.id as employee_id,
    e.full_name,
    e.office_id,
    o.name as office_name,
    e.is_active
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE e.user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 3. Check all employees with their offices
SELECT 
    'All employees with offices' as info,
    e.id,
    e.full_name,
    e.office_id,
    o.name as office_name,
    e.is_active
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
ORDER BY e.office_id, e.full_name;

-- 4. Test simplified frontend query
SELECT 
    'Frontend query test' as info,
    e.id,
    e.full_name,
    e.user_id,
    e.is_active,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет' AND e.is_active = true;

-- 5. Check if there are any employees with office name "Рассвет"
SELECT 
    'Employees in Рассвет office' as info,
    COUNT(*) as count
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет';

-- 6. Check office name status
SELECT 
    'Office name check' as info,
    CASE 
        WHEN EXISTS (SELECT 1 FROM offices WHERE name = 'Рассвет') 
        THEN 'Office Рассвет exists'
        ELSE 'Office Рассвет does NOT exist - need to create or rename'
    END as status;

-- 7. Show first office for potential renaming
SELECT 
    'First office info' as info,
    id,
    name
FROM offices
ORDER BY id
LIMIT 1;

-- 8. If no "Рассвет" office exists, rename the first office
UPDATE offices 
SET name = 'Рассвет'
WHERE id = (SELECT id FROM offices ORDER BY id LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM offices WHERE name = 'Рассвет');

-- 9. Ensure all employees are active and assigned to an office
UPDATE employees 
SET is_active = true,
    office_id = COALESCE(office_id, 1)
WHERE office_id IS NULL OR is_active = false;

-- 10. Final check - this should now return employees
SELECT 
    'Final frontend query test' as info,
    e.id,
    e.full_name,
    e.user_id,
    e.is_active,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет' AND e.is_active = true; 