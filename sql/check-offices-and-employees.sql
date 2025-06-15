-- Check offices and employee relationships

-- 1. Check all offices
SELECT 
    'All offices' as info,
    id,
    name,
    created_at
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

-- 4. Test the exact query that frontend uses
SELECT 
    'Frontend query test' as info,
    e.id,
    e.full_name,
    e.user_id,
    e.is_online,
    e.employee_position as position,
    e.is_active,
    e.work_hours,
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

-- 6. If no "Рассвет" office, let's see what offices exist and fix it
-- First, let's see if we need to create or rename an office
SELECT 
    'Office name check' as info,
    CASE 
        WHEN EXISTS (SELECT 1 FROM offices WHERE name = 'Рассвет') 
        THEN 'Office Рассвет exists'
        ELSE 'Office Рассвет does NOT exist - need to create or rename'
    END as status;

-- 7. If needed, create the "Рассвет" office or rename existing one
-- Let's check what the first office is called
SELECT 
    'First office info' as info,
    id,
    name,
    'Will rename to Рассвет if needed' as action
FROM offices
ORDER BY id
LIMIT 1; 