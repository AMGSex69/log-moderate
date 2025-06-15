-- ПРОВЕРКА ОФИСОВ И ИСПРАВЛЕНИЕ
-- Выполняйте по блокам

-- 1. Все офисы
SELECT 'ВСЕ ОФИСЫ:' as info;
SELECT id, name FROM offices ORDER BY id;

-- 2. Текущие данные пользователя
SELECT 'ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:' as info;
SELECT 
    up.id,
    up.user_id,
    up.full_name,
    up.email,
    up.office_id,
    o.name as office_name
FROM user_profiles up
LEFT JOIN offices o ON up.office_id = o.id
WHERE up.email = 'egordolgih@mail.ru';

-- 3. ИСПРАВЛЕНИЕ: Обновляем office_id для офиса "Тульская"
-- (Выполните этот блок ПОСЛЕ того, как увидите ID офиса "Тульская" в первом запросе)

DO $$
DECLARE
    tulskaya_office_id INTEGER;
    user_uuid UUID := 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';
BEGIN
    -- Находим ID офиса "Тульская"
    SELECT id INTO tulskaya_office_id
    FROM offices
    WHERE name = 'Тульская';
    
    IF tulskaya_office_id IS NULL THEN
        RAISE NOTICE 'Офис "Тульская" не найден!';
        
        -- Показываем все доступные офисы
        RAISE NOTICE 'Доступные офисы:';
        FOR rec IN SELECT id, name FROM offices ORDER BY id LOOP
            RAISE NOTICE 'ID: %, NAME: %', rec.id, rec.name;
        END LOOP;
        
        RETURN;
    END IF;
    
    RAISE NOTICE 'Найден офис "Тульская" с ID: %', tulskaya_office_id;
    
    -- Обновляем office_id пользователя
    UPDATE user_profiles 
    SET office_id = tulskaya_office_id,
        updated_at = NOW()
    WHERE user_id = user_uuid;
    
    RAISE NOTICE 'Обновлен office_id для пользователя egordolgih@mail.ru';
    
    -- Проверяем результат
    SELECT 
        up.full_name,
        up.email,
        up.office_id,
        o.name as office_name
    FROM user_profiles up
    LEFT JOIN offices o ON up.office_id = o.id
    WHERE up.user_id = user_uuid;
    
END $$;

-- 4. ПРОВЕРКА РЕЗУЛЬТАТА
SELECT 'РЕЗУЛЬТАТ ПОСЛЕ ОБНОВЛЕНИЯ:' as info;
SELECT 
    up.id,
    up.user_id,
    up.full_name,
    up.email,
    up.office_id,
    o.name as office_name,
    up.updated_at
FROM user_profiles up
LEFT JOIN offices o ON up.office_id = o.id
WHERE up.email = 'egordolgih@mail.ru'; 