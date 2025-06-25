-- Тестирование админки с графиками работы
-- Выполните этот скрипт после исправления функций

-- 1. Проверяем функцию получения информации о графиках
SELECT 'Тестирование функции get_work_schedule_info' as test_name;
SELECT * FROM get_work_schedule_info('5/2');
SELECT * FROM get_work_schedule_info('2/2');

-- 2. Проверяем текущее состояние сотрудников
SELECT 'Текущие графики сотрудников:' as info;
SELECT 
    full_name,
    work_schedule,
    work_hours,
    admin_role,
    office_id
FROM employees 
ORDER BY full_name
LIMIT 10;

-- 3. Тестируем функцию получения сотрудников для админки
-- Замените UUID на реальный ID супер-админа
SELECT 'Тестирование get_employees_for_admin (замените UUID):' as info;
-- SELECT * FROM get_employees_for_admin('ваш-uuid-супер-админа');

-- 4. Проверяем соответствие данных между таблицами
SELECT 'Проверка соответствия графиков между таблицами:' as info;
SELECT 
    e.full_name,
    e.work_schedule as employee_schedule,
    e.work_hours as employee_hours,
    up.work_schedule as profile_schedule,
    up.work_hours as profile_hours,
    CASE 
        WHEN e.work_schedule = up.work_schedule AND e.work_hours = up.work_hours 
        THEN '✓ Соответствует' 
        ELSE '✗ Не соответствует' 
    END as status
FROM employees e
LEFT JOIN user_profiles up ON up.id = e.user_id
WHERE e.full_name IS NOT NULL
ORDER BY e.full_name
LIMIT 10;

-- 5. Статистика по графикам
SELECT 'Статистика по графикам работы:' as info;
SELECT 
    work_schedule,
    work_hours,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM employees 
WHERE work_schedule IS NOT NULL
GROUP BY work_schedule, work_hours
ORDER BY count DESC;

SELECT 'Тестирование завершено!' as final_status; 