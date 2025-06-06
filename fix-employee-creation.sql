-- ===========================================
-- ИСПРАВЛЕНИЕ ФУНКЦИИ get_or_create_employee_id
-- ===========================================

-- 1. УДАЛЯЕМ СТАРУЮ ФУНКЦИЮ
DROP FUNCTION IF EXISTS public.get_or_create_employee_id(UUID) CASCADE;

-- 2. СОЗДАЕМ НОВУЮ ФУНКЦИЮ ДЛЯ КОРРЕКТНОГО СОЗДАНИЯ EMPLOYEE
CREATE OR REPLACE FUNCTION public.get_or_create_employee_id(user_id UUID)
RETURNS TABLE (employee_id INTEGER, error_message TEXT)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
    found_employee_id INTEGER;
    user_name TEXT;
    user_email TEXT;
    default_office_id INTEGER;
BEGIN
    -- Проверяем существующего employee
    SELECT id INTO found_employee_id
    FROM public.employees
    WHERE employees.user_id = get_or_create_employee_id.user_id;
    
    IF found_employee_id IS NOT NULL THEN
        RETURN QUERY SELECT found_employee_id, NULL::TEXT;
        RETURN;
    END IF;
    
    -- Получаем данные пользователя из auth.users (всегда доступно)
    SELECT 
        COALESCE(au.email, 'user@example.com'),
        COALESCE(
            up.full_name,                                    -- Сначала из user_profiles
            au.raw_user_meta_data->>'full_name',            -- Потом из метаданных
            SPLIT_PART(au.email, '@', 1),                   -- Потом из email
            'Новый пользователь'                            -- Fallback
        )
    INTO user_email, user_name
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON up.id = au.id
    WHERE au.id = get_or_create_employee_id.user_id;
    
    -- Если пользователь не найден в auth.users, выходим с ошибкой
    IF user_email IS NULL THEN
        RETURN QUERY SELECT NULL::INTEGER, 'Пользователь не найден в auth.users'::TEXT;
        RETURN;
    END IF;
    
    -- Получаем ID офиса "Рассвет" как дефолтный
    SELECT id INTO default_office_id FROM public.offices WHERE name = 'Рассвет' LIMIT 1;
    IF default_office_id IS NULL THEN
        default_office_id := 1; -- Fallback на первый офис
    END IF;
    
    -- Создаем/обновляем профиль пользователя если его нет
    INSERT INTO public.user_profiles (
        id, 
        full_name, 
        position,
        is_admin,
        office_id,
        created_at,
        updated_at
    ) VALUES (
        get_or_create_employee_id.user_id,
        user_name,
        'Сотрудник',
        false,
        default_office_id,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(user_profiles.full_name, EXCLUDED.full_name),
        office_id = COALESCE(user_profiles.office_id, EXCLUDED.office_id),
        updated_at = NOW();
    
    -- Создаем нового employee
    INSERT INTO public.employees (
        user_id, 
        full_name, 
        position, 
        office_id,
        created_at,
        updated_at
    )
    VALUES (
        get_or_create_employee_id.user_id,
        user_name,
        'Сотрудник',
        default_office_id,
        NOW(),
        NOW()
    )
    RETURNING id INTO found_employee_id;
    
    RETURN QUERY SELECT found_employee_id, NULL::TEXT;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::INTEGER, ('Ошибка создания employee: ' || SQLERRM)::TEXT;
END $$;

-- 3. ОБНОВЛЯЕМ ФУНКЦИЮ handle_new_user ДЛЯ БОЛЕЕ НАДЕЖНОГО СОЗДАНИЯ ПРОФИЛЕЙ
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
    -- Получаем данные пользователя
    user_email := COALESCE(NEW.email, 'user@example.com');
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        SPLIT_PART(user_email, '@', 1),
        'Новый пользователь'
    );
    
    -- Получаем ID офиса "Рассвет"
    SELECT id INTO default_office_id FROM public.offices WHERE name = 'Рассвет' LIMIT 1;
    IF default_office_id IS NULL THEN
        default_office_id := 1;
    END IF;
    
    -- Создаем профиль пользователя
    INSERT INTO public.user_profiles (
        id, 
        full_name, 
        position,
        is_admin,
        office_id,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        user_name,
        'Сотрудник',
        false,
        default_office_id,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(user_profiles.full_name, EXCLUDED.full_name),
        office_id = COALESCE(user_profiles.office_id, EXCLUDED.office_id),
        updated_at = NOW();
    
    -- Создаем employee запись (только если не существует)
    IF NOT EXISTS (SELECT 1 FROM public.employees WHERE user_id = NEW.id) THEN
        INSERT INTO public.employees (
            user_id,
            full_name,
            position,
            office_id,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            user_name,
            'Сотрудник',
            default_office_id,
            NOW(),
            NOW()
        );
    ELSE
        -- Обновляем существующую запись
        UPDATE public.employees SET
            full_name = COALESCE(employees.full_name, user_name),
            office_id = COALESCE(employees.office_id, default_office_id),
            updated_at = NOW()
        WHERE user_id = NEW.id;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Логируем ошибку, но не блокируем регистрацию
    RAISE WARNING 'Ошибка создания профиля для пользователя %: %', NEW.id, SQLERRM;
    RETURN NEW;
END $$;

-- 4. ПЕРЕСОЗДАЕМ ТРИГГЕР
DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. ДАЕМ ПРАВА НА ВЫПОЛНЕНИЕ
GRANT EXECUTE ON FUNCTION public.get_or_create_employee_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_employee_id(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;

-- 6. ИСПРАВЛЯЕМ СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ БЕЗ ПРОФИЛЕЙ
DO $$
DECLARE
    user_record RECORD;
    default_office_id INTEGER;
BEGIN
    -- Получаем ID офиса "Рассвет"
    SELECT id INTO default_office_id FROM public.offices WHERE name = 'Рассвет' LIMIT 1;
    IF default_office_id IS NULL THEN
        default_office_id := 1;
    END IF;
    
    -- Проходим по всем пользователям без профилей
    FOR user_record IN 
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        LEFT JOIN public.user_profiles up ON up.id = au.id
        WHERE up.id IS NULL
    LOOP
        -- Создаем профиль
        INSERT INTO public.user_profiles (
            id, 
            full_name, 
            position,
            is_admin,
            office_id,
            created_at,
            updated_at
        ) VALUES (
            user_record.id,
            COALESCE(
                user_record.raw_user_meta_data->>'full_name',
                user_record.raw_user_meta_data->>'name',
                SPLIT_PART(user_record.email, '@', 1),
                'Пользователь'
            ),
            'Сотрудник',
            false,
            default_office_id,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO NOTHING;
        
        -- Создаем employee (только если не существует)
        IF NOT EXISTS (SELECT 1 FROM public.employees WHERE user_id = user_record.id) THEN
            INSERT INTO public.employees (
                user_id,
                full_name,
                position,
                office_id,
                created_at,
                updated_at
            ) VALUES (
                user_record.id,
                COALESCE(
                    user_record.raw_user_meta_data->>'full_name',
                    user_record.raw_user_meta_data->>'name',
                    SPLIT_PART(user_record.email, '@', 1),
                    'Пользователь'
                ),
                'Сотрудник',
                default_office_id,
                NOW(),
                NOW()
            );
        END IF;
        
    END LOOP;
    
    RAISE NOTICE 'Исправлены профили для существующих пользователей';
END $$;

-- 7. ФИНАЛЬНАЯ ПРОВЕРКА
SELECT 
    'ПРОВЕРКА ПОСЛЕ ИСПРАВЛЕНИЯ' as info,
    COUNT(au.id) as total_auth_users,
    COUNT(up.id) as users_with_profiles,
    COUNT(e.id) as users_with_employees
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id  
LEFT JOIN public.employees e ON e.user_id = au.id; 