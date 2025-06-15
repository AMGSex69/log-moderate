-- Проверяем структуру таблицы task_types

-- 1. Получаем информацию о колонках
SELECT 'СТРУКТУРА ТАБЛИЦЫ task_types:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'task_types' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Смотрим содержимое таблицы
SELECT 'ДАННЫЕ В ТАБЛИЦЕ task_types:' as info;
SELECT * FROM task_types LIMIT 10;

-- 3. Проверяем есть ли колонка measurement_unit
SELECT 'ПРОВЕРКА measurement_unit:' as check_info;
SELECT CASE 
    WHEN COUNT(*) > 0 THEN 'КОЛОНКА measurement_unit СУЩЕСТВУЕТ'
    ELSE 'КОЛОНКА measurement_unit НЕ СУЩЕСТВУЕТ'
END as result
FROM information_schema.columns 
WHERE table_name = 'task_types' 
AND column_name = 'measurement_unit'
AND table_schema = 'public'; 