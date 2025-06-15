-- ===========================================
-- ПОЛНАЯ ДИАГНОСТИКА СИСТЕМЫ
-- ===========================================

-- 1. ПРОВЕРЯЕМ ОСНОВНЫЕ ТАБЛИЦЫ
SELECT '=== ПРОВЕРКА ТАБЛИЦ ===' as section;

SELECT 'Таблица user_profiles:' as info;
SELECT COUNT(*) as total_profiles FROM user_profiles;

SELECT 'Таблица employees:' as info;
SELECT COUNT(*) as total_employees FROM employees;

SELECT 'Таблица employees_leaderboard:' as info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees_leaderboard')
        THEN 'Таблица существует'
        ELSE 'Таблица НЕ существует'
    END as table_status;

-- 2. ПРОВЕРЯЕМ ФУНКЦИИ
SELECT '=== ПРОВЕРКА ФУНКЦИЙ ===' as section;

SELECT 'Функция get_leaderboard_stats:' as info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_leaderboard_stats')
        THEN 'Функция существует'
        ELSE 'Функция НЕ существует'
    END as function_status;

SELECT 'Функция refresh_leaderboard:' as info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'refresh_leaderboard')
        THEN 'Функция существует'
        ELSE 'Функция НЕ существует'
    END as function_status;

-- 3. ТЕСТИРУЕМ ФУНКЦИЮ ЛИДЕРБОРДА
SELECT '=== ТЕСТ ФУНКЦИИ ЛИДЕРБОРДА ===' as section;

SELECT 'Результат get_leaderboard_stats():' as info;
SELECT COUNT(*) as records_count FROM get_leaderboard_stats();

-- 4. ПРОВЕРЯЕМ ДАННЫЕ ЛИДЕРБОРДА
SELECT '=== ДАННЫЕ ЛИДЕРБОРДА ===' as section;

-- Если таблица employees_leaderboard существует
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees_leaderboard') THEN
        RAISE NOTICE 'Таблица employees_leaderboard найдена';
    ELSE
        RAISE NOTICE 'Таблица employees_leaderboard НЕ найдена - создаем';
    END IF;
END $$;

-- 5. СОЗДАЕМ ТАБЛИЦУ ЛИДЕРБОРДА ЕСЛИ НЕ СУЩЕСТВУЕТ
CREATE TABLE IF NOT EXISTS employees_leaderboard AS
SELECT 
    employee_id,
    user_id,
    full_name,
    employee_position as position,
    office_name,
    total_tasks,
    completed_tasks,
    completion_rate,
    total_points,
    avatar_url,
    NOW() as updated_at
FROM get_leaderboard_stats();

-- 6. СОЗДАЕМ ФУНКЦИЮ ОБНОВЛЕНИЯ ЕСЛИ НЕ СУЩЕСТВУЕТ
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM employees_leaderboard;
    
    INSERT INTO employees_leaderboard (
        employee_id,
        user_id,
        full_name,
        position,
        office_name,
        total_tasks,
        completed_tasks,
        completion_rate,
        total_points,
        avatar_url,
        updated_at
    )
    SELECT 
        employee_id,
        user_id,
        full_name,
        employee_position,
        office_name,
        total_tasks,
        completed_tasks,
        completion_rate,
        total_points,
        avatar_url,
        NOW()
    FROM get_leaderboard_stats();
END;
$$;

-- 7. ОБНОВЛЯЕМ ЛИДЕРБОРД
SELECT refresh_leaderboard();

-- 8. НАСТРАИВАЕМ RLS ДЛЯ ЛИДЕРБОРДА
ALTER TABLE employees_leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all to view leaderboard" ON employees_leaderboard;
CREATE POLICY "Allow all to view leaderboard" ON employees_leaderboard
    FOR SELECT USING (true);

-- 9. ПРОВЕРЯЕМ ФИНАЛЬНЫЙ РЕЗУЛЬТАТ
SELECT '=== ФИНАЛЬНАЯ ПРОВЕРКА ===' as section;

SELECT 'Записи в employees_leaderboard:' as info;
SELECT COUNT(*) as total_records FROM employees_leaderboard;

SELECT 'Топ-3 лидерборда:' as info;
SELECT 
    employee_id,
    full_name,
    position,
    total_tasks,
    total_points,
    CASE 
        WHEN avatar_url IS NULL OR avatar_url = '' THEN 'Нет аватарки'
        ELSE 'Есть аватарка'
    END as avatar_status
FROM employees_leaderboard
ORDER BY total_points DESC
LIMIT 3;

-- 10. ПРОВЕРЯЕМ RLS ПОЛИТИКИ
SELECT '=== RLS ПОЛИТИКИ ===' as section;

SELECT 'Политики для employees_leaderboard:' as info;
SELECT policyname, cmd, permissive 
FROM pg_policies 
WHERE tablename = 'employees_leaderboard';

-- 11. ПРОВЕРЯЕМ ДОСТУП К REST API
SELECT '=== REST API ENDPOINTS ===' as section;
SELECT 'Доступные endpoints:' as info;
SELECT 
    '/rest/v1/employees_leaderboard - таблица лидерборда' as endpoint
UNION ALL
SELECT 
    '/rest/v1/user_profiles - профили пользователей' as endpoint
UNION ALL
SELECT 
    '/rest/v1/employees - сотрудники' as endpoint;

-- 12. ПРОВЕРЯЕМ КОНКРЕТНОГО ПОЛЬЗОВАТЕЛЯ
SELECT '=== ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ ===' as section;

SELECT 'Данные пользователя b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5:' as info;
SELECT 
    up.id,
    up.full_name,
    up.avatar_url,
    up.role,
    up.is_admin,
    e.id as employee_id
FROM user_profiles up
LEFT JOIN employees e ON e.user_id = up.id
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

SELECT 'ДИАГНОСТИКА ЗАВЕРШЕНА' as final_status; 