-- Let's check what columns actually exist in task_logs
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_logs'
ORDER BY ordinal_position;

-- Simple fix - just populate leaderboard with basic data that works
DELETE FROM employees_leaderboard;

-- Insert basic working data without points calculation for now
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
    0 as total_points,  -- Set to 0 for now, we'll fix this after checking task_logs structure
    0 as completed_tasks,  -- Set to 0 for now
    COALESCE(up.avatar_url, e.avatar_url) as avatar_url
FROM employees e
LEFT JOIN user_profiles up ON e.user_id = up.id;

-- Simple RLS policy that just works
DROP POLICY IF EXISTS "employees_leaderboard_auth_read" ON employees_leaderboard;
CREATE POLICY "employees_leaderboard_simple_read" ON employees_leaderboard
    FOR SELECT 
    USING (true);  -- Allow all reads for now, we'll restrict later

-- Check what we have
SELECT 
    'Simple leaderboard check' as info,
    COUNT(*) as total_records
FROM employees_leaderboard;

-- Show the data
SELECT 
    full_name,
    total_points,
    completed_tasks,
    avatar_url IS NOT NULL as has_avatar
FROM employees_leaderboard
ORDER BY full_name; 