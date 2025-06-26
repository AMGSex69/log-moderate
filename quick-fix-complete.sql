-- КОМПЛЕКСНОЕ БЫСТРОЕ ИСПРАВЛЕНИЕ ВСЕХ ПРОБЛЕМ
-- 1. Добавляем недостающую колонку is_online
-- 2. Исправляем имена пользователей
-- 3. Создаем профили для всех проблемных пользователей

-- ШАГ 1: Добавляем колонку is_online
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Устанавливаем значения по умолчанию
UPDATE public.user_profiles 
SET is_online = false 
WHERE is_online IS NULL;

-- ШАГ 2: Исправляем имена пользователей
-- Артём Устинов
UPDATE public.user_profiles 
SET full_name = 'Артём Устинов'
WHERE email LIKE 'ustinov.artemy%' OR full_name LIKE 'ustinov.artemy%';

-- Анна Корабельникова  
UPDATE public.user_profiles 
SET full_name = 'Анна Корабельникова'
WHERE email LIKE 'anuitakor%' OR full_name LIKE 'anuitakor%';

-- Таня
UPDATE public.user_profiles 
SET full_name = 'Татьяна'
WHERE id = 'ca465c0e-6317-4666-b277-b45f9cbeedae';

-- ШАГ 3: Создаем профили для всех пользователей без профилей
DO $$
DECLARE
    user_record RECORD;
    default_office_id INTEGER;
    user_name TEXT;
BEGIN
    -- Получаем офис по умолчанию
    SELECT id INTO default_office_id 
    FROM public.offices 
    WHERE name = 'Рассвет' 
    LIMIT 1;
    
    IF default_office_id IS NULL THEN
        SELECT id INTO default_office_id 
        FROM public.offices 
        ORDER BY id 
        LIMIT 1;
    END IF;
    
    -- Создаем офис если его нет
    IF default_office_id IS NULL THEN
        INSERT INTO public.offices (name, description)
        VALUES ('Рассвет', 'Основной офис')
        RETURNING id INTO default_office_id;
    END IF;
    
    -- Проходим по всем пользователям из auth.users без профилей
    FOR user_record IN 
        SELECT au.id, au.email
        FROM auth.users au
        LEFT JOIN public.user_profiles up ON up.id = au.id
        WHERE up.id IS NULL
    LOOP
        -- Создаем красивое имя
        user_name := CASE 
            WHEN user_record.email LIKE 'ustinov.artemy%' THEN 'Артём Устинов'
            WHEN user_record.email LIKE 'anuitakor%' THEN 'Анна Корабельникова'
            WHEN user_record.email LIKE 'egordolgih%' THEN 'Егор Долгих'
            ELSE INITCAP(REPLACE(SPLIT_PART(user_record.email, '@', 1), '.', ' '))
        END;
        
        -- Создаем профиль
        INSERT INTO public.user_profiles (
            id,
            email,
            full_name,
            position,
            work_schedule,
            work_hours,
            office_id,
            is_admin,
            role,
            admin_role,
            is_active,
            is_online,
            coins,
            experience,
            level,
            achievements,
            created_at,
            updated_at,
            last_activity
        ) VALUES (
            user_record.id,
            user_record.email,
            user_name,
            'Сотрудник',
            '5/2',
            9,
            default_office_id,
            false,
            'user',
            'user',
            true,
            false,
            0,
            0,
            1,
            '[]'::jsonb,
            NOW(),
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            is_online = false,
            updated_at = NOW();
            
        RAISE NOTICE 'Создан профиль для: % (%)', user_name, user_record.email;
    END LOOP;
END $$;

-- ШАГ 4: Проверяем результаты
SELECT 
    '✅ РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ' as status,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN is_online IS NOT NULL THEN 1 END) as profiles_with_is_online,
    COUNT(CASE WHEN full_name NOT LIKE '%.%' THEN 1 END) as profiles_with_nice_names
FROM public.user_profiles;

-- ШАГ 5: Показываем обновленные профили
SELECT 
    '🎯 ОБНОВЛЕННЫЕ ПРОФИЛИ' as info,
    id,
    email,
    full_name,
    is_online,
    created_at
FROM public.user_profiles 
ORDER BY created_at DESC
LIMIT 10;

-- ШАГ 6: Итоговое сообщение
SELECT 
    '🎉 ВСЕ ИСПРАВЛЕНИЯ ПРИМЕНЕНЫ!' as status,
    'Колонка is_online добавлена, имена исправлены, профили созданы' as message;

SELECT 
    '🔄 СЛЕДУЮЩИЕ ШАГИ:' as action,
    '1. Обновите страницу в браузере (F5)' as step1,
    '2. Очистите кеш браузера (Ctrl+Shift+Del)' as step2,
    '3. Попробуйте войти в систему снова' as step3; 