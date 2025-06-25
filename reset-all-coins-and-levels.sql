 -- Полный сброс всех монет и уровней у всех пользователей
-- Устанавливает всем пользователям 0 монет, 0 опыта и 1 уровень

BEGIN;

-- Сначала покажем текущее состояние
SELECT 
    'BEFORE RESET' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN coins > 0 THEN 1 END) as users_with_coins,
    SUM(COALESCE(coins, 0)) as total_coins,
    AVG(COALESCE(level, 1)) as avg_level,
    MAX(coins) as max_coins
FROM user_profiles;

-- Сбрасываем ВСЕ монеты и уровни у ВСЕХ пользователей
UPDATE user_profiles 
SET 
    coins = 0,
    experience = 0,
    level = 1,
    updated_at = NOW()
WHERE id IS NOT NULL;

-- Показываем результат после сброса
SELECT 
    'AFTER RESET' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN coins > 0 THEN 1 END) as users_with_coins,
    SUM(COALESCE(coins, 0)) as total_coins,
    AVG(COALESCE(level, 1)) as avg_level,
    MAX(coins) as max_coins
FROM user_profiles;

-- Показываем несколько пользователей для проверки
SELECT 
    'SAMPLE USERS AFTER RESET' as check_type,
    full_name,
    coins,
    level,
    experience,
    updated_at
FROM user_profiles 
WHERE employee_id IS NOT NULL
ORDER BY full_name
LIMIT 10;

COMMIT;

-- Финальное подтверждение
SELECT 
    COUNT(*) as total_users_reset,
    SUM(coins) as should_be_zero_coins,
    AVG(level) as should_be_one_level,
    'Все монеты и уровни сброшены до нуля' as message
FROM user_profiles;