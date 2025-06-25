-- Обнуление монет и опыта у всех пользователей
-- Сброс к начальному состоянию

BEGIN;

-- Обнуляем монеты и опыт в таблице user_profiles
UPDATE user_profiles 
SET 
    coins = 0,
    experience = 0,
    level = 1
WHERE employee_id IS NOT NULL;

-- Проверяем результат
SELECT 
    id,
    full_name,
    coins,
    experience,
    level,
    office_id
FROM user_profiles 
WHERE employee_id IS NOT NULL
ORDER BY full_name;

COMMIT;

-- Информация о выполненной операции
SELECT 
    COUNT(*) as total_users_reset,
    'Монеты и опыт обнулены для всех пользователей' as message
FROM user_profiles 
WHERE employee_id IS NOT NULL; 