-- Fix leaderboard with office filtering
-- Add office_id column to employees_leaderboard if it doesn't exist
ALTER TABLE employees_leaderboard ADD COLUMN IF NOT EXISTS office_id INTEGER;

-- Clear existing leaderboard data
DELETE FROM employees_leaderboard;

-- Create function to refresh leaderboard with office filtering
CREATE OR REPLACE FUNCTION refresh_leaderboard_with_office()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Clear existing data
    DELETE FROM employees_leaderboard;
    
    -- Insert fresh data with office filtering
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
        e.office_id
    FROM employees e
    LEFT JOIN user_profiles up ON e.user_id = up.id
    WHERE e.office_id IS NOT NULL;
END;
$$;

-- Refresh the leaderboard
SELECT refresh_leaderboard_with_office();

-- Update RLS policies for office-based access
DROP POLICY IF EXISTS "employees_leaderboard_public_read" ON employees_leaderboard;

-- Create policy that shows only employees from the same office
CREATE POLICY "employees_leaderboard_office_read" ON employees_leaderboard
    FOR SELECT 
    USING (
        office_id IN (
            SELECT e.office_id 
            FROM employees e 
            WHERE e.user_id = auth.uid()
        )
    );

-- Also allow admins to see all offices
CREATE POLICY "employees_leaderboard_admin_read" ON employees_leaderboard
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND (up.is_admin = true OR up.role IN ('super-admin', 'office-admin'))
        )
    );

-- Check current user's office
SELECT 
    'Current user office info' as info,
    e.office_id,
    e.full_name,
    (SELECT COUNT(*) FROM employees WHERE office_id = e.office_id) as office_employees_count
FROM employees e
WHERE e.user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- Check leaderboard results
SELECT 
    'Leaderboard by office' as info,
    office_id,
    COUNT(*) as employees_in_leaderboard
FROM employees_leaderboard
GROUP BY office_id
ORDER BY office_id;

-- Show top 5 from user's office
SELECT 
    'Top 5 in your office' as info,
    el.full_name,
    el.employee_position,
    el.total_points,
    el.completed_tasks,
    el.office_id
FROM employees_leaderboard el
WHERE el.office_id = (
    SELECT e.office_id 
    FROM employees e 
    WHERE e.user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'
)
ORDER BY el.total_points DESC
LIMIT 5; 