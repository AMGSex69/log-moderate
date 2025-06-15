-- ПРАВИЛЬНОЕ ИСПРАВЛЕНИЕ С РЕАЛЬНОЙ СТРУКТУРОЙ

-- 1. УДАЛЯЕМ ПРОБЛЕМНЫЕ ФУНКЦИИ
DROP FUNCTION IF EXISTS refresh_leaderboard_safe();
DROP FUNCTION IF EXISTS refresh_leaderboard_with_office();
DROP FUNCTION IF EXISTS refresh_leaderboard_adaptive();

-- 2. ВАШИ ДАННЫЕ
SELECT 'ВАШИ ДАННЫЕ:' as info;
SELECT 
    id,
    full_name,
    office_id,
    office_name
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 3. ВСЕ В ВАШЕМ ОФИСЕ (office_id = 15)
SELECT 'ВСЕ В ОФИСЕ ВИТЯЗЬ:' as info;
SELECT 
    id,
    full_name,
    position,
    office_name
FROM user_profiles 
WHERE office_id = 15;

-- 4. ОЧИЩАЕМ И ЗАПОЛНЯЕМ ЛИДЕРБОРД
DELETE FROM employees_leaderboard;

INSERT INTO employees_leaderboard (
    employee_id,
    user_id,
    full_name,
    total_points,
    completed_tasks,
    avatar_url
)
SELECT 
    ROW_NUMBER() OVER (ORDER BY up.full_name) as employee_id, -- Генерируем ID
    up.id as user_id,
    up.full_name,
    0 as total_points,
    0 as completed_tasks,
    up.avatar_url
FROM user_profiles up
WHERE up.office_id = 15;

-- 5. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
SELECT 'ЛИДЕРБОРД ОФИСА ВИТЯЗЬ:' as info;
SELECT 
    el.employee_id,
    el.user_id,
    el.full_name,
    el.total_points,
    el.avatar_url IS NOT NULL as has_avatar
FROM employees_leaderboard el
ORDER BY el.full_name; 