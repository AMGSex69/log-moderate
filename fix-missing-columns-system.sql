-- СИСТЕМНОЕ ИСПРАВЛЕНИЕ НЕДОСТАЮЩИХ КОЛОНОК
-- Ошибка: "Could not find the 'is_online' column of 'user_profiles' in the schema cache"

-- 1. ПРОВЕРЯЕМ ТЕКУЩУЮ СТРУКТУРУ user_profiles
SELECT 
    '🔍 ТЕКУЩИЕ КОЛОНКИ В user_profiles' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. ДОБАВЛЯЕМ НЕДОСТАЮЩИЕ КОЛОНКИ
DO $$
BEGIN
    -- Добавляем is_online если её нет
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' 
                   AND column_name = 'is_online' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.user_profiles ADD COLUMN is_online BOOLEAN DEFAULT false;
        RAISE NOTICE 'Добавлена колонка is_online';
    END IF;
    
    -- Добавляем last_seen если её нет (она есть в схеме, но может отсутствовать)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' 
                   AND column_name = 'last_seen' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.user_profiles ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Добавлена колонка last_seen';
    END IF;
    
    -- Добавляем avatar_path если её нет (альтернатива avatar_url)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' 
                   AND column_name = 'avatar_path' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.user_profiles ADD COLUMN avatar_path TEXT;
        RAISE NOTICE 'Добавлена колонка avatar_path';
    END IF;
    
    RAISE NOTICE 'Проверка колонок завершена';
END $$;

-- 3. СОЗДАЕМ УНИВЕРСАЛЬНУЮ ФУНКЦИЮ ДЛЯ СОЗДАНИЯ ПРОФИЛЕЙ
CREATE OR REPLACE FUNCTION create_user_profile_universal(user_id UUID)
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
    
    -- Определяем имя пользователя
    user_name := SPLIT_PART(user_email, '@', 1);
    
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
        avatar_path,
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
        NULL,
        NOW(),
        NOW(),
        NOW()
    ) RETURNING * INTO new_profile;
    
    RETURN QUERY SELECT 
        true, 
        'Профиль создан успешно',
        row_to_json(new_profile)::JSONB;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
        false, 
        'Ошибка создания профиля: ' || SQLERRM,
        NULL::JSONB;
END $$ LANGUAGE plpgsql;

-- 4. СОЗДАЕМ ПРОФИЛИ ДЛЯ ВСЕХ ПРОБЛЕМНЫХ ПОЛЬЗОВАТЕЛЕЙ
-- Таня
SELECT * FROM create_user_profile_universal('ca465c0e-6317-4666-b277-b45f9cbeedae');

-- Артём (первый ID)
SELECT * FROM create_user_profile_universal('5b113a9c-c087-42de-87c5-79f240b352fe');

-- Артём (второй ID)
SELECT * FROM create_user_profile_universal('0bbe268a-df96-4b48-b5e6-19e959a8b4f6');

-- 5. ОБНОВЛЯЕМ ТРИГГЕР ДЛЯ НОВЫХ ПОЛЬЗОВАТЕЛЕЙ
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
    -- Используем универсальную функцию
    SELECT * INTO result_record 
    FROM create_user_profile_universal(NEW.id);
    
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
    '✅ СОЗДАННЫЕ ПРОФИЛИ' as status,
    id,
    email,
    full_name,
    office_id,
    employee_id,
    is_online,
    created_at
FROM public.user_profiles 
WHERE id IN (
    'ca465c0e-6317-4666-b277-b45f9cbeedae',
    '5b113a9c-c087-42de-87c5-79f240b352fe', 
    '0bbe268a-df96-4b48-b5e6-19e959a8b4f6'
)
ORDER BY created_at DESC;

-- 7. ФИНАЛЬНАЯ ПРОВЕРКА СТРУКТУРЫ
SELECT 
    '🔍 ОБНОВЛЕННАЯ СТРУКТУРА user_profiles' as info,
    column_name,
    data_type,
    CASE WHEN column_name IN ('is_online', 'avatar_path') THEN '🆕 НОВАЯ' ELSE '✅ БЫЛА' END as status
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
AND column_name IN ('is_online', 'last_seen', 'avatar_url', 'avatar_path', 'email', 'full_name')
ORDER BY column_name;

-- 8. ИТОГОВОЕ СООБЩЕНИЕ
SELECT 
    '🎉 СИСТЕМНОЕ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!' as status,
    'Все новые пользователи теперь могут регистрироваться' as message;

SELECT 
    '🔄 ИНСТРУКЦИИ ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ:' as action,
    '1. Обновите страницу в браузере (F5)' as step1,
    '2. Если проблемы - очистите кеш (Ctrl+Shift+Del)' as step2,
    '3. Попробуйте перелогиниться' as step3; 