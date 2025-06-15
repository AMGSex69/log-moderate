-- Исправляем проблему с DELETE без WHERE в триггерах
-- Выполнить в Supabase Dashboard -> SQL Editor

-- 1. Удаляем проблемные триггеры
DROP TRIGGER IF EXISTS trigger_refresh_leaderboard_profiles ON user_profiles;
DROP TRIGGER IF EXISTS trigger_refresh_leaderboard_tasks ON task_logs;
DROP TRIGGER IF EXISTS trigger_refresh_leaderboard_employees ON employees;

-- 2. Удаляем проблемные функции
DROP FUNCTION IF EXISTS auto_refresh_leaderboard();
DROP FUNCTION IF EXISTS refresh_leaderboard();
DROP FUNCTION IF EXISTS refresh_leaderboard_with_office();
DROP FUNCTION IF EXISTS refresh_leaderboard_safe();
DROP FUNCTION IF EXISTS refresh_leaderboard_adaptive();

-- 3. Создаем безопасную функцию обновления лидерборда
CREATE OR REPLACE FUNCTION safe_refresh_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Безопасно очищаем только старые записи (старше 1 дня)
    DELETE FROM employees_leaderboard 
    WHERE updated_at < NOW() - INTERVAL '1 day'
    OR updated_at IS NULL;
    
    -- Вставляем/обновляем актуальные данные
    INSERT INTO employees_leaderboard (
        employee_id,
        user_id,
        full_name,
        total_points,
        completed_tasks,
        avatar_url,
        updated_at
    )
    SELECT 
        e.id as employee_id,
        e.user_id,
        COALESCE(e.full_name, up.full_name, 'Unknown Employee') as full_name,
        0 as total_points,  -- Пока ставим 0, можно будет добавить расчет позже
        0 as completed_tasks,
        COALESCE(up.avatar_url, e.avatar_url) as avatar_url,
        NOW() as updated_at
    FROM employees e
    LEFT JOIN user_profiles up ON e.user_id = up.id
    WHERE e.is_active = true
    ON CONFLICT (employee_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();
        
    RAISE NOTICE 'Leaderboard safely updated';
END;
$$;

-- 4. Проверяем, что функция работает
SELECT 'Testing safe refresh...' as info;
SELECT safe_refresh_leaderboard();

-- 5. Проверяем результат
SELECT 
    'Leaderboard after safe refresh' as info,
    COUNT(*) as total_records
FROM employees_leaderboard;

-- 6. Показываем данные
SELECT 
    employee_id,
    full_name,
    total_points,
    completed_tasks,
    updated_at
FROM employees_leaderboard
ORDER BY employee_id
LIMIT 10; 