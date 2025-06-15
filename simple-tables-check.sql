-- ПРОСТАЯ ПРОВЕРКА ТАБЛИЦ

-- 1. Все таблицы
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- 2. Структура user_profiles
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_profiles';

-- 3. Ваши данные в user_profiles  
SELECT * FROM user_profiles WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 4. Структура employees
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'employees'; 