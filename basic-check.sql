-- БАЗОВАЯ ПРОВЕРКА

-- 1. Структура таблицы user_profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

-- 2. Первые 3 записи из user_profiles
SELECT * FROM user_profiles LIMIT 3;

-- 3. Ищем вас по имени
SELECT * FROM user_profiles WHERE full_name LIKE '%Долгих%' OR full_name LIKE '%Георгий%';

-- 4. Все записи с office_id = 17  
SELECT * FROM user_profiles WHERE office_id = 17; 