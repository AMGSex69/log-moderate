-- ПРОВЕРКА СТРУКТУРЫ ТАБЛИЦ
-- Выполните по очереди каждый блок

-- 1. Структура user_profiles
SELECT 'СТОЛБЦЫ user_profiles:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

-- 2. Структура employees  
SELECT 'СТОЛБЦЫ employees:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'employees' 
ORDER BY ordinal_position;

-- 3. Структура auth.users (если доступна)
SELECT 'СТОЛБЦЫ auth.users:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'users' 
ORDER BY ordinal_position;

-- 4. Все данные из user_profiles
SELECT 'ВСЕ ДАННЫЕ user_profiles:' as info;
SELECT * FROM user_profiles LIMIT 10;

-- 5. Все данные из employees
SELECT 'ВСЕ ДАННЫЕ employees:' as info;
SELECT * FROM employees LIMIT 10; 