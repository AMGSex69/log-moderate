-- Fix user data without cyrillic in comments
UPDATE user_profiles 
SET full_name = 'Долгих Георгий Александрович',
    avatar_url = 'https://www.gravatar.com/avatar/d4c74594d841139328695756648b6bd6?s=200&d=identicon'
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

UPDATE employees 
SET full_name = 'Долгих Георгий Александрович'
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

DROP POLICY IF EXISTS "employees_leaderboard_select" ON employees_leaderboard;
CREATE POLICY "employees_leaderboard_public_read" ON employees_leaderboard FOR SELECT USING (true);

SELECT refresh_leaderboard();

SELECT full_name, avatar_url FROM user_profiles WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';
SELECT COUNT(*) FROM employees_leaderboard; 