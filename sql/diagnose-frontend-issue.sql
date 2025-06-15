-- Diagnose frontend leaderboard access issue

-- 1. Check if data exists in employees_leaderboard
SELECT 
    'employees_leaderboard data check' as test,
    COUNT(*) as total_records,
    COUNT(CASE WHEN avatar_url IS NOT NULL THEN 1 END) as with_avatar
FROM employees_leaderboard;

-- 2. Check RLS policies on employees_leaderboard
SELECT 
    'RLS policies check' as test,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'employees_leaderboard';

-- 3. Check if RLS is enabled
SELECT 
    'RLS status' as test,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'employees_leaderboard';

-- 4. Test direct access as if from frontend
-- This simulates what the frontend REST API call would do
SELECT 
    'Direct access test' as test,
    employee_id,
    user_id,
    full_name,
    total_points,
    completed_tasks,
    avatar_url IS NOT NULL as has_avatar
FROM employees_leaderboard
ORDER BY total_points DESC
LIMIT 5;

-- 5. Check if the user can access their own record
SELECT 
    'User record access test' as test,
    employee_id,
    user_id,
    full_name,
    total_points
FROM employees_leaderboard
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 6. Temporarily disable RLS to test if that's the issue
ALTER TABLE employees_leaderboard DISABLE ROW LEVEL SECURITY;

-- 7. Test access with RLS disabled
SELECT 
    'Access with RLS disabled' as test,
    COUNT(*) as accessible_records
FROM employees_leaderboard;

-- 8. Re-enable RLS but with a very permissive policy
ALTER TABLE employees_leaderboard ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "employees_leaderboard_simple_read" ON employees_leaderboard;
DROP POLICY IF EXISTS "employees_leaderboard_auth_read" ON employees_leaderboard;
DROP POLICY IF EXISTS "employees_leaderboard_public_read" ON employees_leaderboard;

-- Create the most permissive policy possible
CREATE POLICY "employees_leaderboard_allow_all" ON employees_leaderboard
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- 9. Final test with new policy
SELECT 
    'Final access test' as test,
    COUNT(*) as accessible_records,
    string_agg(full_name, ', ' ORDER BY total_points DESC) as top_employees
FROM employees_leaderboard;

-- 10. Check what the REST API endpoint would return
-- This is what /rest/v1/employees_leaderboard should return
SELECT 
    employee_id,
    user_id,
    full_name,
    total_points,
    completed_tasks,
    avatar_url
FROM employees_leaderboard
ORDER BY total_points DESC; 