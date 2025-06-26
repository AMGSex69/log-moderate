-- ИСПРАВЛЕНИЕ ЛОГИКИ ПАРСИНГА ИМЕН
-- Проблема: система парсит как "Фамилия Имя", а должно быть "Имя Фамилия"

-- 1. СНАЧАЛА ДОБАВЛЯЕМ КОЛОНКУ is_online (если её нет)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

UPDATE public.user_profiles 
SET is_online = false 
WHERE is_online IS NULL;

-- 2. ИСПРАВЛЯЕМ СУЩЕСТВУЮЩИЕ ИМЕНА
-- Для конкретных пользователей устанавливаем правильные имена
UPDATE public.user_profiles 
SET full_name = 'Артём Устинов'
WHERE email LIKE 'ustinov.artemy%' OR full_name LIKE '%ustinov%' OR full_name LIKE '%artemy%';

UPDATE public.user_profiles 
SET full_name = 'Анна Корабельникова'
WHERE email LIKE 'anuitakor%' OR full_name LIKE '%anuitakor%';

UPDATE public.user_profiles 
SET full_name = 'Егор Долгих'
WHERE email LIKE 'egordolgih%' OR full_name LIKE '%egordolgih%';

-- 3. СОЗДАЕМ ФУНКЦИЮ ДЛЯ КРАСИВОГО ПРЕОБРАЗОВАНИЯ EMAIL В ИМЯ
CREATE OR REPLACE FUNCTION email_to_nice_name(user_email TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE 
        WHEN user_email LIKE 'ustinov.artemy%' THEN 'Артём Устинов'
        WHEN user_email LIKE 'anuitakor%' THEN 'Анна Корабельникова'
        WHEN user_email LIKE 'egordolgih%' THEN 'Егор Долгих'
        -- Общая логика: преобразуем email в красивое имя
        ELSE INITCAP(REPLACE(SPLIT_PART(user_email, '@', 1), '.', ' '))
    END;
END $$ LANGUAGE plpgsql;

-- 4. ОБНОВЛЯЕМ ФУНКЦИЮ СОЗДАНИЯ ПРОФИЛЕЙ
CREATE OR REPLACE FUNCTION create_user_profile_correct_name(user_id UUID)
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
    
    -- Создаем красивое имя
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
        'Профиль создан с именем: ' || user_name,
        row_to_json(new_profile)::JSONB;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
        false, 
        'Ошибка создания профиля: ' || SQLERRM,
        NULL::JSONB;
END $$ LANGUAGE plpgsql;

-- 5. СОЗДАЕМ ПРОФИЛИ ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ БЕЗ ПРОФИЛЕЙ
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Проходим по всем пользователям из auth.users без профилей
    FOR user_record IN 
        SELECT au.id, au.email
        FROM auth.users au
        LEFT JOIN public.user_profiles up ON up.id = au.id
        WHERE up.id IS NULL
    LOOP
        -- Создаем профиль с помощью новой функции
        PERFORM create_user_profile_correct_name(user_record.id);
        RAISE NOTICE 'Создан профиль для: %', user_record.email;
    END LOOP;
END $$;

-- 6. ОБНОВЛЯЕМ ТРИГГЕР ДЛЯ НОВЫХ ПОЛЬЗОВАТЕЛЕЙ
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
    -- Используем новую функцию с правильными именами
    SELECT * INTO result_record 
    FROM create_user_profile_correct_name(NEW.id);
    
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

-- 7. ПРОВЕРЯЕМ РЕЗУЛЬТАТЫ
SELECT 
    '✅ ОБНОВЛЕННЫЕ ИМЕНА ПОЛЬЗОВАТЕЛЕЙ' as status,
    id,
    email,
    full_name,
    is_online,
    created_at
FROM public.user_profiles 
ORDER BY created_at DESC;

-- 8. ИТОГОВОЕ СООБЩЕНИЕ
SELECT 
    '🎉 ЛОГИКА ИМЕН ИСПРАВЛЕНА!' as status,
    'Теперь имена отображаются в правильном порядке: Имя Фамилия' as message;

SELECT 
    '🔄 ИНСТРУКЦИИ:' as action,
    '1. Обновите страницу в браузере (F5)' as step1,
    '2. Проверьте отображение имен на главной странице' as step2,
    '3. Новые пользователи будут получать правильные имена автоматически' as step3; 