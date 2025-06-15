-- Check current structure of employees_leaderboard table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'employees_leaderboard'
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
ALTER TABLE employees_leaderboard ADD COLUMN IF NOT EXISTS employee_position TEXT;
ALTER TABLE employees_leaderboard ADD COLUMN IF NOT EXISTS office_id INTEGER;

-- Clear existing data
DELETE FROM employees_leaderboard;

-- Create simplified function that works with actual table structure
CREATE OR REPLACE FUNCTION refresh_leaderboard_safe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Clear existing data
    DELETE FROM employees_leaderboard;
    
    -- Insert data using only existing columns
    INSERT INTO employees_leaderboard (
        employee_id,
        user_id,
        full_name,
        employee_position,
        total_points,
        completed_tasks,
        avatar_url,
        is_online,
        last_seen,
        office_id
    )
    SELECT 
        e.id as employee_id,
        e.user_id,
        COALESCE(e.full_name, up.full_name, 'Unknown Employee') as full_name,
        COALESCE(e.employee_position, up.position, 'Employee') as employee_position,
        COALESCE(
            (SELECT SUM(tl.points_earned)::INTEGER 
             FROM task_logs tl 
             WHERE tl.employee_id = e.id), 
            0
        ) as total_points,
        COALESCE(
            (SELECT COUNT(*)::INTEGER 
             FROM task_logs tl 
             WHERE tl.employee_id = e.id AND tl.status = 'completed'), 
            0
        ) as completed_tasks,
        COALESCE(up.avatar_url, e.avatar_url) as avatar_url,
        COALESCE(e.is_online, false) as is_online,
        COALESCE(e.last_seen, NOW()) as last_seen,
        COALESCE(e.office_id, 1) as office_id
    FROM employees e
    LEFT JOIN user_profiles up ON e.user_id = up.id;
END;
$$;

-- Execute the function
SELECT refresh_leaderboard_safe();

-- Fix RLS policies - remove old ones first
DROP POLICY IF EXISTS "employees_leaderboard_public_read" ON employees_leaderboard;
DROP POLICY IF EXISTS "employees_leaderboard_office_read" ON employees_leaderboard;
DROP POLICY IF EXISTS "employees_leaderboard_admin_read" ON employees_leaderboard;

-- Create simple policy that allows reading for authenticated users
CREATE POLICY "employees_leaderboard_read" ON employees_leaderboard
    FOR SELECT 
    USING (
        -- Show employees from same office OR if user is admin
        office_id IN (
            SELECT COALESCE(e.office_id, 1) 
            FROM employees e 
            WHERE e.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.is_admin = true
        )
    );

-- Check results
SELECT 
    'Table structure check' as info,
    COUNT(*) as total_records
FROM employees_leaderboard;

-- Show current user's office and leaderboard
SELECT 
    'Current user info' as info,
    e.office_id,
    e.full_name,
    (SELECT COUNT(*) FROM employees_leaderboard el WHERE el.office_id = e.office_id) as office_leaderboard_count
FROM employees e
WHERE e.user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- Show leaderboard for user's office
SELECT 
    'Office leaderboard' as info,
    el.full_name,
    el.total_points,
    el.completed_tasks,
    el.office_id,
    el.avatar_url IS NOT NULL as has_avatar
FROM employees_leaderboard el
WHERE el.office_id = (
    SELECT COALESCE(e.office_id, 1) 
    FROM employees e 
    WHERE e.user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'
)
ORDER BY el.total_points DESC; 