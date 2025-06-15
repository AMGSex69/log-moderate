-- First, let's see what columns actually exist
SELECT 
    'Current table structure' as info,
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'employees_leaderboard'
ORDER BY ordinal_position;

-- Add all potentially missing columns
ALTER TABLE employees_leaderboard ADD COLUMN IF NOT EXISTS employee_position TEXT;
ALTER TABLE employees_leaderboard ADD COLUMN IF NOT EXISTS office_id INTEGER;
ALTER TABLE employees_leaderboard ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE employees_leaderboard ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Clear existing data
DELETE FROM employees_leaderboard;

-- Create adaptive function that only uses existing columns
CREATE OR REPLACE FUNCTION refresh_leaderboard_adaptive()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_employee_position BOOLEAN;
    has_office_id BOOLEAN;
    has_is_online BOOLEAN;
    has_last_seen BOOLEAN;
BEGIN
    -- Check which columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees_leaderboard' AND column_name = 'employee_position'
    ) INTO has_employee_position;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees_leaderboard' AND column_name = 'office_id'
    ) INTO has_office_id;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees_leaderboard' AND column_name = 'is_online'
    ) INTO has_is_online;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees_leaderboard' AND column_name = 'last_seen'
    ) INTO has_last_seen;
    
    -- Clear existing data
    DELETE FROM employees_leaderboard;
    
    -- Insert with only basic required columns first
    INSERT INTO employees_leaderboard (
        employee_id,
        user_id,
        full_name,
        total_points,
        completed_tasks,
        avatar_url
    )
    SELECT 
        e.id as employee_id,
        e.user_id,
        COALESCE(e.full_name, up.full_name, 'Unknown Employee') as full_name,
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
        COALESCE(up.avatar_url, e.avatar_url) as avatar_url
    FROM employees e
    LEFT JOIN user_profiles up ON e.user_id = up.id;
    
    -- Update additional columns if they exist
    IF has_employee_position THEN
        UPDATE employees_leaderboard el
        SET employee_position = COALESCE(e.employee_position, up.position, 'Employee')
        FROM employees e
        LEFT JOIN user_profiles up ON e.user_id = up.id
        WHERE el.employee_id = e.id;
    END IF;
    
    IF has_office_id THEN
        UPDATE employees_leaderboard el
        SET office_id = COALESCE(e.office_id, 1)
        FROM employees e
        WHERE el.employee_id = e.id;
    END IF;
    
    IF has_is_online THEN
        UPDATE employees_leaderboard el
        SET is_online = COALESCE(e.is_online, false)
        FROM employees e
        WHERE el.employee_id = e.id;
    END IF;
    
    IF has_last_seen THEN
        UPDATE employees_leaderboard el
        SET last_seen = COALESCE(e.last_seen, NOW())
        FROM employees e
        WHERE el.employee_id = e.id;
    END IF;
    
END;
$$;

-- Execute the adaptive function
SELECT refresh_leaderboard_adaptive();

-- Check the updated table structure
SELECT 
    'Updated table structure' as info,
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'employees_leaderboard'
ORDER BY ordinal_position;

-- Fix RLS policies
DROP POLICY IF EXISTS "employees_leaderboard_public_read" ON employees_leaderboard;
DROP POLICY IF EXISTS "employees_leaderboard_office_read" ON employees_leaderboard;
DROP POLICY IF EXISTS "employees_leaderboard_admin_read" ON employees_leaderboard;
DROP POLICY IF EXISTS "employees_leaderboard_read" ON employees_leaderboard;

-- Create simple read policy for authenticated users
CREATE POLICY "employees_leaderboard_auth_read" ON employees_leaderboard
    FOR SELECT 
    USING (auth.uid() IS NOT NULL);

-- Check results
SELECT 
    'Leaderboard data check' as info,
    COUNT(*) as total_records
FROM employees_leaderboard;

-- Show current user's data
SELECT 
    'Current user in leaderboard' as info,
    el.full_name,
    el.total_points,
    el.completed_tasks,
    el.avatar_url IS NOT NULL as has_avatar
FROM employees_leaderboard el
WHERE el.user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- Show top 5 leaderboard
SELECT 
    'Top 5 leaderboard' as info,
    el.full_name,
    el.total_points,
    el.completed_tasks,
    el.avatar_url IS NOT NULL as has_avatar
FROM employees_leaderboard el
ORDER BY el.total_points DESC
LIMIT 5; 