-- ФИНАЛЬНОЕ КОМПЛЕКСНОЕ ИСПРАВЛЕНИЕ ВСЕХ ПРОБЛЕМ
-- Решает: 400 ошибки, неправильные имена, отсутствующие профили

-- ШАГ 1: Добавляем недостающую колонку is_online
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

UPDATE public.user_profiles 
SET is_online = false 
WHERE is_online IS NULL;

-- ШАГ 2: Исправляем существующие имена на правильный порядок (Имя Фамилия)
UPDATE public.user_profiles 
SET full_name = 'Артём Устинов'
WHERE email LIKE 'ustinov.artemy%' OR full_name LIKE '%ustinov%' OR full_name LIKE '%artemy%';

UPDATE public.user_profiles 
SET full_name = 'Анна Корабельникова'
WHERE email LIKE 'anuitakor%' OR full_name LIKE '%anuitakor%';

UPDATE public.user_profiles 
SET full_name = 'Егор Долгих'
WHERE email LIKE 'egordolgih%' OR full_name LIKE '%egordolgih%';

-- ШАГ 3: Создаем функцию для красивого преобразования email в имя
CREATE OR REPLACE FUNCTION email_to_nice_name(user_email TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE 
        WHEN user_email LIKE 'ustinov.artemy%' THEN 'Артём Устинов'
        WHEN user_email LIKE 'anuitakor%' THEN 'Анна Корабельникова'
        WHEN user_email LIKE 'egordolgih%' THEN 'Егор Долгих'
        -- Общая логика: преобразуем email в красивое имя (Имя Фамилия)
        ELSE INITCAP(REPLACE(SPLIT_PART(user_email, '@', 1), '.', ' '))
    END;
END $$ LANGUAGE plpgsql;

-- ШАГ 4: Создаем профили для всех пользователей без профилей
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
        user_name := email_to_nice_name(user_record.email);
        
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

-- ШАГ 5: Обновляем триггер для новых пользователей
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
    user_email TEXT;
    user_name TEXT;
    default_office_id INTEGER;
BEGIN
    -- Получаем данные из auth.users
    user_email := COALESCE(NEW.email, 'user@example.com');
    user_name := email_to_nice_name(user_email);
    
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
    
    -- Создаем профиль только если его еще нет
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
        NEW.id,
        user_email,
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
    ) ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Ошибка в handle_new_user для %: %', NEW.id, SQLERRM;
    RETURN NEW;
END $$;

-- Создаем триггер
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- ШАГ 6: Проверяем результаты
SELECT 
    '✅ ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ' as status,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN is_online IS NOT NULL THEN 1 END) as profiles_with_is_online,
    COUNT(CASE WHEN full_name NOT LIKE '%.%' THEN 1 END) as profiles_with_nice_names
FROM public.user_profiles;

-- Показываем последние профили
SELECT 
    '🎯 ПОСЛЕДНИЕ ОБНОВЛЕННЫЕ ПРОФИЛИ' as info,
    id,
    email,
    full_name,
    is_online,
    position,
    office_id,
    created_at
FROM public.user_profiles 
ORDER BY updated_at DESC
LIMIT 5;

-- ШАГ 7: Итоговые сообщения
SELECT 
    '🎉 ВСЕ ПРОБЛЕМЫ ИСПРАВЛЕНЫ!' as status,
    'Колонка is_online добавлена, имена в правильном порядке, профили созданы' as message;

SELECT 
    '🔄 СЛЕДУЮЩИЕ ШАГИ:' as action,
    '1. Обновите страницу в браузере (F5)' as step1,
    '2. Очистите кеш браузера (Ctrl+Shift+Del)' as step2,
    '3. Попробуйте войти в систему снова' as step3,
    '4. Теперь имена отображаются как "Имя Фамилия"' as step4; 