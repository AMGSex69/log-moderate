-- ТЕСТИРОВАНИЕ СИСТЕМЫ АВТОМАТИЧЕСКОГО ЗАКРЫТИЯ
-- Этот скрипт создает тестовые данные и проверяет работу автозакрытия

-- 1. СОЗДАЕМ ТЕСТОВЫЕ ДАННЫЕ ДЛЯ ПРОВЕРКИ

-- Получаем первого доступного сотрудника для тестов
DO $$
DECLARE
    test_employee_id INTEGER;
    test_task_type_id INTEGER;
BEGIN
    -- Находим сотрудника для тестов
    SELECT id INTO test_employee_id FROM employees LIMIT 1;
    
    -- Находим тип задачи для тестов  
    SELECT id INTO test_task_type_id FROM task_types LIMIT 1;
    
    IF test_employee_id IS NOT NULL AND test_task_type_id IS NOT NULL THEN
        -- Удаляем существующую сессию вчерашнего дня для этого сотрудника (если есть)
        DELETE FROM work_sessions 
        WHERE employee_id = test_employee_id 
        AND date = CURRENT_DATE - INTERVAL '1 day';
        
        -- Создаем незакрытую рабочую сессию "вчерашнего" дня
        INSERT INTO work_sessions (
            employee_id, 
            date, 
            clock_in_time, 
            clock_out_time,
            created_at
        ) VALUES (
            test_employee_id,
            CURRENT_DATE - INTERVAL '1 day',  -- Вчера
            (CURRENT_DATE - INTERVAL '1 day') + INTERVAL '09:00:00',  -- 9:00 вчера
            NULL,  -- Не закрыта!
            NOW() - INTERVAL '1 day'
        );
        
        -- Очищаем старые тестовые активные сессии для этого сотрудника
        DELETE FROM active_sessions 
        WHERE employee_id = test_employee_id 
        AND task_type_id = test_task_type_id;
        
        -- Создаем активную сессию "вчерашнего" дня
        INSERT INTO active_sessions (
            employee_id,
            task_type_id, 
            started_at,
            last_heartbeat,
            is_active
        ) VALUES (
            test_employee_id,
            test_task_type_id,
            (CURRENT_DATE - INTERVAL '1 day') + INTERVAL '10:00:00',  -- 10:00 вчера
            NOW() - INTERVAL '1 day',
            true  -- Активна!
        );
        
        -- Создаем активную сессию сегодняшнего дня (должна остаться)
        INSERT INTO active_sessions (
            employee_id,
            task_type_id,
            started_at,
            last_heartbeat,
            is_active
        ) VALUES (
            test_employee_id,
            test_task_type_id,
            CURRENT_DATE + INTERVAL '09:00:00',  -- 9:00 сегодня
            NOW(),
            true  -- Активна!
        );
        
        RAISE NOTICE 'Тестовые данные созданы для employee_id: %', test_employee_id;
    ELSE
        RAISE NOTICE 'Не найдены сотрудники или типы задач для создания тестовых данных';
    END IF;
END $$;

-- 2. ПОКАЗЫВАЕМ СОСТОЯНИЕ ДО ВЫПОЛНЕНИЯ АВТОЗАКРЫТИЯ

SELECT '=== СОСТОЯНИЕ ДО АВТОЗАКРЫТИЯ ===' as info;

SELECT 'Незакрытые рабочие дни:' as info;
SELECT 
    e.full_name,
    ws.date,
    ws.clock_in_time,
    ws.clock_out_time,
    CASE 
        WHEN ws.clock_out_time IS NULL THEN 'НЕ ЗАКРЫТ'
        ELSE 'ЗАКРЫТ'
    END as status
FROM work_sessions ws
JOIN employees e ON e.id = ws.employee_id
WHERE ws.date < CURRENT_DATE
ORDER BY ws.date DESC;

SELECT 'Активные задачи (включая вчерашние):' as info;
SELECT 
    e.full_name,
    tt.name as task_name,
    DATE(acs.started_at) as task_date,
    acs.started_at::time as started_time,
    acs.is_active,
    CASE 
        WHEN DATE(acs.started_at) < CURRENT_DATE THEN 'ДОЛЖНА ЗАКРЫТЬСЯ'
        ELSE 'ДОЛЖНА ОСТАТЬСЯ'
    END as expected_action
FROM active_sessions acs
JOIN employees e ON e.id = acs.employee_id
JOIN task_types tt ON tt.id = acs.task_type_id
WHERE acs.is_active = true
ORDER BY acs.started_at DESC;

-- 3. ВЫПОЛНЯЕМ АВТОЗАКРЫТИЕ

SELECT '=== ВЫПОЛНЯЕМ АВТОЗАКРЫТИЕ ===' as info;

-- Вызываем функцию автозакрытия
SELECT auto_close_workday_and_tasks() as result;

-- 4. ПОКАЗЫВАЕМ СОСТОЯНИЕ ПОСЛЕ ВЫПОЛНЕНИЯ

SELECT '=== СОСТОЯНИЕ ПОСЛЕ АВТОЗАКРЫТИЯ ===' as info;

SELECT 'Проверка: незакрытые рабочие дни предыдущих дней' as info;
SELECT 
    e.full_name,
    ws.date,
    ws.clock_in_time::time as "Время прихода",
    ws.clock_out_time::time as "Время ухода",
    CASE 
        WHEN ws.clock_out_time IS NULL THEN '❌ НЕ ЗАКРЫТ'
        ELSE '✅ ЗАКРЫТ'
    END as status
FROM work_sessions ws
JOIN employees e ON e.id = ws.employee_id
WHERE ws.date < CURRENT_DATE
AND ws.clock_in_time IS NOT NULL
ORDER BY ws.date DESC;

SELECT 'Проверка: активные задачи предыдущих дней' as info;
SELECT 
    e.full_name,
    tt.name as task_name,
    DATE(acs.started_at) as task_date,
    acs.started_at::time as started_time,
    CASE 
        WHEN acs.is_active THEN '❌ ЕЩЕ АКТИВНА'
        ELSE '✅ ДЕАКТИВИРОВАНА'
    END as status
FROM active_sessions acs
JOIN employees e ON e.id = acs.employee_id
JOIN task_types tt ON tt.id = acs.task_type_id
WHERE DATE(acs.started_at) < CURRENT_DATE
ORDER BY acs.started_at DESC;

SELECT 'Проверка: активные задачи текущего дня (должны остаться)' as info;
SELECT 
    e.full_name,
    tt.name as task_name,
    acs.started_at::time as started_time,
    CASE 
        WHEN acs.is_active THEN '✅ АКТИВНА'
        ELSE '❌ ДЕАКТИВИРОВАНА'
    END as status
FROM active_sessions acs
JOIN employees e ON e.id = acs.employee_id
JOIN task_types tt ON tt.id = acs.task_type_id
WHERE DATE(acs.started_at) = CURRENT_DATE
AND acs.is_active = true
ORDER BY acs.started_at DESC;

-- 5. ИТОГОВАЯ СТАТИСТИКА ТЕСТА

SELECT '=== ИТОГИ ТЕСТИРОВАНИЯ ===' as info;

-- Проверяем что все предыдущие дни закрыты
WITH test_results AS (
    SELECT 
        'Незакрытые рабочие дни предыдущих дней' as test_name,
        COUNT(*) as count,
        CASE WHEN COUNT(*) = 0 THEN '✅ ПРОЙДЕН' ELSE '❌ ПРОВАЛЕН' END as result
    FROM work_sessions 
    WHERE date < CURRENT_DATE 
    AND clock_in_time IS NOT NULL 
    AND clock_out_time IS NULL
    
    UNION ALL
    
    SELECT 
        'Активные задачи предыдущих дней' as test_name,
        COUNT(*) as count,
        CASE WHEN COUNT(*) = 0 THEN '✅ ПРОЙДЕН' ELSE '❌ ПРОВАЛЕН' END as result
    FROM active_sessions 
    WHERE is_active = true 
    AND DATE(started_at) < CURRENT_DATE
    
    UNION ALL
    
    SELECT 
        'Активные задачи сегодня (должны остаться)' as test_name,
        COUNT(*) as count,
        CASE WHEN COUNT(*) > 0 THEN '✅ ПРОЙДЕН' ELSE '⚠️  НЕТ ДАННЫХ' END as result
    FROM active_sessions 
    WHERE is_active = true 
    AND DATE(started_at) = CURRENT_DATE
)
SELECT test_name, count, result FROM test_results;

-- 6. ОЧИСТКА ТЕСТОВЫХ ДАННЫХ (ОПЦИОНАЛЬНО)

SELECT '=== ОЧИСТКА ТЕСТОВЫХ ДАННЫХ ===' as info;
SELECT 'Для очистки тестовых данных раскомментируйте блок ниже' as note;

/*
-- Раскомментируйте для очистки тестовых данных:

-- Удаляем тестовые активные сессии
DELETE FROM active_sessions 
WHERE started_at >= CURRENT_DATE - INTERVAL '2 days';

-- Удаляем тестовые рабочие сессии вчерашнего дня
DELETE FROM work_sessions 
WHERE date = CURRENT_DATE - INTERVAL '1 day'
AND created_at >= CURRENT_DATE - INTERVAL '1 hour';

SELECT 'Тестовые данные удалены' as cleanup_result;
*/

-- 7. РЕЗУЛЬТАТ ТЕСТИРОВАНИЯ

SELECT 
    'ТЕСТИРОВАНИЕ ЗАВЕРШЕНО' as status,
    'Проверьте результаты выше' as instruction,
    'Все тесты должны показывать ✅ ПРОЙДЕН' as expected_result; 