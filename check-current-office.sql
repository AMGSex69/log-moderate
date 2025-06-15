-- ПРОВЕРКА ТЕКУЩЕГО ОФИСА ПОЛЬЗОВАТЕЛЯ

-- 1. Ваш текущий офис
SELECT 'ВАШ ТЕКУЩИЙ ОФИС:' as info;
SELECT 
    up.full_name,
    up.email,
    up.office_id,
    o.name as office_name
FROM user_profiles up
LEFT JOIN offices o ON up.office_id = o.id
WHERE up.email = 'egordolgih@mail.ru';

-- 2. Все пользователи в вашем офисе
SELECT 'ВСЕ В ВАШЕМ ОФИСЕ:' as info;
SELECT 
    up.id,
    up.full_name,
    up.email,
    up.position,
    up.is_active
FROM user_profiles up
WHERE up.office_id = 17
ORDER BY up.full_name;

-- 3. Проверка данных для лидерборда (если есть task_logs)
SELECT 'СТАТИСТИКА ОФИСА ИЗ TASK_LOGS:' as info;
SELECT 
    COUNT(DISTINCT tl.employee_id) as unique_employees,
    COUNT(*) as total_tasks,
    SUM(tl.units_completed) as total_units
FROM task_logs tl
WHERE tl.employee_id IN (
    SELECT up.id FROM user_profiles up WHERE up.office_id = 17
); 