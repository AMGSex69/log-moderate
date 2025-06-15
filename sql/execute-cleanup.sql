-- Execute Employee Data Cleanup
-- This will fix the duplicate nikita entries

-- Create backup first
CREATE TABLE IF NOT EXISTS employees_backup_cleanup AS 
SELECT * FROM employees WHERE id IN (301, 302);

BEGIN;

-- Update the first nikita entry (301) with proper data
UPDATE employees 
SET 
    full_name = 'Никита Тимофеев',
    email = 'nikita.timofeev.2022@mail.ru',
    updated_at = NOW()
WHERE id = 301;

-- Delete the duplicate entry (302)
DELETE FROM employees WHERE id = 302;

-- Verify the changes
SELECT 'AFTER CLEANUP - Updated entry:' as status;
SELECT id, full_name, email, position, is_active
FROM employees 
WHERE id = 301;

-- Confirm deletion
SELECT 'DELETION VERIFICATION:' as status;
SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'SUCCESS: Duplicate ID 302 has been deleted'
    ELSE 'ERROR: ID 302 still exists'
END as result
FROM employees WHERE id = 302;

-- Show final clean employee list for Рассвет office
SELECT 'FINAL CLEAN EMPLOYEE LIST:' as status;
SELECT id, full_name, email, position, is_active
FROM employees 
WHERE is_active = true AND office_name = 'Рассвет'
ORDER BY position DESC, full_name;

COMMIT;

-- Success message
SELECT 'CLEANUP COMPLETED SUCCESSFULLY' as final_status; 