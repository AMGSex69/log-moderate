-- ИСПРАВЛЕНИЕ: Сохранение офиса и графика работы при регистрации
-- Выполните этот SQL в Supabase Dashboard -> SQL Editor

-- Обновляем функцию handle_new_user для чтения данных из user_metadata
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
    user_email TEXT;
    user_name TEXT;
    user_work_schedule TEXT;
    user_office_id INTEGER;
    default_office_id INTEGER;
    work_hours_value INTEGER;
BEGIN
    -- Получаем данные из auth.users
    user_email := COALESCE(NEW.email, 'user@example.com');
    
    -- Получаем данные из user_metadata (то что передается из формы регистрации)
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        email_to_nice_name(user_email)
    );
    
    user_work_schedule := COALESCE(
        NEW.raw_user_meta_data->>'work_schedule',
        '5/2'
    );
    
    -- Получаем office_id из metadata
    user_office_id := CASE 
        WHEN NEW.raw_user_meta_data->>'office_id' IS NOT NULL 
        THEN (NEW.raw_user_meta_data->>'office_id')::INTEGER
        ELSE NULL
    END;
    
    -- Если office_id не указан в metadata, используем офис по умолчанию
    IF user_office_id IS NULL THEN
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
        
        user_office_id := default_office_id;
    END IF;
    
    -- Определяем количество рабочих часов на основе графика
    work_hours_value := CASE 
        WHEN user_work_schedule = '2/2' THEN 12
        WHEN user_work_schedule = '5/2' THEN 9
        ELSE 9
    END;
    
    RAISE LOG 'handle_new_user: Создаем профиль для % с графиком % и офисом %', 
        user_name, user_work_schedule, user_office_id;
    
    -- Создаем профиль с данными из регистрации
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
        user_work_schedule,  -- ✅ Используем выбранный график из формы
        work_hours_value,    -- ✅ Соответствующие часы
        user_office_id,      -- ✅ Используем выбранный офис из формы
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
        work_schedule = EXCLUDED.work_schedule,
        work_hours = EXCLUDED.work_hours,
        office_id = EXCLUDED.office_id,
        updated_at = NOW();
    
    RAISE LOG 'handle_new_user: Успешно создан профиль для % в офисе % с графиком %', 
        user_name, user_office_id, user_work_schedule;
    
    RETURN NEW;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Ошибка в handle_new_user для %: %', NEW.id, SQLERRM;
    RETURN NEW;
END $$;

-- Пересоздаем триггер
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- Проверяем что функция создана
SELECT 
    'Функция handle_new_user обновлена' as status,
    'Теперь при регистрации будут сохраняться офис и график из формы' as message;

-- Показываем текущее распределение пользователей
SELECT 
    'Текущие пользователи:' as info,
    up.full_name,
    up.work_schedule,
    up.work_hours,
    o.name as office_name
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
ORDER BY up.full_name; 