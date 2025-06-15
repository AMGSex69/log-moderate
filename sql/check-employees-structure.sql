-- Проверяем структуру таблицы employees

-- 1. Получаем полную структуру таблицы
SELECT 'СТРУКТУРА ТАБЛИЦЫ employees:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Проверяем есть ли колонка avatar_url
SELECT 'ПРОВЕРКА avatar_url:' as check_info;
SELECT CASE 
    WHEN COUNT(*) > 0 THEN 'КОЛОНКА avatar_url СУЩЕСТВУЕТ'
    ELSE 'КОЛОНКА avatar_url НЕ СУЩЕСТВУЕТ'
END as result
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND column_name = 'avatar_url'
AND table_schema = 'public';

-- 3. Смотрим пример данных
SELECT 'ПРИМЕР ДАННЫХ employees:' as data_info;
SELECT id, full_name, email, position, is_active, office_id, user_id
FROM employees 
WHERE id = 2
LIMIT 1; 