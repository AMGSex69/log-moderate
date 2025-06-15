-- Fix employees table structure to match frontend expectations

-- 1. Check current structure
SELECT 
    'Current employees table structure' as info,
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'employees'
ORDER BY ordinal_position;

-- 2. Add missing columns that frontend expects
ALTER TABLE employees ADD COLUMN IF NOT EXISTS position TEXT DEFAULT 'Сотрудник';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_hours INTEGER DEFAULT 9;

-- 3. Update position from user_profiles where available
UPDATE employees e
SET position = up.position
FROM user_profiles up
WHERE e.user_id = up.id
AND up.position IS NOT NULL;

-- 4. Ensure all employees have proper office relationships
-- Check if foreign key constraint exists
SELECT 
    'Foreign key check' as info,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'employees'
    AND kcu.column_name = 'office_id';

-- 5. Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'employees' 
        AND constraint_name LIKE '%office%'
    ) THEN
        ALTER TABLE employees 
        ADD CONSTRAINT employees_office_id_fkey 
        FOREIGN KEY (office_id) REFERENCES offices(id);
    END IF;
END $$;

-- 6. Test the exact frontend query
SELECT 
    'Frontend query test' as info,
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

-- 7. Check updated table structure
SELECT 
    'Updated employees table structure' as info,
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'employees'
ORDER BY ordinal_position;

-- 8. Show count of employees that should be found by frontend
SELECT 
    'Employees that frontend should find' as info,
    COUNT(*) as count
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет' AND e.is_active = true; 