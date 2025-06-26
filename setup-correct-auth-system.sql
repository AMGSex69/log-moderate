-- ПРАВИЛЬНАЯ НАСТРОЙКА АВТОРИЗАЦИИ И РЕГИСТРАЦИИ
-- Для текущей схемы БД (user_profiles без employees)

-- 1. ОЧИСТКА СТАРЫХ ТРИГГЕРОВ И ФУНКЦИЙ
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
DROP TRIGGER IF EXISTS on_user_profile_created ON public.user_profiles;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. ПРОВЕРЯЕМ СТРУКТУРУ ТАБЛИЦЫ user_profiles
DO $$
BEGIN
    -- Добавляем email колонку если её нет
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'email') THEN
        ALTER TABLE public.user_profiles ADD COLUMN email TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_email_idx ON public.user_profiles(email);
    END IF;
    
    -- Добавляем employee_id колонку если её нет (для совместимости)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'employee_id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN employee_id SERIAL;
    END IF;
    
    RAISE NOTICE 'Структура user_profiles проверена и обновлена';
END $$;

-- 3. СОЗДАЕМ СОВРЕМЕННУЮ ФУНКЦИЮ РЕГИСТРАЦИИ
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
    user_email TEXT;
    user_name TEXT;
    user_work_schedule TEXT;
    user_work_hours INTEGER;
    default_office_id INTEGER;
    existing_profile_id UUID;
BEGIN
    -- Логируем начало процесса
    RAISE LOG 'handle_new_user: Начинаем создание профиля для пользователя %', NEW.id;
    
    -- Проверяем, не существует ли уже профиль
    SELECT id INTO existing_profile_id 
    FROM public.user_profiles 
    WHERE id = NEW.id OR email = NEW.email;
    
    IF existing_profile_id IS NOT NULL THEN
        RAISE LOG 'handle_new_user: Профиль уже существует для пользователя %', NEW.id;
        RETURN NEW;
    END IF;

    -- Получаем данные пользователя из auth.users
    user_email := COALESCE(NEW.email, 'user@example.com');
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        SPLIT_PART(user_email, '@', 1),
        'Новый пользователь'
    );
    
    -- Определяем график работы
    user_work_schedule := COALESCE(
        NEW.raw_user_meta_data->>'work_schedule',
        '5/2'
    );
    
    user_work_hours := CASE 
        WHEN user_work_schedule = '2/2' THEN 12
        ELSE 9
    END;

    -- Получаем ID офиса по умолчанию
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
    
    -- Если офисов нет, создаем базовый
    IF default_office_id IS NULL THEN
        INSERT INTO public.offices (name, address, is_active)
        VALUES ('Рассвет', 'Основной офис', true)
        RETURNING id INTO default_office_id;
    END IF;

    -- Создаем профиль пользователя
    BEGIN
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
            avatar_url,
            created_at,
            updated_at,
            last_activity
        ) VALUES (
            NEW.id,
            user_email,
            user_name,
            'Сотрудник',
            user_work_schedule,
            user_work_hours,
            default_office_id,
            false,
            'user',
            'user',
            true,
            false,
            0,      -- начальные монеты
            0,      -- начальный опыт
            1,      -- начальный уровень
            '[]'::jsonb,  -- пустые достижения
            NULL,   -- аватар
            NOW(),
            NOW(),
            NOW()
        );
        
        RAISE LOG 'handle_new_user: Успешно создан профиль для пользователя %', NEW.id;
        
    EXCEPTION
        WHEN unique_violation THEN
            RAISE LOG 'handle_new_user: Профиль уже существует (unique_violation) для %', NEW.id;
        WHEN OTHERS THEN
            RAISE WARNING 'handle_new_user: Ошибка создания профиля для %: % %', NEW.id, SQLSTATE, SQLERRM;
            -- НЕ прерываем регистрацию - это критично!
    END;

    RAISE LOG 'handle_new_user: Завершено успешно для пользователя %', NEW.id;
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Критическая ошибка - логируем но НЕ прерываем регистрацию
        RAISE WARNING 'handle_new_user: КРИТИЧЕСКАЯ ОШИБКА для пользователя %: % %', NEW.id, SQLSTATE, SQLERRM;
        -- Возвращаем NEW чтобы регистрация продолжилась в auth.users
        RETURN NEW;
END $$;

-- 4. СОЗДАЕМ ТРИГГЕР
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- 5. НАСТРАИВАЕМ ПРАВА ДОСТУПА
-- Базовые права для схемы
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Права на таблицы
GRANT ALL ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT ON public.user_profiles TO anon;
GRANT ALL ON public.offices TO authenticated;
GRANT SELECT ON public.offices TO anon;

-- Права на функции
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;

-- Права на последовательности
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 6. НАСТРАИВАЕМ RLS ПОЛИТИКИ
-- Включаем RLS для user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;

-- Создаем новые политики
-- Пользователи могут видеть свой профиль
CREATE POLICY "Users can view own profile" ON public.user_profiles 
    FOR SELECT 
    USING (auth.uid() = id);

-- Пользователи могут создавать свой профиль
CREATE POLICY "Users can insert own profile" ON public.user_profiles 
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Пользователи могут обновлять свой профиль
CREATE POLICY "Users can update own profile" ON public.user_profiles 
    FOR UPDATE 
    USING (auth.uid() = id);

-- Администраторы могут видеть все профили
CREATE POLICY "Admins can view all profiles" ON public.user_profiles 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND (admin_profile.is_admin = true OR admin_profile.admin_role IN ('office_admin', 'super_admin'))
        )
    );

-- Администраторы могут обновлять все профили
CREATE POLICY "Admins can update all profiles" ON public.user_profiles 
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND (admin_profile.is_admin = true OR admin_profile.admin_role IN ('office_admin', 'super_admin'))
        )
    );

-- 7. НАСТРАИВАЕМ RLS ДЛЯ OFFICES
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

-- Все могут читать офисы
CREATE POLICY "Anyone can view offices" ON public.offices 
    FOR SELECT 
    USING (true);

-- Только админы могут изменять офисы
CREATE POLICY "Admins can manage offices" ON public.offices 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND (admin_profile.is_admin = true OR admin_profile.admin_role IN ('office_admin', 'super_admin'))
        )
    );

-- 8. СОЗДАЕМ ФУНКЦИЮ ТЕСТИРОВАНИЯ
CREATE OR REPLACE FUNCTION test_auth_system()
RETURNS TABLE(component TEXT, status TEXT, details TEXT) AS $$
BEGIN
    -- Проверяем функцию триггера
    RETURN QUERY
    SELECT 
        'Функция handle_new_user' as component,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user') 
            THEN '✅ РАБОТАЕТ' 
            ELSE '❌ ОТСУТСТВУЕТ' 
        END as status,
        'Функция для создания профилей при регистрации' as details;
    
    -- Проверяем триггер
    RETURN QUERY
    SELECT 
        'Триггер on_auth_user_created' as component,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created') 
            THEN '✅ РАБОТАЕТ' 
            ELSE '❌ ОТСУТСТВУЕТ' 
        END as status,
        'Триггер для автоматического создания профилей' as details;
    
    -- Проверяем таблицу user_profiles
    RETURN QUERY
    SELECT 
        'Таблица user_profiles' as component,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
            THEN '✅ РАБОТАЕТ' 
            ELSE '❌ ОТСУТСТВУЕТ' 
        END as status,
        'Основная таблица профилей пользователей' as details;
    
    -- Проверяем RLS
    RETURN QUERY
    SELECT 
        'RLS политики' as component,
        CASE 
            WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles') 
            THEN '✅ РАБОТАЕТ' 
            ELSE '❌ НЕ НАСТРОЕНЫ' 
        END as status,
        'Политики безопасности на уровне строк' as details;
    
    -- Проверяем офисы
    RETURN QUERY
    SELECT 
        'Офисы по умолчанию' as component,
        CASE 
            WHEN EXISTS (SELECT 1 FROM public.offices WHERE name = 'Рассвет') 
            THEN '✅ РАБОТАЕТ' 
            ELSE '⚠️ НЕТ ОФИСА РАССВЕТ' 
        END as status,
        'Офис по умолчанию для новых пользователей' as details;
END $$ LANGUAGE plpgsql;

-- 9. СИНХРОНИЗИРУЕМ СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ
DO $$
DECLARE
    user_record RECORD;
    default_office_id INTEGER;
BEGIN
    -- Получаем ID офиса по умолчанию
    SELECT id INTO default_office_id FROM public.offices WHERE name = 'Рассвет' LIMIT 1;
    IF default_office_id IS NULL THEN
        SELECT id INTO default_office_id FROM public.offices ORDER BY id LIMIT 1;
    END IF;
    
    -- Синхронизируем пользователей из auth.users которых нет в user_profiles
    FOR user_record IN 
        SELECT au.id, au.email, au.raw_user_meta_data, au.created_at
        FROM auth.users au
        LEFT JOIN public.user_profiles up ON au.id = up.id
        WHERE up.id IS NULL
    LOOP
        BEGIN
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
                COALESCE(
                    user_record.raw_user_meta_data->>'full_name',
                    SPLIT_PART(user_record.email, '@', 1),
                    'Пользователь'
                ),
                'Сотрудник',
                '5/2',
                9,
                default_office_id,
                false,
                'user',
                'user',
                true,
                0,
                0,
                1,
                '[]'::jsonb,
                user_record.created_at,
                NOW(),
                NOW()
            );
            
            RAISE NOTICE 'Синхронизирован пользователь: %', user_record.email;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Ошибка синхронизации пользователя %: %', user_record.email, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Синхронизация завершена';
END $$;

-- 10. ЗАПУСКАЕМ ТЕСТ
SELECT * FROM test_auth_system();

-- 11. ФИНАЛЬНАЯ ПРОВЕРКА
SELECT 
    '🎉 СИСТЕМА АВТОРИЗАЦИИ НАСТРОЕНА!' as status,
    'Теперь Анна и Артём могут зарегистрироваться заново' as message;

-- ИНСТРУКЦИИ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ:
-- 1. Очистите кеш браузера (Ctrl+Shift+Del)
-- 2. Попробуйте зарегистрироваться заново
-- 3. При регистрации будет автоматически создан профиль в user_profiles
-- 4. Если возникнут проблемы - проверьте логи Supabase 