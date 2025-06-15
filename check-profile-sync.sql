-- ПРОВЕРКА И СИНХРОНИЗАЦИЯ ПРОФИЛЯ

-- 1. Текущие данные в user_profiles
SELECT 'ТЕКУЩИЕ ДАННЫЕ user_profiles:' as info;
SELECT 
    id,
    full_name,
    office_id,
    office_name,
    updated_at
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 2. Принудительно обновляем данные профиля на "Рассвет"
UPDATE user_profiles 
SET 
    office_id = 1,
    office_name = 'Рассвет',
    updated_at = NOW()
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 3. Проверяем результат
SELECT 'ПОСЛЕ ОБНОВЛЕНИЯ:' as info;
SELECT 
    id,
    full_name,
    office_id,
    office_name,
    updated_at
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 4. Обновляем лидерборд для офиса "Рассвет"
DELETE FROM employees_leaderboard WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

INSERT INTO employees_leaderboard (
    employee_id,
    user_id,
    full_name,
    total_points,
    completed_tasks,
    avatar_url
)
SELECT 
    1 as employee_id,
    up.id as user_id,
    up.full_name,
    0 as total_points,
    0 as completed_tasks,
    up.avatar_url
FROM user_profiles up
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 5. Проверяем лидерборд
SELECT 'ЛИДЕРБОРД:' as info;
SELECT * FROM employees_leaderboard 
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'; 