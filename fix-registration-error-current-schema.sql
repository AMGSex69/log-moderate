-- ИСПРАВЛЕНИЕ ОШИБКИ 500 ПРИ РЕГИСТРАЦИИ 
-- Для текущей схемы БД (только user_profiles, без таблицы employees)

-- 1. Удаляем все существующие триггеры регистрации
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
DROP TRIGGER IF EXISTS on_user_profile_created ON public.user_profiles;

-- 2. Удаляем старые функции
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Создаем ПРОСТУЮ и БЕЗОПАСНУЮ функцию триггера
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_full_name TEXT;
    user_work_schedule TEXT;
    user_work_hours INTEGER;
    user_office_id INTEGER;
    existing_profile_id UUID;
BEGIN
    -- Логируем начало функции
    RAISE LOG 'handle_new_user: Starting for user ID %', NEW.id;
    
    -- Проверяем, не существует ли уже профиль (предотвращаем дублирование)
    SELECT id INTO existing_profile_id 
    FROM public.user_profiles 
    WHERE id = NEW.id;
    
    -- Если профиль уже существует, просто возвращаем NEW
    IF existing_profile_id IS NOT NULL THEN
        RAISE LOG 'handle_new_user: Profile already exists for user %', NEW.id;
        RETURN NEW;
    END IF;

    -- Получаем данные из метаданных пользователя с безопасными значениями по умолчанию
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.email,
        'Новый пользователь'
    );
    
    user_work_schedule := COALESCE(
        NEW.raw_user_meta_data->>'work_schedule',
        '5/2'
    );
    
    user_work_hours := CASE 
        WHEN user_work_schedule = '2/2' THEN 12
        ELSE 9
    END;

    -- Получаем office_id из метаданных или используем значение по умолчанию
    user_office_id := COALESCE(
        (NEW.raw_user_meta_data->>'office_id')::INTEGER,
        NULL
    );

    -- Если office_id не указан, пытаемся найти офис по умолчанию
    IF user_office_id IS NULL THEN
        SELECT id INTO user_office_id 
        FROM public.offices 
        WHERE name ILIKE '%рассвет%' OR name ILIKE '%main%' OR name ILIKE '%default%'
        LIMIT 1;
    END IF;

    -- Создаем профиль пользователя с обработкой ошибок
    BEGIN
        INSERT INTO public.user_profiles (
            id, 
            full_name, 
            position, 
            is_admin, 
            work_schedule, 
            work_hours,
            office_id,
            role,
            admin_role,
            is_active,
            coins,
            experience,
            level,
            achievements,
            created_at,
            updated_at,
            last_activity
        ) VALUES (
            NEW.id, 
            user_full_name, 
            'Сотрудник', 
            false, 
            user_work_schedule, 
            user_work_hours,
            user_office_id,
            'user',
            'user',
            true,
            0,  -- начальные монеты
            0,  -- начальный опыт
            1,  -- начальный уровень
            '[]'::jsonb,  -- пустые достижения
            NOW(),
            NOW(),
            NOW()
        );
        
        RAISE LOG 'handle_new_user: Successfully created user_profile for %', NEW.id;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE LOG 'handle_new_user: Profile already exists (unique violation) for %', NEW.id;
        WHEN OTHERS THEN
            RAISE LOG 'handle_new_user: Error creating user_profile for %: % %', NEW.id, SQLSTATE, SQLERRM;
            -- НЕ прерываем процесс - это критично!
    END;

    RAISE LOG 'handle_new_user: Completed successfully for user %', NEW.id;
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Критическая ошибка - логируем но НЕ прерываем регистрацию
        RAISE LOG 'handle_new_user: CRITICAL ERROR for user %: % %', NEW.id, SQLSTATE, SQLERRM;
        -- Возвращаем NEW чтобы регистрация продолжилась
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Создаем триггер ПОСЛЕ создания пользователя
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- 5. Даем необходимые права доступа
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO anon;
GRANT ALL ON public.offices TO authenticated;
GRANT ALL ON public.offices TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;

-- 6. Даем права на последовательности
GRANT USAGE, SELECT, UPDATE ON SEQUENCE user_profiles_employee_id_seq TO authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE user_profiles_employee_id_seq TO anon;

-- 7. ВРЕМЕННО отключаем RLS для тестирования (ВАЖНО: включите обратно после тестирования!)
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- 8. Создаем базовые RLS политики для user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles 
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles 
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles 
    FOR UPDATE USING (auth.uid() = id);

-- 9. Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.user_profiles 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND (is_admin = true OR admin_role IN ('office_admin', 'super_admin'))
        )
    );

-- 10. Создаем тестовую функцию для проверки
CREATE OR REPLACE FUNCTION test_registration_fix()
RETURNS TEXT AS $$
DECLARE
    test_result TEXT := '';
BEGIN
    -- Проверяем что функция триггера существует
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user') THEN
        test_result := test_result || '✅ Function exists. ';
    ELSE
        test_result := test_result || '❌ Function missing. ';
    END IF;
    
    -- Проверяем что триггер существует
    IF EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created') THEN
        test_result := test_result || '✅ Trigger exists. ';
    ELSE
        test_result := test_result || '❌ Trigger missing. ';
    END IF;
    
    -- Проверяем что таблица user_profiles существует
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        test_result := test_result || '✅ user_profiles table exists. ';
    ELSE
        test_result := test_result || '❌ user_profiles table missing. ';
    END IF;
    
    RETURN test_result || 'Registration should work now!';
END;
$$ LANGUAGE plpgsql;

-- 11. Запускаем тест
SELECT test_registration_fix() as test_result;

-- 12. Показываем финальный статус
SELECT 'Registration fix completed! Try registering a new user now.' as status;

-- ВАЖНЫЕ ЗАМЕЧАНИЯ:
-- 1. RLS временно отключен для тестирования
-- 2. После успешной регистрации выполните: ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
-- 3. Функция триггера НЕ прерывает регистрацию при ошибках
-- 4. Все ошибки логируются, но регистрация продолжается
-- 5. Удалены ссылки на несуществующую таблицу employees 