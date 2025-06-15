-- Исправление ФИО, аватарки и лидерборда
-- Fix name, avatar, and leaderboard issues

-- 1. Исправляем ФИО для пользователя b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5
UPDATE user_profiles 
SET full_name = 'Долгих Георгий Александрович'
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- Также обновляем в таблице employees
UPDATE employees 
SET full_name = 'Долгих Георгий Александрович'
WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 2. Добавляем аватарку (используем стандартную аватарку или Gravatar)
UPDATE user_profiles 
SET avatar_url = 'https://www.gravatar.com/avatar/' || md5(lower(trim('dolgihegor2323@gmail.com'))) || '?s=200&d=identicon'
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 3. Проверяем и исправляем данные лидерборда
-- Сначала проверим, есть ли данные в employees_leaderboard
SELECT COUNT(*) as leaderboard_count FROM employees_leaderboard;

-- Принудительно обновляем лидерборд
SELECT refresh_leaderboard();

-- 4. Проверяем RLS политики для employees_leaderboard
-- Убираем все политики и создаем простые
DROP POLICY IF EXISTS "employees_leaderboard_select" ON employees_leaderboard;

-- Создаем простую политику для чтения лидерборда (доступно всем аутентифицированным)
CREATE POLICY "employees_leaderboard_public_read" ON employees_leaderboard
    FOR SELECT 
    USING (true);

-- 5. Проверяем, что у нас есть данные в основных таблицах
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as count
FROM user_profiles
WHERE full_name IS NOT NULL

UNION ALL

SELECT 
    'employees' as table_name,
    COUNT(*) as count
FROM employees
WHERE full_name IS NOT NULL

UNION ALL

SELECT 
    'employees_leaderboard' as table_name,
    COUNT(*) as count
FROM employees_leaderboard;

-- 6. Если лидерборд пустой, заполняем его вручную
INSERT INTO employees_leaderboard (
    employee_id,
    user_id,
    full_name,
    employee_position,
    total_points,
    completed_tasks,
    avatar_url,
    is_online,
    last_seen
)
SELECT 
    e.id as employee_id,
    e.user_id,
    COALESCE(e.full_name, up.full_name, 'Неизвестный сотрудник') as full_name,
    COALESCE(e.employee_position, up.position, 'Сотрудник') as employee_position,
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
    COALESCE(e.last_seen, NOW()) as last_seen
FROM employees e
LEFT JOIN user_profiles up ON e.user_id = up.id
ON CONFLICT (employee_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    employee_position = EXCLUDED.employee_position,
    total_points = EXCLUDED.total_points,
    completed_tasks = EXCLUDED.completed_tasks,
    avatar_url = EXCLUDED.avatar_url,
    is_online = EXCLUDED.is_online,
    last_seen = EXCLUDED.last_seen;

-- 7. Проверяем результат
SELECT 
    'Обновленные данные пользователя' as info,
    up.full_name,
    up.avatar_url,
    e.full_name as employee_name,
    e.employee_position
FROM user_profiles up
LEFT JOIN employees e ON up.id = e.user_id
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 8. Проверяем лидерборд
SELECT 
    'Лидерборд (топ 5)' as info,
    el.full_name,
    el.employee_position,
    el.total_points,
    el.completed_tasks,
    el.avatar_url IS NOT NULL as has_avatar
FROM employees_leaderboard el
ORDER BY el.total_points DESC
LIMIT 5;

-- 9. Финальная диагностика
SELECT 
    'Финальная диагностика' as status,
    (SELECT COUNT(*) FROM user_profiles WHERE full_name LIKE '%Долгих Георгий%') as correct_name_count,
    (SELECT COUNT(*) FROM user_profiles WHERE avatar_url IS NOT NULL) as profiles_with_avatar,
    (SELECT COUNT(*) FROM employees_leaderboard) as leaderboard_entries; 