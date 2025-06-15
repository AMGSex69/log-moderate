-- Safe Employee Data Cleanup Script
-- This version includes detailed checks and rollback options

-- Step 1: Create backup of current state
CREATE TABLE IF NOT EXISTS employees_backup_temp AS 
SELECT * FROM employees WHERE id IN (301, 302);

-- Step 2: Show what we're about to change
SELECT 'BEFORE CHANGES - Current problematic entries:' as status;
SELECT id, full_name, email, position, is_active, created_at
FROM employees 
WHERE id IN (301, 302)
ORDER BY id;

-- Step 3: Show the planned changes (DRY RUN)
SELECT 'PLANNED CHANGES:' as status;
SELECT 
    301 as id,
    'Никита Тимофеев' as new_full_name,
    'nikita.timofeev.2022@mail.ru' as new_email,
    'Will be updated' as action
UNION ALL
SELECT 
    302 as id,
    'DELETED' as new_full_name,
    'DELETED' as new_email,
    'Will be deleted' as action;

-- UNCOMMENT THE FOLLOWING SECTION TO EXECUTE CHANGES:
/*
BEGIN;

-- Update the first nikita entry (301)
UPDATE employees 
SET 
    full_name = 'Никита Тимофеев',
    email = 'nikita.timofeev.2022@mail.ru',
    updated_at = NOW()
WHERE id = 301;

-- Delete the duplicate entry (302)
DELETE FROM employees WHERE id = 302;

-- Verify changes
SELECT 'AFTER CHANGES - Verification:' as status;
SELECT id, full_name, email, position, is_active
FROM employees 
WHERE id = 301 OR email = 'nikita.timofeev.2022@mail.ru'
ORDER BY id;

-- Check that 302 is gone
SELECT 'Checking if ID 302 was deleted:' as status;
SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'SUCCESS: ID 302 deleted'
    ELSE 'ERROR: ID 302 still exists'
END as result
FROM employees WHERE id = 302;

COMMIT;
*/

-- To rollback if needed, uncomment this:
/*
-- ROLLBACK PROCEDURE (if needed):
INSERT INTO employees 
SELECT * FROM employees_backup_temp 
WHERE id NOT IN (SELECT id FROM employees);

UPDATE employees 
SET full_name = b.full_name, email = b.email, updated_at = b.updated_at
FROM employees_backup_temp b
WHERE employees.id = b.id AND employees.id = 301;
*/ 