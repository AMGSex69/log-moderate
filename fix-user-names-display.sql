-- ИСПРАВЛЕНИЕ ОТОБРАЖЕНИЯ ИМЕН ПОЛЬЗОВАТЕЛЕЙ
-- Проблема: имена отображаются как "ustinov.artemy" вместо нормальных имен

-- 1. ПРОВЕРЯЕМ ТЕКУЩИЕ ИМЕНА
SELECT 
    '🔍 ТЕКУЩИЕ ИМЕНА ПОЛЬЗОВАТЕЛЕЙ' as info,
    id,
    email,
    full_name,
    created_at
FROM public.user_profiles 
ORDER BY created_at DESC;

-- 2. ИСПРАВЛЯЕМ ИМЕНА ДЛЯ КОНКРЕТНЫХ ПОЛЬЗОВАТЕЛЕЙ
-- Артём Устинов
UPDATE public.user_profiles 
SET full_name = 'Артём Устинов'
WHERE email LIKE 'ustinov.artemy%' OR full_name LIKE 'ustinov.artemy%';

-- Анна Корабельникова  
UPDATE public.user_profiles 
SET full_name = 'Анна Корабельникова'
WHERE email LIKE 'anuitakor%' OR full_name LIKE 'anuitakor%';

-- Таня (если есть)
UPDATE public.user_profiles 
SET full_name = 'Татьяна'
WHERE id = 'ca465c0e-6317-4666-b277-b45f9cbeedae';

-- 3. АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ С ИМЕНАМИ ТИПА EMAIL
UPDATE public.user_profiles 
SET full_name = CASE 
    -- Если имя содержит точку, то это скорее всего email-формат
    WHEN full_name LIKE '%.%' AND full_name NOT LIKE '% %' THEN
        -- Пытаемся красиво преобразовать
        CASE 
            WHEN full_name LIKE 'ustinov.artemy%' THEN 'Артём Устинов'
            WHEN full_name LIKE 'anuitakor%' THEN 'Анна Корабельникова'
            ELSE INITCAP(REPLACE(full_name, '.', ' '))
        END
    ELSE full_name
END
WHERE full_name LIKE '%.%' AND full_name NOT LIKE '% %';

-- 4. ОБНОВЛЯЕМ ФУНКЦИЮ СОЗДАНИЯ ПРОФИЛЕЙ ДЛЯ БУДУЩИХ ПОЛЬЗОВАТЕЛЕЙ
CREATE OR REPLACE FUNCTION create_user_profile_with_proper_name(user_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT, profile_data JSONB) AS $$
DECLARE
    user_email TEXT;
    user_name TEXT;
    default_office_id INTEGER;
    new_profile RECORD;
BEGIN
    -- Проверяем существует ли уже профиль
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = user_id) THEN
        RETURN QUERY SELECT false, 'Профиль уже существует', NULL::JSONB;
        RETURN;
    END IF;
    
    -- Получаем данные из auth.users
    SELECT email INTO user_email
    FROM auth.users 
    WHERE id = user_id;
    
    IF user_email IS NULL THEN
        RETURN QUERY SELECT false, 'Пользователь не найден в auth.users', NULL::JSONB;
        RETURN;
    END IF;
    
    -- Создаем красивое имя из email
    user_name := CASE 
        WHEN user_email LIKE 'ustinov.artemy%' THEN 'Артём Устинов'
        WHEN user_email LIKE 'anuitakor%' THEN 'Анна Корабельникова'
        WHEN user_email LIKE 'egordolgih%' THEN 'Егор Долгих'
        ELSE 
            -- Общая логика: берем часть до @, заменяем точки на пробелы, делаем заглавными
            INITCAP(REPLACE(SPLIT_PART(user_email, '@', 1), '.', ' '))
    END;
    
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
    
    -- Создаем профиль со ВСЕМИ необходимыми колонками
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
        last_seen,
        coins,
        experience,
        level,
        achievements,
        avatar_url,
        created_at,
        updated_at,
        last_activity
    ) VALUES (
        user_id,
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
        NOW(),
        0,
        0,
        1,
        '[]'::jsonb,
        NULL,
        NOW(),
        NOW(),
        NOW()
    ) RETURNING * INTO new_profile;
    
    RETURN QUERY SELECT 
        true, 
        'Профиль создан с красивым именем: ' || user_name,
        row_to_json(new_profile)::JSONB;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
        false, 
        'Ошибка создания профиля: ' || SQLERRM,
        NULL::JSONB;
END $$ LANGUAGE plpgsql;

-- 5. ОБНОВЛЯЕМ ТРИГГЕР
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
    result_record RECORD;
BEGIN
    -- Используем новую функцию с красивыми именами
    SELECT * INTO result_record 
    FROM create_user_profile_with_proper_name(NEW.id);
    
    IF result_record.success THEN
        RAISE LOG 'Профиль создан для пользователя %: %', NEW.id, result_record.message;
    ELSE
        RAISE WARNING 'Ошибка создания профиля для %: %', NEW.id, result_record.message;
    END IF;
    
    RETURN NEW;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Критическая ошибка в handle_new_user для %: %', NEW.id, SQLERRM;
    RETURN NEW;
END $$;

-- Создаем триггер
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- 6. ПРОВЕРЯЕМ РЕЗУЛЬТАТЫ
SELECT 
    '✅ ОБНОВЛЕННЫЕ ИМЕНА' as status,
    id,
    email,
    full_name,
    position,
    office_id,
    created_at
FROM public.user_profiles 
ORDER BY created_at DESC;

-- 7. ИТОГОВОЕ СООБЩЕНИЕ
SELECT 
    '🎉 ИМЕНА ИСПРАВЛЕНЫ!' as status,
    'Теперь пользователи видят красивые имена вместо email-адресов' as message;

SELECT 
    '🔄 ИНСТРУКЦИИ:' as action,
    '1. Обновите страницу в браузере (F5)' as step1,
    '2. Проверьте отображение имен на главной странице' as step2,
    '3. Если нужно - исправьте имена вручную в профиле' as step3; 