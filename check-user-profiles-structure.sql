-- Проверка структуры таблицы user_profiles
-- Смотрим какие колонки есть и каких не хватает для игровой системы

-- 1. Показываем все колонки таблицы user_profiles
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Проверяем есть ли игровые колонки
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'coins') 
        THEN 'coins - EXISTS' 
        ELSE 'coins - MISSING' 
    END as coins_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'experience') 
        THEN 'experience - EXISTS' 
        ELSE 'experience - MISSING' 
    END as experience_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'level') 
        THEN 'level - EXISTS' 
        ELSE 'level - MISSING' 
    END as level_status;

-- 3. Показываем несколько записей для понимания текущей структуры
SELECT * FROM user_profiles LIMIT 3; 