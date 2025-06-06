-- ===========================================
-- ИСПРАВЛЕНИЕ ИМЕНИ ПАРАМЕТРА ФУНКЦИИ
-- ===========================================

-- 1. УДАЛЯЕМ СТАРУЮ ФУНКЦИЮ
DROP FUNCTION IF EXISTS public.get_or_create_employee_id(UUID) CASCADE;

-- 2. СОЗДАЕМ ФУНКЦИЮ С ПРАВИЛЬНЫМ ИМЕНЕМ ПАРАМЕТРА
CREATE OR REPLACE FUNCTION public.get_or_create_employee_id(user_uuid UUID)
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
    WHERE employees.user_id = user_uuid;
    
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
    WHERE au.id = user_uuid;
    
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
        user_uuid,
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
        user_uuid,
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

-- 3. ДАЕМ ПРАВА НА ВЫПОЛНЕНИЕ
GRANT EXECUTE ON FUNCTION public.get_or_create_employee_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_employee_id(UUID) TO anon;

-- 4. ПРОВЕРЯЕМ СОЗДАНИЕ ФУНКЦИИ
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_or_create_employee_id') THEN
        RAISE NOTICE '✅ Функция get_or_create_employee_id(user_uuid) создана успешно';
    ELSE
        RAISE NOTICE '❌ Функция get_or_create_employee_id НЕ создана';
    END IF;
END $$; 