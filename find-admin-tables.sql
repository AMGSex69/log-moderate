-- ПОИСК ТАБЛИЦ АДМИНИСТРАТОРА

-- 1. Все таблицы в базе данных
SELECT 'ВСЕ ТАБЛИЦЫ:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Поиск таблиц связанных с админкой или сотрудниками
SELECT 'ТАБЛИЦЫ С EMPLOYEES/ADMIN:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%employee%' OR table_name LIKE '%admin%' OR table_name LIKE '%staff%')
ORDER BY table_name;

-- 3. Ваши данные во всех возможных таблицах
-- Сначала проверим структуру employees
SELECT 'СТРУКТУРА employees:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'employees';

-- Проверим employees по user_id
SELECT 'ДАННЫЕ В employees:' as info;
SELECT * FROM employees WHERE user_id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- Поиск по имени в employees
SELECT 'ПОИСК ПО ИМЕНИ В employees:' as info;
SELECT * FROM employees WHERE full_name LIKE '%Долгих%' OR full_name LIKE '%Георгий%';

-- 4. Поиск в user_profiles
SELECT 'ПОИСК В user_profiles:' as info;
SELECT id, full_name, office_id, office_name, updated_at
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 5. Все таблицы содержащие office_id
SELECT 'ТАБЛИЦЫ С office_id:' as info;
SELECT table_name, column_name
FROM information_schema.columns 
WHERE column_name = 'office_id' AND table_schema = 'public'; 