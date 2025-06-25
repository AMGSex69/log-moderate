-- Детальная диагностика проблемы с игровыми статистиками
-- Выявляем почему у всех пользователей 0 монет

-- 1. Проверяем структуру таблицы user_profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('id', 'employee_id', 'coins', 'level', 'experience')
ORDER BY ordinal_position;

-- 2. Проверяем количество записей в основных таблицах
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as total_records,
    COUNT(employee_id) as records_with_employee_id
FROM user_profiles
UNION ALL
SELECT 
    'task_logs' as table_name,
    COUNT(*) as total_records,
    COUNT(employee_id) as records_with_employee_id
FROM task_logs
UNION ALL
SELECT 
    'task_types' as table_name,
    COUNT(*) as total_records,
    NULL as records_with_employee_id
FROM task_types;

-- 3. Проверяем связь между user_profiles и task_logs
SELECT 
    'user_profiles with task_logs' as check_type,
    COUNT(DISTINCT up.employee_id) as users_with_employee_id,
    COUNT(DISTINCT tl.employee_id) as task_logs_with_employee_id,
    COUNT(DISTINCT up.employee_id) FILTER (WHERE tl.employee_id IS NOT NULL) as matching_employee_ids
FROM user_profiles up
LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
WHERE up.employee_id IS NOT NULL;

-- 4. Показываем примеры employee_id из обеих таблиц
SELECT 'user_profiles employee_ids' as source, employee_id, full_name
FROM user_profiles 
WHERE employee_id IS NOT NULL 
LIMIT 5
UNION ALL
SELECT 'task_logs employee_ids' as source, employee_id::text, 'N/A' as full_name
FROM task_logs 
WHERE employee_id IS NOT NULL 
LIMIT 5;

-- 5. Проверяем типы данных employee_id в обеих таблицах
SELECT 
    'user_profiles' as table_name,
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND column_name = 'employee_id'
UNION ALL
SELECT 
    'task_logs' as table_name,
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'task_logs' AND column_name = 'employee_id';

-- 6. Проверяем наличие task_logs для конкретных пользователей
SELECT 
    up.id,
    up.full_name,
    up.employee_id,
    COUNT(tl.id) as task_count,
    SUM(tl.units_completed) as total_units,
    STRING_AGG(tt.name, ', ') as task_types
FROM user_profiles up
LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
LEFT JOIN task_types tt ON tt.id = tl.task_type_id
WHERE up.employee_id IS NOT NULL
GROUP BY up.id, up.full_name, up.employee_id
ORDER BY task_count DESC
LIMIT 10;

-- 7. Проверяем task_types и их награды
SELECT 
    tt.id,
    tt.name,
    COUNT(tl.id) as usage_count,
    SUM(tl.units_completed) as total_units,
    CASE 
        WHEN tt.name = 'Актуализация ОСС' THEN SUM(tl.units_completed) * 15
        WHEN tt.name = 'Обзвоны по рисовке' THEN SUM(tl.units_completed) * 10
        WHEN tt.name = 'Отчеты физикам (+почта)' THEN SUM(tl.units_completed) * 12
        WHEN tt.name = 'Протоколы ОСС' THEN SUM(tl.units_completed) * 25
        WHEN tt.name = 'Внесение решений МЖИ (кол-во бланков)' THEN SUM(tl.units_completed) * 5
        WHEN tt.name = 'Обходы' THEN SUM(tl.units_completed) * 25
        WHEN tt.name = 'Работа с нетиповыми обращениями' THEN SUM(tl.units_completed) * 8
        WHEN tt.name = 'СТП отмена ОСС' THEN SUM(tl.units_completed) * 12
        WHEN tt.name = 'СТП подселенцы' THEN SUM(tl.units_completed) * 10
        ELSE SUM(tl.units_completed) * 5
    END as calculated_coins
FROM task_types tt
LEFT JOIN task_logs tl ON tl.task_type_id = tt.id
GROUP BY tt.id, tt.name
ORDER BY usage_count DESC;

-- 8. Проверяем структуру таблицы task_logs
SELECT 
    'task_logs structure' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'task_logs' 
ORDER BY ordinal_position;

-- 9. Тестовый расчет монет для одного пользователя
SELECT 
    up.id,
    up.full_name,
    up.employee_id,
    tl.id as task_log_id,
    tt.name as task_type,
    tl.units_completed,
    CASE 
        WHEN tt.name = 'Актуализация ОСС' THEN tl.units_completed * 15
        WHEN tt.name = 'Обзвоны по рисовке' THEN tl.units_completed * 10
        WHEN tt.name = 'Отчеты физикам (+почта)' THEN tl.units_completed * 12
        WHEN tt.name = 'Протоколы ОСС' THEN tl.units_completed * 25
        WHEN tt.name = 'Внесение решений МЖИ (кол-во бланков)' THEN tl.units_completed * 5
        WHEN tt.name = 'Обходы' THEN tl.units_completed * 25
        WHEN tt.name = 'Работа с нетиповыми обращениями' THEN tl.units_completed * 8
        WHEN tt.name = 'СТП отмена ОСС' THEN tl.units_completed * 12
        WHEN tt.name = 'СТП подселенцы' THEN tl.units_completed * 10
        ELSE tl.units_completed * 5
    END as coins_for_this_task
FROM user_profiles up
LEFT JOIN task_logs tl ON tl.employee_id = up.employee_id
LEFT JOIN task_types tt ON tt.id = tl.task_type_id
WHERE up.employee_id IS NOT NULL
AND tl.id IS NOT NULL
LIMIT 20; 