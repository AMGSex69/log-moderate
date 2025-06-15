-- ===========================================
-- ВОССТАНОВЛЕНИЕ АВАТАРКИ И ОБНОВЛЕНИЕ ЛИДЕРБОРДА
-- ===========================================

-- 1. Проверяем текущую аватарку пользователя
SELECT 'Текущая аватарка пользователя:' as info;
SELECT 
    id,
    full_name,
    avatar_url,
    CASE 
        WHEN avatar_url IS NULL OR avatar_url = '' THEN 'Аватарка отсутствует'
        ELSE 'Аватарка есть: ' || avatar_url
    END as avatar_status
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 2. Если аватарка пустая, устанавливаем дефолтную
UPDATE user_profiles 
SET avatar_url = COALESCE(
    NULLIF(avatar_url, ''), 
    'https://qodmtekryabmcnuvvbyf.supabase.co/storage/v1/object/public/avatars/default-avatar.png'
)
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'
AND (avatar_url IS NULL OR avatar_url = '');

-- 3. Проверяем результат обновления
SELECT 'После обновления аватарки:' as info;
SELECT 
    id,
    full_name,
    avatar_url,
    'Аватарка установлена' as status
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 4. Обновляем лидерборд с новыми данными
SELECT refresh_leaderboard();

-- 5. Проверяем обновленный лидерборд
SELECT 'Обновленный лидерборд:' as info;
SELECT 
    employee_id,
    full_name,
    position,
    office_name,
    total_tasks,
    total_points,
    CASE 
        WHEN avatar_url = '' OR avatar_url IS NULL THEN 'Нет аватарки'
        ELSE 'Есть аватарка'
    END as avatar_status,
    updated_at
FROM employees_leaderboard
ORDER BY total_points DESC
LIMIT 5;

-- 6. Создаем функцию для автоматического обновления лидерборда
CREATE OR REPLACE FUNCTION auto_refresh_leaderboard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Обновляем лидерборд при изменении профилей или задач
    PERFORM refresh_leaderboard();
    RETURN NULL;
END;
$$;

-- 7. Создаем триггеры для автообновления
DROP TRIGGER IF EXISTS trigger_refresh_leaderboard_profiles ON user_profiles;
CREATE TRIGGER trigger_refresh_leaderboard_profiles
    AFTER INSERT OR UPDATE OR DELETE ON user_profiles
    FOR EACH STATEMENT
    EXECUTE FUNCTION auto_refresh_leaderboard();

DROP TRIGGER IF EXISTS trigger_refresh_leaderboard_tasks ON task_logs;
CREATE TRIGGER trigger_refresh_leaderboard_tasks
    AFTER INSERT OR UPDATE OR DELETE ON task_logs
    FOR EACH STATEMENT
    EXECUTE FUNCTION auto_refresh_leaderboard();

-- 8. Финальная проверка
SELECT 'Финальная проверка лидерборда:' as info;
SELECT COUNT(*) as total_records FROM employees_leaderboard;

SELECT 'Проверка доступности через REST API:' as info;
SELECT 'Лидерборд доступен по адресу: /rest/v1/employees_leaderboard' as endpoint;

COMMENT ON FUNCTION auto_refresh_leaderboard() IS 'Автоматическое обновление лидерборда при изменении данных'; 