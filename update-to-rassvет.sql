-- ОБНОВЛЕНИЕ ПРОФИЛЯ НА РАССВЕТ

-- 1. Текущие данные
SELECT 'ДО ОБНОВЛЕНИЯ:' as info;
SELECT id, full_name, office_id, office_name, position
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 2. Обновляем на офис Рассвет
UPDATE user_profiles 
SET 
    office_id = 1,
    office_name = 'Рассвет',
    updated_at = NOW()
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 3. Проверяем результат
SELECT 'ПОСЛЕ ОБНОВЛЕНИЯ:' as info;
SELECT id, full_name, office_id, office_name, position
FROM user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 4. Проверяем всех в офисе Рассвет
SELECT 'ВСЕ В ОФИСЕ РАССВЕТ:' as info;
SELECT id, full_name, office_id, office_name
FROM user_profiles 
WHERE office_id = 1
ORDER BY full_name; 