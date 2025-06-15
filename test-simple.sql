-- ПРОСТЕЙШИЙ ТЕСТ

-- 1. Найти ваши данные по ID
SELECT 'ПОИСК ПО ID:' as info;
SELECT id, full_name, office_id, email
FROM user_profiles 
WHERE id = 2;

-- 2. Найти ваш офис
SELECT 'ВАШ ОФИС:' as info;
SELECT id, name FROM offices WHERE id = 17;

-- 3. Все в офисе 17
SELECT 'ВСЕ В ОФИСЕ 17:' as info;
SELECT id, full_name, is_active
FROM user_profiles 
WHERE office_id = 17;

-- 4. Очистить лидерборд
DELETE FROM employees_leaderboard;

-- 5. Простая вставка
INSERT INTO employees_leaderboard (employee_id, user_id, full_name, total_points, completed_tasks)
VALUES (2, 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5', 'Долгих Георгий Александрович', 0, 0);

-- 6. Проверка
SELECT 'РЕЗУЛЬТАТ:' as info;
SELECT * FROM employees_leaderboard; 