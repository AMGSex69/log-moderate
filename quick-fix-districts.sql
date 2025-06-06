-- Быстрое исправление: удаляем проблемный view
DROP VIEW IF EXISTS employee_district_stats CASCADE;

-- Теперь можно удалить колонку
ALTER TABLE employees DROP COLUMN IF EXISTS district_id CASCADE;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS district_id CASCADE;

-- Проверяем результат
SELECT 'КОЛОНКИ ПОСЛЕ УДАЛЕНИЯ:' as info;
SELECT 
    table_name,
    column_name
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name IN ('employees', 'user_profiles')
    AND column_name LIKE '%district%';

SELECT 'Если пусто - значит колонки успешно удалены! ✅' as result; 