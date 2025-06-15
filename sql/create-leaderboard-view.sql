-- ===========================================
-- СОЗДАНИЕ VIEW ДЛЯ ЛИДЕРБОРДА
-- ===========================================

-- 1. Удаляем старое представление если есть
DROP VIEW IF EXISTS leaderboard_view;

-- 2. Создаем представление лидерборда
CREATE VIEW leaderboard_view AS
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
    avatar_url
FROM get_leaderboard_stats();

-- 3. Создаем RLS политику для представления
ALTER VIEW leaderboard_view OWNER TO postgres;

-- 4. Разрешаем доступ к представлению
GRANT SELECT ON leaderboard_view TO authenticated;
GRANT SELECT ON leaderboard_view TO anon;

-- 5. Создаем альтернативную таблицу employees_leaderboard для REST API
DROP TABLE IF EXISTS employees_leaderboard CASCADE;

CREATE TABLE employees_leaderboard AS
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

-- 6. Создаем функцию для обновления лидерборда
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Очищаем таблицу
    DELETE FROM employees_leaderboard;
    
    -- Заполняем свежими данными
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

-- 7. Обновляем лидерборд
SELECT refresh_leaderboard();

-- 8. Создаем RLS для таблицы лидерборда
ALTER TABLE employees_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to view leaderboard" ON employees_leaderboard
    FOR SELECT USING (true);

-- 9. Проверяем результат
SELECT 'Проверка leaderboard_view:' as info;
SELECT COUNT(*) as view_records FROM leaderboard_view;

SELECT 'Проверка employees_leaderboard:' as info;
SELECT COUNT(*) as table_records FROM employees_leaderboard;

SELECT 'Данные лидерборда:' as info;
SELECT 
    employee_id,
    full_name,
    position,
    office_name,
    total_tasks,
    total_points,
    CASE 
        WHEN avatar_url = '' THEN 'Нет аватарки'
        ELSE 'Есть аватарка'
    END as avatar_status
FROM employees_leaderboard
ORDER BY total_points DESC
LIMIT 5;

COMMENT ON VIEW leaderboard_view IS 'Представление лидерборда для REST API';
COMMENT ON TABLE employees_leaderboard IS 'Кэшированная таблица лидерборда для быстрого доступа';
COMMENT ON FUNCTION refresh_leaderboard() IS 'Функция обновления кэша лидерборда'; 